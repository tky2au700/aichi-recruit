import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET() {
  try {
    const rows = await query(`SELECT * FROM data_sources ORDER BY name ASC`)
    return NextResponse.json({ success: true, data: rows })
  } catch (error: any) {
    // テーブルが存在しない場合（DB初期化前）は空配列を返す
    if (error.message?.includes("doesn't exist") || error.code === 'ER_NO_SUCH_TABLE') {
      return NextResponse.json({ success: true, data: [], warning: 'テーブルが未作成です。DB初期化を実行してください。' })
    }
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, url, description } = await req.json()
    if (!name) {
      return NextResponse.json({ success: false, message: '名前は必須です' }, { status: 400 })
    }
    const result = await query(
      `INSERT INTO data_sources (name, url, description) VALUES (?, ?, ?)`,
      [name, url || null, description || null]
    ) as any
    const rows = await query(`SELECT * FROM data_sources WHERE id = ?`, [result.insertId])
    return NextResponse.json({ success: true, data: (rows as any[])[0] }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}
