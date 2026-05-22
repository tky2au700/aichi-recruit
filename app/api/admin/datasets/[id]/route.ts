import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

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
