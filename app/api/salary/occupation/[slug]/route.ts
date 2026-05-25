import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug: rawSlug } = await params

  // URLエンコードされた日本語職種名を復元
  let slug: string
  try {
    slug = decodeURIComponent(rawSlug)
  } catch {
    slug = rawSlug
  }

  try {
    // colCheck廃止: occupation_slug=NULL固定、hourly_wage=NULL固定
    const buildQuery = (whereClause: string) => `
      SELECT ow.occupation_name,
             NULL AS occupation_slug,
             ow.sex, ow.enterprise_size,
             ow.age, ow.tenure_years,
             ow.scheduled_hours, ow.overtime_hours,
             ow.monthly_wage, ow.scheduled_wage,
             ow.annual_bonus, ow.annual_income, NULL AS hourly_wage, ow.workers,
             d.survey_year,
             dg.survey_group_name, dg.survey_table_name
      FROM occupation_wages ow
      JOIN datasets d ON ow.dataset_id = d.id
      JOIN dataset_groups dg ON d.group_id = dg.id
      WHERE ${whereClause}
      ORDER BY d.survey_year DESC, ow.sex, ow.enterprise_size`

    // 1. occupation_name で完全一致検索
    let rows: any[] = await query(buildQuery('ow.occupation_name = ?'), [slug]) as any[]

    // 2. 部分一致フォールバック
    if (rows.length === 0) {
      rows = await query(buildQuery('ow.occupation_name LIKE ?'), [`%${slug}%`]) as any[]
    }

    if (rows.length === 0) {
      return NextResponse.json({ success: false, message: '職種が見つかりません' }, { status: 404 })
    }

    // 年度一覧
    const allYears = [...new Set(rows.map((r: any) => r.survey_year as number))].sort((a, b) => b - a)
    const latestYear = allYears[0]
    const latestRows = rows.filter((r: any) => r.survey_year === latestYear)

    // 時系列（全 sex × enterprise_size の組み合わせ）
    const timeSeriesAll: Array<{
      survey_year: number
      sex: string
      enterprise_size: string
      annual_income: number | null
      monthly_wage: number | null
      scheduled_wage: number | null
      annual_bonus: number | null
      hourly_wage: number | null
      scheduled_hours: number | null
      overtime_hours: number | null
      workers: number | null
      age: number | null
    }> = rows.map((r: any) => {
      const mw = r.monthly_wage != null ? Number(r.monthly_wage) : null
      return {
        survey_year:     Number(r.survey_year),
        sex:             String(r.sex),
        enterprise_size: String(r.enterprise_size),
        annual_income:   r.annual_income    != null ? Number(r.annual_income)   : null,
        monthly_wage:    mw,
        scheduled_wage:  r.scheduled_wage   != null ? Number(r.scheduled_wage)  : null,
        annual_bonus:    r.annual_bonus     != null ? Number(r.annual_bonus)    : null,
        hourly_wage:     r.hourly_wage      != null ? Number(r.hourly_wage)
                       : mw                != null ? Math.round(mw * 1000 / 160) : null,
        scheduled_hours: r.scheduled_hours  != null ? Number(r.scheduled_hours) : null,
        overtime_hours:  r.overtime_hours   != null ? Number(r.overtime_hours)  : null,
        workers:         r.workers          != null ? Number(r.workers)         : null,
        age:             r.age              != null ? Number(r.age)             : null,
      }
    }).sort((a, b) => a.survey_year - b.survey_year)

    // 後方互換のため time_series（男女計・企業規模計のみ）も残す
    const timeSeries = timeSeriesAll.filter(r => r.sex === '計' && r.enterprise_size === '企業規模計')

    // 各指標のランキング順位を取得（男女計・企業規模計・最新年度）
    const latestDatasetId = latestRows.find((r: any) => r.sex === '計' && r.enterprise_size === '企業規模計')
      ? (rows.find((r: any) => r.survey_year === latestYear) as any)?.dataset_id ?? null
      : null

    // dataset_id を直接取得
    const datasetRows = await query(
      `SELECT d.id as dataset_id FROM datasets d
       JOIN dataset_groups dg ON d.group_id = dg.id
       WHERE d.survey_year = ? AND dg.target_table = 'occupation_wages'
       ORDER BY d.id DESC LIMIT 1`,
      [latestYear]
    ) as Array<{ dataset_id: number }>
    const datasetId = datasetRows[0]?.dataset_id ?? null

    let ranks: Record<string, { rank: number; total: number }> = {}
    if (datasetId != null) {
      const rankRows = await query(
        `SELECT
           -- 年収・月給・賞与・労働者数: 高い順（自分より高い職種数 + 1 = 順位）
           SUM(annual_income   > tgt.ai AND annual_income   IS NOT NULL) + 1 AS rank_income,
           SUM(scheduled_wage  > tgt.sw AND scheduled_wage  IS NOT NULL) + 1 AS rank_wage,
           SUM(annual_bonus    > tgt.ab AND annual_bonus    IS NOT NULL) + 1 AS rank_bonus,
           SUM(workers         > tgt.wk AND workers         IS NOT NULL) + 1 AS rank_workers,
           -- 残業時間・労働時間: 少ない順（自分より少ない職種数 + 1 = 順位）
           SUM(overtime_hours  < tgt.ot AND overtime_hours  IS NOT NULL) + 1 AS rank_overtime,
           SUM(scheduled_hours < tgt.sh AND scheduled_hours IS NOT NULL) + 1 AS rank_hours,
           -- 平均年齢: 参考値（若い順）
           SUM(age             < tgt.ag AND age             IS NOT NULL) + 1 AS rank_age,
           COUNT(DISTINCT occupation_name) AS total
         FROM occupation_wages
         JOIN (
           SELECT annual_income AS ai, scheduled_wage AS sw, annual_bonus AS ab,
                  overtime_hours AS ot, scheduled_hours AS sh, workers AS wk, age AS ag
           FROM occupation_wages
           WHERE dataset_id = ? AND occupation_name = ?
             AND sex = '計' AND enterprise_size = '企業規模計'
           LIMIT 1
         ) AS tgt ON 1=1
         WHERE dataset_id = ? AND sex = '計' AND enterprise_size = '企業規模計'`,
        [datasetId, slug, datasetId]
      ) as Array<Record<string, number>>

      if (rankRows[0]) {
        const r = rankRows[0]
        const total = Number(r.total)
        // 年収・月給・賞与・時給は高い順（= rank_income は降順位）
        // 残業時間・労働時間は少ない順（rank_overtime は昇順）
        // 労働者数は多い順（rank_workers は降順）
        ranks = {
          annual_income:   { rank: Number(r.rank_income),   total },
          scheduled_wage:  { rank: Number(r.rank_wage),     total },
          annual_bonus:    { rank: Number(r.rank_bonus),    total },
          overtime_hours:  { rank: Number(r.rank_overtime), total },
          scheduled_hours: { rank: Number(r.rank_hours),    total },
          workers:         { rank: Number(r.rank_workers),  total },
          age:             { rank: Number(r.rank_age),      total },
        }
      }
    }

    return NextResponse.json({
      success: true,
      occupation_name:   rows[0].occupation_name,
      occupation_slug:   rows[0].occupation_slug,
      survey_group_name: rows[0].survey_group_name,
      survey_table_name: rows[0].survey_table_name,
      latest_year:       latestYear,
      all_years:         allYears,
      latest_data:       latestRows,
      time_series:       timeSeries,
      time_series_all:   timeSeriesAll,
      ranks,
    })
  } catch (error: any) {
    if (error.message?.includes("doesn't exist") || error.code === 'ER_NO_SUCH_TABLE') {
      return NextResponse.json({ success: false, message: 'データが見つかりません' }, { status: 404 })
    }
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}
