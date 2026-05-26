import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug: rawSlug } = await params
  let roleName: string
  try { roleName = decodeURIComponent(rawSlug) } catch { roleName = rawSlug }

  try {
    // education='学歴計' AND age_group='学歴計' が集計行
    const buildQ = (where: string) => `
      SELECT rw.role_name, rw.sex, rw.enterprise_size,
             rw.tenure_category, rw.education, rw.age_group,
             rw.scheduled_wage, rw.annual_bonus, rw.annual_income, rw.workers,
             d.survey_year,
             dg.survey_group_name, dg.survey_table_name
      FROM role_wages rw
      JOIN datasets d ON rw.dataset_id = d.id
      JOIN dataset_groups dg ON d.group_id = dg.id
      WHERE ${where}
      ORDER BY d.survey_year DESC, rw.sex, rw.enterprise_size, rw.tenure_category`

    const rows = await query(
      buildQ('rw.role_name = ? AND rw.education = ? AND rw.age_group = ?'),
      [roleName, '学歴計', '学歴計']
    ) as any[]

    if (rows.length === 0) {
      return NextResponse.json({ success: false, message: '役職が見つかりません' }, { status: 404 })
    }

    const allYears = [...new Set(rows.map((r: any) => r.survey_year as number))].sort((a, b) => b - a)
    const latestYear = allYears[0]
    const latestRows = rows.filter((r: any) => r.survey_year === latestYear)

    // 時系列：tenure_category='勤続年数計' のみ
    const timeSeriesAll = rows
      .filter((r: any) => r.tenure_category === '勤続年数計')
      .map((r: any) => ({
        survey_year:     Number(r.survey_year),
        sex:             String(r.sex),
        enterprise_size: String(r.enterprise_size),
        tenure_category: String(r.tenure_category),
        scheduled_wage:  r.scheduled_wage != null ? Number(r.scheduled_wage) : null,
        annual_bonus:    r.annual_bonus   != null ? Number(r.annual_bonus)   : null,
        annual_income:   r.annual_income  != null ? Number(r.annual_income)  : null,
        workers:         r.workers        != null ? Number(r.workers)        : null,
      }))
      .sort((a: any, b: any) => a.survey_year - b.survey_year)

    const timeSeries = timeSeriesAll.filter(
      (r: any) => r.sex === '計' && r.enterprise_size === '10人以上'
    )

    return NextResponse.json({
      success: true,
      role_name:         roleName,
      survey_group_name: rows[0].survey_group_name ?? '賃金構造基本統計調査',
      survey_table_name: rows[0].survey_table_name ?? null,
      latest_year:       latestYear,
      all_years:         allYears,
      latest_data:       latestRows,
      time_series:       timeSeries,
      time_series_all:   timeSeriesAll,
    })
  } catch (error: any) {
    if (error.message?.includes("doesn't exist") || error.code === 'ER_NO_SUCH_TABLE') {
      return NextResponse.json({ success: false, message: 'データが見つかりません' }, { status: 404 })
    }
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}
