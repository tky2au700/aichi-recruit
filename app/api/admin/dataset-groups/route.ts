import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

// 全グループ一覧（提供元・流通元名、子datasets件数サマリー付き）
export async function GET() {
  try {
    const groups = await query(`
      SELECT
        g.*,
        pub.name  AS publisher_name,
        pub.url   AS publisher_url,
        dist.name AS distributor_name,
        dist.url  AS distributor_url,
        COUNT(d.id)         AS dataset_count,
        MIN(d.survey_year)  AS year_min,
        MAX(d.survey_year)  AS year_max,
        SUM(d.record_count) AS total_records
      FROM dataset_groups g
      LEFT JOIN data_sources pub  ON pub.id  = g.publisher_id
      LEFT JOIN data_sources dist ON dist.id = g.distributor_id
      LEFT JOIN datasets d ON d.group_id = g.id
      GROUP BY g.id
      ORDER BY g.id DESC
    `)
    return NextResponse.json({ success: true, data: groups })
  } catch (error: any) {
    // テーブルが存在しない場合（DB初期化前）は空配列を返す
    if (error.message?.includes("doesn't exist") || error.code === 'ER_NO_SUCH_TABLE') {
      return NextResponse.json({ success: true, data: [], warning: 'テーブルが未作成です。DB初期化を実行してください。' })
    }
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}

// 新規グループ作成
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      name, category = 'occupation',
      publisher_id, distributor_id,
      sex_label_mode = 'cell_combined',
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
         (name, category, publisher_id, distributor_id, sex_label_mode,
          data_start_row, name_col_index,
          size1_col_start, size2_col_start, size3_col_start, size4_col_start, parse_notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, category,
       publisher_id ?? null, distributor_id ?? null,
       sex_label_mode,
       data_start_row, name_col_index,
       size1_col_start, size2_col_start, size3_col_start, size4_col_start,
       parse_notes ?? null]
    ) as any

    const rows = await query(
      `SELECT g.*, pub.name AS publisher_name, dist.name AS distributor_name
       FROM dataset_groups g
       LEFT JOIN data_sources pub  ON pub.id  = g.publisher_id
       LEFT JOIN data_sources dist ON dist.id = g.distributor_id
       WHERE g.id = ?`,
      [result.insertId]
    )
    return NextResponse.json({ success: true, data: (rows as any[])[0] }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}
