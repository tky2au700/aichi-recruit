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
  // 半角・全角スペース、改行をすべて除去
  return String(v ?? '').replace(/[\s\u3000\n\r]/g, '').trim()
}

function normalizeAgeGroup(raw: string): string {
  return raw.replace(/^[\s　]+/, '').replace(/~/g, '～')
}

function normalizeSex(sex: '計' | '男' | '女'): string {
  return sex === '計' ? '男女計' : sex
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ success: false, error: 'ファイルが指定されていません' }, { status: 400 })

    const arrayBuffer = await file.arrayBuffer()
    const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' })

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

      // 役職行・企業規模行・データ開始行を動的に探す
      let roleRow = -1
      let sizeRow = -1
      let dataStartRow = 12
      for (let r = 0; r <= Math.min(25, maxRow); r++) {
        // col0〜2 のいずれかにラベルがある可能性を考慮
        const labels = [clean(cv(ws, r, 0)), clean(cv(ws, r, 1)), clean(cv(ws, r, 2))]
        const label = labels.find(l => l.length > 0) ?? ''
        if (label.includes('役職') && !label.includes('部長') && !label.includes('課長')) roleRow = r
        if (label.includes('企業規模')) sizeRow = r
        // 区分(row9) → ヘッダー行(row10) → 千円行(row11) → データ開始(row12) = r+3
        if (label.includes('区分') || label === '区分') dataStartRow = r + 3
      }

      // ブロック収集: col0〜2 以降にデータブロックが並ぶ
      // 役職行が見つかった場合はその行から、見つからない場合は row 7 をデフォルトに
      const effectiveRoleRow = roleRow >= 0 ? roleRow : 7
      const effectiveSizeRow = sizeRow >= 0 ? sizeRow : 6
      const blocks: Array<{ colBase: number; roleName: string; enterpriseSize: string }> = []
      // データ列の開始: ラベル列を飛ばして最初に数値または役職コードが現れる列を探す
      let dataColStart = 2
      for (let c = 1; c <= Math.min(10, maxCol); c++) {
        const v = clean(cv(ws, effectiveRoleRow, c))
        if (v.match(/^\d{3}/)) { dataColStart = c; break }
      }
      for (let c = dataColStart; c <= maxCol; c++) {
        const roleCell = clean(cv(ws, effectiveRoleRow, c))
        if (!roleCell || !roleCell.match(/^\d{3}/)) continue
        const codeMatch = roleCell.match(/^(\d+)(.+)$/)
        const roleName = codeMatch ? (ROLE_CODE_MAP[codeMatch[1]] ?? codeMatch[2]) : roleCell
        const sizeCell = clean(cv(ws, effectiveSizeRow, c)) || '10人以上'
        // colBase = 役職コード列 = ラベル列(C列相当)、データ列は colBase+1 以降
        blocks.push({ colBase: c, roleName, enterpriseSize: sizeCell })
        // 1ブロック = 役職コード兼ラベル列(1) + 3列×10勤続区分(30) = 31列
        c += 30
      }
      // プレビュー行（先頭ブロック × 先頭20行）
      const previewRows: typeof sheetPreviews[0]['preview'] = []
      const firstBlock = blocks[0]
      if (!firstBlock) continue

      let currentSex: string = '計'
      let currentEducation = '学歴計'

      const EDUCATION_LABELS = ['中学', '高校', '専門学校', '高専・��大', '大学', '大学院', '不明']

      // 列構成: col0=空, col1=ラベル（男女計/年齢等）, col2=データ開始（所定内給与）
      // 役職コードはcol2にあるが、データ行のラベルはcol1にある
      const labelCol = firstBlock.colBase - 1   // col1（ラベル列）
      const dataColOffset = 0                    // colBase（col2）からデータ列開始

      for (let r = dataStartRow; r <= maxRow && previewRows.length < 20; r++) {
        const rawLabel = String(cv(ws, r, labelCol) ?? '').trim()
        const cleanLabel = rawLabel.replace(/[\r\n]/g, '').replace(/^\s+/, '').trim()
        if (!cleanLabel) continue

        // 性別・学歴の親行を判定してステート更新 → データ行としては扱わない
        let isHeader = false
        if (cleanLabel.includes('男女計') && cleanLabel.includes('学歴計')) {
          currentSex = '計'; currentEducation = '学歴計'; isHeader = true
        } else if (cleanLabel.includes('男') && cleanLabel.includes('学歴計') && !cleanLabel.includes('男女')) {
          currentSex = '男'; currentEducation = '学歴計'; isHeader = true
        } else if (cleanLabel.includes('女') && cleanLabel.includes('学歴計')) {
          currentSex = '女'; currentEducation = '学歴計'; isHeader = true
        } else if (cleanLabel.includes('男女計') && cleanLabel.includes('大学')) {
          currentSex = '計'; currentEducation = cleanLabel.includes('院') ? '大学院' : '大学'; isHeader = true
        } else if (cleanLabel.includes('男') && cleanLabel.includes('大学') && !cleanLabel.includes('男女')) {
          currentSex = '男'; currentEducation = cleanLabel.includes('院') ? '大学院' : '大学'; isHeader = true
        } else if (cleanLabel.includes('女') && cleanLabel.includes('大学')) {
          currentSex = '女'; currentEducation = cleanLabel.includes('院') ? '大学院' : '大学'; isHeader = true
        } else if (EDUCATION_LABELS.some(e => cleanLabel.startsWith(e))) {
          currentEducation = EDUCATION_LABELS.find(e => cleanLabel.startsWith(e))!; isHeader = true
        }

        // 勤続年数計のみプレビュー（データ列 = colBase + dataColOffset + offset）
        const tc = TENURE_CATS[0]
        const base = firstBlock.colBase + dataColOffset + tc.offset
        const sw = n(cv(ws, r, base))
        const ab = n(cv(ws, r, base + 1))
        const wk = n(cv(ws, r, base + 2))
        if (sw === null && ab === null && wk === null) continue

        // 年齢グループ:
        //   isHeader（男女計/学歴計・中学・高校等）→ 「学歴計」（その学歴の年齢合計）
        //   年齢行（～19歳・20～24歳等）→ ラベルそのまま
        const ageGroup = isHeader ? '学歴計' : cleanLabel.replace(/^[\s　]+/, '')

        previewRows.push({
          roleName:      firstBlock.roleName,
          enterpriseSize: firstBlock.enterpriseSize,
          sex:           normalizeSex(currentSex),
          education:     currentEducation,
          ageGroup:      normalizeAgeGroup(ageGroup),
          tenureCategory: tc.label,
          scheduledWage: sw,
          annualBonus:   ab,
          workers:       wk !== null ? Math.round(wk * 10) : null,
        })
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
