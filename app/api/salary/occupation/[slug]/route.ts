import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  try {
    // slug に一致する最新年度のデータを全性別・全企業規模で取得
    const rows = await query(
      `SELECT ow.occupation_name, ow.occupation_slug,
              ow.sex, ow.enterprise_size,
              ow.age, ow.tenure_years,
              ow.scheduled_hours, ow.overtime_hours,
              ow.monthly_wage, ow.scheduled_wage,
              ow.annual_bonus, ow.annual_income, ow.hourly_wage, ow.workers,
              d.survey_year,
              dg.survey_group_name, dg.survey_table_name
       FROM occupation_wages ow
       JOIN datasets d ON ow.dataset_id = d.id
       JOIN dataset_groups dg ON d.group_id = dg.id
       WHERE ow.occupation_slug = ?
       ORDER BY d.survey_year DESC, ow.sex, ow.enterprise_size`,
      [slug]
    ) as Array<{
      occupation_name: string
      occupation_slug: string
      sex: string
      enterprise_size: string
      age: number | null
      tenure_years: number | null
      scheduled_hours: number | null
      overtime_hours: number | null
      monthly_wage: number | null
      scheduled_wage: number | null
      annual_bonus: number | null
      annual_income: number | null
      hourly_wage: number | null
      workers: number | null
      survey_year: number
      survey_group_name: string
      survey_table_name: string | null
    }>

    if (rows.length === 0) {
      return NextResponse.json({ success: false, message: '職種が見つかりません' }, { status: 404 })
    }

    // 年度一覧
    const allYears = [...new Set(rows.map(r => r.survey_year))].sort((a, b) => b - a)
    const latestYear = allYears[0]
    const latestRows = rows.filter(r => r.survey_year === latestYear)

    // 時系列（男女計・企業規模計 のみ）
    const timeSeries = rows
      .filter(r => r.sex === '計' && r.enterprise_size === '企業規模計')
      .map(r => ({
        survey_year: r.survey_year,
        annual_income: r.annual_income,
        monthly_wage: r.monthly_wage,
        hourly_wage: r.hourly_wage,
      }))
      .sort((a, b) => a.survey_year - b.survey_year)

    return NextResponse.json({
      success: true,
      occupation_name: rows[0].occupation_name,
      occupation_slug: rows[0].occupation_slug,
      survey_group_name: rows[0].survey_group_name,
      survey_table_name: rows[0].survey_table_name,
      latest_year: latestYear,
      all_years: allYears,
      latest_data: latestRows,
      time_series: timeSeries,
    })
  } catch (error: any) {
    if (error.message?.includes("doesn't exist") || error.code === 'ER_NO_SUCH_TABLE') {
      return NextResponse.json({ success: false, message: 'データが見つかりません' }, { status: 404 })
    }
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}
