import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

// データセット一覧取得
export async function GET() {
  try {
    const datasets = await query(
      'SELECT * FROM datasets ORDER BY survey_year DESC, created_at DESC'
    )
    return NextResponse.json({ success: true, data: datasets })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: 'データセット取得失敗', error: error.message },
      { status: 500 }
    )
  }
}

// データセット新規作成
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, category, survey_year, published_at, source_name, source_url } = body

    if (!name || !category || !survey_year) {
      return NextResponse.json(
        { success: false, message: 'name, category, survey_year は必須です' },
        { status: 400 }
      )
    }

    await query(
      `INSERT INTO datasets (name, category, survey_year, published_at, source_name, source_url)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, category, survey_year, published_at || null, source_name || null, source_url || null]
    )

    const rows = await query('SELECT * FROM datasets ORDER BY id DESC LIMIT 1')
    return NextResponse.json({ success: true, data: rows[0] })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: 'データセット作成失敗', error: error.message },
      { status: 500 }
    )
  }
}
