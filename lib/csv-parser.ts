/**
 * 賃金構造基本統計調査 職種別CSVパーサー
 *
 * CSVフォーマット（(1-4-1)aa1s19形式）:
 *  - ヘッダー: 最初の38論理行をスキップ
 *  - データ行:
 *    列[1]: 職種名 ※Excelの結合セルが改行込みクォートフィールドになる場合あり
 *            例: "　男女計\n\n管理的職業従事者"  → sex=計, name=管理的職業従事者
 *            例: "女\n\n看護助手"               → sex=女, name=看護助手
 *            例: ",研究者,"                      → 前の性別を引き継ぎ, name=研究者
 *    列[3..10]: 企業規模計（8列）
 *    列[11..18]: 1000人以上（8列）
 *    列[19..26]: 100～999人（8列）
 *    列[27..34]: 10～99人（8列）
 *
 *  ★ 重要: Excelの複数行結合セルがCSVで改行入りクォートフィールドになるため、
 *    ファイル全体を「RFC4180準拠の全体パーサー」で論理行に変換してから処理する。
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

/**
 * RFC4180準拠の全体CSVパーサー
 * ファイル全体を1度に走査し、改行を含むクォートフィールドも正しく論理行に分割する
 */
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
        // エスケープされた二重引用符
        if (csvText[i + 1] === '"') {
          field += '"'
          i += 2
        } else {
          // 閉じクォート
          inQuotes = false
          i++
        }
      } else {
        // クォート内の改行も含めてフィールドに追加
        field += ch
        i++
      }
    } else {
      if (ch === '"') {
        inQuotes = true
        i++
      } else if (ch === ',') {
        row.push(field)
        field = ''
        i++
      } else if (ch === '\r' && csvText[i + 1] === '\n') {
        // CRLF
        row.push(field)
        field = ''
        rows.push(row)
        row = []
        i += 2
      } else if (ch === '\n' || ch === '\r') {
        // LF or CR
        row.push(field)
        field = ''
        rows.push(row)
        row = []
        i++
      } else {
        field += ch
        i++
      }
    }
  }
  // 最後のフィールド・行
  if (field || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

// CSVテキスト全体をパースしてOccupationWageRow[]を返す
export function parseOccupationWageCsv(csvText: string): OccupationWageRow[] {
  // ファイル全体を論理行に変換（改行入りセルを正しく処理）
  const allRows = parseFullCsv(csvText)

  const results: OccupationWageRow[] = []

  // ヘッダー行数: 論理行の先頭38行をスキップ
  // ただしExcelのヘッダー内にも改行セルがあるため、
  // 「職種名セル(cols[1])に数値データ(cols[3])がある」行のみ処理する
  const DATA_START = 38

  // 現在の性別状態
  let currentSex: '計' | '男' | '女' = '計'

  const ENTERPRISE_SIZES: Array<{
    label: '企業規模計' | '1000人以上' | '100～999人' | '10～99人'
    start: number
  }> = [
    { label: '企業規模計', start: 3 },
    { label: '1000人以上', start: 11 },
    { label: '100～999人', start: 19 },
    { label: '10～99人', start: 27 },
  ]

  for (let i = DATA_START; i < allRows.length; i++) {
    const cols = allRows[i]
    if (!cols || cols.length < 4) continue

    // 職種名セル（列インデックス1）
    // 改行を含む場合: "　男女計\n\n管理的職業従事者" や "女\n\n看護助手" など
    const rawNameCell = cols[1] || ''

    // 改行で分割して性別ラベルと職種名を取得
    // 例: "　男女計\n\n管理的職業従事者" → parts = ["　男女計", "", "管理的職業従事者"]
    const parts = rawNameCell.split(/\n/).map(s => s.replace(/\r/g, '').trim()).filter(s => s !== '')

    // 性別ラベルの検出（partsの先頭に「男女計」「男」「女」があるケース）
    let occupationName = ''
    if (parts.length === 0) continue

    // 先頭要素から性別を判定
    const firstPart = parts[0].replace(/\u3000/g, ' ').trim()
    if (firstPart === '男女計' || firstPart.match(/^[\s　]*男女計[\s　]*$/)) {
      currentSex = '計'
      // 職種名は2番目以降
      occupationName = parts.slice(1).join(' ').trim()
    } else if (firstPart === '男' || firstPart.match(/^[\s　]*男[\s　]*$/)) {
      currentSex = '男'
      occupationName = parts.slice(1).join(' ').trim()
    } else if (firstPart === '女' || firstPart.match(/^[\s　]*女[\s　]*$/)) {
      currentSex = '女'
      occupationName = parts.slice(1).join(' ').trim()
    } else {
      // 性別ラベルなし → 全体が職種名
      occupationName = parts.join(' ').trim()
    }

    // 職種名の最終正規化
    occupationName = occupationName.replace(/\u3000/g, ' ').replace(/\s+/g, ' ').trim()

    if (!occupationName) continue

    // 数値データがあるかチェック（企業規模計の年齢列）
    const sizeCheck = (cols[3] || '').trim()
    if (sizeCheck === '' || sizeCheck === '-') {
      // データなし行（合計なしの企業規模のみ）→ 他のサイズブロックも確認
      const anyData = [3, 11, 19, 27].some(start => {
        const v = (cols[start] || '').trim()
        return v !== '' && v !== '-'
      })
      if (!anyData) continue
    }

    for (const { label, start } of ENTERPRISE_SIZES) {
      const block = cols.slice(start, start + 8)
      // 全て空またはハイフンならスキップ
      const hasData = block.some((c) => {
        const t = (c || '').trim()
        return t !== '' && t !== '-'
      })
      if (!hasData) continue

      const row = extractSizeBlock(occupationName, currentSex, label, block)
      results.push(row)
    }
  }

  return results
}
