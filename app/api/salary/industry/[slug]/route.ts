import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

// industry_name をそのままスラグとして使用（URLエンコード済み）
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params
  const industryName = decodeURIComponent(slug)

  try {
    // 利用可能な年度
    const yearsRows = await query(
      `SELECT DISTINCT d.survey_year, d.id as dataset_id, dg.survey_group_name, dg.survey_table_name
       FROM datasets d
       JOIN dataset_groups dg ON d.group_id = dg.id
       WHERE d.record_count > 0 AND dg.target_table = 'industry_wages'
         AND EXISTS (
           SELECT 1 FROM industry_wages w
           WHERE w.dataset_id = d.id AND w.industry_name = ?
         )
       ORDER BY d.survey_year DESC`,
      [industryName]
    ) as Array<{ survey_year: number; dataset_id: number; survey_group_name: string; survey_table_name: string | null }>

    if (yearsRows.length === 0) {
      return NextResponse.json({ success: false, message: `「${industryName}」のデータが見つかりません` }, { status: 404 })
    }

    const latestRow        = yearsRows[0]
    const latestDatasetId  = latestRow.dataset_id
    const latestYear       = latestRow.survey_year
    const allYears         = yearsRows.map(y => y.survey_year)

    // 最新年の全組み合わせデータ（性別×企業規模×学歴×年齢階級）
    const latestData = await query(
      `SELECT sex, education, age_group, enterprise_size,
              age, tenure_years, scheduled_hours, overtime_hours,
              monthly_wage, scheduled_wage, annual_bonus, annual_income, workers
       FROM industry_wages
       WHERE dataset_id = ? AND industry_name = ?
       ORDER BY sex, education, enterprise_size, age_group`,
      [latestDatasetId, industryName]
    ) as Array<{
      sex: string; education: string; age_group: string; enterprise_size: string
      age: number | null; tenure_years: number | null
      scheduled_hours: number | null; overtime_hours: number | null
      monthly_wage: number | null; scheduled_wage: number | null
      annual_bonus: number | null; annual_income: number | null
      workers: number | null
    }>

    // 時系列データ（学歴計・年齢階級は集計、性別×企業規模のみ区別）
    const timeSeries = await query(
      `SELECT d.survey_year, w.sex, w.enterprise_size,
              AVG(w.age)             AS age,
              AVG(w.tenure_years)    AS tenure_years,
              AVG(w.scheduled_hours) AS scheduled_hours,
              AVG(w.overtime_hours)  AS overtime_hours,
              AVG(w.monthly_wage)    AS monthly_wage,
              AVG(w.scheduled_wage)  AS scheduled_wage,
              AVG(w.annual_bonus)    AS annual_bonus,
              AVG(w.annual_income)   AS annual_income,
              SUM(w.workers)         AS workers
       FROM industry_wages w
       JOIN datasets d ON d.id = w.dataset_id
       JOIN dataset_groups dg ON dg.id = d.group_id
       WHERE w.industry_name = ?
         AND w.education = '学歴計'
         AND dg.target_table = 'industry_wages'
       GROUP BY d.survey_year, w.sex, w.enterprise_size
       ORDER BY d.survey_year, w.sex, w.enterprise_size`,
      [industryName]
    ) as Array<{
      survey_year: number; sex: string; enterprise_size: string
      age: number | null; tenure_years: number | null
      scheduled_hours: number | null; overtime_hours: number | null
      monthly_wage: number | null; scheduled_wage: number | null
      annual_bonus: number | null; annual_income: number | null
      workers: number | null
    }>

    // 年齢階級別データ（最新年・学歴計・企業規模計）
    const ageData = await query(
      `SELECT sex, age_group, age, tenure_years,
              scheduled_hours, overtime_hours,
              monthly_wage, scheduled_wage, annual_bonus, annual_income, workers
       FROM industry_wages
       WHERE dataset_id = ? AND industry_name = ?
         AND education = '学歴計' AND enterprise_size = '企業規模計'
       ORDER BY sex,
         CASE
           WHEN age_group = '〜19歳' THEN 0
           WHEN age_group LIKE '%〜%' THEN CAST(SUBSTRING_INDEX(age_group, '〜', 1) AS UNSIGNED)
           ELSE 999
         END`,
      [latestDatasetId, industryName]
    ) as Array<{
      sex: string; age_group: string; age: number | null; tenure_years: number | null
      scheduled_hours: number | null; overtime_hours: number | null
      monthly_wage: number | null; scheduled_wage: number | null
      annual_bonus: number | null; annual_income: number | null; workers: number | null
    }>

    // 産業計との比較（最新年・学歴計・企業規模計・男女計）
    const allIndustrySummary = await query(
      `SELECT industry_name,
              AVG(annual_income) AS avg_annual_income,
              AVG(monthly_wage)  AS avg_monthly_wage,
              AVG(annual_bonus)  AS avg_bonus
       FROM industry_wages
       WHERE dataset_id = ?
         AND sex = '計' AND enterprise_size = '企業規模計' AND education = '学歴計'
       GROUP BY industry_name
       ORDER BY avg_annual_income DESC`,
      [latestDatasetId]
    ) as Array<{ industry_name: string; avg_annual_income: number | null; avg_monthly_wage: number | null; avg_bonus: number | null }>

    const toWan = (v: any) => v != null ? Math.round(Number(v) / 10) : null

    return NextResponse.json({
      success:           true,
      industry_name:     industryName,
      survey_group_name: latestRow.survey_group_name,
      survey_table_name: latestRow.survey_table_name,
      latest_year:       latestYear,
      all_years:         allYears,
      latest_data:       latestData,
      time_series:       timeSeries,
      age_data:          ageData,
      all_industry_summary: allIndustrySummary.map(r => ({
        industry_name:     r.industry_name,
        avg_annual_income: toWan(r.avg_annual_income),
        avg_monthly_wage:  toWan(r.avg_monthly_wage),
        avg_bonus:         toWan(r.avg_bonus),
      })),
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}
