import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { parseOccupationWageCsv, DEFAULT_CSV_RULE, type CsvParseRule } from '@/lib/csv-parser'
import { query } from '@/lib/db'
import { toOccupationSlug } from '@/lib/slug'

function detectYearFromSheetName(name: string): number | null {
  const m4 = name.match(/(\d{4})/)
  if (m4) { const y = parseInt(m4[1], 10); if (y >= 2000 && y <= 2100) return y }
  const mReiwa  = name.match(/令和\s*(\d+)/);  if (mReiwa)  return 2018 + parseInt(mReiwa[1], 10)
  const mHeisei = name.match(/平成\s*(\d+)/);  if (mHeisei) return 1988 + parseInt(mHeisei[1], 10)
  const m2 = name.match(/^(\d{2})$/);          if (m2) { const y = parseInt(m2[1], 10); return 2000 + y }
  return null
}

function sheetToCsvText(sheet: XLSX.WorkSheet): string {
  return XLSX.utils.sheet_to_csv(sheet, { FS: ',', RS: '\n' })
}

const BATCH_SIZE = 100

async function insertRows(datasetId: number, rows: ReturnType<typeof parseOccupationWageCsv>) {
  if (rows.length === 0) return 0
  let inserted = 0
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const placeholders = batch.map(() => '(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').join(',')
    const values: any[] = []
    for (const r of batch) {
      const slug      = toOccupationSlug(r.occupation_name)
      const hourlyWage = r.monthly_wage != null ? Math.round((r.monthly_wage / 160) * 10) / 10 : null
      values.push(
        datasetId, r.occupation_name, slug, r.sex, r.enterprise_size,
        r.age, r.tenure_years, r.scheduled_hours, r.overtime_hours,
        r.monthly_wage, r.scheduled_wage, r.annual_bonus, r.workers,
        r.annual_income, hourlyWage,
      )
    }
    await query(
      `INSERT INTO occupation_wages
        (dataset_id, occupation_name, occupation_slug, sex, enterprise_size, age, tenure_years,
         scheduled_hours, overtime_hours, monthly_wage, scheduled_wage,
         annual_bonus, workers, annual_income, hourly_wage)
       VALUES ${placeholders}`,
      values
    )
    inserted += batch.length
  }
  return inserted
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file    = formData.get('file')    as File | null
    const groupId = formData.get('group_id') as string | null
    // 特定シートのみインポートする場合（カンマ区切りシート名 or 全シート）
    const sheetsParam = formData.get('sheets') as string | null  // "all" or "シート名1,シート名2"

    if (!file)    return NextResponse.json({ success: false, message: 'ファイルが見つかりません' }, { status: 400 })
    if (!groupId) return NextResponse.json({ success: false, message: 'group_id が必要です' }, { status: 400 })
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      return NextResponse.json({ success: false, message: '.xlsx / .xls ファイルのみ対応しています' }, { status: 400 })
    }

    // グループのパースルールを取得
    const groupRows = await query('SELECT * FROM dataset_groups WHERE id = ?', [groupId]) as any[]
    if (groupRows.length === 0) {
      return NextResponse.json({ success: false, message: '指定されたグループが存在しません' }, { status: 404 })
    }
    const g = groupRows[0]
    const rule: CsvParseRule = {
      data_start_row:  g.data_start_row,
      name_col_index:  g.name_col_index,
      size1_col_start: g.size1_col_start,
      size2_col_start: g.size2_col_start,
      size3_col_start: g.size3_col_start,
      size4_col_start: g.size4_col_start,
      sex_label_mode:  g.sex_label_mode ?? 'cell_combined',
    }

    const buffer   = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false })

    // 対象シートを決定
    let targetSheets = workbook.SheetNames
    if (sheetsParam && sheetsParam !== 'all') {
      const requested = sheetsParam.split(',').map(s => s.trim())
      targetSheets = workbook.SheetNames.filter(n => requested.includes(n))
    }

    // 既存データセット一覧（グループ内）
    const existingDatasets = await query(
      'SELECT id, survey_year FROM datasets WHERE group_id = ?',
      [groupId]
    ) as Array<{ id: number; survey_year: number }>

    const results: Array<{
      sheet_name: string
      survey_year: number | null
      dataset_id: number
      inserted: number
      created: boolean
      error?: string
    }> = []

    for (const sheetName of targetSheets) {
      try {
        const sheet   = workbook.Sheets[sheetName]
        if (!sheet) continue

        const csvText = sheetToCsvText(sheet)
        const rows    = parseOccupationWageCsv(csvText, rule)

        if (rows.length === 0) {
          results.push({ sheet_name: sheetName, survey_year: null, dataset_id: 0, inserted: 0, created: false, error: 'パース結果0件' })
          continue
        }

        const detectedYear = detectYearFromSheetName(sheetName)
        let datasetId: number
        let created = false

        // 既存データセットに調査年が一致するものがあればそれを使う
        const existing = detectedYear ? existingDatasets.find(d => d.survey_year === detectedYear) : null
        if (existing) {
          datasetId = existing.id
        } else {
          // なければ自動作成
          const year = detectedYear ?? new Date().getFullYear()
          const ins  = await query(
            'INSERT INTO datasets (group_id, survey_year, record_count) VALUES (?, ?, 0)',
            [groupId, year]
          ) as any
          datasetId = ins.insertId
          existingDatasets.push({ id: datasetId, survey_year: year })
          created = true
        }

        // 既存データを削除して再インポート
        await query('DELETE FROM occupation_wages WHERE dataset_id = ?', [datasetId])
        const inserted = await insertRows(datasetId, rows)

        // record_count・imported_at を更新
        await query(
          'UPDATE datasets SET record_count = ?, imported_at = NOW() WHERE id = ?',
          [inserted, datasetId]
        )

        results.push({ sheet_name: sheetName, survey_year: detectedYear, dataset_id: datasetId, inserted, created })
      } catch (err: any) {
        results.push({ sheet_name: sheetName, survey_year: null, dataset_id: 0, inserted: 0, created: false, error: err.message })
      }
    }

    const totalInserted = results.reduce((s, r) => s + r.inserted, 0)
    const successCount  = results.filter(r => r.inserted > 0).length

    return NextResponse.json({
      success: true,
      message: `${successCount}シート・${totalInserted}件のデータを取り込みました`,
      total_inserted: totalInserted,
      results,
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: 'XLSXインポート失敗', error: error.message },
      { status: 500 }
    )
  }
}
