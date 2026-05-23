import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const sex            = searchParams.get('sex')            || '計'
  const enterpriseSize = searchParams.get('enterprise_size') || '企業規模計'
  const surveyYear     = searchParams.get('survey_year') ? Number(searchParams.get('survey_year')) : null
  const education      = searchParams.get('education')       || '学歴計'
  const ageGroup       = searchParams.get('age_group')       || null  // null = 全年齢加重平均
  try {
    // 利用可能な年度一覧（industry_wages に紐づく datasets のみ）
    const yearsRows = await query(
      `SELECT DISTINCT d.survey_year, d.id as dataset_id, dg.id as group_id,
              dg.survey_group_name, dg.survey_table_name
       FROM datasets d
       JOIN dataset_groups dg ON d.group_id = dg.id
       WHERE d.record_count > 0 AND dg.target_table = 'industry_wages'
       ORDER BY d.survey_year DESC`
    ) as Array<{ survey_year: number; dataset_id: number; group_id: number; survey_group_name: string; survey_table_name: string | null }>

    if (yearsRows.length === 0) {
      return NextResponse.json({ success: true, data: [], years: [], meta: null })
    }

    // 対象 dataset 決定
    const targetRow = surveyYear
      ? yearsRows.find(y => y.survey_year === surveyYear) ?? yearsRows[0]
      : yearsRows[0]
    const targetDatasetId = targetRow.dataset_id
    const targetYear      = targetRow.survey_year

    // 業種ごとの集計
    // age_group 指定あり → その年齢階級の値をそのまま使用
    // age_group 指定なし → workers加重平均で全年齢を集計
    const ageCondition = ageGroup ? 'AND age_group = ?' : ''
    const ageParams    = ageGroup ? [ageGroup] : []
    const rankingRows = await query(
      `SELECT
         industry_name,
         sex,
         education,
         enterprise_size,
         ${ageGroup
           ? 'age AS avg_age, tenure_years AS avg_tenure, scheduled_hours AS avg_sched_hours, overtime_hours AS avg_ot_hours, monthly_wage AS avg_monthly_wage, scheduled_wage AS avg_sched_wage, annual_bonus AS avg_bonus, annual_income AS avg_annual_income, workers AS total_workers'
           : `SUM(workers * age)             / NULLIF(SUM(workers), 0) AS avg_age,
         SUM(workers * tenure_years)    / NULLIF(SUM(workers), 0) AS avg_tenure,
         SUM(workers * scheduled_hours) / NULLIF(SUM(workers), 0) AS avg_sched_hours,
         SUM(workers * overtime_hours)  / NULLIF(SUM(workers), 0) AS avg_ot_hours,
         SUM(workers * monthly_wage)    / NULLIF(SUM(workers), 0) AS avg_monthly_wage,
         SUM(workers * scheduled_wage)  / NULLIF(SUM(workers), 0) AS avg_sched_wage,
         SUM(workers * annual_bonus)    / NULLIF(SUM(workers), 0) AS avg_bonus,
         SUM(workers * annual_income)   / NULLIF(SUM(workers), 0) AS avg_annual_income,
         SUM(workers)                                              AS total_workers`
         }
       FROM industry_wages
       WHERE dataset_id = ?
         AND sex = ?
         AND enterprise_size = ?
         AND education = ?
         ${ageCondition}
       GROUP BY industry_name, sex, education, enterprise_size
       ORDER BY avg_annual_income DESC`,
      [targetDatasetId, sex, enterpriseSize, education, ...ageParams]
    ) as Array<{
      industry_name: string
      sex: string
      education: string
      enterprise_size: string
      avg_age: number | null
      avg_tenure: number | null
      avg_sched_hours: number | null
      avg_ot_hours: number | null
      avg_monthly_wage: number | null
      avg_sched_wage: number | null
      avg_bonus: number | null
      avg_annual_income: number | null
      total_workers: number | null
    }>

    // 全体統計: rankingRows（workers加重平均済み）から導出する
    // MAX(annual_income) を直接使うと age_group 別の最高齢行が混入するため
    const validRows = rankingRows.filter(r => r.avg_annual_income != null)
    const maxIncome   = validRows.length > 0 ? Math.max(...validRows.map(r => Number(r.avg_annual_income))) : null
    const avgIncome   = validRows.length > 0
      ? validRows.reduce((s, r) => s + Number(r.avg_annual_income), 0) / validRows.length
      : null
    const totalWorkers = rankingRows.reduce((s, r) => s + (r.total_workers ? Number(r.total_workers) : 0), 0)
    const stats = {
      avg_income:     avgIncome,
      max_income:     maxIncome,
      total_workers:  totalWorkers,
      industry_count: rankingRows.length,
    }

    // 千円 → 万円変換
    const toWan = (v: any) => v != null ? Math.round(Number(v) / 10) : null

    const convertedRows = rankingRows.map((r, idx) => ({
      rank:            idx + 1,
      industry_name:   r.industry_name,
      sex:             r.sex,
      education:       r.education,
      enterprise_size: r.enterprise_size,
      avg_age:          r.avg_age   != null ? Math.round(Number(r.avg_age) * 10) / 10 : null,
      avg_tenure:       r.avg_tenure != null ? Math.round(Number(r.avg_tenure) * 10) / 10 : null,
      avg_sched_hours:  r.avg_sched_hours != null ? Math.round(Number(r.avg_sched_hours) * 10) / 10 : null,
      avg_ot_hours:     r.avg_ot_hours != null ? Math.round(Number(r.avg_ot_hours) * 10) / 10 : null,
      avg_monthly_wage: toWan(r.avg_monthly_wage),
      avg_sched_wage:   toWan(r.avg_sched_wage),
      avg_bonus:        toWan(r.avg_bonus),
      avg_annual_income: toWan(r.avg_annual_income),
      total_workers:    r.total_workers != null ? Number(r.total_workers) : null,
    }))

    return NextResponse.json({
      success: true,
      data:    convertedRows,
      years:   yearsRows.map(y => ({ survey_year: y.survey_year, dataset_id: y.dataset_id, group_id: y.group_id })),
      meta: {
        survey_year:       targetYear,
        dataset_id:        targetDatasetId,
        sex,
        enterprise_size:   enterpriseSize,
        education,
        survey_group_name: targetRow.survey_group_name,
        survey_table_name: targetRow.survey_table_name,
        avg_income:        stats.avg_income != null ? Math.round(stats.avg_income / 10) : null,
        max_income:        stats.max_income != null ? Math.round(stats.max_income / 10) : null,
        total_workers:     stats?.total_workers ? Number(stats.total_workers) : null,
        industry_count:    stats?.industry_count ? Number(stats.industry_count) : 0,
      },
    })
  } catch (error: any) {
    if (error.message?.includes("doesn't exist") || error.code === 'ER_NO_SUCH_TABLE') {
      return NextResponse.json({ success: true, data: [], years: [], meta: null })
    }
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}
