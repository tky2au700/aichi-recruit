import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { name, url, description } = await req.json()
    if (!name) {
      return NextResponse.json({ success: false, message: '名前は必須です' }, { status: 400 })
    }
    await query(
      `UPDATE data_sources SET name = ?, url = ?, description = ? WHERE id = ?`,
      [name, url || null, description || null, id]
    )
    const rows = await query(`SELECT * FROM data_sources WHERE id = ?`, [id])
    return NextResponse.json({ success: true, data: (rows as any[])[0] })
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    // 使用中チェック
    const used = await query(
      `SELECT COUNT(*) AS cnt FROM dataset_groups WHERE publisher_id = ? OR distributor_id = ?`,
      [id, id]
    ) as any[]
    if (used[0].cnt > 0) {
      return NextResponse.json(
        { success: false, message: 'このデータソースはグループで使用中のため削除できません' },
        { status: 409 }
      )
    }
    await query(`DELETE FROM data_sources WHERE id = ?`, [id])
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}
