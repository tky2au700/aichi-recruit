/**
 * POST /api/admin/xlsx-import
 *
 * 賃金構造基本統計調査 第1表（業種別・年齢階級別）XLSX を
 * industry_wages テーブルへ一括インポートする。
 *
 * XLSXフォーマット:
 *   タブ  = 業種（産業計・C鉱業・D建設業 など）
 *   行    = 性別（計/男/女）× 学歴 × 年齢階級 の3層ネスト
 *   列    = 企業規模 × 8指標
 *
 * 確定レイアウト（実データから検証済み）:
 *   col2  : ラベル（性別+学歴が改行結合 or 年齢階級）
 *   col3-10: 企業規模計
 *   col11-18: 1,000人以上
 *   col19-26: 100〜999人
 *   col27-34: 10〜99人
 *   各8列 = 年齢, 勤続年数, 所定内時間, 超過時間, 月給, 所定内給与, 賞与, 労働者数（十人）
 */

import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { query } from '@/lib/db'

// -------------------------------------------------------
// 定数
// -------------------------------------------------------

type EntSize = '企業規模計' | '1000人以上' | '100〜999人' | '10〜99人'
type Sex     = '計' | '男' | '女'

// 固定列レイアウト（実データで確定）
const SIZE_BLOCKS: Array<{ name: EntSize; col: number }> = [
  { name: '企業規模計', col: 3  },
  { name: '1000人以上', col: 11 },
  { name: '100〜999人', col: 19 },
  { name: '10〜99人',   col: 27 },
]

// 学歴ラベルの正規化マップ（長いキーを先に置いて部分一致の誤検出を防ぐ）
const EDU_MAP: Record<string, string> = {
  '学歴計':       '学歴計',
  '専門学校':     '専門学校',
  '高専・短大':   '高専・短大',
  '高専短大':     '高専・短大',
  '大学院':       '大学院',   // "大学" より前に置く
  '大学':         '大学',
  '高校':         '高校',
  '中学':         '中学',
  '不明':         '不明',
}

// 性別ラベルの正規化マップ
const SEX_TOKENS = new Map<string, Sex>([
  ['男女計', '計'],
  ['計',     '計'],
  ['男',     '男'],
  ['女',     '女'],
])

// -------------------------------------------------------
// ユーティリティ
// -------------------------------------------------------

/** 数値変換（ハイフン・スペース区切り数値・空白 → null） */
function n(v: unknown): number | null {
  if (v === null || v === undefined) return null
  const s = String(v).replace(/,| /g, '').trim()
  if (s === '' || s === '-' || s === '−') return null
  const num = parseFloat(s)
  return isNaN(num) ? null : num
}

/** XLSXシートのセル値を取得 */
function cv(ws: XLSX.WorkSheet, r: number, c: number): unknown {
  return ws[XLSX.utils.encode_cell({ r, c })]?.v ?? ''
}

/** セル文字列を正規化（全角スペース・改行を半角スペースに統一して trim） */
function norm(v: unknown): string {
  return String(v ?? '').replace(/[\u3000\r\n]/g, ' ').replace(/\s+/g, ' ').trim()
}

// -------------------------------------------------------
// ラベル解析
// -------------------------------------------------------

interface ParsedLabel {
  sex?:       Sex
  education?: string
  age_group?: string
}

/**
 * col2 のラベルセルを解析する。
 *
 * セルには以下のパターンが存在する:
 *   "男　女　計\n学　歴　計"  → sex='計', education='学歴計'
 *   "　　男\n学　歴　計"      → sex='男', education='学歴計'
 *   "男女計\n大　学"          → sex='計', education='大学'
 *   "中　学"                  → education='中学'（sexは維持）
 *   "　　～１９歳"            → age_group='〜19歳'
 *   "２０～２４歳"            → age_group='20〜24歳'
 */
function parseLabel(raw: unknown): ParsedLabel {
  if (raw === null || raw === undefined) return {}
  const s = String(raw)

  // 改行で分割してそれぞれ処理
  const parts = s.split(/[\r\n]/).map(p => p.replace(/[\u3000\s]/g, '').trim()).filter(Boolean)

  let sex: Sex | undefined
  let education: string | undefined
  let age_group: string | undefined

  for (const part of parts) {
    // 性別判定
    const sexMatch = SEX_TOKENS.get(part)
    if (sexMatch !== undefined) { sex = sexMatch; continue }

    // 「男女計」が含まれる場合
    if (part.includes('男女計')) { sex = '計'; continue }
    if (/^男/.test(part) && !part.includes('歳')) { sex = '男'; continue }
    if (/^女/.test(part) && !part.includes('歳')) { sex = '女'; continue }

    // 学歴判定
    const eduKey = Object.keys(EDU_MAP).find(k => part.includes(k.replace(/\s/g, '')))
    if (eduKey) { education = EDU_MAP[eduKey]; continue }

    // 年齢階級判定（数字か ～ を含む）
    const ageNorm = part
      .replace(/～|〜/g, '〜')
      .replace(/[０-９]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))  // 全角数字→半角
    if (/\d/.test(ageNorm) || ageNorm.includes('〜') || ageNorm.includes('歳')) {
      age_group = ageNorm.replace(/^〜/, '〜')
      continue
    }
  }

  return { sex, education, age_group }
}

// -------------------------------------------------------
// 産業名検出
// -------------------------------------------------------

/** シート内の産業名を取得（行7のC列 = row6, col2 in 0-indexed） */
function detectIndustryName(ws: XLSX.WorkSheet, fallback: string): string {
  // 行5〜8、列2〜4 の範囲でテキストを探す
  for (const [r, c] of [[6, 2], [6, 3], [7, 2], [5, 2], [6, 1]]) {
    const v = norm(cv(ws, r, c))
    if (v && v.length > 1 && !/^\d+$/.test(v) && !v.includes('調査') && !v.includes('第')) {
      return v
    }
  }
  return fallback
}

// -------------------------------------------------------
// メインパーサー
// -------------------------------------------------------

interface IndustryWageRow {
  industry_name:   string
  sex:             Sex
  education:       string
  age_group:       string
  enterprise_size: EntSize
  age:             number | null
  tenure_years:    number | null
  scheduled_hours: number | null
  overtime_hours:  number | null
  monthly_wage:    number | null
  scheduled_wage:  number | null
  annual_bonus:    number | null
  workers:         number | null
  annual_income:   number | null
}

function parseIndustrySheet(ws: XLSX.WorkSheet, sheetName: string): IndustryWageRow[] {
  const ref    = ws['!ref'] ?? 'A1:A1'
  const range  = XLSX.utils.decode_range(ref)
  const maxRow = range.e.r

  const industryName = detectIndustryName(ws, sheetName)
  const rows: IndustryWageRow[] = []

  // 状態（前の行から引き継ぐ）
  let currentSex: Sex   = '計'
  let currentEdu        = '学歴計'
  let inDataSection     = false

  for (let r = 0; r <= maxRow; r++) {
    // col2 のラベルを取得（XLSXでは結合セルの値が col2 に入る）
    const rawLabel = ws[XLSX.utils.encode_cell({ r, c: 2 })]?.v

    // col2 が空の行はスキップ
    if (rawLabel === undefined || rawLabel === null || String(rawLabel).trim() === '') continue

    const parsed = parseLabel(rawLabel)

    // 性別・学歴の更新（年齢階級でない行）
    if (parsed.sex !== undefined || parsed.education !== undefined) {
      if (parsed.sex      !== undefined) currentSex = parsed.sex
      if (parsed.education !== undefined) currentEdu = parsed.education
      inDataSection = true

      // 年齢階級も同時に含む場合はそのまま続行
      if (!parsed.age_group) continue
    }

    // 年齢階級行のみデータを抽出
    if (!parsed.age_group) continue
    if (!inDataSection) continue

    const ageGroup = parsed.age_group

    for (const { name: sizeName, col: c } of SIZE_BLOCKS) {
      const monthly  = n(cv(ws, r, c + 4))
      const sched    = n(cv(ws, r, c + 5))
      const bonus    = n(cv(ws, r, c + 6))
      const wrkRaw   = n(cv(ws, r, c + 7))

      // 有効データがなければスキップ（"-" のみの行）
      if (monthly === null && sched === null && bonus === null && wrkRaw === null) continue

      const workers     = wrkRaw !== null ? Math.round(wrkRaw * 10) : null  // 十人 → 人
      const annualIncome = monthly !== null
        ? Math.round(monthly * 12 + (bonus ?? 0))
        : null

      rows.push({
        industry_name:   industryName,
        sex:             currentSex,
        education:       currentEdu,
        age_group:       ageGroup,
        enterprise_size: sizeName,
        age:             n(cv(ws, r, c)),
        tenure_years:    n(cv(ws, r, c + 1)),
        scheduled_hours: n(cv(ws, r, c + 2)),
        overtime_hours:  n(cv(ws, r, c + 3)),
        monthly_wage:    monthly,
        scheduled_wage:  sched,
        annual_bonus:    bonus,
        workers,
        annual_income:   annualIncome,
      })
    }
  }

  return rows
}

// -------------------------------------------------------
// DB挿入
// -------------------------------------------------------

const BATCH_SIZE = 200

async function insertIndustryRows(datasetId: number, rows: IndustryWageRow[], targetTable: string): Promise<number> {
  if (rows.length === 0) return 0
  let inserted = 0
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const ph    = batch.map(() => '(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').join(',')
    const vals: unknown[] = []
    for (const row of batch) {
      vals.push(
        datasetId,
        row.industry_name, row.sex, row.education, row.age_group, row.enterprise_size,
        row.age, row.tenure_years, row.scheduled_hours, row.overtime_hours,
        row.monthly_wage, row.scheduled_wage, row.annual_bonus, row.workers, row.annual_income,
      )
    }
    await query(
      `INSERT INTO \`${targetTable}\`
        (dataset_id, industry_name, sex, education, age_group, enterprise_size,
         age, tenure_years, scheduled_hours, overtime_hours,
         monthly_wage, scheduled_wage, annual_bonus, workers, annual_income)
       VALUES ${ph}`,
      vals
    )
    inserted += batch.length
  }
  return inserted
}

// -------------------------------------------------------
// Route Handler
// -------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const fd = await req.formData()
    const file         = fd.get('file')       as File   | null
    const datasetIdRaw = fd.get('dataset_id') as string | null
    const groupIdRaw   = fd.get('group_id')   as string | null

    if (!file) return NextResponse.json({ success: false, message: 'ファイルがありません' }, { status: 400 })
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      return NextResponse.json({ success: false, message: '.xlsx / .xls ファイルのみ対応しています' }, { status: 400 })
    }

    // dataset_id が指定されていればそれを使い、なければ group_id から解決
    let datasetId: number
    let targetTable: string
    let surveyYear: number

    if (datasetIdRaw) {
      // 調査年データ一覧で選択済みの dataset を使う
      const dsRows = await query(
        'SELECT d.id, d.survey_year, g.target_table FROM datasets d JOIN dataset_groups g ON g.id = d.group_id WHERE d.id = ?',
        [parseInt(datasetIdRaw, 10)]
      ) as any[]
      if (dsRows.length === 0) {
        return NextResponse.json({ success: false, message: '指定されたデータセットが存在しません' }, { status: 404 })
      }
      datasetId   = dsRows[0].id
      surveyYear  = dsRows[0].survey_year
      targetTable = dsRows[0].target_table || 'industry_wages'
    } else {
      // group_id のみの場合（後方互換）
      if (!groupIdRaw) {
        return NextResponse.json({ success: false, message: '調査年データ一覧から取込先を選択してください' }, { status: 400 })
      }
      const groupId = parseInt(groupIdRaw, 10)
      const groupRows = await query(
        'SELECT id, target_table FROM dataset_groups WHERE id = ?',
        [groupId]
      ) as any[]
      if (groupRows.length === 0) {
        return NextResponse.json({ success: false, message: '指定されたグループが存在しません' }, { status: 404 })
      }
      targetTable = groupRows[0].target_table || 'industry_wages'
      return NextResponse.json({ success: false, message: '調査年データ一覧から取込先を選択してください' }, { status: 400 })
    }

    // 既存データ削除（再インポート対応）
    await query(`DELETE FROM \`${targetTable}\` WHERE dataset_id = ?`, [datasetId])

    // XLSX パース＆インポート
    const buf = Buffer.from(await file.arrayBuffer())
    const wb  = XLSX.read(buf, { type: 'buffer', cellDates: false })

    const results: Array<{
      sheet_name:    string
      industry_name: string
      inserted:      number
      error?:        string
    }> = []

    let totalInserted = 0

    for (const sheetName of wb.SheetNames) {
      try {
        const ws = wb.Sheets[sheetName]
        if (!ws || !ws['!ref']) {
          results.push({ sheet_name: sheetName, industry_name: sheetName, inserted: 0, error: 'シートが空' })
          continue
        }
        const rows = parseIndustrySheet(ws, sheetName)
        if (rows.length === 0) {
          results.push({ sheet_name: sheetName, industry_name: sheetName, inserted: 0, error: 'データ行なし' })
          continue
        }
        const inserted = await insertIndustryRows(datasetId, rows, targetTable)
        totalInserted += inserted
        results.push({ sheet_name: sheetName, industry_name: rows[0].industry_name, inserted })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        results.push({ sheet_name: sheetName, industry_name: sheetName, inserted: 0, error: msg })
      }
    }

    // record_count 更新
    await query(
      'UPDATE datasets SET record_count = ?, imported_at = NOW() WHERE id = ?',
      [totalInserted, datasetId]
    )

    return NextResponse.json({
      success:         true,
      message:         `${results.filter(r => r.inserted > 0).length}シート・${totalInserted.toLocaleString()}件を取り込みました`,
      survey_year:     surveyYear,
      dataset_id:      datasetId,
      total_inserted:  totalInserted,
      results,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ success: false, message: 'XLSXインポート失敗: ' + msg }, { status: 500 })
  }
}
