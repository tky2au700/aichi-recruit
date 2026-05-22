import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

// グループ更新
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const {
      name, category,
      publisher_id, distributor_id,
      sex_label_mode,
      data_start_row, name_col_index,
      size1_col_start, size2_col_start, size3_col_start, size4_col_start,
      parse_notes,
    } = body

    if (!name) {
      return NextResponse.json({ success: false, message: '調査名は必須です' }, { status: 400 })
    }

    await query(
      `UPDATE dataset_groups SET
         name = ?, category = ?,
         publisher_id = ?, distributor_id = ?,
         sex_label_mode = ?,
         data_start_row = ?, name_col_index = ?,
         size1_col_start = ?, size2_col_start = ?, size3_col_start = ?, size4_col_start = ?,
         parse_notes = ?
       WHERE id = ?`,
      [name, category,
       publisher_id ?? null, distributor_id ?? null,
       sex_label_mode ?? 'cell_combined',
       data_start_row, name_col_index,
       size1_col_start, size2_col_start, size3_col_start, size4_col_start,
       parse_notes ?? null, id]
    )

    const rows = await query(
      `SELECT g.*, pub.name AS publisher_name, dist.name AS distributor_name
       FROM dataset_groups g
       LEFT JOIN data_sources pub  ON pub.id  = g.publisher_id
       LEFT JOIN data_sources dist ON dist.id = g.distributor_id
       WHERE g.id = ?`,
      [id]
    )
    return NextResponse.json({ success: true, data: (rows as any[])[0] })
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}

// グループ削除（CASCADE: datasets + occupation_wages も削除）
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await query(`DELETE FROM dataset_groups WHERE id = ?`, [id])
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}
