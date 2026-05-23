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

/** ファイル内のセルテキストから調査年を推定（タイトル行を走査） */
function detectYearFromSheet(sheet: XLSX.WorkSheet): number | null {
  // 行1〜3、列2〜4 あたりにタイトルがある
  for (let r = 0; r <= 4; r++) {
    for (let c = 0; c <= 6; c++) {
      const v = String(sheet[XLSX.utils.encode_cell({ r, c })]?.v ?? '')
      const mReiwa = v.match(/令和\s*(\d+)/)
      if (mReiwa) return 2018 + parseInt(mReiwa[1], 10)
      const mHeisei = v.match(/平成\s*(\d+)/)
      if (mHeisei) return 1988 + parseInt(mHeisei[1], 10)
    }
  }
  return null
}

/**
 * シートから産業名を取得。
 * 実データ構造: row6(0-indexed)=「産業」ラベル行, col2 に産業名が入る
 * 例: row6=[産業, "", 産業計]
 */
function detectIndustryName(sheet: XLSX.WorkSheet, sheetName: string): string {
  // row6 col2 が産業名（最も確実）
  for (const [r, c] of [[6, 2], [6, 3], [7, 2], [5, 2], [6, 1]]) {
    const cell = sheet[XLSX.utils.encode_cell({ r, c })]
    const val  = (cell?.v?.toString() ?? '').replace(/\s+/g, '').trim()
    if (val && val.length > 1 && !/^\d+$/.test(val)
      && !val.includes('調査') && !val.includes('第') && !val.includes('表')
      && !val.includes('民営') && !val.includes('公営') && val !== '産業') {
      return val
    }
  }
  return sheetName
}

/**
 * データ行数をカウント（col2 に値がある行 = ラベル行）。
 * 実構造では col2 にすべてのラベルが入る。
 */
function countDataRows(sheet: XLSX.WorkSheet): number {
  const range  = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1:A1')
  const maxRow = Math.min(range.e.r, 400)
  let count = 0
  for (let r = 12; r <= maxRow; r++) {
    const cell = sheet[XLSX.utils.encode_cell({ r, c: 2 })]
    if (cell?.v !== undefined && String(cell.v).trim() !== '') count++
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

    // ファイル名 → 最初のシート内テキスト の優先順位で調査年を推定
    let detectedYear = detectYearFromText(file.name)
    if (!detectedYear && wb.SheetNames.length > 0) {
      const firstWs = wb.Sheets[wb.SheetNames[0]]
      if (firstWs) detectedYear = detectYearFromSheet(firstWs)
    }

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
