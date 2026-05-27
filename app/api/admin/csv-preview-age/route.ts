import { NextRequest, NextResponse } from 'next/server'
import { parseAgeWageCsv } from '@/lib/csv-parser-age'
import iconv from 'iconv-lite'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file)
      return NextResponse.json({ success: false, message: 'ファイルが見つかりません' }, { status: 400 })
    if (!file.name.endsWith('.csv'))
      return NextResponse.json({ success: false, message: 'CSVファイルのみ対応しています' }, { status: 400 })

    const buffer = await file.arrayBuffer()
    const nodeBuffer = Buffer.from(buffer)

    let text: string
    if (nodeBuffer[0] === 0xef && nodeBuffer[1] === 0xbb && nodeBuffer[2] === 0xbf) {
      text = nodeBuffer.slice(3).toString('utf-8')
    } else {
      text = iconv.decode(nodeBuffer, 'CP932')
    }

    const rows = parseAgeWageCsv(text)

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'データが取得できませんでした。CSVフォーマットを確認してください。' },
        { status: 422 }
      )
    }

    // 集計
    const educations = [...new Set(rows.map(r => r.education))]
    const ageGroups  = [...new Set(rows.map(r => r.age_group))]
    const sexBreakdown = {
      計: rows.filter(r => r.sex === '計').length,
      男: rows.filter(r => r.sex === '男').length,
      女: rows.filter(r => r.sex === '女').length,
    }

    return NextResponse.json({
      success: true,
      summary: {
        total_rows:      rows.length,
        education_count: educations.length,
        age_group_count: ageGroups.length,
        sex_breakdown:   sexBreakdown,
        file_name:       file.name,
        file_size:       file.size,
      },
      preview:         rows.slice(0, 50),
      all_educations:  educations,
      all_age_groups:  ageGroups,
    })
  } catch (error: unknown) {
    const err = error as { message?: string }
    return NextResponse.json(
      { success: false, message: 'パース失敗', error: err.message },
      { status: 500 }
    )
  }
}
