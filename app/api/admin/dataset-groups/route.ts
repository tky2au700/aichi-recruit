import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

// 全グループ一覧（子datasetsの件数・最終取込年サマリー付き）
export async function GET() {
  try {
    const groups = await query(`
      SELECT
        g.*,
        COUNT(d.id)          AS dataset_count,
        MIN(d.survey_year)   AS year_min,
        MAX(d.survey_year)   AS year_max,
        SUM(d.record_count)  AS total_records
      FROM dataset_groups g
      LEFT JOIN datasets d ON d.group_id = g.id
      GROUP BY g.id
      ORDER BY g.id DESC
    `)
    return NextResponse.json({ success: true, data: groups })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    )
  }
}

// 新規グループ作成
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      name, category = 'occupation', source_name,
      data_start_row = 10, name_col_index = 1,
      size1_col_start = 3, size2_col_start = 11,
      size3_col_start = 19, size4_col_start = 27,
      parse_notes,
    } = body

    if (!name) {
      return NextResponse.json({ success: false, message: '調査名は必須です' }, { status: 400 })
    }

    const result = await query(
      `INSERT INTO dataset_groups
         (name, category, source_name, data_start_row, name_col_index,
          size1_col_start, size2_col_start, size3_col_start, size4_col_start, parse_notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, category, source_name ?? null,
       data_start_row, name_col_index,
       size1_col_start, size2_col_start, size3_col_start, size4_col_start,
       parse_notes ?? null]
    ) as any

    const rows = await query(`SELECT * FROM dataset_groups WHERE id = ?`, [result.insertId])
    return NextResponse.json({ success: true, data: (rows as any[])[0] }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    )
  }
}
