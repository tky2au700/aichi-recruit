/**
 * POST /api/admin/xlsx-import
 *
 * 業種別XLSXの全シートを industry_wages テーブルへ一括インポートする。
 *
 * XLSXフォーマット（賃金構造基本統計調査 第1表）:
 *   タブ = 業種（産業計・C鉱業・D建設業 など）
 *   行   = 年齢階級 × 性別（計/男/女）
 *   列   = 企業規模 × 指標（年齢・勤続・所定内時間・超過時間・月給・所定内給与・賞与・労働者数）
 *
 * リクエストボディ（multipart/form-data）:
 *   file       : XLSX ファイル
 *   survey_year: 調査年（西暦4桁）※ユーザーが手動入力
 *   group_id   : dataset_groups.id（省略時は category='industry' のグループを自動選択）
 */

import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { query } from '@/lib/db'

// -------------------------------------------------------
// 列ブロック定義（e-Stat 賃金構造基本統計調査 第1表 標準レイアウト）
// A列(0): 区分ラベル
// 各サイズブロック: 8列幅
//   offset 0: 年齢
//   offset 1: 勤続年数
//   offset 2: 所定内労働時間
//   offset 3: 超過労働時間
//   offset 4: きまって支給する現金給与額
//   offset 5: 所定内給与額
//   offset 6: 年間賞与その他特別給与額
//   offset 7: 労働者数（十人）
// -------------------------------------------------------

const SIZE_NAMES = ['企業規模計', '1000人以上', '100〜999人', '10〜99人'] as const
type EntSize = typeof SIZE_NAMES[number]
const DB_SIZE_MAP: Record<string, EntSize> = {
  '企業規模計': '企業規模計',
  '1000人以上': '1000人以上',
  '1,000人以上': '1000人以上',
  '100～999人': '100〜999人',
  '100〜999人': '100〜999人',
  '10～99人': '10〜99人',
  '10〜99人': '10〜99人',
}

const SEX_MAP: Record<string, '計' | '男' | '女'> = {
  '男女計': '計', '計': '計',
  '男　 計': '男', '男  計': '男', '男　計': '男', '男 計': '男', '男': '男',
  '女　 計': '女', '女  計': '女', '女　計': '女', '女 計': '女', '女': '女',
}

function n(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const num = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''))
  return isNaN(num) ? null : num
}

function cellVal(ws: XLSX.WorkSheet, r: number, c: number): unknown {
  return ws[XLSX.utils.encode_cell({ r, c })]?.v ?? ''
}

interface IndustryWageRow {
  industry_name:   string
  sex:             '計' | '男' | '女'
  age_group:       string
  enterprise_size: EntSize
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

function parseIndustrySheet(ws: XLSX.WorkSheet, sheetName: string): IndustryWageRow[] {
  const ref    = ws['!ref'] ?? 'A1:A1'
  const range  = XLSX.utils.decode_range(ref)
  const maxRow = Math.min(range.e.r, 300)
  const maxCol = Math.min(range.e.c, 60)

  // --- 1. 産業名（C6 付近）---
  let industryName = sheetName
  for (const [r, c] of [[5, 2], [5, 3], [6, 2], [4, 2], [5, 1]]) {
    const v = String(cellVal(ws, r, c)).trim()
    if (v && v.length > 1 && !/^\d+$/.test(v)) { industryName = v; break }
  }

  // --- 2. 企業規模ブロックの開始列を検出（ヘッダー行を走査）---
  const sizeColStarts: Partial<Record<EntSize, number>> = {}
  for (let r = 7; r <= 14; r++) {
    for (let c = 0; c <= maxCol; c++) {
      const v = String(cellVal(ws, r, c)).replace(/\s+/g, '').trim()
      const mapped = DB_SIZE_MAP[v]
      if (mapped && sizeColStarts[mapped] === undefined) {
        sizeColStarts[mapped] = c
      }
    }
    if (Object.keys(sizeColStarts).length >= 2) break
  }

  // フォールバック: 標準レイアウトを仮定
  if (sizeColStarts['企業規模計'] === undefined) sizeColStarts['企業規模計'] = 1
  if (sizeColStarts['1000人以上']  === undefined) sizeColStarts['1000人以上']  = 9
  if (sizeColStarts['100〜999人']  === undefined) sizeColStarts['100〜999人']  = 17
  if (sizeColStarts['10〜99人']    === undefined) sizeColStarts['10〜99人']    = 25

  // --- 3. データ開始行（性別ラベルが現れる行）---
  let dataStart = 12
  for (let r = 10; r <= 20; r++) {
    const v = String(cellVal(ws, r, 0)).replace(/\s+/g, '').trim()
    if (SEX_MAP[v] !== undefined) { dataStart = r; break }
  }

  // --- 4. 行パース ---
  const rows: IndustryWageRow[] = []
  let currentSex: '計' | '男' | '女' = '計'

  for (let r = dataStart; r <= maxRow; r++) {
    const label = String(cellVal(ws, r, 0)).replace(/\s+/g, ' ').trim()
    if (!label) continue

    // 性別ラベル行
    const sexMapped = SEX_MAP[label.replace(/\s/g, '')]
    if (sexMapped !== undefined) {
      currentSex = sexMapped
      continue
    }

    // 年齢階級ラベルかどうか（数字・〜・歳 を含む）
    const isAgeGroup = /\d/.test(label) || label.includes('〜') || label.includes('～') || label.includes('歳') || label === '合計' || label === '総数'
    if (!isAgeGroup) continue

    const ageGroup = label

    for (const [sizeName, startCol] of Object.entries(sizeColStarts) as [EntSize, number][]) {
      const c = startCol
      const ageVal       = n(cellVal(ws, r, c))
      const tenureVal    = n(cellVal(ws, r, c + 1))
      const schedHours   = n(cellVal(ws, r, c + 2))
      const overtimeHrs  = n(cellVal(ws, r, c + 3))
      const monthlyWage  = n(cellVal(ws, r, c + 4))
      const schedWage    = n(cellVal(ws, r, c + 5))
      const bonus        = n(cellVal(ws, r, c + 6))
      const workers      = n(cellVal(ws, r, c + 7))

      // 有効データが1つもなければスキップ
      if ([monthlyWage, schedWage, bonus, workers].every(v => v === null)) continue

      const annualIncome = monthlyWage != null && bonus != null
        ? Math.round(monthlyWage * 12 + bonus)
        : monthlyWage != null ? Math.round(monthlyWage * 12) : null

      rows.push({
        industry_name:   industryName,
        sex:             currentSex,
        age_group:       ageGroup,
        enterprise_size: sizeName,
        age:             ageVal,
        tenure_years:    tenureVal,
        scheduled_hours: schedHours,
        overtime_hours:  overtimeHrs,
        monthly_wage:    monthlyWage,
        scheduled_wage:  schedWage,
        annual_bonus:    bonus,
        workers:         workers != null ? Math.round(workers * 10) : null, // 十人単位 → 人
        annual_income:   annualIncome,
      })
    }
  }

  return rows
}

const BATCH_SIZE = 200

async function insertIndustryRows(datasetId: number, rows: IndustryWageRow[]): Promise<number> {
  if (rows.length === 0) return 0
  let inserted = 0
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const ph = batch.map(() => '(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').join(',')
    const vals: unknown[] = []
    for (const r of batch) {
      vals.push(
        datasetId, r.industry_name, r.sex, r.age_group, r.enterprise_size,
        r.age, r.tenure_years, r.scheduled_hours, r.overtime_hours,
        r.monthly_wage, r.scheduled_wage, r.annual_bonus, r.workers, r.annual_income,
      )
    }
    await query(
      `INSERT INTO industry_wages
        (dataset_id, industry_name, sex, age_group, enterprise_size,
         age, tenure_years, scheduled_hours, overtime_hours,
         monthly_wage, scheduled_wage, annual_bonus, workers, annual_income)
       VALUES ${ph}`,
      vals
    )
    inserted += batch.length
  }
  return inserted
}

// -------------------------------------------------------
// Route Handler
// -------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const fd = await req.formData()
    const file       = fd.get('file')        as File   | null
    const surveyYear = fd.get('survey_year') as string | null
    const groupIdRaw = fd.get('group_id')    as string | null

    if (!file)       return NextResponse.json({ success: false, message: 'ファイルがありません' }, { status: 400 })
    if (!surveyYear) return NextResponse.json({ success: false, message: '調査年を入力してください' }, { status: 400 })
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      return NextResponse.json({ success: false, message: '.xlsx / .xls ファイルのみ対応しています' }, { status: 400 })
    }

    const year = parseInt(surveyYear, 10)
    if (isNaN(year) || year < 1900 || year > 2100) {
      return NextResponse.json({ success: false, message: '調査年が不正です' }, { status: 400 })
    }

    // グループIDを解決（指定がなければ category='industry' を自動選択）
    let groupId: number
    if (groupIdRaw) {
      groupId = parseInt(groupIdRaw, 10)
    } else {
      const groups = await query(
        "SELECT id FROM dataset_groups WHERE category = 'industry' LIMIT 1"
      ) as any[]
      if (groups.length === 0) {
        return NextResponse.json({ success: false, message: 'industryグループが未作成です' }, { status: 500 })
      }
      groupId = groups[0].id
    }

    // datasets に該当年のレコードを取得 or 新規作成
    const existing = await query(
      'SELECT id FROM datasets WHERE group_id = ? AND survey_year = ?',
      [groupId, year]
    ) as any[]

    let datasetId: number
    let datasetCreated = false
    if (existing.length > 0) {
      datasetId = existing[0].id
    } else {
      const ins = await query(
        'INSERT INTO datasets (group_id, survey_year, record_count) VALUES (?, ?, 0)',
        [groupId, year]
      ) as any
      datasetId = ins.insertId
      datasetCreated = true
    }

    // 既存データ削除（再インポート対応）
    await query('DELETE FROM industry_wages WHERE dataset_id = ?', [datasetId])

    // XLSX パース＆インポート
    const buf = Buffer.from(await file.arrayBuffer())
    const wb  = XLSX.read(buf, { type: 'buffer', cellDates: false })

    const results: Array<{
      sheet_name:    string
      industry_name: string
      inserted:      number
      error?:        string
    }> = []

    let totalInserted = 0

    for (const sheetName of wb.SheetNames) {
      try {
        const ws = wb.Sheets[sheetName]
        if (!ws || !ws['!ref']) {
          results.push({ sheet_name: sheetName, industry_name: sheetName, inserted: 0, error: 'シートが空' })
          continue
        }
        const rows = parseIndustrySheet(ws, sheetName)
        if (rows.length === 0) {
          results.push({ sheet_name: sheetName, industry_name: sheetName, inserted: 0, error: 'データ行なし' })
          continue
        }
        const inserted = await insertIndustryRows(datasetId, rows)
        totalInserted += inserted
        results.push({ sheet_name: sheetName, industry_name: rows[0].industry_name, inserted })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        results.push({ sheet_name: sheetName, industry_name: sheetName, inserted: 0, error: msg })
      }
    }

    // record_count 更新
    await query(
      'UPDATE datasets SET record_count = ?, imported_at = NOW() WHERE id = ?',
      [totalInserted, datasetId]
    )

    return NextResponse.json({
      success:       true,
      message:       `${results.filter(r => r.inserted > 0).length}シート・${totalInserted.toLocaleString()}件を取り込みました`,
      survey_year:   year,
      dataset_id:    datasetId,
      dataset_created: datasetCreated,
      total_inserted:  totalInserted,
      results,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ success: false, message: 'XLSXインポート失敗: ' + msg }, { status: 500 })
  }
}
