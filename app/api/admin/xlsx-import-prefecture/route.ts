/**
 * POST /api/admin/xlsx-import-prefecture
 *
 * 賃金構造基本統計調査 都道府県別参考表1 XLSX を
 * prefecture_wages テーブルへ一括インポートする。
 *
 * XLSXフォーマット:
 *   シート「男女計」: 都道府県 × 男女計データ（sex='計'）
 *     col E(4): 年齢, col F(5): 勤続年数, col G(6): 所定内労働時間数,
 *     col H(7): 超過労働時間数, col J(9): 現金給与額, col K(10): 所定内給与額,
 *     col L(11): 年間賞与, col M(12): 労働者数
 *   シート「男女別」: 左半分=男, 右半分=女
 *     男: col E(4)〜col N(13), 女: col O(14)〜col X(23)
 *
 * 都道府県名は col B(1) または col C(2) に2文字ずつ分割されて入る場合がある
 */

import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { query } from '@/lib/db'

// -------------------------------------------------------
// 47都道府県リスト（正規化用）
// -------------------------------------------------------
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

/** セル値を数値に変換（ハイフン・全角・空白 → null） */
function n(v: unknown): number | null {
  if (v === null || v === undefined) return null
  const s = String(v).replace(/,|\s/g, '').trim()
  if (s === '' || s === '-' || s === '−' || s === 'ー') return null
  const num = parseFloat(s)
  return isNaN(num) ? null : num
}

/** シートのセル値取得 */
function cv(ws: XLSX.WorkSheet, r: number, c: number): unknown {
  return ws[XLSX.utils.encode_cell({ r, c })]?.v ?? ''
}

/** 都道府県名の正規化（2セル分割を統合、スペース除去） */
function normPref(raw: unknown): string {
  return String(raw ?? '').replace(/[\s　]/g, '')
}

/**
 * 分割セルの都道府県名を復元する。
 * XLSXでは「北 海 道」のようにスペース区切りで入る場合がある。
 * col B(1) + col C(2) の値を結合してスペース除去する。
 */
function extractPrefecture(ws: XLSX.WorkSheet, r: number): string | null {
  // col A(0), B(1), C(2) を結合
  const a = normPref(cv(ws, r, 0))
  const b = normPref(cv(ws, r, 1))
  const c = normPref(cv(ws, r, 2))
  const combined = (a + b + c).replace(/\s/g, '')

  // 都道府県リストと照合（前方一致）
  const match = PREFECTURES.find(p => combined.includes(p) || p.includes(combined))
  if (match) return match

  // col B だけでも試す
  const bOnly = (a + b).replace(/\s/g, '')
  const match2 = PREFECTURES.find(p => bOnly.includes(p) || p.includes(bOnly))
  return match2 ?? null
}

// -------------------------------------------------------
// 男女計シートパーサー
// -------------------------------------------------------
interface PrefectureWageRow {
  prefecture:      string
  sex:             '計' | '男' | '女'
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

/** 男女計シートをパース（1シートに全都道府県・男女計） */
function parseCombinedSheet(ws: XLSX.WorkSheet): PrefectureWageRow[] {
  const range  = XLSX.utils.decode_range(ws['!ref'] ?? 'A1:A1')
  const maxRow = range.e.r
  const rows: PrefectureWageRow[] = []

  // データ行は row 11〜（0-indexed）= 表の12行目〜
  // col レイアウト（0-indexed）:
  //   0-2: 都道府県（分割）, 3: 年齢, 4: 勤続, 5: 所定内時間, 6: 超過時間,
  //   7: (空), 8: 現金給与, 9: 所定内給与, 10: 年間賞与, 11: 労働者数（十人）
  for (let r = 11; r <= maxRow; r++) {
    const pref = extractPrefecture(ws, r)
    if (!pref) continue

    const monthlyWage = n(cv(ws, r, 8))
    const scheduledWage = n(cv(ws, r, 9))
    const bonus = n(cv(ws, r, 10))
    const workersRaw = n(cv(ws, r, 11))

    // 有効データなし行はスキップ
    if (monthlyWage === null && scheduledWage === null && bonus === null && workersRaw === null) continue

    const workers = workersRaw !== null ? Math.round(workersRaw * 10) : null
    const annualIncome = monthlyWage !== null
      ? Math.round(monthlyWage * 12 + (bonus ?? 0))
      : null

    rows.push({
      prefecture:      pref,
      sex:             '計',
      age:             n(cv(ws, r, 3)),
      tenure_years:    n(cv(ws, r, 4)),
      scheduled_hours: n(cv(ws, r, 5)),
      overtime_hours:  n(cv(ws, r, 6)),
      monthly_wage:    monthlyWage,
      scheduled_wage:  scheduledWage,
      annual_bonus:    bonus,
      workers,
      annual_income:   annualIncome,
    })
  }
  return rows
}

/** 男女別シートをパース（左=男、右=女）
 *
 * col レイアウト（0-indexed）:
 *   A-C(0-2): 都道府県
 *   男: D(3)=年齢, E(4)=勤続, F(5)=所定内時間, G(6)=超過時間,
 *       H(7)=現金給与, I(8)=所定内給与, J(9)=賞与, K(10)=労働者数
 *   女: L(11)=年齢, M(12)=勤続, N(13)=所定内時間, O(14)=超過時間,
 *       P(15)=現金給与, Q(16)=所定内給与, R(17)=賞与, S(18)=労働者数
 *
 * ※ 男 base=3: age=+0, tenure=+1, sched=+2, ot=+3, monthly=+4, swage=+5, bonus=+6, workers=+7
 * ※ 女 base=11: 同じオフセット
 */
function parseSeparateSheet(ws: XLSX.WorkSheet): PrefectureWageRow[] {
  const range  = XLSX.utils.decode_range(ws['!ref'] ?? 'A1:A1')
  const maxRow = range.e.r
  const rows: PrefectureWageRow[] = []

  const SEX_COLS: Array<{ sex: '男' | '女'; base: number }> = [
    { sex: '男', base: 3  },
    { sex: '女', base: 11 },
  ]

  for (let r = 11; r <= maxRow; r++) {
    const pref = extractPrefecture(ws, r)
    if (!pref) continue

    for (const { sex, base } of SEX_COLS) {
      // base+0=年齢, +1=勤続, +2=所定内時間, +3=超過時間,
      // +4=現金給与(月), +5=所定内給与, +6=賞与, +7=労働者数(十人)
      const monthlyWage   = n(cv(ws, r, base + 4))
      const scheduledWage = n(cv(ws, r, base + 5))
      const bonus         = n(cv(ws, r, base + 6))
      const workersRaw    = n(cv(ws, r, base + 7))

      if (monthlyWage === null && scheduledWage === null && bonus === null && workersRaw === null) continue

      const workers = workersRaw !== null ? Math.round(workersRaw * 10) : null
      const annualIncome = monthlyWage !== null
        ? Math.round(monthlyWage * 12 + (bonus ?? 0))
        : null

      rows.push({
        prefecture:      pref,
        sex,
        age:             n(cv(ws, r, base + 0)),
        tenure_years:    n(cv(ws, r, base + 1)),
        scheduled_hours: n(cv(ws, r, base + 2)),
        overtime_hours:  n(cv(ws, r, base + 3)),
        monthly_wage:    monthlyWage,
        scheduled_wage:  scheduledWage,
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

async function insertPrefectureRows(datasetId: number, rows: PrefectureWageRow[]): Promise<number> {
  if (rows.length === 0) return 0
  let inserted = 0
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const ph    = batch.map(() => '(?,?,?,?,?,?,?,?,?,?,?,?)').join(',')
    const vals: unknown[] = []
    for (const row of batch) {
      vals.push(
        datasetId,
        row.prefecture, row.sex,
        row.age, row.tenure_years, row.scheduled_hours, row.overtime_hours,
        row.monthly_wage, row.scheduled_wage, row.annual_bonus, row.workers, row.annual_income,
      )
    }
    await query(
      `INSERT INTO prefecture_wages
        (dataset_id, prefecture, sex,
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

    if (!file) return NextResponse.json({ success: false, message: 'ファイルがありません' }, { status: 400 })
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      return NextResponse.json({ success: false, message: '.xlsx / .xls ファイルのみ対応しています' }, { status: 400 })
    }
    if (!datasetIdRaw) {
      return NextResponse.json({ success: false, message: '調査年データ一覧から取込先を選択してください' }, { status: 400 })
    }

    const dsRows = await query(
      'SELECT d.id, d.survey_year FROM datasets d WHERE d.id = ?',
      [parseInt(datasetIdRaw, 10)]
    ) as any[]
    if (dsRows.length === 0) {
      return NextResponse.json({ success: false, message: '指定されたデータセットが存在しません' }, { status: 404 })
    }
    const datasetId  = dsRows[0].id as number
    const surveyYear = dsRows[0].survey_year as number

    // 既存データ削除（再インポート対応）
    await query('DELETE FROM prefecture_wages WHERE dataset_id = ?', [datasetId])

    const buf = Buffer.from(await file.arrayBuffer())
    const wb  = XLSX.read(buf, { type: 'buffer', cellDates: false })

    const encoder = new TextEncoder()
    const stream  = new ReadableStream({
      async start(controller) {
        function send(obj: Record<string, unknown>) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))
        }

        try {
          const results: Array<{ sheet_name: string; inserted: number; error?: string }> = []
          let totalInserted = 0

          send({ type: 'start', total: wb.SheetNames.length })

          for (const sheetName of wb.SheetNames) {
            try {
              const ws = wb.Sheets[sheetName]
              if (!ws || !ws['!ref']) {
                results.push({ sheet_name: sheetName, inserted: 0, error: 'シートが空' })
                continue
              }

              send({ type: 'processing', sheet_name: sheetName })

              // シート名で男女計 / 男女別を判別
              let rows: PrefectureWageRow[]
              const sn = sheetName.replace(/\s/g, '')
              if (sn.includes('男女別') || sn.includes('男女') && sn.includes('別')) {
                rows = parseSeparateSheet(ws)
              } else {
                // 男女計 or デフォルト
                rows = parseCombinedSheet(ws)
              }

              if (rows.length === 0) {
                results.push({ sheet_name: sheetName, inserted: 0, error: 'データ行なし' })
                send({ type: 'sheet', sheet_name: sheetName, inserted: 0, error: 'データ行なし' })
                continue
              }

              const inserted = await insertPrefectureRows(datasetId, rows)
              totalInserted += inserted
              results.push({ sheet_name: sheetName, inserted })
              send({ type: 'sheet', sheet_name: sheetName, inserted, total_so_far: totalInserted })
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e)
              results.push({ sheet_name: sheetName, inserted: 0, error: msg })
              send({ type: 'sheet', sheet_name: sheetName, inserted: 0, error: msg })
            }
          }

          await query(
            'UPDATE datasets SET record_count = ?, imported_at = NOW() WHERE id = ?',
            [totalInserted, datasetId]
          )

          send({
            type:           'done',
            success:        true,
            message:        `${results.filter(r => r.inserted > 0).length}シート・${totalInserted.toLocaleString()}件を取り込みました`,
            survey_year:    surveyYear,
            dataset_id:     datasetId,
            total_inserted: totalInserted,
            results,
          })
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          send({ type: 'error', success: false, message: 'インポート失敗: ' + msg })
        } finally {
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type':      'text/event-stream',
        'Cache-Control':     'no-cache',
        'Connection':        'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ success: false, message: 'インポート失敗: ' + msg }, { status: 500 })
  }
}
