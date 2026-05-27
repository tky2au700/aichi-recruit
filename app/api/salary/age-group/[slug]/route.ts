import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug: rawSlug } = await params
  let slug: string
  try { slug = decodeURIComponent(rawSlug) } catch { slug = rawSlug }

  try {
    const buildQuery = (where: string) => `
      SELECT aw.sex, aw.education, aw.age_group, aw.enterprise_size,
             aw.age, aw.tenure_years,
             aw.scheduled_hours, aw.overtime_hours,
             aw.monthly_wage, aw.scheduled_wage,
             aw.annual_bonus, aw.annual_income, aw.workers,
             d.survey_year,
             dg.survey_group_name
      FROM age_wages aw
      JOIN datasets d ON aw.dataset_id = d.id
      JOIN dataset_groups dg ON d.group_id = dg.id
      WHERE ${where}
      ORDER BY d.survey_year DESC, aw.sex, aw.enterprise_size, aw.education`

    // age_group固定・education='学歴計'のデータを取得
    let rows: any[] = await query(
      buildQuery("aw.age_group = ? AND aw.education = '学歴計'"),
      [slug]
    ) as any[]

    if (rows.length === 0) {
      return NextResponse.json({ success: false, message: '年齢階級が見つかりません' }, { status: 404 })
    }

    const allYears = [...new Set(rows.map((r: any) => Number(r.survey_year)))].sort((a, b) => b - a)
    const latestYear = allYears[0]
    const latestRows = rows.filter((r: any) => Number(r.survey_year) === latestYear)

    const timeSeriesAll = rows.map((r: any) => ({
      survey_year:     Number(r.survey_year),
      sex:             String(r.sex),
      enterprise_size: String(r.enterprise_size),
      education:       String(r.education),
      annual_income:   r.annual_income   != null ? Number(r.annual_income)   : null,
      monthly_wage:    r.monthly_wage    != null ? Number(r.monthly_wage)    : null,
      scheduled_wage:  r.scheduled_wage  != null ? Number(r.scheduled_wage)  : null,
      annual_bonus:    r.annual_bonus    != null ? Number(r.annual_bonus)    : null,
      scheduled_hours: r.scheduled_hours != null ? Number(r.scheduled_hours) : null,
      overtime_hours:  r.overtime_hours  != null ? Number(r.overtime_hours)  : null,
      workers:         r.workers         != null ? Number(r.workers)         : null,
      age:             r.age             != null ? Number(r.age)             : null,
      tenure_years:    r.tenure_years    != null ? Number(r.tenure_years)    : null,
    })).sort((a, b) => a.survey_year - b.survey_year)

    const timeSeries = timeSeriesAll.filter(r => r.sex === '計' && r.enterprise_size === '企業規模計')

    return NextResponse.json({
      success: true,
      age_group:         slug,
      survey_group_name: rows[0].survey_group_name,
      latest_year:       latestYear,
      all_years:         allYears,
      latest_data:       latestRows,
      time_series:       timeSeries,
      time_series_all:   timeSeriesAll,
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}
