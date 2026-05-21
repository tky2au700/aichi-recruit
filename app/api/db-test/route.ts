import { NextResponse } from 'next/server'
import { getConnection } from '@/lib/db'

export async function GET() {
  let connection
  try {
    connection = await getConnection()

    // 接続確認
    const [pingResult] = await connection.query('SELECT 1 + 1 AS result')

    // データベース情報取得
    const [dbResult] = await connection.query('SELECT DATABASE() AS current_db, VERSION() AS version, NOW() AS server_time')

    // テーブル一覧取得
    const [tables] = await connection.query('SHOW TABLES')

    return NextResponse.json({
      success: true,
      message: 'MySQL接続成功',
      connection: {
        host: process.env.MYSQL_HOST,
        port: process.env.MYSQL_PORT,
        database: process.env.MYSQL_DATABASE,
        user: process.env.MYSQL_USER,
      },
      server: (dbResult as any[])[0],
      ping: (pingResult as any[])[0],
      tables: tables,
      tableCount: (tables as any[]).length,
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
  } finally {
    if (connection) await connection.end()
  }
}
