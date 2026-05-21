import { NextResponse } from 'next/server'
import { query, getPool } from '@/lib/db'

// テスト用テーブルを作成してサンプルデータを挿入する
export async function POST() {
  try {
    const db = getPool()

    // テスト用テーブル作成
    await db.execute(`
      CREATE TABLE IF NOT EXISTS test_companies (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        industry VARCHAR(50),
        location VARCHAR(100),
        salary_min INT,
        salary_max INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)

    // サンプルデータ挿入（重複しない）
    await db.execute(`
      INSERT IGNORE INTO test_companies (id, name, industry, location, salary_min, salary_max) VALUES
        (1, '株式会社テックジャパン', 'IT・ソフトウェア', '東京都渋谷区', 400, 800),
        (2, '合同会社クリエイト愛知', 'デザイン・クリエイティブ', '愛知県名古屋市', 350, 600),
        (3, '株式会社フューチャーリンク', 'コンサルティング', '大阪府大阪市', 500, 1000),
        (4, '有限会社グリーンワークス', '製造業', '愛知県豊田市', 300, 500),
        (5, '株式会社スマートキャリア', 'HR・人材', '東京都新宿区', 450, 750)
    `)

    // データ確認
    const rows = await query('SELECT * FROM test_companies ORDER BY id')

    return NextResponse.json({
      success: true,
      message: 'テーブル作成・サンプルデータ挿入完了',
      data: rows,
      count: rows.length,
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: 'セットアップ失敗',
        error: error.message,
        code: error.code,
      },
      { status: 500 }
    )
  }
}

// テーブルデータを取得する
export async function GET() {
  try {
    // テーブル存在確認
    const tables = await query("SHOW TABLES LIKE 'test_companies'")

    if (tables.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'test_companiesテーブルが存在しません。先にセットアップを実行してください。',
        data: [],
      })
    }

    const rows = await query('SELECT * FROM test_companies ORDER BY id')

    return NextResponse.json({
      success: true,
      message: 'データ取得成功',
      data: rows,
      count: rows.length,
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: 'データ取得失敗',
        error: error.message,
        code: error.code,
      },
      { status: 500 }
    )
  }
}
