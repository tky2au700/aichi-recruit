/**
 * 賃金構造基本統計調査 職種別CSVパーサー
 *
 * CSVフォーマット（(1-4-1)aa1s19形式）:
 *  - 行1-38: ヘッダー（スキップ）
 *  - 行39以降: データ行
 *    列B: 職種名（複数行にまたがる場合あり）
 *    列D-K: 企業規模計（10人以上）
 *    列L-S: 1,000人以上
 *    列T-AA: 100～999人
 *    列AB-AI: 10～99人
 *
 *  各企業規模の列順（8列）:
 *    [0] 年齢（歳）
 *    [1] 勤続年数（年）
 *    [2] 所定内実労働時間数（時間）
 *    [3] 超過実労働時間数（時間）
 *    [4] きまって支給する現金給与額（千円）
 *    [5] 所定内給与額（千円）
 *    [6] 年間賞与その他特別給与額（千円）
 *    [7] 労働者数（十人）
 *
 *  性別区分: 職種名セルに「男女計」「男」「女」が含まれる行でリセット
 */

export interface OccupationWageRow {
  occupation_name: string
  sex: '計' | '男' | '女'
  enterprise_size: '企業規模計' | '1000人以上' | '100～999人' | '10～99人'
  age: number | null
  tenure_years: number | null
  scheduled_hours: number | null
  overtime_hours: number | null
  monthly_wage: number | null
  scheduled_wage: number | null
  annual_bonus: number | null
  workers: number | null
  annual_income: number | null
}

// 数値文字列をパース（スペース・カンマ除去、"-"はnull）
function parseNum(s: string): number | null {
  if (!s) return null
  const cleaned = s.replace(/[\s,]/g, '').trim()
  if (cleaned === '-' || cleaned === '') return null
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

// 整数文字列をパース（労働者数はスペース区切りの場合がある）
function parseInt2(s: string): number | null {
  if (!s) return null
  const cleaned = s.replace(/[\s,]/g, '').trim()
  if (cleaned === '-' || cleaned === '') return null
  const n = parseInt(cleaned, 10)
  return isNaN(n) ? null : n
}

// 職種名の正規化（先頭スペース・改行・全角スペース除去）
function normalizeName(s: string): string {
  return s.replace(/[\r\n]/g, ' ').replace(/\u3000/g, ' ').replace(/^\s+|\s+$/g, '').replace(/\s+/g, ' ')
}

// 1企業規模分（8列）からWageRowを生成
function extractSizeBlock(
  occupation_name: string,
  sex: '計' | '男' | '女',
  enterprise_size: '企業規模計' | '1000人以上' | '100～999人' | '10～99人',
  cols: string[]
): OccupationWageRow {
  const age = parseNum(cols[0])
  const tenure_years = parseNum(cols[1])
  const scheduled_hours = parseNum(cols[2])
  const overtime_hours = parseNum(cols[3])
  const monthly_wage = parseNum(cols[4])
  const scheduled_wage = parseNum(cols[5])
  const annual_bonus = parseNum(cols[6])
  const workers = parseInt2(cols[7])
  const annual_income =
    monthly_wage !== null && annual_bonus !== null
      ? Math.round((monthly_wage * 12 + annual_bonus) * 10) / 10
      : null

  return {
    occupation_name,
    sex,
    enterprise_size,
    age,
    tenure_years,
    scheduled_hours,
    overtime_hours,
    monthly_wage,
    scheduled_wage,
    annual_bonus,
    workers,
    annual_income,
  }
}

// CSVテキスト全体をパースしてOccupationWageRow[]を返す
export function parseOccupationWageCsv(csvText: string): OccupationWageRow[] {
  // Shift-JIS等のデコード済みテキストを前提とする
  // 行に分割（\r\n / \n どちらでも対応）
  const lines = csvText.split(/\r?\n/)

  const results: OccupationWageRow[] = []

  // ヘッダー行数: 行1-38をスキップ（0-indexed: 0-37）
  const DATA_START = 38

  // 現在の性別状態
  let currentSex: '計' | '男' | '女' = '計'

  // 職種名が複数行セルにまたがる場合の管理
  // 列インデックス（0-indexed）
  // 元CSVはカンマ区切りで先頭に空列がある
  // 実際の列配置:
  //   [0]: 空
  //   [1]: 区分/職種名（改行を含む場合あり）
  //   [2]: 空（表頭分割用）
  //   [3..10]: 企業規模計（8列）
  //   [11..18]: 1000人以上（8列）
  //   [19..26]: 100～999人（8列）
  //   [27..34]: 10～99人（8列）

  const ENTERPRISE_SIZES: Array<{
    label: '企業規模計' | '1000人以上' | '100～999人' | '10～99人'
    start: number
  }> = [
    { label: '企業規模計', start: 3 },
    { label: '1000人以上', start: 11 },
    { label: '100～999人', start: 19 },
    { label: '10～99人', start: 27 },
  ]

  for (let i = DATA_START; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue

    // CSVパース（クォート対応）
    const cols = parseCsvLine(line)

    // 職種名セル（列インデックス1）
    const nameCell = normalizeName(cols[1] || '')

    // 性別判定: セルに「男女計」「　男」「　女」「男 」「女 」を含む
    if (nameCell.includes('男女計') || nameCell.match(/^男女計/)) {
      currentSex = '計'
    } else if (
      nameCell.match(/^[\s　]*男[\s　]/) ||
      nameCell.match(/^[\s　]*男$/) ||
      nameCell === '男' ||
      nameCell.startsWith('　男')
    ) {
      currentSex = '男'
    } else if (
      nameCell.match(/^[\s　]*女[\s　]/) ||
      nameCell.match(/^[\s　]*女$/) ||
      nameCell === '女' ||
      nameCell.startsWith('　女')
    ) {
      currentSex = '女'
    }

    // 実際の職種名を取得（性別プレフィックスを除いた部分）
    // 例: "　男女計\n\n管理的職業従事者" -> "管理的職業従事者"
    // 例: ",研究者," -> "研究者"
    let occupationName = nameCell
      .replace(/男女計/g, '')
      .replace(/^[\s　]*(男|女)[\s　]*/g, '')
      .trim()

    if (!occupationName) continue

    // 企業規模計のデータが存在するか確認（年齢列が数値）
    const sizeCheck = cols[3]
    if (!sizeCheck || sizeCheck.trim() === '') continue
    if (sizeCheck.trim() === '-' && cols[4]?.trim() === '-') continue

    for (const { label, start } of ENTERPRISE_SIZES) {
      const block = cols.slice(start, start + 8)
      // 全て空またはハイフンならスキップ
      const hasData = block.some((c) => {
        const t = c.trim()
        return t !== '' && t !== '-'
      })
      if (!hasData) continue

      const row = extractSizeBlock(occupationName, currentSex, label, block)
      results.push(row)
    }
  }

  return results
}

// RFC 4180準拠のCSV行パーサー
function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}
