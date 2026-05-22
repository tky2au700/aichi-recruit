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
    // 追加列の存在チェック
    const colCheck = await query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'occupation_wages'
         AND COLUMN_NAME IN ('occupation_slug','hourly_wage')`
    ) as Array<{ COLUMN_NAME: string }>
    const existingCols = new Set(colCheck.map((c: any) => c.COLUMN_NAME as string))

    const hourlyCol    = existingCols.has('hourly_wage')     ? 'ow.hourly_wage'     : 'NULL AS hourly_wage'
    const slugSelectCol = existingCols.has('occupation_slug') ? 'ow.occupation_slug' : 'NULL AS occupation_slug'

    const buildQuery = (whereClause: string) => `
      SELECT ow.occupation_name,
             ${slugSelectCol},
             ow.sex, ow.enterprise_size,
             ow.age, ow.tenure_years,
             ow.scheduled_hours, ow.overtime_hours,
             ow.monthly_wage, ow.scheduled_wage,
             ow.annual_bonus, ow.annual_income, ${hourlyCol}, ow.workers,
             d.survey_year,
             dg.survey_group_name, dg.survey_table_name
      FROM occupation_wages ow
      JOIN datasets d ON ow.dataset_id = d.id
      JOIN dataset_groups dg ON d.group_id = dg.id
      WHERE ${whereClause}
      ORDER BY d.survey_year DESC, ow.sex, ow.enterprise_size`

    let rows: any[] = []

    // 1. occupation_slug 列があれば slug で完全一致検索
    if (existingCols.has('occupation_slug')) {
      rows = await query(buildQuery('ow.occupation_slug = ?'), [slug]) as any[]
    }

    // 2. occupation_name で完全一致検索（URLデコード済み日本語）
    if (rows.length === 0) {
      rows = await query(buildQuery('ow.occupation_name = ?'), [slug]) as any[]
    }

    // 3. 部分一致フォールバック
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

    // 時系列（男女計・企業規模計のみ）
    const timeSeries = rows
      .filter((r: any) => r.sex === '計' && r.enterprise_size === '企業規模計')
      .map((r: any) => ({
        survey_year:   r.survey_year,
        annual_income: r.annual_income,
        monthly_wage:  r.monthly_wage,
        hourly_wage:   r.hourly_wage ?? (r.monthly_wage ? Math.round(r.monthly_wage / 160 * 10) / 10 : null),
      }))
      .sort((a: any, b: any) => a.survey_year - b.survey_year)

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
    })
  } catch (error: any) {
    if (error.message?.includes("doesn't exist") || error.code === 'ER_NO_SUCH_TABLE') {
      return NextResponse.json({ success: false, message: 'データが見つかりません' }, { status: 404 })
    }
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}
