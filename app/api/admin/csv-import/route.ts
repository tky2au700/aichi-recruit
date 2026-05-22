import { NextRequest, NextResponse } from 'next/server'
import { parseOccupationWageCsv, DEFAULT_CSV_RULE, type CsvParseRule } from '@/lib/csv-parser'
import { query } from '@/lib/db'
import iconv from 'iconv-lite'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file      = formData.get('file') as File | null
    const datasetId = formData.get('dataset_id') as string | null

    if (!file)      return NextResponse.json({ success: false, message: 'ファイルが見つかりません' }, { status: 400 })
    if (!datasetId) return NextResponse.json({ success: false, message: 'dataset_id が必要です' }, { status: 400 })

    // データセット + 親グループのCSVルールを取得
    const dsRows = await query(
      `SELECT d.*, g.data_start_row, g.name_col_index, g.sex_label_mode,
              g.size1_col_start, g.size2_col_start, g.size3_col_start, g.size4_col_start
       FROM datasets d
       JOIN dataset_groups g ON g.id = d.group_id
       WHERE d.id = ?`,
      [datasetId]
    ) as any[]

    if (dsRows.length === 0) {
      return NextResponse.json({ success: false, message: '指定されたデータセットが存在しません' }, { status: 404 })
    }

    const ds = dsRows[0]
    const rule: CsvParseRule = {
      data_start_row:  ds.data_start_row,
      name_col_index:  ds.name_col_index,
      size1_col_start: ds.size1_col_start,
      size2_col_start: ds.size2_col_start,
      size3_col_start: ds.size3_col_start,
      size4_col_start: ds.size4_col_start,
      sex_label_mode:  ds.sex_label_mode ?? 'cell_combined',
    }

    const buffer = await file.arrayBuffer()
    const nodeBuffer = Buffer.from(buffer)

    let text: string
    if (nodeBuffer[0] === 0xef && nodeBuffer[1] === 0xbb && nodeBuffer[2] === 0xbf) {
      text = nodeBuffer.slice(3).toString('utf-8')
    } else {
      text = iconv.decode(nodeBuffer, 'CP932')
    }

    const rows = parseOccupationWageCsv(text, rule)

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'データが取得できませんでした' },
        { status: 422 }
      )
    }

    // 既存データ削除（同一dataset_idの再インポート対応）
    await query('DELETE FROM occupation_wages WHERE dataset_id = ?', [datasetId])

    // バッチ挿入（100件ずつ）
    const BATCH = 100
    let inserted = 0

    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH)
      if (batch.length === 0) continue

      const placeholders = batch.map(() => '(?,?,?,?,?,?,?,?,?,?,?,?,?)').join(',')
      const values: any[] = []

      for (const r of batch) {
        values.push(
          datasetId,
          r.occupation_name,
          r.sex,
          r.enterprise_size,
          r.age,
          r.tenure_years,
          r.scheduled_hours,
          r.overtime_hours,
          r.monthly_wage,
          r.scheduled_wage,
          r.annual_bonus,
          r.workers,
          r.annual_income
        )
      }

      await query(
        `INSERT INTO occupation_wages
          (dataset_id, occupation_name, sex, enterprise_size, age, tenure_years,
           scheduled_hours, overtime_hours, monthly_wage, scheduled_wage,
           annual_bonus, workers, annual_income)
         VALUES ${placeholders}`,
        values
      )
      inserted += batch.length
    }

    // データセットのrecord_count・imported_atを更新
    await query(
      'UPDATE datasets SET record_count = ?, imported_at = NOW() WHERE id = ?',
      [inserted, datasetId]
    )

    return NextResponse.json({
      success: true,
      message: `${inserted}件のデータを取り込みました`,
      inserted,
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: '取込失敗', error: error.message },
      { status: 500 }
    )
  }
}
