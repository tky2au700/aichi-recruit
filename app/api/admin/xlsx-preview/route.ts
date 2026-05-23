/**
 * POST /api/admin/xlsx-preview
 *
 * 業種別XLSXのシート一覧と各シートのデータ行数をプレビューする。
 * タブ = 業種（産業計・C鉱業・D建設業 など）
 * 調査年はユーザーが管理画面で手動入力するため、ここでは推定のみ行う。
 */

import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

/** ファイル名・シート内テキストから調査年（西暦4桁）を推定 */
function detectYearFromText(text: string): number | null {
  const mReiwa = text.match(/令和\s*(\d+)/)
  if (mReiwa) return 2018 + parseInt(mReiwa[1], 10)
  const mHeisei = text.match(/平成\s*(\d+)/)
  if (mHeisei) return 1988 + parseInt(mHeisei[1], 10)
  const m4 = text.match(/(\d{4})/)
  if (m4) {
    const y = parseInt(m4[1], 10)
    if (y >= 2000 && y <= 2100) return y
  }
  return null
}

/** シートから産業名を取得（行3〜8の C 列付近） */
function detectIndustryName(sheet: XLSX.WorkSheet, sheetName: string): string {
  // C6 (r=5, c=2) が最も多い
  for (const [r, c] of [[5, 2], [5, 3], [6, 2], [4, 2], [5, 1]]) {
    const cell = sheet[XLSX.utils.encode_cell({ r, c })]
    const val  = cell?.v?.toString().trim() ?? ''
    if (val && val.length > 1 && !/^\d+$/.test(val)) return val
  }
  return sheetName
}

/** データ行数を大まかに数える（行9〜200 を走査） */
function countDataRows(sheet: XLSX.WorkSheet): number {
  const range   = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1:A1')
  const maxRow  = Math.min(range.e.r, 200)
  let count = 0
  for (let r = 9; r <= maxRow; r++) {
    // A〜F列のどこかに値があれば有効行
    for (let c = 0; c <= 5; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })]
      if (cell?.v !== undefined && cell.v !== '') { count++; break }
    }
  }
  return count
}

export async function POST(req: NextRequest) {
  try {
    const fd   = await req.formData()
    const file = fd.get('file') as File | null

    if (!file) {
      return NextResponse.json({ success: false, message: 'ファイルがありません' }, { status: 400 })
    }
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      return NextResponse.json({ success: false, message: '.xlsx / .xls ファイルのみ対応しています' }, { status: 400 })
    }

    const buf = Buffer.from(await file.arrayBuffer())
    const wb  = XLSX.read(buf, { type: 'buffer', cellDates: false })

    // ファイル名から調査年を推定
    const detectedYear = detectYearFromText(file.name)

    const sheets = wb.SheetNames.map(name => {
      const ws = wb.Sheets[name]
      if (!ws || !ws['!ref']) {
        return { sheet_name: name, industry_name: name, row_count: 0, parseable: false }
      }
      const industryName = detectIndustryName(ws, name)
      const rowCount     = countDataRows(ws)
      return {
        sheet_name:    name,
        industry_name: industryName,
        row_count:     rowCount,
        parseable:     rowCount > 3,
      }
    })

    return NextResponse.json({
      success:          true,
      file_name:        file.name,
      detected_year:    detectedYear,
      total_sheets:     sheets.length,
      parseable_sheets: sheets.filter(s => s.parseable).length,
      sheets,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ success: false, message: 'XLSXプレビュー失敗: ' + msg }, { status: 500 })
  }
}
