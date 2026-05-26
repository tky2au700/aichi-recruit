import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug: rawSlug } = await params
  let slug: string
  try {
    slug = decodeURIComponent(rawSlug)
  } catch {
    slug = rawSlug
  }

  try {
    const rows = await query(
      `SELECT pw.prefecture, pw.sex,
              pw.age, pw.tenure_years,
              pw.scheduled_hours, pw.overtime_hours,
              pw.monthly_wage, pw.scheduled_wage,
              pw.annual_bonus, pw.annual_income, pw.workers,
              d.survey_year,
              dg.survey_group_name, dg.survey_table_name
       FROM prefecture_wages pw
       JOIN datasets d ON pw.dataset_id = d.id
       JOIN dataset_groups dg ON d.group_id = dg.id
       WHERE pw.prefecture = ?
       ORDER BY d.survey_year DESC, pw.sex`,
      [slug]
    ) as any[]

    if (rows.length === 0) {
      return NextResponse.json({ success: false, message: '都道府県が見つかりません' }, { status: 404 })
    }

    const allYears = [...new Set(rows.map((r: any) => r.survey_year as number))].sort((a, b) => b - a)
    const latestYear = allYears[0]
    const latestRows = rows.filter((r: any) => r.survey_year === latestYear)

    // 時系列データ（全年・全性別）
    const timeSeriesAll = rows.map((r: any) => {
      const mw = r.monthly_wage != null ? Number(r.monthly_wage) : null
      return {
        survey_year:     Number(r.survey_year),
        sex:             String(r.sex),
        annual_income:   r.annual_income   != null ? Number(r.annual_income)   : null,
        monthly_wage:    mw,
        scheduled_wage:  r.scheduled_wage  != null ? Number(r.scheduled_wage)  : null,
        annual_bonus:    r.annual_bonus    != null ? Number(r.annual_bonus)    : null,
        hourly_wage:     mw != null ? Math.round(mw * 1000 / 160) : null,
        scheduled_hours: r.scheduled_hours != null ? Number(r.scheduled_hours) : null,
        overtime_hours:  r.overtime_hours  != null ? Number(r.overtime_hours)  : null,
        workers:         r.workers         != null ? Number(r.workers)         : null,
        age:             r.age             != null ? Number(r.age)             : null,
        tenure_years:    r.tenure_years    != null ? Number(r.tenure_years)    : null,
      }
    }).sort((a: any, b: any) => a.survey_year - b.survey_year)

    const timeSeries = timeSeriesAll.filter((r: any) => r.sex === '計')

    // 全国との比較（最新年・同性別）
    const datasetId = (await query(
      `SELECT d.id FROM datasets d
       JOIN dataset_groups dg ON d.group_id = dg.id
       WHERE d.survey_year = ? AND dg.target_table = 'prefecture_wages'
       ORDER BY d.id DESC LIMIT 1`,
      [latestYear]
    ) as any[])[0]?.id

    let nationalData: any = null
    if (datasetId) {
      const natRows = await query(
        `SELECT sex, annual_income, monthly_wage, scheduled_wage,
                annual_bonus, scheduled_hours, overtime_hours, workers, age, tenure_years
         FROM prefecture_wages
         WHERE dataset_id = ? AND prefecture = '全国'`,
        [datasetId]
      ) as any[]
      nationalData = natRows.length > 0 ? natRows : null
    }

    // ランキング順位（男女計・最新年）
    let ranks: Record<string, { rank: number; total: number }> = {}
    if (datasetId) {
      const rankRows = await query(
        `SELECT
           SUM(annual_income  > tgt.ai AND annual_income  IS NOT NULL) + 1 AS rank_income,
           SUM(monthly_wage   > tgt.mw AND monthly_wage   IS NOT NULL) + 1 AS rank_wage,
           SUM(annual_bonus   > tgt.ab AND annual_bonus   IS NOT NULL) + 1 AS rank_bonus,
           SUM(overtime_hours < tgt.ot AND overtime_hours IS NOT NULL) + 1 AS rank_overtime,
           COUNT(DISTINCT prefecture) AS total
         FROM prefecture_wages
         JOIN (
           SELECT annual_income AS ai, monthly_wage AS mw, annual_bonus AS ab, overtime_hours AS ot
           FROM prefecture_wages
           WHERE dataset_id = ? AND prefecture = ? AND sex = '計' LIMIT 1
         ) AS tgt ON 1=1
         WHERE dataset_id = ? AND sex = '計' AND prefecture != '全国'`,
        [datasetId, slug, datasetId]
      ) as any[]
      if (rankRows[0]) {
        const r = rankRows[0]
        const total = Number(r.total)
        ranks = {
          annual_income:  { rank: Number(r.rank_income),   total },
          monthly_wage:   { rank: Number(r.rank_wage),     total },
          annual_bonus:   { rank: Number(r.rank_bonus),    total },
          overtime_hours: { rank: Number(r.rank_overtime), total },
        }
      }
    }

    return NextResponse.json({
      success: true,
      prefecture_name:   slug,
      survey_group_name: rows[0].survey_group_name,
      survey_table_name: rows[0].survey_table_name,
      latest_year:       latestYear,
      all_years:         allYears,
      latest_data:       latestRows,
      time_series:       timeSeries,
      time_series_all:   timeSeriesAll,
      national_data:     nationalData,
      ranks,
    })
  } catch (error: any) {
    if (error.message?.includes("doesn't exist") || error.code === 'ER_NO_SUCH_TABLE') {
      return NextResponse.json({ success: false, message: 'データが見つかりません' }, { status: 404 })
    }
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}
