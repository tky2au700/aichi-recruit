/**
 * POST /api/admin/xlsx-preview-role
 * 役職第２表 XLSX のプレビューデータを返す（先頭20行）
 */

import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

const TENURE_CATS = [
  { label: '勤続年数計', offset: 0  },
  { label: '0年',        offset: 3  },
  { label: '1～2年',     offset: 6  },
  { label: '3～4年',     offset: 9  },
  { label: '5～9年',     offset: 12 },
  { label: '10～14年',   offset: 15 },
  { label: '15～19年',   offset: 18 },
  { label: '20～24年',   offset: 21 },
  { label: '25～29年',   offset: 24 },
  { label: '30年以上',   offset: 27 },
]

const BLOCK_WIDTH = 32

const ROLE_CODE_MAP: Record<string, string> = {
  '101': '部長級', '102': '課長級', '103': '係長級',
  '104': '職長・班長級', '105': '非役職',
}

function n(v: unknown): number | null {
  if (v === null || v === undefined) return null
  const s = String(v).replace(/[\s,]/g, '').trim()
  if (!s || s === '-' || s === '−' || s === 'ー') return null
  const num = parseFloat(s)
  return isNaN(num) ? null : num
}

function cv(ws: XLSX.WorkSheet, r: number, c: number): unknown {
  return ws[XLSX.utils.encode_cell({ r, c })]?.v ?? ''
}

function clean(v: unknown): string {
  return String(v ?? '').replace(/[\s\n\r]/g, '').trim()
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ success: false, error: 'ファイルが指定されていません' }, { status: 400 })

    const arrayBuffer = await file.arrayBuffer()
    const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' })

    console.log('[v0] role-preview: sheetNames =', wb.SheetNames)
    const sheetPreviews: Array<{
      sheetName: string
      blocks: Array<{ roleName: string; enterpriseSize: string }>
      preview: Array<{
        sex: string; education: string; ageGroup: string; tenureCategory: string
        scheduledWage: number | null; annualBonus: number | null; workers: number | null
      }>
      totalEstimate: number
    }> = []

    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName]
      const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1:A1')
      const maxRow = range.e.r
      const maxCol = range.e.c

      console.log('[v0] role-preview sheet:', sheetName, 'maxRow=', maxRow, 'maxCol=', maxCol)

      // 役職行・企業規模行・データ開始行を動的に探す
      let roleRow = -1
      let sizeRow = -1
      let dataStartRow = 12
      for (let r = 0; r <= Math.min(20, maxRow); r++) {
        const label = clean(cv(ws, r, 0)) || clean(cv(ws, r, 1))
        if (label === '役職') roleRow = r
        if (label === '企業規模') sizeRow = r
        if (label === '区分' || label === '区　分') dataStartRow = r + 3
      }
      console.log('[v0] role-preview roleRow=', roleRow, 'sizeRow=', sizeRow, 'dataStartRow=', dataStartRow)

      // ブロック収集: col1は区分ラベル列、col2以降にデータブロックが並ぶ
      const blocks: Array<{ colBase: number; roleName: string; enterpriseSize: string }> = []
      for (let c = 2; c <= maxCol; c++) {
        const roleCell = roleRow >= 0 ? clean(cv(ws, roleRow, c)) : ''
        if (!roleCell) continue
        const codeMatch = roleCell.match(/^(\d+)(.+)$/)
        const roleName = codeMatch ? (ROLE_CODE_MAP[codeMatch[1]] ?? codeMatch[2]) : roleCell
        const sizeCell = (sizeRow >= 0 ? clean(cv(ws, sizeRow, c)) : '') || '10人以上'
        blocks.push({ colBase: c, roleName, enterpriseSize: sizeCell })
        // 1ブロック = 3列×10勤続区分 = 30列、次ブロックへジャンプ
        c += 29
      }
      console.log('[v0] role-preview blocks found:', blocks.length, blocks.map(b => b.roleName + '/' + b.enterpriseSize))
      // プレビュー行（先頭ブロック × 先頭20行）
      const previewRows: typeof sheetPreviews[0]['preview'] = []
      const firstBlock = blocks[0]
      if (!firstBlock) continue

      let currentSex: string = '計'
      let currentEducation = '学歴計'

      const EDUCATION_LABELS = ['中学', '高校', '専門学校', '高専・短大', '大学', '大学院', '不明']

      for (let r = dataStartRow; r <= maxRow && previewRows.length < 20; r++) {
        const rawLabel = String(cv(ws, r, 1) ?? '').trim()
        const cleanLabel = rawLabel.replace(/[\r\n]/g, '').trim()
        if (!cleanLabel) continue

        // 性別判定
        if (cleanLabel.includes('男女計') && cleanLabel.includes('学歴計')) { currentSex = '計'; currentEducation = '学歴計' }
        else if (cleanLabel.match(/^男/) && cleanLabel.includes('学歴計')) { currentSex = '男'; currentEducation = '学歴計' }
        else if (cleanLabel.match(/^女/) && cleanLabel.includes('学歴計')) { currentSex = '女'; currentEducation = '学歴計' }

        if (EDUCATION_LABELS.some(e => cleanLabel.startsWith(e))) currentEducation = cleanLabel.split(/[\n\r]/)[0]

        // 勤続年数計のみプレビュー
        const tc = TENURE_CATS[0]
        const base = firstBlock.colBase + tc.offset
        const sw = n(cv(ws, r, base))
        const ab = n(cv(ws, r, base + 1))
        const wk = n(cv(ws, r, base + 2))
        if (sw === null && ab === null && wk === null) continue

        previewRows.push({
          sex: currentSex,
          education: currentEducation,
          ageGroup: cleanLabel,
          tenureCategory: tc.label,
          scheduledWage: sw,
          annualBonus: ab,
          workers: wk !== null ? Math.round(wk * 10) : null,
        })
        count++
      }

      // 総件数推定
      const dataRows = maxRow - 12
      const totalEstimate = blocks.length * dataRows * TENURE_CATS.length

      sheetPreviews.push({
        sheetName,
        blocks: blocks.map(b => ({ roleName: b.roleName, enterpriseSize: b.enterpriseSize })),
        preview: previewRows,
        totalEstimate,
      })
    }

    // 既存の XlsxSheet 型 { sheet_name, row_count, parseable } に合わせた形式で返す
    const sheetsForList = sheetPreviews.map(s => ({
      sheet_name:    s.sheetName,
      industry_name: s.blocks.map(b => `${b.roleName}(${b.enterpriseSize})`).join(', '),
      row_count:     s.totalEstimate,
      parseable:     s.blocks.length > 0,
      blocks:        s.blocks,
      preview:       s.preview,
    }))
    return NextResponse.json({ success: true, sheets: sheetsForList })
  } catch (err) {
    console.error('[role-preview]', err)
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
