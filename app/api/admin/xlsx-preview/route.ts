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
  // シート名から「(民＋公)」プレフィックスを抽出
  const prefixMatch = sheetName.match(/^(\(民[＋+]公\))\s*/)
  const prefix = prefixMatch ? prefixMatch[1] : ''

  // row6 col2 が産業名（最も確実）
  for (const [r, c] of [[6, 2], [6, 3], [7, 2], [5, 2], [6, 1]]) {
    const cell = sheet[XLSX.utils.encode_cell({ r, c })]
    const val  = (cell?.v?.toString() ?? '').replace(/\s+/g, '').trim()
    if (val && val.length > 1 && !/^\d+$/.test(val)
      && !val.includes('調査') && !val.includes('第') && !val.includes('表')
      && !val.includes('民営') && !val.includes('公営') && val !== '産業') {
      return prefix ? `${prefix}${val}` : val
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

/** 1シートをパースしてプレビュー行を返す（最大 previewRows 件） */
function parseSheetPreview(ws: XLSX.WorkSheet, previewRows = 30): Record<string, unknown>[] {
  const range  = XLSX.utils.decode_range(ws['!ref'] ?? 'A1:A1')
  const maxRow = range.e.r
  const rows: Record<string, unknown>[] = []

  const SIZE_BLOCKS = [
    { name: '企業規模計', col: 3  },
    { name: '1000人以上', col: 11 },
    { name: '100〜999人', col: 19 },
    { name: '10〜99人',   col: 27 },
  ]

  const EDU_MAP: Record<string, string> = {
    '学歴計': '学歴計', '専門学校': '専門学校', '高専・短大': '高専・短大',
    '高専短大': '高専・短大', '大学院': '大学院', '大学': '大学',
    '高校': '高校', '中学': '中学', '不明': '不明',
  }
  const SEX_MAP = new Map([['男女計','計'],['計','計'],['男','男'],['女','女']])

  function n(v: unknown): number | null {
    if (v === null || v === undefined) return null
    const s = String(v).replace(/,| /g, '').trim()
    if (s === '' || s === '-' || s === '−') return null
    const num = parseFloat(s)
    return isNaN(num) ? null : num
  }
  function cv(r: number, c: number): unknown {
    return ws[XLSX.utils.encode_cell({ r, c })]?.v ?? ''
  }

  let currentSex = '計'
  let currentEdu = '学歴計'
  let inData = false

  for (let r = 0; r <= maxRow && rows.length < previewRows * 4; r++) {
    const raw = ws[XLSX.utils.encode_cell({ r, c: 2 })]?.v
    if (raw === undefined || raw === null || String(raw).trim() === '') continue

    const s    = String(raw)
    const parts = s.split(/[\r\n]/).map(p => p.replace(/[\u3000\s]/g, '').trim()).filter(Boolean)

    let sex: string | undefined, edu: string | undefined, ageGroup: string | undefined
    for (const part of parts) {
      const sm = SEX_MAP.get(part)
      if (sm) { sex = sm; continue }
      if (part.includes('男女計')) { sex = '計'; continue }
      if (/^男/.test(part) && !part.includes('歳')) { sex = '男'; continue }
      if (/^女/.test(part) && !part.includes('歳')) { sex = '女'; continue }
      const ek = Object.keys(EDU_MAP).find(k => part.includes(k))
      if (ek) { edu = EDU_MAP[ek]; continue }
      const ag = part.replace(/～|〜/g, '〜').replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
      if (/\d/.test(ag) || ag.includes('〜') || ag.includes('歳')) { ageGroup = ag }
    }

    if (sex !== undefined || edu !== undefined) {
      if (sex) currentSex = sex
      if (edu) currentEdu = edu
      inData = true
      if (!ageGroup) continue
    }
    if (!ageGroup || !inData) continue

    for (const { name: sz, col: c } of SIZE_BLOCKS) {
      const monthly = n(cv(r, c + 4))
      const sched   = n(cv(r, c + 5))
      const bonus   = n(cv(r, c + 6))
      const workers = n(cv(r, c + 7))
      if (monthly === null && sched === null && bonus === null && workers === null) continue
      rows.push({
        sex:             currentSex,
        education:       currentEdu,
        age_group:       ageGroup,
        enterprise_size: sz,
        age:             n(cv(r, c)),
        tenure_years:    n(cv(r, c + 1)),
        scheduled_hours: n(cv(r, c + 2)),
        overtime_hours:  n(cv(r, c + 3)),
        monthly_wage:    monthly,
        scheduled_wage:  sched,
        annual_bonus:    bonus,
        workers:         workers !== null ? Math.round(workers * 10) : null,
      })
      if (rows.length >= previewRows) break
    }
    if (rows.length >= previewRows) break
  }
  return rows
}

export async function POST(req: NextRequest) {
  try {
    const fd        = await req.formData()
    const file      = fd.get('file') as File | null
    const sheetName = fd.get('sheet_name') as string | null  // 指定時はそのシートの詳細を返す

    if (!file) {
      return NextResponse.json({ success: false, message: 'ファイルがありません' }, { status: 400 })
    }
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      return NextResponse.json({ success: false, message: '.xlsx / .xls ファイルのみ対応しています' }, { status: 400 })
    }

    const buf = Buffer.from(await file.arrayBuffer())
    const wb  = XLSX.read(buf, { type: 'buffer', cellDates: false })

    // --- シート詳細モード ---
    if (sheetName) {
      const ws = wb.Sheets[sheetName]
      if (!ws) {
        return NextResponse.json({ success: false, message: `シート "${sheetName}" が見つかりません` }, { status: 404 })
      }
      const industryName = detectIndustryName(ws, sheetName)
      const preview      = parseSheetPreview(ws, 50)
      return NextResponse.json({ success: true, sheet_name: sheetName, industry_name: industryName, preview })
    }

    // --- シート一覧モード ---
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
