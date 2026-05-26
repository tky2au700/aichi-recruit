/**
 * POST /api/admin/xlsx-preview-prefecture
 *
 * 都道府県別XLSXのシート情報とプレビューデータを返す。
 */

import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

const PREFECTURES = [
  '全国',
  '北海道', '青森', '岩手', '宮城', '秋田', '山形', '福島',
  '茨城', '栃木', '群馬', '埼玉', '千葉', '東京', '神奈川',
  '新潟', '富山', '石川', '福井', '山梨', '長野', '岐阜',
  '静岡', '愛知', '三重', '滋賀', '京都', '大阪', '兵庫',
  '奈良', '和歌山', '鳥取', '島根', '岡山', '広島', '山口',
  '徳島', '香川', '愛媛', '高知', '福岡', '佐賀', '長崎',
  '熊本', '大分', '宮崎', '鹿児島', '沖縄',
]

function n(v: unknown): number | null {
  if (v === null || v === undefined) return null
  const s = String(v).replace(/,|\s/g, '').trim()
  if (s === '' || s === '-' || s === '−') return null
  const num = parseFloat(s)
  return isNaN(num) ? null : num
}

function cv(ws: XLSX.WorkSheet, r: number, c: number): unknown {
  return ws[XLSX.utils.encode_cell({ r, c })]?.v ?? ''
}

function normPref(raw: unknown): string {
  return String(raw ?? '').replace(/[\s　]/g, '')
}

function extractPrefecture(ws: XLSX.WorkSheet, r: number): string | null {
  const a = normPref(cv(ws, r, 0))
  const b = normPref(cv(ws, r, 1))
  const c = normPref(cv(ws, r, 2))
  const combined = (a + b + c).replace(/\s/g, '')
  const match = PREFECTURES.find(p => combined.includes(p) || p.includes(combined))
  if (match) return match
  const bOnly = (a + b).replace(/\s/g, '')
  const match2 = PREFECTURES.find(p => bOnly.includes(p) || p.includes(bOnly))
  return match2 ?? null
}

function detectYearFromSheet(ws: XLSX.WorkSheet): number | null {
  for (let r = 0; r <= 4; r++) {
    for (let c = 0; c <= 8; c++) {
      const v = String(ws[XLSX.utils.encode_cell({ r, c })]?.v ?? '')
      const mR = v.match(/令和\s*(\d+)/)
      if (mR) return 2018 + parseInt(mR[1], 10)
      const mH = v.match(/平成\s*(\d+)/)
      if (mH) return 1988 + parseInt(mH[1], 10)
    }
  }
  return null
}

function countPrefectureRows(ws: XLSX.WorkSheet): number {
  const range  = XLSX.utils.decode_range(ws['!ref'] ?? 'A1:A1')
  const maxRow = Math.min(range.e.r, 100)
  let count = 0
  for (let r = 11; r <= maxRow; r++) {
    if (extractPrefecture(ws, r)) count++
  }
  return count
}

function parsePreview(ws: XLSX.WorkSheet, isSeparate: boolean, limit = 20): Record<string, unknown>[] {
  const range  = XLSX.utils.decode_range(ws['!ref'] ?? 'A1:A1')
  const maxRow = range.e.r
  const rows: Record<string, unknown>[] = []

  for (let r = 11; r <= maxRow && rows.length < limit; r++) {
    const pref = extractPrefecture(ws, r)
    if (!pref) continue

    if (!isSeparate) {
      const mw = n(cv(ws, r, 8))
      const sw = n(cv(ws, r, 9))
      const ab = n(cv(ws, r, 10))
      const wk = n(cv(ws, r, 11))
      if (mw === null && sw === null && ab === null && wk === null) continue
      rows.push({
        prefecture: pref, sex: '計',
        age: n(cv(ws, r, 3)), tenure_years: n(cv(ws, r, 4)),
        scheduled_hours: n(cv(ws, r, 5)), overtime_hours: n(cv(ws, r, 6)),
        monthly_wage: mw, scheduled_wage: sw, annual_bonus: ab,
        workers: wk !== null ? Math.round(wk * 10) : null,
      })
    } else {
      for (const { sex, base } of [{ sex: '男', base: 3 }, { sex: '女', base: 12 }]) {
        const mw = n(cv(ws, r, base + 5))
        const sw = n(cv(ws, r, base + 6))
        const ab = n(cv(ws, r, base + 7))
        const wk = n(cv(ws, r, base + 8))
        if (mw === null && sw === null && ab === null && wk === null) continue
        rows.push({
          prefecture: pref, sex,
          age: n(cv(ws, r, base)), tenure_years: n(cv(ws, r, base + 1)),
          scheduled_hours: n(cv(ws, r, base + 2)), overtime_hours: n(cv(ws, r, base + 3)),
          monthly_wage: mw, scheduled_wage: sw, annual_bonus: ab,
          workers: wk !== null ? Math.round(wk * 10) : null,
        })
        if (rows.length >= limit) break
      }
    }
  }
  return rows
}

export async function POST(req: NextRequest) {
  try {
    const fd   = await req.formData()
    const file = fd.get('file') as File | null

    if (!file) return NextResponse.json({ success: false, message: 'ファイルがありません' }, { status: 400 })
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      return NextResponse.json({ success: false, message: '.xlsx / .xls ファイルのみ対応しています' }, { status: 400 })
    }

    const buf = Buffer.from(await file.arrayBuffer())
    const wb  = XLSX.read(buf, { type: 'buffer', cellDates: false })

    let detectedYear: number | null = null
    const sheets = wb.SheetNames.map(name => {
      const ws = wb.Sheets[name]
      if (!ws || !ws['!ref']) {
        return { sheet_name: name, row_count: 0, parseable: false, preview: [] }
      }
      if (!detectedYear) detectedYear = detectYearFromSheet(ws)
      const sn         = name.replace(/\s/g, '')
      const isSeparate = sn.includes('男女別') || (sn.includes('男女') && sn.includes('別'))
      const rowCount   = countPrefectureRows(ws)
      const preview    = parsePreview(ws, isSeparate, 10)
      return { sheet_name: name, row_count: rowCount, parseable: rowCount >= 1, is_separate: isSeparate, preview }
    })

    return NextResponse.json({
      success:       true,
      file_name:     file.name,
      detected_year: detectedYear,
      total_sheets:  sheets.length,
      sheets,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ success: false, message: 'プレビュー失敗: ' + msg }, { status: 500 })
  }
}
