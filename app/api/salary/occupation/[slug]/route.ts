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
    })
  } catch (error: any) {
    if (error.message?.includes("doesn't exist") || error.code === 'ER_NO_SUCH_TABLE') {
      return NextResponse.json({ success: false, message: 'データが見つかりません' }, { status: 404 })
    }
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}
