/**
 * POST /api/admin/xlsx-import-role
 *
 * 賃金構造基本統計調査 役職第２表 XLSX を role_wages テーブルへ一括インポート。
 *
 * XLSXフォーマット (1シート = 役職 × 企業規模の複数ブロックが横並び):
 *   Row 4  : 表頭分割番号 (01, 02, ...)
 *   Row 8  : 役職名 (101部長級 etc.)  ← col 2 に入る
 *   Row 10 : 勤続年数カテゴリヘッダー
 *   Row 13〜: データ
 *     col 0 : 空
 *     col 1 : 区分ラベル（"男女計\n学歴計", "男\n学歴計", "女\n学歴計" or 年齢, 学歴など）
 *     1ブロック 32列:
 *       勤続年数計: +0=所定内給与, +1=賞与, +2=労働者数
 *       0年       : +3, +4, +5
 *       1〜2年    : +6, +7, +8
 *       3〜4年    : +9, +10, +11
 *       5〜9年    : +12, +13, +14
 *       10〜14年  : +15, +16, +17
 *       15〜19年  : +18, +19, +20
 *       20〜24年  : +21, +22, +23
 *       25〜29年  : +24, +25, +26
 *       30年以上  : +27, +28, +29
 *     ブロック間に空白列2列 = 次ブロック開始は +32
 */

import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { query } from '@/lib/db'

// 勤続年数区分とブロック内オフセット (base = ブロック先頭列)
const TENURE_CATS: Array<{ label: string; offset: number }> = [
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

const BLOCK_WIDTH = 32 // 1ブロックの列数（データ30 + 空白2）

/** セル値を数値に変換 */
function n(v: unknown): number | null {
  if (v === null || v === undefined) return null
  const s = String(v).replace(/[\s,]/g, '').trim()
  if (!s || s === '-' || s === '−' || s === 'ー') return null
  const num = parseFloat(s)
  return isNaN(num) ? null : num
}

/** シートのセル値取得 */
function cv(ws: XLSX.WorkSheet, r: number, c: number): unknown {
  return ws[XLSX.utils.encode_cell({ r, c })]?.v ?? ''
}

/** 文字列の空白・改行を正規化 */
function clean(v: unknown): string {
  return String(v ?? '').replace(/[\s\u3000\n\r]/g, '').trim()
}

// 役職コード → 役職名マッピング
const ROLE_CODE_MAP: Record<string, string> = {
  '101': '部長級',
  '102': '課長級',
  '103': '係長級',
  '104': '職長・班長級',
  '105': '非役職',
}

/** 行の区分セル（col1）を (sex, education, ageGroup) にパース */
function parseCategory(raw: string): { sex: '計' | '男' | '女' | null; education: string; ageGroup: string } | null {
  // "男女計\n学歴計" → sex=計, education=学歴計, ageGroup=学歴計
  // "男\n学歴計" → sex=男, education=学歴計
  // "女\n学歴計" → sex=女
  // "　～19歳" 等の年齢行
  const cleaned = raw.replace(/\r/g, '').trim()
  if (!cleaned) return null

  // 性別+学歴計の親行
  if (cleaned.includes('男女計') && cleaned.includes('学歴計')) return { sex: '計', education: '学歴計', ageGroup: '学歴計' }
  if (cleaned.match(/^男\n?学歴計/) || cleaned === '男学歴計') return { sex: '男', education: '学歴計', ageGroup: '学歴計' }
  if (cleaned.match(/^女\n?学歴計/) || cleaned === '女学歴計') return { sex: '女', education: '学歴計', ageGroup: '学歴計' }
  // 性別+大学
  if (cleaned.includes('男女計') && cleaned.includes('大学院')) return { sex: '計', education: '大学院', ageGroup: '学歴計' }
  if (cleaned.includes('男女計') && cleaned.includes('大学')) return { sex: '計', education: '大学', ageGroup: '学歴計' }
  if (cleaned.match(/^男\n?大学院/) || cleaned === '男大学院') return { sex: '男', education: '大学院', ageGroup: '学歴計' }
  if (cleaned.match(/^男\n?大学/) || cleaned === '男大学') return { sex: '男', education: '大学', ageGroup: '学歴計' }
  if (cleaned.match(/^女\n?大学院/) || cleaned === '女大学院') return { sex: '女', education: '大学院', ageGroup: '学歴計' }
  if (cleaned.match(/^女\n?大学/) || cleaned === '女大学') return { sex: '女', education: '大学', ageGroup: '学歴計' }

  return null
}

type RoleRow = {
  roleName: string
  enterpriseSize: string
  sex: '計' | '男' | '女'
  education: string
  ageGroup: string
  tenureCategory: string
  scheduledWage: number | null
  annualBonus: number | null
  workers: number | null
  annualIncome: number | null
}

/** 1シートをパース */
function parseSheet(ws: XLSX.WorkSheet, surveyYear: number): RoleRow[] {
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1:A1')
  const maxRow = range.e.r
  const maxCol = range.e.c
  const rows: RoleRow[] = []

  // 役職行・企業規模行・データ開始行を動的に探す
  let roleRow = -1
  let sizeRow = -1
  let dataStartRow = 12
  for (let r = 0; r <= Math.min(25, maxRow); r++) {
    const labels = [clean(cv(ws, r, 0)), clean(cv(ws, r, 1)), clean(cv(ws, r, 2))]
    const label = labels.find(l => l.length > 0) ?? ''
    if (label.includes('役職') && !label.includes('部長') && !label.includes('課長')) roleRow = r
    if (label.includes('企業規模')) sizeRow = r
    if (label.includes('区分') || label === '区分') dataStartRow = r + 3
  }

  const effectiveRoleRow = roleRow >= 0 ? roleRow : 7
  const effectiveSizeRow = sizeRow >= 0 ? sizeRow : 6

  // データ列開始を動的に特定
  let dataColStart = 2
  for (let c = 1; c <= Math.min(10, maxCol); c++) {
    const v = clean(cv(ws, effectiveRoleRow, c))
    if (v.match(/^\d{3}/)) { dataColStart = c; break }
  }

  // ブロック情報を収集
  type Block = { colBase: number; roleName: string; enterpriseSize: string }
  const blocks: Block[] = []

  for (let c = dataColStart; c <= maxCol; c++) {
    const roleCell = clean(cv(ws, effectiveRoleRow, c))
    if (!roleCell || !roleCell.match(/^\d{3}/)) continue

    const codeMatch = roleCell.match(/^(\d+)(.+)$/)
    const roleName = codeMatch
      ? (ROLE_CODE_MAP[codeMatch[1]] ?? codeMatch[2])
      : roleCell

    const sizeCell = clean(cv(ws, effectiveSizeRow, c)) || '10人以上'
    blocks.push({ colBase: c, roleName, enterpriseSize: sizeCell })
    c += 29 // 1ブロック = 3列×10区分 = 30列
  }

  if (blocks.length === 0) return rows

  // データ行をパース
  let currentSex: '計' | '男' | '女' = '計'
  let currentEducation = '学歴計'

  for (let r = dataStartRow; r <= maxRow; r++) {
    const rawLabel = String(cv(ws, r, 1) ?? '').trim()
    const cleanLabel = rawLabel.replace(/[\r\n]/g, '').trim()

    if (!cleanLabel) continue

    // 性別・学歴の親行かチェック
    const parsed = parseCategory(rawLabel)
    if (parsed) {
      currentSex = parsed.sex ?? currentSex
      currentEducation = parsed.education
      // 学歴計行はそのまま "学歴計" としてデータ登録
    }

    // 年齢階級行かチェック
    const isAgeRow = /[\d～〜歳～]/.test(cleanLabel) && !cleanLabel.includes('学歴') && !cleanLabel.includes('大学') && !cleanLabel.includes('高校') && !cleanLabel.includes('専門') && !cleanLabel.includes('高専') && !cleanLabel.includes('中学') && !cleanLabel.includes('不明') && !cleanLabel.includes('男') && !cleanLabel.includes('女')
    // 学歴行
    const EDUCATION_LABELS = ['中学', '高校', '専門学校', '高専・短大', '大学', '大学院', '不明']
    const isEducationRow = EDUCATION_LABELS.some(e => cleanLabel.startsWith(e))

    if (isEducationRow) {
      currentEducation = cleanLabel
    }

    // 年齢階級（半角スペース付き "　～19歳" も含む）
    const ageGroup = isAgeRow ? cleanLabel : (parsed ? (isEducationRow ? '学歴計' : parsed.ageGroup) : (isEducationRow ? '学歴計' : null))
    const finalAgeGroup = ageGroup ?? (isEducationRow ? '学歴計' : cleanLabel)

    // 各ブロックのデータを取得
    for (const block of blocks) {
      for (const tc of TENURE_CATS) {
        const base = block.colBase + tc.offset
        const sw = n(cv(ws, r, base))
        const ab = n(cv(ws, r, base + 1))
        const wkRaw = n(cv(ws, r, base + 2))

        if (sw === null && ab === null && wkRaw === null) continue

        const workers = wkRaw !== null ? Math.round(wkRaw * 10) : null
        const annualIncome = sw !== null ? Math.round(sw * 12 + (ab ?? 0)) : null

        rows.push({
          roleName: block.roleName,
          enterpriseSize: block.enterpriseSize,
          sex: currentSex,
          education: currentEducation,
          ageGroup: finalAgeGroup,
          tenureCategory: tc.label,
          scheduledWage: sw,
          annualBonus: ab,
          workers,
          annualIncome,
        })
      }
    }
  }

  return rows
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const rawDatasetId = formData.get('dataset_id') ? Number(formData.get('dataset_id')) : null
    const rawSurveyYear = formData.get('survey_year') ? Number(formData.get('survey_year')) : null

    if (!file) return NextResponse.json({ success: false, error: 'ファイルが指定されていません' }, { status: 400 })

    // role_wages グループID = 4（固定）
    const ROLE_GROUP_ID = 4

    let datasetId = rawDatasetId
    let surveyYear: number = rawSurveyYear ?? new Date().getFullYear()

    if (datasetId) {
      // 既存 dataset を確認
      const dsRows = await query<{ survey_year: number; group_id: number }>(
        'SELECT survey_year, group_id FROM datasets WHERE id = ?', [datasetId]
      )
      if (dsRows.length === 0) {
        // dataset_id が存在しない場合は survey_year で再検索・自動作成
        datasetId = null
      } else {
        surveyYear = dsRows[0].survey_year
      }
    }

    if (!datasetId) {
      // dataset_id が渡されないか見つからない場合: survey_year で既存を探すか新規作成
      const year = rawSurveyYear ?? new Date().getFullYear()
      const existRows = await query<{ id: number }>(
        'SELECT id FROM datasets WHERE group_id = ? AND survey_year = ?', [ROLE_GROUP_ID, year]
      )
      if (existRows.length > 0) {
        datasetId = existRows[0].id
        surveyYear = year
      } else {
        // 自動作成
        const ins = await query<{ insertId: number }>(
          'INSERT INTO datasets (group_id, survey_year) VALUES (?, ?)', [ROLE_GROUP_ID, year]
        )
        datasetId = (ins as any).insertId
        surveyYear = year
        console.log(`[role-import] dataset 自動作成: id=${datasetId}, year=${year}`)
      }
    }

    const arrayBuffer = await file.arrayBuffer()
    const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' })

    let totalInserted = 0
    const sheetResults: Array<{ sheet: string; inserted: number }> = []

    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName]
      const parsed = parseSheet(ws, surveyYear)
      if (parsed.length === 0) continue

      // 既存データ削除（このシートのデータを洗い替え）
      await query('DELETE FROM role_wages WHERE dataset_id = ?', [datasetId])

      // バルクインサート
      const CHUNK = 500
      for (let i = 0; i < parsed.length; i += CHUNK) {
        const chunk = parsed.slice(i, i + CHUNK)
        const placeholders = chunk.map(() => '(?,?,?,?,?,?,?,?,?,?)').join(',')
        const values = chunk.flatMap(r => [
          datasetId, r.roleName, r.enterpriseSize, r.sex,
          r.education, r.ageGroup, r.tenureCategory,
          r.scheduledWage, r.annualBonus, r.workers,
        ])
        await query(
          `INSERT INTO role_wages
             (dataset_id, role_name, enterprise_size, sex, education, age_group, tenure_category, scheduled_wage, annual_bonus, workers)
           VALUES ${placeholders}`,
          values
        )
      }

      // annual_income を UPDATE
      await query(
        `UPDATE role_wages
         SET annual_income = ROUND(scheduled_wage * 12 + COALESCE(annual_bonus, 0), 1)
         WHERE dataset_id = ? AND scheduled_wage IS NOT NULL`,
        [datasetId]
      )

      totalInserted += parsed.length
      sheetResults.push({ sheet: sheetName, inserted: parsed.length })
    }

    return NextResponse.json({
      success: true,
      total_inserted: totalInserted,
      sheets: sheetResults,
      message: `${totalInserted}件のデータをインポートしました`,
    })
  } catch (err) {
    console.error('[role-import]', err)
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
