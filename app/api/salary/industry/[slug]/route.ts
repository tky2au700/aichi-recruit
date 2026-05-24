import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params
  const industryName = decodeURIComponent(slug)

  const sp        = req.nextUrl.searchParams
  const yearParam = sp.get('year')
  const sex       = sp.get('sex')       ?? '計'
  const size      = sp.get('size')      ?? '企業規模計'
  const education = sp.get('education') ?? '学歴計'

  try {
    // 利用可能な年度
    const yearsRows = await query(
      `SELECT DISTINCT d.survey_year, d.id AS dataset_id,
              dg.survey_group_name, dg.survey_table_name
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

    const allYears    = yearsRows.map(y => y.survey_year)
    const selectedYear = yearParam ? parseInt(yearParam, 10) : yearsRows[0].survey_year
    const targetRow    = yearsRows.find(y => y.survey_year === selectedYear) ?? yearsRows[0]
    const datasetId    = targetRow.dataset_id
    const latestYear   = targetRow.survey_year

    // KPI・テーブル用: 選択パラメータでフィルタした代表行
    const mainData = await query(
      `SELECT sex, education, age_group, enterprise_size,
              age, tenure_years, scheduled_hours, overtime_hours,
              monthly_wage, scheduled_wage, annual_bonus, annual_income, workers
       FROM industry_wages
       WHERE dataset_id = ? AND industry_name = ?
         AND sex = ? AND enterprise_size = ? AND education = ?
       ORDER BY
         CASE
           WHEN age_group = '〜19歳' THEN 0
           WHEN age_group LIKE '%〜%' THEN CAST(SUBSTRING_INDEX(age_group, '〜', 1) AS UNSIGNED)
           ELSE 999
         END`,
      [datasetId, industryName, sex, size, education]
    ) as Array<{
      sex: string; education: string; age_group: string; enterprise_size: string
      age: number | null; tenure_years: number | null
      scheduled_hours: number | null; overtime_hours: number | null
      monthly_wage: number | null; scheduled_wage: number | null
      annual_bonus: number | null; annual_income: number | null
      workers: number | null
    }>

    // KPI 代表値: workers加重平均（age_group別行しか存在しないため）
    const kpiAgg = await query(
      `SELECT
         SUM(workers * age)             / NULLIF(SUM(workers), 0) AS avg_age,
         SUM(workers * tenure_years)    / NULLIF(SUM(workers), 0) AS avg_tenure,
         SUM(workers * scheduled_hours) / NULLIF(SUM(workers), 0) AS avg_sched_hours,
         SUM(workers * overtime_hours)  / NULLIF(SUM(workers), 0) AS avg_ot_hours,
         SUM(workers * monthly_wage)    / NULLIF(SUM(workers), 0) AS avg_monthly_wage,
         SUM(workers * scheduled_wage)  / NULLIF(SUM(workers), 0) AS avg_sched_wage,
         SUM(workers * annual_bonus)    / NULLIF(SUM(workers), 0) AS avg_bonus,
         SUM(workers * annual_income)   / NULLIF(SUM(workers), 0) AS avg_annual_income,
         SUM(workers)                                              AS total_workers
       FROM industry_wages
       WHERE dataset_id = ? AND industry_name = ?
         AND sex = ? AND enterprise_size = ? AND education = ?`,
      [datasetId, industryName, sex, size, education]
    ) as Array<{
      avg_age: number | null; avg_tenure: number | null
      avg_sched_hours: number | null; avg_ot_hours: number | null
      avg_monthly_wage: number | null; avg_sched_wage: number | null
      avg_bonus: number | null; avg_annual_income: number | null; total_workers: number | null
    }>
    const kpiRow = kpiAgg[0] ?? null

    // 企業規模別テーブル（選択した性別・学歴固定、企業規模を全種類 — workers加重平均）
    const sizeRows = await query(
      `SELECT enterprise_size,
         SUM(workers * age)             / NULLIF(SUM(workers), 0) AS age,
         SUM(workers * tenure_years)    / NULLIF(SUM(workers), 0) AS tenure_years,
         SUM(workers * scheduled_hours) / NULLIF(SUM(workers), 0) AS scheduled_hours,
         SUM(workers * overtime_hours)  / NULLIF(SUM(workers), 0) AS overtime_hours,
         SUM(workers * monthly_wage)    / NULLIF(SUM(workers), 0) AS monthly_wage,
         SUM(workers * scheduled_wage)  / NULLIF(SUM(workers), 0) AS scheduled_wage,
         SUM(workers * annual_bonus)    / NULLIF(SUM(workers), 0) AS annual_bonus,
         SUM(workers * annual_income)   / NULLIF(SUM(workers), 0) AS annual_income,
         SUM(workers)                                              AS workers
       FROM industry_wages
       WHERE dataset_id = ? AND industry_name = ? AND sex = ? AND education = ?
       GROUP BY enterprise_size
       ORDER BY FIELD(enterprise_size, '企業規模計', '1000人以上', '100〜999人', '10〜99人')`,
      [datasetId, industryName, sex, education]
    ) as Array<{ enterprise_size: string; age: number | null; tenure_years: number | null; scheduled_hours: number | null; overtime_hours: number | null; monthly_wage: number | null; scheduled_wage: number | null; annual_bonus: number | null; annual_income: number | null; workers: number | null }>

    // 男女別テーブル（選択した企業規模・学歴固定、性別を全種類 — workers加重平均）
    const sexRows = await query(
      `SELECT sex,
         SUM(workers * age)             / NULLIF(SUM(workers), 0) AS age,
         SUM(workers * tenure_years)    / NULLIF(SUM(workers), 0) AS tenure_years,
         SUM(workers * scheduled_hours) / NULLIF(SUM(workers), 0) AS scheduled_hours,
         SUM(workers * overtime_hours)  / NULLIF(SUM(workers), 0) AS overtime_hours,
         SUM(workers * monthly_wage)    / NULLIF(SUM(workers), 0) AS monthly_wage,
         SUM(workers * scheduled_wage)  / NULLIF(SUM(workers), 0) AS scheduled_wage,
         SUM(workers * annual_bonus)    / NULLIF(SUM(workers), 0) AS annual_bonus,
         SUM(workers * annual_income)   / NULLIF(SUM(workers), 0) AS annual_income,
         SUM(workers)                                              AS workers
       FROM industry_wages
       WHERE dataset_id = ? AND industry_name = ? AND enterprise_size = ? AND education = ?
       GROUP BY sex
       ORDER BY FIELD(sex, '計', '男', '女')`,
      [datasetId, industryName, size, education]
    ) as Array<{ sex: string; age: number | null; tenure_years: number | null; scheduled_hours: number | null; overtime_hours: number | null; monthly_wage: number | null; scheduled_wage: number | null; annual_bonus: number | null; annual_income: number | null; workers: number | null }>

    // 年齢階級別データ（選択した性別・企業規模・学歴）
    const ageData = await query(
      `SELECT sex, age_group, age, tenure_years, scheduled_hours, overtime_hours,
              monthly_wage, scheduled_wage, annual_bonus, annual_income, workers
       FROM industry_wages
       WHERE dataset_id = ? AND industry_name = ?
         AND enterprise_size = ? AND education = ?
         AND age_group != '' AND age_group IS NOT NULL
       ORDER BY FIELD(sex, '計', '男', '女'),
         CASE
           WHEN age_group = '〜19歳' THEN 0
           WHEN age_group LIKE '%〜%' THEN CAST(SUBSTRING_INDEX(age_group, '〜', 1) AS UNSIGNED)
           ELSE 999
         END`,
      [datasetId, industryName, size, education]
    ) as Array<{
      sex: string; age_group: string; age: number | null; tenure_years: number | null
      scheduled_hours: number | null; overtime_hours: number | null
      monthly_wage: number | null; scheduled_wage: number | null
      annual_bonus: number | null; annual_income: number | null; workers: number | null
    }>

    // 時系列（推移グラフ用 — workers加重平均）
    const timeSeries = await query(
      `SELECT d.survey_year, w.sex, w.enterprise_size,
              SUM(w.workers * w.age)           / NULLIF(SUM(w.workers), 0) AS age,
              SUM(w.workers * w.tenure_years)  / NULLIF(SUM(w.workers), 0) AS tenure_years,
              SUM(w.workers * w.monthly_wage)  / NULLIF(SUM(w.workers), 0) AS monthly_wage,
              SUM(w.workers * w.scheduled_wage)/ NULLIF(SUM(w.workers), 0) AS scheduled_wage,
              SUM(w.workers * w.annual_bonus)  / NULLIF(SUM(w.workers), 0) AS annual_bonus,
              SUM(w.workers * w.annual_income) / NULLIF(SUM(w.workers), 0) AS annual_income,
              SUM(w.workers)                                                AS workers
       FROM industry_wages w
       JOIN datasets d ON d.id = w.dataset_id
       JOIN dataset_groups dg ON dg.id = d.group_id
       WHERE w.industry_name = ?
         AND w.education = ?
         AND dg.target_table = 'industry_wages'
       GROUP BY d.survey_year, w.sex, w.enterprise_size
       ORDER BY d.survey_year, w.sex, w.enterprise_size`,
      [industryName, education]
    ) as Array<{
      survey_year: number; sex: string; enterprise_size: string
      age: number | null; tenure_years: number | null
      monthly_wage: number | null; scheduled_wage: number | null
      annual_bonus: number | null; annual_income: number | null; workers: number | null
    }>

    // 他産業との比較（workers加重平均）
    const allIndustrySummary = await query(
      `SELECT industry_name,
              SUM(workers * annual_income) / NULLIF(SUM(workers), 0) AS avg_annual_income,
              SUM(workers * monthly_wage)  / NULLIF(SUM(workers), 0) AS avg_monthly_wage,
              SUM(workers * annual_bonus)  / NULLIF(SUM(workers), 0) AS avg_bonus
       FROM industry_wages
       WHERE dataset_id = ?
         AND sex = ? AND enterprise_size = ? AND education = ?
       GROUP BY industry_name
       ORDER BY avg_annual_income DESC`,
      [datasetId, sex, size, education]
    ) as Array<{ industry_name: string; avg_annual_income: number | null; avg_monthly_wage: number | null; avg_bonus: number | null }>

    // 利用可能な学歴一覧（この産業・データセット）
    const educationOptions = await query(
      `SELECT DISTINCT education FROM industry_wages
       WHERE dataset_id = ? AND industry_name = ?
       ORDER BY FIELD(education, '学歴計', '中学', '高校', '専門学校', '高専・短大', '大学', '大学院', '不明')`,
      [datasetId, industryName]
    ) as Array<{ education: string }>

    const toWan = (v: unknown) => v != null ? Math.round(Number(v) / 10) : null

    return NextResponse.json({
      success:           true,
      industry_name:     industryName,
      survey_group_name: targetRow.survey_group_name,
      survey_table_name: targetRow.survey_table_name,
      latest_year:       latestYear,
      all_years:         allYears,
      selected:          { year: latestYear, sex, size, education },
      education_options: educationOptions.map(r => r.education),
      kpi_row:           kpiRow,
      size_rows:         sizeRows,
      sex_rows:          sexRows,
      age_data:          ageData,
      time_series:       timeSeries,
      all_industry_summary: allIndustrySummary.map(r => ({
        industry_name:     r.industry_name,
        avg_annual_income: toWan(r.avg_annual_income),
        avg_monthly_wage:  toWan(r.avg_monthly_wage),
        avg_bonus:         toWan(r.avg_bonus),
      })),
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, message: msg }, { status: 500 })
  }
}
