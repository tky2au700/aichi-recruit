/**
 * 賃金構造基本統計調査 年齢階級別×学歴別CSVパーサー
 * 対象: (1-1-1)aa1n11 系 第１表
 *
 * CSV論理行構造（RFC4180パース後）:
 *   論理行0-8:  ヘッダー（スキップ）
 *   論理行9:    集計行 (col[2]に学歴計が入る最初の行)
 *   論理行9以降のデータ行:
 *     col[0]: 空
 *     col[1]: 空 or 民公区分
 *     col[2]: ラベル (例: "学　歴　計", "　　～１９歳", "中　学" 等)
 *     col[3-10]:  企業規模計ブロック (年齢,勤続,所定内時間,超過時間,月給,所定内給与,賞与,労働者数)
 *     col[11-18]: 1,000人以上ブロック
 *     col[19-26]: 100～999人ブロック
 *     col[27-34]: 10～99人ブロック
 *
 * ラベル行の種類:
 *   学歴行  (col[2]="学　歴　計","中　学"等): その学歴の集計行 (age_group='学歴計')
 *   年齢行  (col[2]に先頭スペース + 年齢): その学歴の年齢階級別行
 *
 * 性別ブロック: CSVは男女計→男→女の順で全学歴を繰り返す
 *   性別行は col[2]="男　女　計"等のみのセル内改行行として来る
 */

export interface AgeWageRow {
  sex:             '計' | '男' | '女'
  education:       string
  age_group:       string
  enterprise_size: '企業規模計' | '1,000人以上' | '100～999人' | '10～99人'
  age:             number | null
  tenure_years:    number | null
  scheduled_hours: number | null
  overtime_hours:  number | null
  monthly_wage:    number | null
  scheduled_wage:  number | null
  annual_bonus:    number | null
  workers:         number | null
  annual_income:   number | null
}

// -------------------- ユーティリティ --------------------

function parseNum(s: string): number | null {
  const cleaned = (s ?? '').replace(/[\s,　]/g, '').trim()
  if (!cleaned || cleaned === '-' || cleaned === '…' || cleaned === '**') return null
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

/** 全角数字→半角、全角スペースを除去して正規化 */
function normalize(s: string): string {
  return s
    .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/[　\s\r\n]+/g, '')
    .trim()
}

// -------------------- RFC4180準拠CSVパーサー --------------------

function parseFullCsv(csvText: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0

  while (i < csvText.length) {
    const ch = csvText[i]
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < csvText.length && csvText[i + 1] === '"') {
          field += '"'; i += 2
        } else {
          inQuotes = false; i++
        }
      } else {
        field += ch; i++
      }
    } else {
      if (ch === '"') {
        inQuotes = true; i++
      } else if (ch === ',') {
        row.push(field); field = ''; i++
      } else if (ch === '\r' && i + 1 < csvText.length && csvText[i + 1] === '\n') {
        row.push(field); field = ''; rows.push(row); row = []; i += 2
      } else if (ch === '\n' || ch === '\r') {
        row.push(field); field = ''; rows.push(row); row = []; i++
      } else {
        field += ch; i++
      }
    }
  }
  if (row.length > 0 || field !== '') {
    row.push(field); rows.push(row)
  }
  return rows
}

// -------------------- ラベル分類 --------------------

/** 学歴名の正規化マップ（全角スペース除去済み → 正式名） */
const EDUCATION_MAP: Record<string, string> = {
  '学歴計':   '学歴計',
  '中学':     '中学',
  '高校':     '高校',
  '専門学校': '専門学校',
  '高専短大': '高専・短大',
  '高専・短大':'高専・短大',
  '大学':     '大学',
  '大学院':   '大学院',
  '不明':     '不明',
}

/** 性別判定 */
function parseSex(norm: string): '計' | '男' | '女' | null {
  if (norm.includes('男女計') || norm.includes('男女')) return '計'
  if (norm === '男') return '男'
  if (norm === '女') return '女'
  return null
}

/** 学歴判定 */
function parseEducation(norm: string): string | null {
  return EDUCATION_MAP[norm] ?? null
}

/** 年齢階級判定: 全角数字→半角変換後、数字+歳/チルダを含む */
function parseAgeGroup(raw: string): string | null {
  // 先頭スペース付きの年齢階級行
  const trimmed = raw.replace(/^[　\s]+/, '').replace(/[　\s]+$/, '')
  const norm = trimmed
    .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/〜|~/g, '～')
    .trim()
  // 数字を含み、歳または～を含む
  if (/[0-9]/.test(norm) && (/歳|～/.test(norm) || /^[0-9]/.test(norm))) {
    return norm
  }
  return null
}

// -------------------- ブロック抽出 --------------------

type EnterpriseSize = AgeWageRow['enterprise_size']

const BLOCKS: Array<{ label: EnterpriseSize; start: number }> = [
  { label: '企業規模計',   start: 3  },
  { label: '1,000人以上', start: 11 },
  { label: '100～999人',  start: 19 },
  { label: '10～99人',    start: 27 },
]

function extractBlock(
  base: Pick<AgeWageRow, 'sex' | 'education' | 'age_group'>,
  cols: string[],
  blockStart: number,
  enterpriseSize: EnterpriseSize,
): AgeWageRow | null {
  const b = cols.slice(blockStart, blockStart + 8)
  // データが全て空・ハイフンならスキップ
  const hasData = b.some(c => {
    const t = (c ?? '').replace(/[\s,　]/g, '').trim()
    return t !== '' && t !== '-' && t !== '…' && t !== '**'
  })
  if (!hasData) return null

  const monthlyWage   = parseNum(b[4] ?? '')
  const scheduledWage = parseNum(b[5] ?? '')
  const annualBonus   = parseNum(b[6] ?? '')
  const annualIncome  = monthlyWage !== null && annualBonus !== null
    ? Math.round((monthlyWage * 12 + annualBonus) * 10) / 10
    : null

  return {
    ...base,
    enterprise_size: enterpriseSize,
    age:             parseNum(b[0] ?? ''),
    tenure_years:    parseNum(b[1] ?? ''),
    scheduled_hours: parseNum(b[2] ?? ''),
    overtime_hours:  parseNum(b[3] ?? ''),
    monthly_wage:    monthlyWage,
    scheduled_wage:  scheduledWage,
    annual_bonus:    annualBonus,
    workers:         parseNum(b[7] ?? ''),
    annual_income:   annualIncome,
  }
}

// -------------------- メインパーサー --------------------

export function parseAgeWageCsv(csvText: string): AgeWageRow[] {
  const logicalRows = parseFullCsv(csvText)
  const results: AgeWageRow[] = []

  // データ開始行を検出: col[2]が「学歴計」を含む最初の行
  // （ヘッダーのセル内改行を含む行はcol[2]が短い/空のためスキップされる）
  let dataStart = -1
  for (let r = 0; r < logicalRows.length; r++) {
    const label = logicalRows[r]?.[2] ?? ''
    const norm = normalize(label)
    // col[3]以降に数値データがある行が最初のデータ行
    const cols = logicalRows[r]
    if (cols && cols.length >= 12) {
      const hasNumbers = cols.slice(3, 12).some(c => {
        const t = (c ?? '').replace(/[\s,　]/g, '').trim()
        return /^[0-9]/.test(t)
      })
      if (hasNumbers && (norm.includes('学歴計') || norm.includes('中学') || norm.includes('高校') || norm.includes('男女計') || norm.includes('男女'))) {
        dataStart = r
        break
      }
    }
  }
  if (dataStart === -1) {
    // フォールバック: 数値データが35列以上ある最初の行
    for (let r = 5; r < logicalRows.length; r++) {
      const cols = logicalRows[r]
      if (cols && cols.length >= 30) {
        const numCount = cols.slice(3).filter(c => /^[\s,0-9]+$/.test((c ?? '').trim()) && (c ?? '').trim() !== '').length
        if (numCount >= 10) { dataStart = r; break }
      }
    }
  }
  if (dataStart === -1) return []

  let currentSex: '計' | '男' | '女' = '計'
  let currentEducation = '学歴計'

  for (let i = dataStart; i < logicalRows.length; i++) {
    const cols = logicalRows[i]
    if (!cols || cols.length < 12) continue

    const rawLabel = cols[2] ?? ''
    if (!rawLabel.trim()) continue

    // セル内改行で分割してラベルを解析
    const labelParts = rawLabel.split('\n').map(p => p.trim()).filter(p => p !== '')

    let rowSex:       '計' | '男' | '女' | null = null
    let rowEducation: string | null = null
    let rowAgeGroup:  string | null = null

    for (const part of labelParts) {
      const norm = normalize(part)
      const sex = parseSex(norm)
      if (sex !== null) rowSex = sex

      const edu = parseEducation(norm)
      if (edu !== null) rowEducation = edu

      const ag = parseAgeGroup(part)
      if (ag !== null) rowAgeGroup = ag
    }

    // 性別のみの行（切り替え行）はスキップして状態を更新
    if (rowSex !== null && rowEducation === null && rowAgeGroup === null) {
      currentSex = rowSex
      // ただし数値データがある場合はその行も出力する（学歴計と兼用の場合）
      const hasNumbers = cols.slice(3, 12).some(c => /^[\s]*[0-9]/.test((c ?? '').replace(/,/g, '')))
      if (!hasNumbers) continue
      // 数値があれば学歴計として扱う
      rowEducation = '学歴計'
      rowAgeGroup = '学歴計'
    }

    if (rowSex !== null) currentSex = rowSex
    if (rowEducation !== null) currentEducation = rowEducation

    // age_group の決定
    let finalAgeGroup: string
    if (rowAgeGroup !== null && rowAgeGroup !== '') {
      finalAgeGroup = rowAgeGroup
    } else if (rowEducation !== null) {
      finalAgeGroup = '学歴計'
    } else {
      // 年齢ラベルが取れなかった場合: col[2]をそのまま年齢として試みる
      const ag2 = parseAgeGroup(rawLabel)
      if (ag2) {
        finalAgeGroup = ag2
      } else {
        continue
      }
    }

    const base = {
      sex:       currentSex,
      education: currentEducation,
      age_group: finalAgeGroup,
    }

    for (const { label, start } of BLOCKS) {
      const row = extractBlock(base, cols, start, label)
      if (row) results.push(row)
    }
  }

  return results
}
