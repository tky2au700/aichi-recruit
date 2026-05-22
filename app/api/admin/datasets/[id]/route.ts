import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

// データセット更新
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { name, category, survey_year, published_at, source_name, source_url } = body

    if (!name || !category || !survey_year) {
      return NextResponse.json(
        { success: false, message: 'name, category, survey_year は必須です' },
        { status: 400 }
      )
    }

    await query(
      `UPDATE datasets
       SET name = ?, category = ?, survey_year = ?, published_at = ?, source_name = ?, source_url = ?
       WHERE id = ?`,
      [name, category, Number(survey_year), published_at || null, source_name || null, source_url || null, id]
    )

    const rows = await query('SELECT * FROM datasets WHERE id = ?', [id])
    return NextResponse.json({ success: true, data: rows[0] })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: '更新失敗', error: error.message },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await query('DELETE FROM datasets WHERE id = ?', [id])
    return NextResponse.json({ success: true, message: '削除しました' })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: '削除失敗', error: error.message },
      { status: 500 }
    )
  }
}
