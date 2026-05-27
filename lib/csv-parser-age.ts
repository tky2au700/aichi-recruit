/**
 * 賃金構造基本統計調査 年齢階級別×学歴別CSVパーサー
 * 対象: (1-1-1)aa1n11 系 第１表
 *
 * フォーマット A（2025年〜）:
 *   - 集計行: cols[1] に "男　女　計\n学　歴　計" 形式（全角スペース）、cols[2] は空、cols[3]〜 が数値
 *   - 学歴行: cols[1] は空、cols[2] に "中　学" 等（全角スペース）、cols[3]〜 が数値
 *   - 年齢行: cols[1] は空、cols[2] に "　　～１９歳" 等、cols[3]〜 が数値
 *   → labelOffset=2 (学歴/年齢), sexEduOffset=1 (集計行), dataOffset=3
 *
 * フォーマット B（〜2024年）:
 *   - 集計行: cols[0] は空、cols[1] に "男女計\n学歴計" 形式（スペースなし）、cols[2]〜 が数値
 *   - 学歴行: cols[0] は空、cols[1] に "中学" 等、cols[2]〜 が数値
 *   - 年齢行: cols[0] は空、cols[1] に "　　～１９歳" 等、cols[2]〜 が数値
 *   → labelOffset=1, dataOffset=2
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
  '男女':   '計',
  '男性':   '男',
  '女性':   '女',
  '男':     '男',
  '女':     '女',
}

const EDU_MAP: Record<string, string> = {
  '学歴計':   '学歴計',
  '中学':     '中学',
  '高校':     '高校',
  '専門学校': '専門学校',
  '高専短大': '高専・短大',
  '高専・短大': '高専・短大',
  '大学':     '大学',
  '大学院':   '大学院',
  '不明':     '不明',
}

type ParsedLabel = {
  sex:       '計' | '男' | '女' | null
  education: string | null
  ageGroup:  string | null
}

function parseLabelParts(raw: string): ParsedLabel {
  const result: ParsedLabel = { sex: null, education: null, ageGroup: null }
  const parts = raw.split('\n').map(p => p.trim()).filter(p => p !== '')

  for (const part of parts) {
    const n = norm(part)

    // 性別
    if (result.sex === null) {
      for (const [key, val] of Object.entries(SEX_MAP)) {
        if (n === key) { result.sex = val; break }
      }
    }

    // 学歴
    if (result.education === null) {
      const edu = EDU_MAP[n]
      if (edu) result.education = edu
    }

    // 年齢階級: 全角数字→半角、年齢パターン検出
    if (result.ageGroup === null) {
      const ageNorm = part
        .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
        .replace(/〜/g, '～')
        .replace(/[　\s]+/g, '')
        .trim()
      if (/^[～]?[0-9]+/.test(ageNorm) && (ageNorm.includes('歳') || ageNorm.includes('～'))) {
        result.ageGroup = ageNorm
      }
    }
  }

  return result
}

// -------------------- ブロック抽出 --------------------

type EnterpriseSize = AgeWageRow['enterprise_size']

function getBlocks(dataOffset: number): Array<{ label: EnterpriseSize; start: number }> {
  const d = dataOffset
  return [
    { label: '企業規模計',   start: d },
    { label: '1,000人以上', start: d + 8 },
    { label: '100～999人',  start: d + 16 },
    { label: '10～99人',    start: d + 24 },
  ]
}

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

function isPositiveNum(s: string): boolean {
  const cleaned = (s ?? '').replace(/[\s　,]/g, '').trim()
    .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
  const n = parseFloat(cleaned)
  return !isNaN(n) && n > 0
}

// -------------------- メインパーサー --------------------

export function parseAgeWageCsv(csvText: string): AgeWageRow[] {
  const logicalRows = parseFullCsv(csvText)
  const results: AgeWageRow[] = []

  // -------- フォーマット自動判定 --------
  // ヘッダー行の「区　分」列位置でフォーマットを判定する:
  //   フォーマットA（2025年〜）: 「区　分」が cols[2] → labelOffset=2, dataOffset=3
  //   フォーマットB（〜2024年）: 「区　分」が cols[0] → labelOffset=1, dataOffset=2
  //
  // 「区　分」が見つからない場合は、データ行の列数で推定:
  //   cols[0] が空で cols[1] にラベル → フォーマットB
  let dataStart = -1
  let labelOffset = 2
  let dataOffset  = 3

  // ヘッダー行スキャン（先頭15行以内）
  // 「区　分」がある列でフォーマットを判定する:
  //   col[0] に「区　分」→ フォーマットB（2024年以前）: labelOffset=1, dataOffset=2
  //   col[1] に「区　分」→ フォーマットA（2025年〜）:  labelOffset=2, dataOffset=3
  let formatDetected = false
  for (let r = 0; r < Math.min(15, logicalRows.length); r++) {
    const cols = logicalRows[r]
    if (!cols) continue
    const n0 = norm(cols[0] ?? '')
    const n1 = norm(cols[1] ?? '')
    if (n0 === '区分' || n0.startsWith('区分')) {
      // 2024年以前: col[0]に「区　分」→ labelOffset=1（データはcol[2]から）
      labelOffset = 1; dataOffset = 2; formatDetected = true; break
    }
    if (n1 === '区分' || n1.startsWith('区分')) {
      // 2025年〜: col[1]に「区　分」→ labelOffset=2（データはcol[3]から）
      labelOffset = 2; dataOffset = 3; formatDetected = true; break
    }
  }

  // データ開始行検出: dataOffset列目が正の数値（年齢: 10〜80）になる行
  for (let r = 5; r < logicalRows.length; r++) {
    const cols = logicalRows[r]
    if (!cols || cols.length < 10) continue
    const v = (cols[dataOffset] ?? '').replace(/[\s　,]/g, '').replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    const n = parseFloat(v)
    if (!isNaN(n) && n > 10 && n < 80) {
      dataStart = r; break
    }
  }

  // フォーマット未検出かつデータ行も見つからない場合は空を返す
  if (dataStart === -1) return []

  const BLOCKS = getBlocks(dataOffset)

  let currentSex: '計' | '男' | '女' = '計'
  let currentEducation = '学歴計'

  for (let i = dataStart; i < logicalRows.length; i++) {
    const cols = logicalRows[i]
    if (!cols || cols.length < 10) continue

    // データ列（dataOffset）が正の数値でなければスキップ
    if (!isPositiveNum(cols[dataOffset] ?? '')) continue

    // フォーマットAの特殊ケース:
    // 集計行（性別+学歴）は cols[1] にラベルがあり cols[2] は空
    // → cols[labelOffset] が空のとき cols[labelOffset-1] も確認する
    let rawLabel = cols[labelOffset] ?? ''
    if (!rawLabel.trim() && labelOffset > 0) {
      rawLabel = cols[labelOffset - 1] ?? ''
    }
    if (!rawLabel.trim()) continue

    const parsed = parseLabelParts(rawLabel)

    if (parsed.sex !== null)       currentSex = parsed.sex
    if (parsed.education !== null) currentEducation = parsed.education

    let finalAgeGroup: string
    if (parsed.ageGroup !== null) {
      finalAgeGroup = parsed.ageGroup
    } else if (parsed.education !== null || parsed.sex !== null) {
      // 学歴行 or 性別+学歴集計行 → 学歴計
      finalAgeGroup = '学歴計'
    } else {
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
