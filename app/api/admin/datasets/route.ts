import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

// group_id でフィルタ可能な一覧取得
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const groupId = searchParams.get('group_id')

    let sql = `
      SELECT d.*, g.name AS group_name, g.category
      FROM datasets d
      JOIN dataset_groups g ON g.id = d.group_id`
    const args: any[] = []

    if (groupId) {
      sql += ` WHERE d.group_id = ?`
      args.push(Number(groupId))
    }
    sql += ` ORDER BY d.survey_year DESC`

    const rows = await query(sql, args)
    return NextResponse.json({ success: true, data: rows })
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}

// 子データセット新規作成
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { group_id, survey_year, published_at, source_url } = body

    if (!group_id || !survey_year) {
      return NextResponse.json(
        { success: false, message: 'group_id と survey_year は必須です' },
        { status: 400 }
      )
    }

    const result = await query(
      `INSERT INTO datasets (group_id, survey_year, published_at, source_url)
       VALUES (?, ?, ?, ?)`,
      [Number(group_id), Number(survey_year), published_at || null, source_url || null]
    ) as any

    const rows = await query(
      `SELECT d.*, g.name AS group_name, g.category
       FROM datasets d
       JOIN dataset_groups g ON g.id = d.group_id
       WHERE d.id = ?`,
      [result.insertId]
    )
    return NextResponse.json({ success: true, data: (rows as any[])[0] }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}
