/**
 * 賃金構造基本統計調査 年齢階級別×学歴別CSVパーサー
 *
 * 対象ファイル形式: (1-1-1)aa1n11 系
 * 表題: 第１表 年齢階級別きまって支給する現金給与額、所定内給与額及び年間賞与その他特別給与額
 *
 * CSVフォーマット:
 *   col[0]: 空
 *   col[1]: 民公区分等メタ列（使用しない）
 *   col[2]: ラベル列（性別+学歴の組み合わせ or 年齢階級）
 *           例: "男　女　計\n学　歴　計" → sex=計, education=学歴計, age_group=学歴計（集計行）
 *               "　　～１９歳"           → age_group=～19歳（現在の学歴を引き継ぐ）
 *               "中　学"                 → education=中学, age_group=中学（集計行）
 *               "　　男\n学　歴　計"     → sex=男
 *   col[3..10]:  企業規模計ブロック
 *   col[11..18]: 1,000人以上ブロック
 *   col[19..26]: 100～999人ブロック
 *   col[27..34]: 10～99人ブロック
 *
 *   各ブロック8列: 年齢, 勤続年数, 所定内時間, 超過時間, 月給, 所定内給与, 賞与, 労働者数（十人）
 *
 * 学歴ラベル（CSV上の表記 → 正規化後）:
 *   男女計/男/女 + 学歴計、中学、高校、専門学校、高専・短大、大学、大学院、不明
 */

export interface AgeWageRow {
  sex:             '計' | '男' | '女'
  education:       string   // 学歴計・中学・高校・専門学校・高専・短大・大学・大学院・不明
  age_group:       string   // 学歴計（集計行）or ～19歳・20～24歳 etc.
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
  if (!s) return null
  const cleaned = s.replace(/[\s,]/g, '').trim()
  if (cleaned === '-' || cleaned === '') return null
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

function parseInt2(s: string): number | null {
  if (!s) return null
  // 労働者数は「2 892 371」のようにスペース区切りで記載されることがある
  const cleaned = s.replace(/[\s,]/g, '').trim()
  if (cleaned === '-' || cleaned === '') return null
  const n = parseInt(cleaned, 10)
  return isNaN(n) ? null : n
}

/** 全角数字・全角スペース・改行を正規化して比較用に使う */
function normalizeLabel(s: string): string {
  return s
    .replace(/[\r\n]/g, '')
    .replace(/\u3000/g, ' ')   // 全角スペース → 半角
    .replace(/\s+/g, '')        // 全スペース除去
    .trim()
}

/** 年齢階級ラベルの正規化（全角数字→半角、全角チルダ統一） */
function normalizeAgeGroup(raw: string): string {
  return raw
    .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/～/g, '～')
    .replace(/〜/g, '～')
    .replace(/~/g, '～')
    .replace(/^[\s　]+/, '')
    .trim()
}

/** 学歴ラベルのCSV表記 → 正規化名マップ */
const EDUCATION_MAP: Record<string, string> = {
  '学歴計':    '学歴計',
  '中学':      '中学',
  '高校':      '高校',
  '専門学校':  '専門学校',
  '高専・短大': '高専・短大',
  '高専短大':  '高専・短大',
  '大学':      '大学',
  '大学院':    '大学院',
  '不明':      '不明',
}

/** ラベルセル（col[2]）から性別・学歴・年齢階級を解析 */
function parseLabel(raw: string): {
  sex:       '計' | '男' | '女' | null
  education: string | null
  ageGroup:  string | null
} {
  // 改行で分割して各部分を正規化
  const lines = raw.split(/\n/).map(l => normalizeLabel(l)).filter(l => l !== '')

  let sex:       '計' | '男' | '女' | null = null
  let education: string | null = null
  let ageGroup:  string | null = null

  for (const line of lines) {
    // 性別判定
    if (line === '男女計' || line === '男女') { sex = '計'; continue }
    if (line === '男') { sex = '男'; continue }
    if (line === '女') { sex = '女'; continue }

    // 学歴判定（全角スペース除去済みの形で比較）
    const edNorm = line.replace(/[　\s]/g, '')
    const edKey = Object.keys(EDUCATION_MAP).find(k => edNorm === k.replace(/[　\s]/g, ''))
    if (edKey) {
      education = EDUCATION_MAP[edKey]
      continue
    }

    // 年齢階級判定（数字を含む、または「～」「歳」を含む）
    const ageRaw = raw.split(/\n/).find(l => {
      const norm = normalizeLabel(l)
      return /[0-9０-９〜～歳]/.test(norm) && !/^[男女]/.test(norm)
    })
    if (ageRaw) {
      ageGroup = normalizeAgeGroup(ageRaw.trim())
    }
  }

  return { sex, education, ageGroup }
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
        if (csvText[i + 1] === '"') { field += '"'; i += 2 }
        else { inQuotes = false; i++ }
      } else { field += ch; i++ }
    } else {
      if (ch === '"') { inQuotes = true; i++ }
      else if (ch === ',') { row.push(field); field = ''; i++ }
      else if (ch === '\r' && csvText[i + 1] === '\n') {
        row.push(field); field = ''; rows.push(row); row = []; i += 2
      } else if (ch === '\n' || ch === '\r') {
        row.push(field); field = ''; rows.push(row); row = []; i++
      } else { field += ch; i++ }
    }
  }
  if (field || row.length > 0) { row.push(field); rows.push(row) }
  return rows
}

// -------------------- メインパーサー --------------------

const ENTERPRISE_SIZES: Array<{ label: AgeWageRow['enterprise_size']; start: number }> = [
  { label: '企業規模計',   start: 3  },
  { label: '1,000人以上', start: 11 },
  { label: '100～999人',  start: 19 },
  { label: '10～99人',    start: 27 },
]

function extractBlock(
  row: AgeWageRow,
  cols: string[],
  start: number,
  enterpriseSize: AgeWageRow['enterprise_size'],
): AgeWageRow | null {
  const block = cols.slice(start, start + 8)
  const hasData = block.some(c => {
    const t = (c || '').replace(/[\s,]/g, '').trim()
    return t !== '' && t !== '-'
  })
  if (!hasData) return null

  const monthlyWage  = parseNum(block[4])
  const scheduledWage = parseNum(block[5])
  const annualBonus  = parseNum(block[6])
  const annualIncome = monthlyWage !== null && annualBonus !== null
    ? Math.round((monthlyWage * 12 + annualBonus) * 10) / 10
    : null

  return {
    ...row,
    enterprise_size: enterpriseSize,
    age:             parseNum(block[0]),
    tenure_years:    parseNum(block[1]),
    scheduled_hours: parseNum(block[2]),
    overtime_hours:  parseNum(block[3]),
    monthly_wage:    monthlyWage,
    scheduled_wage:  scheduledWage,
    annual_bonus:    annualBonus,
    workers:         parseInt2(block[7]),
    annual_income:   annualIncome,
  }
}

/**
 * 年齢階級別CSVをパースして AgeWageRow[] を返す
 */
export function parseAgeWageCsv(csvText: string): AgeWageRow[] {
  const allRows = parseFullCsv(csvText)
  const results: AgeWageRow[] = []

  // データ開始行を動的に検出（「区　分」または数値データが始まる行）
  let dataStart = 9  // デフォルト（論理行9から）
  for (let r = 0; r <= Math.min(20, allRows.length - 1); r++) {
    const col2 = normalizeLabel(allRows[r]?.[2] ?? '')
    if (col2.includes('男女計') && col2.includes('学歴計')) {
      dataStart = r
      break
    }
  }

  let currentSex:       '計' | '男' | '女' = '計'
  let currentEducation: string = '学歴計'

  for (let i = dataStart; i < allRows.length; i++) {
    const cols = allRows[i]
    if (!cols || cols.length < 4) continue

    const rawLabel = cols[2] ?? ''
    if (!rawLabel.trim()) continue

    const { sex, education, ageGroup } = parseLabel(rawLabel)

    // 性別の更新
    if (sex !== null) currentSex = sex

    // 学歴の更新
    if (education !== null) currentEducation = education

    // 年齢階級の決定
    let finalAgeGroup: string
    if (ageGroup !== null && ageGroup !== '') {
      finalAgeGroup = ageGroup
    } else if (education !== null) {
      // 学歴ラベル行自体が集計行 → age_group = 学歴計
      finalAgeGroup = '学歴計'
    } else {
      continue  // 解析不能な行はスキップ
    }

    // 全企業規模ブロックでデータがあるかチェック
    const anyData = ENTERPRISE_SIZES.some(({ start }) =>
      cols.slice(start, start + 8).some(c => {
        const t = (c || '').replace(/[\s,]/g, '').trim()
        return t !== '' && t !== '-'
      })
    )
    if (!anyData) continue

    const baseRow: AgeWageRow = {
      sex:             currentSex,
      education:       currentEducation,
      age_group:       finalAgeGroup,
      enterprise_size: '企業規模計',
      age:             null,
      tenure_years:    null,
      scheduled_hours: null,
      overtime_hours:  null,
      monthly_wage:    null,
      scheduled_wage:  null,
      annual_bonus:    null,
      workers:         null,
      annual_income:   null,
    }

    for (const { label, start } of ENTERPRISE_SIZES) {
      const extracted = extractBlock(baseRow, cols, start, label)
      if (extracted) results.push(extracted)
    }
  }

  return results
}
