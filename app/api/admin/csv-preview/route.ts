import { NextRequest, NextResponse } from 'next/server'
import { parseOccupationWageCsv, DEFAULT_CSV_RULE, type CsvParseRule } from '@/lib/csv-parser'
import { query } from '@/lib/db'
import iconv from 'iconv-lite'

// CSVをパースしてプレビューデータを返す（DBには保存しない）
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file    = formData.get('file') as File | null
    const groupId = formData.get('group_id') as string | null

    if (!file) {
      return NextResponse.json({ success: false, message: 'ファイルが見つかりません' }, { status: 400 })
    }
    if (!file.name.endsWith('.csv')) {
      return NextResponse.json({ success: false, message: 'CSVファイルのみ対応しています' }, { status: 400 })
    }

    // グループのCSVルールを取得（指定なし or 存在しなければデフォルト使用）
    let rule: CsvParseRule = DEFAULT_CSV_RULE
    if (groupId) {
      const groups = await query(`SELECT * FROM dataset_groups WHERE id = ?`, [groupId]) as any[]
      if (groups.length > 0) {
        const g = groups[0]
        rule = {
          data_start_row:  g.data_start_row,
          name_col_index:  g.name_col_index,
          size1_col_start: g.size1_col_start,
          size2_col_start: g.size2_col_start,
          size3_col_start: g.size3_col_start,
          size4_col_start: g.size4_col_start,
          sex_label_mode:  g.sex_label_mode ?? 'cell_combined',
        }
      }
    }

    const buffer = await file.arrayBuffer()
    const nodeBuffer = Buffer.from(buffer)

    let text: string
    if (nodeBuffer[0] === 0xef && nodeBuffer[1] === 0xbb && nodeBuffer[2] === 0xbf) {
      text = nodeBuffer.slice(3).toString('utf-8')
    } else {
      text = iconv.decode(nodeBuffer, 'CP932')
    }

    const rows = parseOccupationWageCsv(text, rule)

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'データが取得できませんでした。CSVフォーマットを確認してください。' },
        { status: 422 }
      )
    }

    // 集計情報 + 全件プレビューを返す
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
      preview: rows,
      all_occupations: occupations,
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: 'パース失敗', error: error.message },
      { status: 500 }
    )
  }
}
