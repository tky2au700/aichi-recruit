/**
 * 賃金構造基本統計調査 年齢階級別×学歴別CSVパーサー
 * 対象: (1-1-1)aa1n11 系 第１表
 *
 * 論理行構造（RFC4180 CSVとして解析後）:
 *   論理行0-7: ヘッダー（スキップ）
 *   論理行8:   列ヘッダー（企業規模計, 1000人以上, 100-999人, 10-99人 の8列×4ブロック）
 *   論理行9-:  データ行
 *     col[0]: 空
 *     col[1]: 民公区分等（スキップ）
 *     col[2]: ラベル（"男　女　計\n学　歴　計" 等のセル内改行あり）
 *     col[3-10]:  企業規模計ブロック（年齢,勤続,所定内時間,超過時間,月給,所定内給与,賞与,労働者数）
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
  const cleaned = (s || '').replace(/[\s,　]/g, '').trim()
  if (!cleaned || cleaned === '-' || cleaned === '…') return null
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

/** 全角数字→半角、全角スペース・改行を除去して正規化 */
function normalize(s: string): string {
  return s
    .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/[\r\n]/g, '')
    .replace(/[　\s]+/g, '')
    .trim()
}

/** 年齢階級ラベル: 全角数字→半角、全角チルダ統一、前後スペース除去 */
function normalizeAgeGroup(raw: string): string {
  return raw
    .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/〜|~/g, '～')
    .replace(/^[　\s]+/, '')
    .replace(/[　\s]+$/, '')
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

// -------------------- ラベル解析 --------------------

/** 性別マップ */
const SEX_PATTERNS: Array<{ pat: RegExp; val: '計' | '男' | '女' }> = [
  { pat: /男女計|男　女　計|男女/,   val: '計' },
  { pat: /^男$/,                      val: '男' },
  { pat: /^女$/,                      val: '女' },
]

/** 学歴マップ（全角スペース除去済みキーで比較） */
const EDUCATION_MAP: Record<string, string> = {
  '学歴計':    '学歴計',
  '中学':      '中学',
  '高校':      '高校',
  '専門学校':  '専門学校',
  '高専・短大':'高専・短大',
  '高専短大':  '高専・短大',
  '大学':      '大学',
  '大学院':    '大学院',
  '不明':      '不明',
}

/**
 * ラベルセル（col[2]）を解析して性別・学歴・年齢階級を返す
 *
 * セル内容例:
 *   "男　女　計\n学　歴　計"  → sex=計, education=学歴計, ageGroup=null（集計行）
 *   "　　～１９歳"             → sex=null, education=null, ageGroup=～19歳
 *   "中　学"                   → sex=null, education=中学, ageGroup=null
 *   "　　男\n学　歴　計"       → sex=男, education=学歴計, ageGroup=null
 */
function parseLabel(raw: string): {
  sex:       '計' | '男' | '女' | null
  education: string | null
  ageGroup:  string | null
} {
  // セル内改行で分割
  const parts = raw.split(/\n/).map(p => p.trim()).filter(p => p !== '')

  let sex:       '計' | '男' | '女' | null = null
  let education: string | null = null
  let ageGroup:  string | null = null

  for (const part of parts) {
    const norm = normalize(part)

    // 性別チェック
    for (const { pat, val } of SEX_PATTERNS) {
      if (pat.test(norm)) { sex = val; break }
    }

    // 学歴チェック（全角スペース除去して比較）
    const edKey = normalize(part).replace(/[　\s]/g, '')
    const matched = Object.keys(EDUCATION_MAP).find(k => normalize(k) === edKey || k.replace(/[　\s]/g, '') === edKey)
    if (matched) {
      education = EDUCATION_MAP[matched]
    }

    // 年齢階級チェック（先頭スペース付き＝年齢階級の行、または数字を含む）
    // 先頭が全角スペース or 半角スペースで始まる → 年齢階級サブ行
    const raw_part = part
    if (/^[　\s]/.test(raw_part) && /[0-9０-９～〜歳]/.test(raw_part)) {
      ageGroup = normalizeAgeGroup(raw_part)
    } else if (/^[0-9０-９]/.test(norm) && /[歳～〜]/.test(norm)) {
      // 先頭が数字で年齢階級っぽい
      ageGroup = normalizeAgeGroup(raw_part)
    }
  }

  return { sex, education, ageGroup }
}

// -------------------- ブロック抽出 --------------------

const ENTERPRISE_SIZES: Array<{ label: AgeWageRow['enterprise_size']; start: number }> = [
  { label: '企業規模計',   start: 3  },
  { label: '1,000人以上', start: 11 },
  { label: '100～999人',  start: 19 },
  { label: '10～99人',    start: 27 },
]

function extractBlock(
  base: Omit<AgeWageRow, 'enterprise_size' | 'age' | 'tenure_years' | 'scheduled_hours' | 'overtime_hours' | 'monthly_wage' | 'scheduled_wage' | 'annual_bonus' | 'workers' | 'annual_income'>,
  cols: string[],
  start: number,
  enterpriseSize: AgeWageRow['enterprise_size'],
): AgeWageRow | null {
  const block = cols.slice(start, start + 8)
  const hasData = block.some(c => {
    const t = (c || '').replace(/[\s,　]/g, '').trim()
    return t !== '' && t !== '-' && t !== '…'
  })
  if (!hasData) return null

  const monthlyWage   = parseNum(block[4] ?? '')
  const scheduledWage = parseNum(block[5] ?? '')
  const annualBonus   = parseNum(block[6] ?? '')
  const annualIncome  = monthlyWage !== null && annualBonus !== null
    ? Math.round((monthlyWage * 12 + annualBonus) * 10) / 10
    : null

  return {
    ...base,
    enterprise_size: enterpriseSize,
    age:             parseNum(block[0] ?? ''),
    tenure_years:    parseNum(block[1] ?? ''),
    scheduled_hours: parseNum(block[2] ?? ''),
    overtime_hours:  parseNum(block[3] ?? ''),
    monthly_wage:    monthlyWage,
    scheduled_wage:  scheduledWage,
    annual_bonus:    annualBonus,
    workers:         parseNum(block[7] ?? ''),
    annual_income:   annualIncome,
  }
}

// -------------------- メインパーサー --------------------

export function parseAgeWageCsv(csvText: string): AgeWageRow[] {
  const logicalRows = parseFullCsv(csvText)
  const results: AgeWageRow[] = []

  // データ開始行を動的検出: col[2]に「男女計」かつ「学歴計」を含む最初の行
  let dataStart = -1
  for (let r = 0; r < Math.min(30, logicalRows.length); r++) {
    const label = logicalRows[r]?.[2] ?? ''
    const norm = normalize(label)
    if (norm.includes('男女計') || norm.includes('男女')) {
      dataStart = r
      break
    }
  }
  // 見つからなければ論理行9を試す
  if (dataStart === -1) dataStart = 9

  let currentSex:       '計' | '男' | '女' = '計'
  let currentEducation: string = '学歴計'

  for (let i = dataStart; i < logicalRows.length; i++) {
    const cols = logicalRows[i]
    if (!cols || cols.length < 12) continue

    const rawLabel = cols[2] ?? ''
    if (!rawLabel.trim()) continue

    // 空行スキップ
    const anyNonEmpty = cols.slice(3).some(c => (c || '').trim() !== '')
    if (!anyNonEmpty) continue

    const { sex, education, ageGroup } = parseLabel(rawLabel)

    // 性別が変わったら更新
    if (sex !== null) currentSex = sex

    // 学歴が変わったら更新
    if (education !== null) currentEducation = education

    // age_group の決定
    let finalAgeGroup: string
    if (ageGroup !== null && ageGroup !== '') {
      finalAgeGroup = ageGroup
    } else if (education !== null) {
      // 学歴ラベル行 → 集計行として age_group = 学歴計
      finalAgeGroup = '学歴計'
    } else if (sex !== null && education === null && ageGroup === null) {
      // 性別ラベル行（性別切り替え行）は skip（次の行で学歴/年齢が来る）
      continue
    } else {
      continue
    }

    const base = {
      sex:       currentSex,
      education: currentEducation,
      age_group: finalAgeGroup,
    }

    for (const { label, start } of ENTERPRISE_SIZES) {
      const extracted = extractBlock(base, cols, start, label)
      if (extracted) results.push(extracted)
    }
  }

  return results
}
