import { NextRequest, NextResponse } from 'next/server'
import { parseAgeWageCsv } from '@/lib/csv-parser-age'
import { query } from '@/lib/db'
import iconv from 'iconv-lite'

export async function POST(req: NextRequest) {
  try {
    const formData  = await req.formData()
    const file      = formData.get('file') as File | null
    const datasetId = formData.get('dataset_id') as string | null

    if (!file)
      return NextResponse.json({ success: false, message: 'ファイルが見つかりません' }, { status: 400 })
    if (!datasetId)
      return NextResponse.json({ success: false, message: 'dataset_id が必要です' }, { status: 400 })
    if (!file.name.endsWith('.csv'))
      return NextResponse.json({ success: false, message: 'CSVファイルのみ対応しています' }, { status: 400 })

    // データセット存在確認
    const dsRows = await query(
      `SELECT d.id, dg.target_table FROM datasets d JOIN dataset_groups dg ON dg.id = d.group_id WHERE d.id = ?`,
      [datasetId]
    ) as Array<{ id: number; target_table: string }>

    if (dsRows.length === 0)
      return NextResponse.json({ success: false, message: '指定されたデータセットが存在しません' }, { status: 404 })

    const buffer = await file.arrayBuffer()
    const nodeBuffer = Buffer.from(buffer)

    let text: string
    if (nodeBuffer[0] === 0xef && nodeBuffer[1] === 0xbb && nodeBuffer[2] === 0xbf) {
      text = nodeBuffer.slice(3).toString('utf-8')
    } else {
      text = iconv.decode(nodeBuffer, 'CP932')
    }

    const rows = parseAgeWageCsv(text)

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'データが取得できませんでした' },
        { status: 422 }
      )
    }

    // 既存データ削除（再インポート対応）
    await query('DELETE FROM age_wages WHERE dataset_id = ?', [datasetId])

    // バッチ挿入（100件ずつ）
    const BATCH = 100
    let inserted = 0

    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH)
      if (batch.length === 0) continue

      const placeholders = batch.map(() => '(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').join(',')
      const values: unknown[] = []

      // 空白除去・数値変換・NaN→null
      const n = (v: unknown): number | null => {
        if (v === null || v === undefined || v === '') return null
        const num = typeof v === 'number' ? v : Number(String(v).replace(/[\s,]/g, ''))
        return isNaN(num) ? null : num
      }

      for (const r of batch) {
        values.push(
          datasetId,
          r.sex ?? '計',
          r.education ?? '学歴計',
          r.age_group ?? '',
          r.enterprise_size ?? '',
          n(r.age),
          n(r.tenure_years),
          n(r.scheduled_hours),
          n(r.overtime_hours),
          n(r.monthly_wage),
          n(r.scheduled_wage),
          n(r.annual_bonus),
          n(r.workers),
          n(r.annual_income),
        )
      }

      await query(
        `INSERT INTO age_wages
          (dataset_id, sex, education, age_group, enterprise_size,
           age, tenure_years, scheduled_hours, overtime_hours,
           monthly_wage, scheduled_wage, annual_bonus, workers, annual_income)
         VALUES ${placeholders}`,
        values
      )
      inserted += batch.length
    }

    // datasets.record_count 更新
    await query(
      'UPDATE datasets SET record_count = ?, imported_at = NOW() WHERE id = ?',
      [inserted, datasetId]
    )

    return NextResponse.json({
      success: true,
      message: `${inserted}件のデータを取り込みました`,
      inserted,
    })
  } catch (error: unknown) {
    const err = error as { message?: string; code?: string; sqlMessage?: string }
    console.log('[v0] import-age ERROR:', err.message, '| code:', err.code, '| sql:', err.sqlMessage)
    return NextResponse.json(
      { success: false, message: err.sqlMessage ?? err.message ?? '取込失敗' },
      { status: 500 }
    )
  }
}
