import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { parseOccupationWageCsv, DEFAULT_CSV_RULE, type CsvParseRule } from '@/lib/csv-parser'
import { query } from '@/lib/db'

/** シート名から調査年（西暦4桁）を推定する */
function detectYearFromSheetName(name: string): number | null {
  // 西暦4桁: "2025", "2025年"
  const m4 = name.match(/(\d{4})/)
  if (m4) {
    const y = parseInt(m4[1], 10)
    if (y >= 2000 && y <= 2100) return y
  }
  // 令和: 令和7年 → 2025, 令和6年 → 2024
  const mReiwa = name.match(/令和\s*(\d+)/)
  if (mReiwa) return 2018 + parseInt(mReiwa[1], 10)
  // 平成: 平成30年 → 2018
  const mHeisei = name.match(/平成\s*(\d+)/)
  if (mHeisei) return 1988 + parseInt(mHeisei[1], 10)
  // 2桁年号: "25" → 2025 (>=90なら1900年代とみなさない)
  const m2 = name.match(/^(\d{2})$/)
  if (m2) {
    const y = parseInt(m2[1], 10)
    if (y >= 0 && y <= 99) return 2000 + y
  }
  return null
}

/** XLSXシートをCSVテキストに変換（文字列として結合セルも含む） */
function sheetToCsvText(sheet: XLSX.WorkSheet): string {
  return XLSX.utils.sheet_to_csv(sheet, { FS: ',', RS: '\n', dense: false, skipHidden: false })
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file    = formData.get('file') as File | null
    const groupId = formData.get('group_id') as string | null

    if (!file) {
      return NextResponse.json({ success: false, message: 'ファイルが見つかりません' }, { status: 400 })
    }
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      return NextResponse.json({ success: false, message: '.xlsx / .xls ファイルのみ対応しています' }, { status: 400 })
    }

    // グループのパースルールを取得
    let rule: CsvParseRule = DEFAULT_CSV_RULE
    if (groupId) {
      const groups = await query('SELECT * FROM dataset_groups WHERE id = ?', [groupId]) as any[]
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

    const buffer     = Buffer.from(await file.arrayBuffer())
    const workbook   = XLSX.read(buffer, { type: 'buffer', cellDates: false })
    const sheetNames = workbook.SheetNames

    // 既存データセット一覧（グループ内）
    let existingDatasets: Array<{ id: number; survey_year: number }> = []
    if (groupId) {
      existingDatasets = await query(
        'SELECT id, survey_year FROM datasets WHERE group_id = ? ORDER BY survey_year DESC',
        [groupId]
      ) as any[]
    }

    const sheets = sheetNames.map(name => {
      const sheet   = workbook.Sheets[name]
      const csvText = sheetToCsvText(sheet)
      const rows    = parseOccupationWageCsv(csvText, rule)

      const detectedYear = detectYearFromSheetName(name)
      const matchedDs    = detectedYear
        ? existingDatasets.find(d => d.survey_year === detectedYear)
        : null

      const occupations = [...new Set(
        rows.filter(r => r.sex === '計' && r.enterprise_size === '企業規模計')
            .map(r => r.occupation_name)
      )]

      return {
        sheet_name:     name,
        detected_year:  detectedYear,
        dataset_id:     matchedDs?.id ?? null,
        row_count:      rows.length,
        occupation_count: occupations.length,
        parseable:      rows.length > 0,
      }
    })

    return NextResponse.json({
      success: true,
      file_name: file.name,
      file_size: file.size,
      sheet_count: sheetNames.length,
      sheets,
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: 'XLSXプレビュー失敗', error: error.message },
      { status: 500 }
    )
  }
}
