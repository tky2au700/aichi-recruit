import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET() {
  try {
    // 接続確認
    const ping = await query('SELECT 1 + 1 AS result')

    // データベース情報取得
    const dbInfo = await query('SELECT DATABASE() AS current_db, VERSION() AS version, NOW() AS server_time')

    // テーブル一覧取得
    const tables = await query('SHOW TABLES')

    return NextResponse.json({
      success: true,
      message: 'MySQL接続成功',
      connection: {
        host: process.env.MYSQL_HOST,
        port: process.env.MYSQL_PORT,
        database: process.env.MYSQL_DATABASE,
        user: process.env.MYSQL_USER,
      },
      server: dbInfo[0],
      ping: ping[0],
      tables,
      tableCount: tables.length,
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: 'MySQL接続失敗',
        error: error.message,
        code: error.code,
        connection: {
          host: process.env.MYSQL_HOST,
          port: process.env.MYSQL_PORT,
          database: process.env.MYSQL_DATABASE,
          user: process.env.MYSQL_USER,
        },
      },
      { status: 500 }
    )
  }
}
