import { NextRequest, NextResponse } from 'next/server'
import { parseOccupationWageCsv } from '@/lib/csv-parser'

// CSVをパースしてプレビューデータを返す（DBには保存しない）
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ success: false, message: 'ファイルが見つかりません' }, { status: 400 })
    }

    if (!file.name.endsWith('.csv')) {
      return NextResponse.json({ success: false, message: 'CSVファイルのみ対応しています' }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()

    // Shift-JISデコード（賃金構造基本統計調査の標準エンコーディング）
    let text: string
    try {
      const decoder = new TextDecoder('shift-jis')
      text = decoder.decode(buffer)
    } catch {
      // UTF-8フォールバック
      const decoder = new TextDecoder('utf-8')
      text = decoder.decode(buffer)
    }

    const rows = parseOccupationWageCsv(text)

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'データが取得できませんでした。CSVフォーマットを確認してください。' },
        { status: 422 }
      )
    }

    // プレビュー用に先頭20件 + 集計情報を返す
    const occupations = [...new Set(rows.filter(r => r.sex === '計' && r.enterprise_size === '企業規模計').map(r => r.occupation_name))]
    const sexBreakdown = {
      計: rows.filter(r => r.sex === '計').length,
      男: rows.filter(r => r.sex === '男').length,
      女: rows.filter(r => r.sex === '女').length,
    }

    return NextResponse.json({
      success: true,
      summary: {
        total_rows: rows.length,
        occupation_count: occupations.length,
        sex_breakdown: sexBreakdown,
        file_name: file.name,
        file_size: file.size,
      },
      preview: rows
        .filter(r => r.sex === '計' && r.enterprise_size === '企業規模計')
        .slice(0, 20),
      all_occupations: occupations.slice(0, 50),
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: 'パース失敗', error: error.message },
      { status: 500 }
    )
  }
}
