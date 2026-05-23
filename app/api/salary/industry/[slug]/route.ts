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

    // KPI 代表値（年齢階級なし = 単一行のはず）
    const kpiRow = mainData.find(r => !r.age_group || r.age_group === '') ?? mainData[0] ?? null

    // 企業規模別テーブル（選択した性別・学歴固定、企業規模を全種類）
    const sizeRows = await query(
      `SELECT enterprise_size, age, tenure_years, scheduled_hours, overtime_hours,
              monthly_wage, scheduled_wage, annual_bonus, annual_income, workers
       FROM industry_wages
       WHERE dataset_id = ? AND industry_name = ? AND sex = ? AND education = ?
         AND age_group = ''
       ORDER BY FIELD(enterprise_size, '企業規模計', '1000人以上', '100〜999人', '10〜99人')`,
      [datasetId, industryName, sex, education]
    ) as Array<{ enterprise_size: string; age: number | null; tenure_years: number | null; scheduled_hours: number | null; overtime_hours: number | null; monthly_wage: number | null; scheduled_wage: number | null; annual_bonus: number | null; annual_income: number | null; workers: number | null }>

    // 男女別テーブル（選択した企業規模・学歴固定、性別を全種類）
    const sexRows = await query(
      `SELECT sex, age, tenure_years, scheduled_hours, overtime_hours,
              monthly_wage, scheduled_wage, annual_bonus, annual_income, workers
       FROM industry_wages
       WHERE dataset_id = ? AND industry_name = ? AND enterprise_size = ? AND education = ?
         AND age_group = ''
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

    // 時系列（推移グラフ用 — パラメータ問わず全年・学歴計・全性別×全企業規模）
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
         AND w.education = ?
         AND w.age_group = ''
         AND dg.target_table = 'industry_wages'
       GROUP BY d.survey_year, w.sex, w.enterprise_size
       ORDER BY d.survey_year, w.sex, w.enterprise_size`,
      [industryName, education]
    ) as Array<{
      survey_year: number; sex: string; enterprise_size: string
      age: number | null; tenure_years: number | null
      scheduled_hours: number | null; overtime_hours: number | null
      monthly_wage: number | null; scheduled_wage: number | null
      annual_bonus: number | null; annual_income: number | null; workers: number | null
    }>

    // 他産業との比較（選択パラメータと同条件）
    const allIndustrySummary = await query(
      `SELECT industry_name,
              AVG(annual_income) AS avg_annual_income,
              AVG(monthly_wage)  AS avg_monthly_wage,
              AVG(annual_bonus)  AS avg_bonus
       FROM industry_wages
       WHERE dataset_id = ?
         AND sex = ? AND enterprise_size = ? AND education = ?
         AND age_group = ''
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
