import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

// 子データセット更新（調査年・公表日・URLのみ）
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { survey_year, published_at, source_url } = await req.json()

    if (!survey_year) {
      return NextResponse.json(
        { success: false, message: 'survey_year は必須です' },
        { status: 400 }
      )
    }

    await query(
      `UPDATE datasets SET survey_year = ?, published_at = ?, source_url = ? WHERE id = ?`,
      [Number(survey_year), published_at || null, source_url || null, id]
    )

    const rows = await query(
      `SELECT d.*, g.name AS group_name, g.category
       FROM datasets d JOIN dataset_groups g ON g.id = d.group_id
       WHERE d.id = ?`,
      [id]
    )
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
    await query('DELETE FROM datasets WHERE id = ?', [id])
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}
