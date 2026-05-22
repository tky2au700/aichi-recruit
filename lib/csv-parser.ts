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

// グループごとに保存するCSVパースルール
export interface CsvParseRule {
  data_start_row: number   // データ開始論理行（0-indexed）
  name_col_index: number   // 職種名列インデックス
  size1_col_start: number  // 企業規模計 開始列
  size2_col_start: number  // 1000人以上 開始列
  size3_col_start: number  // 100～999人 開始列
  size4_col_start: number  // 10～99人 開始列
  /**
   * 性別ラベルのCSV上での位置を指定する
   *
   * 'cell_combined' (デフォルト):
   *   職種名セルに性別ラベルが改行で同居する形式
   *   例: "　男女計\n\n管理的職業従事者" → sex=計, name=管理的職業従事者
   *       "女\n\n看護助手"              → sex=女, name=看護助手
   *
   * 'separate_row':
   *   性別ラベルが独立した行として存在する形式（画像1・3・4のCSV）
   *   例: 行N  → [.., "男女計", ...] （数値なし）→ currentSex = 計
   *       行N+1→ [.., "管理的職業従事者", ...] （数値あり）→ sex継続
   */
  sex_label_mode: 'cell_combined' | 'separate_row'
}

export const DEFAULT_CSV_RULE: CsvParseRule = {
  data_start_row: 10,
  name_col_index: 1,
  size1_col_start: 3,
  size2_col_start: 11,
  size3_col_start: 19,
  size4_col_start: 27,
  sex_label_mode: 'cell_combined',
}

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
// rule を省略した場合は DEFAULT_CSV_RULE を使用
export function parseOccupationWageCsv(
  csvText: string,
  rule: CsvParseRule = DEFAULT_CSV_RULE
): OccupationWageRow[] {
  const allRows = parseFullCsv(csvText)
  const results: OccupationWageRow[] = []

  const DATA_START      = rule.data_start_row
  const NAME_COL        = rule.name_col_index
  const SEX_LABEL_MODE  = rule.sex_label_mode ?? 'cell_combined'

  // DATA_START より前の行を後ろからスキャンして、直近の性別ラベルを初期値として取得する。
  // これにより「男女計」ラベルが data_start_row より前にある形式に対応する。
  let currentSex: '計' | '男' | '女' = '計'
  for (let pre = DATA_START - 1; pre >= 0; pre--) {
    const preCols = allRows[pre]
    if (!preCols) continue
    const preName = (preCols[NAME_COL] || '').replace(/[\u3000\u0020\t\r\n]/g, '').trim()
    if (preName === '男女計') { currentSex = '計'; break }
    if (preName === '男')    { currentSex = '男'; break }
    if (preName === '女')    { currentSex = '女'; break }
  }

  const ENTERPRISE_SIZES: Array<{
    label: '企業規模計' | '1000人以上' | '100～999人' | '10～99人'
    start: number
  }> = [
    { label: '企業規模計', start: rule.size1_col_start },
    { label: '1000人以上', start: rule.size2_col_start },
    { label: '100～999人', start: rule.size3_col_start },
    { label: '10～99人',   start: rule.size4_col_start },
  ]

  // 性別ラベルかどうかを判定するヘルパー
  function detectSexLabel(raw: string): '計' | '男' | '女' | null {
    const s = raw.replace(/[\u3000\u0020\t]/g, '').trim()
    if (s === '男女計') return '計'
    if (s === '男')    return '男'
    if (s === '女')    return '女'
    return null
  }

  // デバッグ: data_start_row付近の行とNAME_COL列の中身を出力
  console.log('[v0] csv-parser: SEX_LABEL_MODE=', SEX_LABEL_MODE, 'DATA_START=', DATA_START, 'NAME_COL=', NAME_COL)
  for (let dbgI = Math.max(0, DATA_START - 3); dbgI < Math.min(allRows.length, DATA_START + 5); dbgI++) {
    const dbgCols = allRows[dbgI]
    const dbgCell = dbgCols?.[NAME_COL] ?? ''
    console.log(`[v0] row[${dbgI}] nameCell=${JSON.stringify(dbgCell.substring(0, 60))} hasData=${
      ENTERPRISE_SIZES.some(({ start }) => dbgCols?.slice(start, start + 8).some(c => (c || '').trim() !== '' && (c || '').trim() !== '-'))
    }`)
  }

  for (let i = DATA_START; i < allRows.length; i++) {
    const cols = allRows[i]
    if (!cols || cols.length < 4) continue

    const rawNameCell = cols[NAME_COL] || ''
    let occupationName = ''

    if (SEX_LABEL_MODE === 'separate_row') {
      // ---- separate_row モード ----
      // 性別ラベルのみの行（数値データなし）→ currentSex を更新してスキップ
      const sex = detectSexLabel(rawNameCell)
      if (sex !== null) {
        // データ列がすべて空/ハイフンであれば性別ラベル行として扱う
        const anyData = ENTERPRISE_SIZES.some(({ start }) =>
          cols.slice(start, start + 8).some(c => {
            const t = (c || '').trim(); return t !== '' && t !== '-'
          })
        )
        if (!anyData) {
          currentSex = sex
          continue
        }
      }
      occupationName = normalizeName(rawNameCell)
    } else {
      // ---- cell_combined モード（デフォルト）----
      // 改行で分割して性別ラベルと職種名を取得
      // 例: "　男女計\n\n管理的職業従事者" → parts = ["　男女計", "管理的職業従事者"]
      const parts = rawNameCell.split(/\n/).map(s => s.replace(/\r/g, '').trim()).filter(s => s !== '')
      if (parts.length === 0) continue

      const sex = detectSexLabel(parts[0])
      if (sex !== null) {
        currentSex = sex
        occupationName = parts.slice(1).join(' ').trim()
      } else {
        occupationName = parts.join(' ').trim()
      }
    }

    // 職種名の最終正規化
    occupationName = normalizeName(occupationName)
    if (!occupationName) continue

    // 数値データがあるかチェック（全企業規模ブロック横断）
    const anyData = ENTERPRISE_SIZES.some(({ start }) =>
      cols.slice(start, start + 8).some(c => {
        const t = (c || '').trim(); return t !== '' && t !== '-'
      })
    )
    if (!anyData) continue

    for (const { label, start } of ENTERPRISE_SIZES) {
      const block = cols.slice(start, start + 8)
      const hasData = block.some(c => {
        const t = (c || '').trim(); return t !== '' && t !== '-'
      })
      if (!hasData) continue

      results.push(extractSizeBlock(occupationName, currentSex, label, block))
    }
  }

  return results
}
