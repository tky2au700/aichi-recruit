/**
 * 賃金構造基本統計調査 年齢階級別×学歴別CSVパーサー
 * 対象: (1-1-1)aa1n11 系 第１表
 *
 * 実CSV構造（RFC4180パース後の論理行）:
 *   論理行0-8:  ヘッダー（スキップ）
 *   論理行9〜:  データ行
 *     col[0]: 空
 *     col[1]: 空
 *     col[2]: ラベル（セル内\nで性別+学歴、または年齢階級のみ）
 *       例: "男　女　計\n学　歴　計" / "　　～１９歳" / "中　学"
 *     col[3-10]:  企業規模計ブロック（8列: 年齢,勤続,所定内時間,超過時間,月給,所定内給与,賞与,労働者数）
 *     col[11-18]: 1,000人以上ブロック
 *     col[19-26]: 100～999人ブロック
 *     col[27-34]: 10～99人ブロック
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
  // スペース（全角・半角）と , を除去してparseFloat
  const cleaned = (s ?? '').replace(/[\s　,]/g, '').trim()
  if (!cleaned || cleaned === '-' || cleaned === '…' || cleaned === '**') return null
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

/** 全角→半角変換 + 空白除去 */
function norm(s: string): string {
  return s
    .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/[　\s\r\n]+/g, '')
    .trim()
}

// -------------------- RFC4180準拠CSVパーサー --------------------

function parseFullCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQ = false
  let i = 0
  while (i < text.length) {
    const ch = text[i]
    if (inQ) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i += 2 }
      else if (ch === '"') { inQ = false; i++ }
      else { field += ch; i++ }
    } else {
      if (ch === '"') { inQ = true; i++ }
      else if (ch === ',') { row.push(field); field = ''; i++ }
      else if (ch === '\r' && text[i + 1] === '\n') { row.push(field); field = ''; rows.push(row); row = []; i += 2 }
      else if (ch === '\r' || ch === '\n') { row.push(field); field = ''; rows.push(row); row = []; i++ }
      else { field += ch; i++ }
    }
  }
  if (row.length > 0 || field) { row.push(field); rows.push(row) }
  return rows
}

// -------------------- ラベル解析 --------------------

const SEX_MAP: Record<string, '計' | '男' | '女'> = {
  '男女計': '計',
  '男女': '計',
  '男性': '男',
  '女性': '女',
  '男': '男',
  '女': '女',
}

const EDU_MAP: Record<string, string> = {
  '学歴計': '学歴計',
  '中学': '中学',
  '高校': '高校',
  '専門学校': '専門学校',
  '高専短大': '高専・短大',
  '高専・短大': '高専・短大',
  '大学': '大学',
  '大学院': '大学院',
  '不明': '不明',
}

type ParsedLabel = {
  sex: '計' | '男' | '女' | null
  education: string | null
  ageGroup: string | null
}

function parseLabel(raw: string): ParsedLabel {
  const result: ParsedLabel = { sex: null, education: null, ageGroup: null }

  // セル内改行で分割して各部分を解析
  const parts = raw.split('\n').map(p => p.trim()).filter(p => p !== '')

  for (const part of parts) {
    const n = norm(part)

    // 性別チェック
    if (result.sex === null) {
      for (const [key, val] of Object.entries(SEX_MAP)) {
        if (n === key) { result.sex = val; break }
      }
    }

    // 学歴チェック
    if (result.education === null) {
      const edu = EDU_MAP[n]
      if (edu) result.education = edu
    }

    // 年齢階級チェック: 先頭スペースがある or 数字を含む
    if (result.ageGroup === null) {
      // 全角数字→半角変換して年齢パターンを検出
      const ageNorm = part
        .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
        .replace(/〜|~/g, '～')
        .replace(/[　\s]+/g, '')
        .trim()
      // ～数字歳、数字～数字歳、数字以上 のパターン
      if (/^[～～]?[0-9]+/.test(ageNorm) && (ageNorm.includes('歳') || ageNorm.includes('～') || /[0-9]+$/.test(ageNorm))) {
        result.ageGroup = ageNorm
      }
    }
  }

  return result
}

// -------------------- ブロック抽出 --------------------

type EnterpriseSize = AgeWageRow['enterprise_size']

const BLOCKS: Array<{ label: EnterpriseSize; start: number }> = [
  { label: '企業規模計',   start: 3  },
  { label: '1,000人以上', start: 11 },
  { label: '100～999人',  start: 19 },
  { label: '10～99人',    start: 27 },
]

function buildRow(
  base: Pick<AgeWageRow, 'sex' | 'education' | 'age_group'>,
  cols: string[],
  start: number,
  enterpriseSize: EnterpriseSize,
): AgeWageRow | null {
  const b = cols.slice(start, start + 8)
  const hasData = b.some(c => {
    const t = (c ?? '').replace(/[\s　,]/g, '').trim()
    return t !== '' && t !== '-' && t !== '…' && t !== '**'
  })
  if (!hasData) return null

  const monthly   = parseNum(b[4] ?? '')
  const scheduled = parseNum(b[5] ?? '')
  const bonus     = parseNum(b[6] ?? '')
  const annual    = monthly !== null && bonus !== null
    ? Math.round((monthly * 12 + bonus) * 10) / 10
    : null

  return {
    ...base,
    enterprise_size: enterpriseSize,
    age:             parseNum(b[0] ?? ''),
    tenure_years:    parseNum(b[1] ?? ''),
    scheduled_hours: parseNum(b[2] ?? ''),
    overtime_hours:  parseNum(b[3] ?? ''),
    monthly_wage:    monthly,
    scheduled_wage:  scheduled,
    annual_bonus:    bonus,
    workers:         parseNum(b[7] ?? ''),
    annual_income:   annual,
  }
}

// -------------------- メインパーサー --------------------

export function parseAgeWageCsv(csvText: string): AgeWageRow[] {
  const logicalRows = parseFullCsv(csvText)
  const results: AgeWageRow[] = []

  // データ開始行: col[3]以降に数値が複数ある最初の行（ヘッダーは単位行等で構成）
  // 「年」「時間」「千円」のような単位行を除き、実際の数値データ行を検出
  let dataStart = -1
  for (let r = 5; r < logicalRows.length; r++) {
    const cols = logicalRows[r]
    if (!cols || cols.length < 12) continue
    // col[3]が純粋な数値（年齢）であれば開始
    const col3 = (cols[3] ?? '').replace(/[\s　,]/g, '').trim()
    const num3 = parseFloat(
      col3.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    )
    if (!isNaN(num3) && num3 > 10 && num3 < 80) {
      dataStart = r
      break
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

    // col[3]が実数値かチェック（データ行の確認）
    const col3 = (cols[3] ?? '').replace(/[\s　,]/g, '').trim()
    const col3Norm = col3.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    const isDataRow = !isNaN(parseFloat(col3Norm)) && parseFloat(col3Norm) > 0

    if (!isDataRow) continue

    const parsed = parseLabel(rawLabel)

    // 性別の更新
    if (parsed.sex !== null) currentSex = parsed.sex

    // 学歴の更新
    if (parsed.education !== null) currentEducation = parsed.education

    // age_group の決定
    let finalAgeGroup: string
    if (parsed.ageGroup !== null) {
      finalAgeGroup = parsed.ageGroup
    } else if (parsed.education !== null) {
      // 学歴行（年齢なし）→ 集計行
      finalAgeGroup = '学歴計'
    } else {
      // どちらも取れなかった場合はスキップ
      continue
    }

    const base = {
      sex:       currentSex,
      education: currentEducation,
      age_group: finalAgeGroup,
    }

    for (const { label, start } of BLOCKS) {
      const row = buildRow(base, cols, start, label)
      if (row) results.push(row)
    }
  }

  return results
}
