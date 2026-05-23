import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const sex            = searchParams.get('sex')            || '計'
  const enterpriseSize = searchParams.get('enterprise_size') || '企業規模計'
  const surveyYear     = searchParams.get('survey_year') ? Number(searchParams.get('survey_year')) : null
  const education      = searchParams.get('education')       || '学歴計'
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

    // 業種ごとの集計（全age_groupをAVG集計 — age_group別の代表行は存在しないため）
    const rankingRows = await query(
      `SELECT
         industry_name,
         sex,
         education,
         enterprise_size,
         AVG(age)              AS avg_age,
         AVG(tenure_years)     AS avg_tenure,
         AVG(scheduled_hours)  AS avg_sched_hours,
         AVG(overtime_hours)   AS avg_ot_hours,
         AVG(monthly_wage)     AS avg_monthly_wage,
         AVG(scheduled_wage)   AS avg_sched_wage,
         AVG(annual_bonus)     AS avg_bonus,
         AVG(annual_income)    AS avg_annual_income,
         SUM(workers)          AS total_workers
       FROM industry_wages
       WHERE dataset_id = ?
         AND sex = ?
         AND enterprise_size = ?
         AND education = ?
       GROUP BY industry_name, sex, education, enterprise_size
       ORDER BY avg_annual_income DESC`,
      [targetDatasetId, sex, enterpriseSize, education]
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

    // 全体統計
    const statsRows = await query(
      `SELECT
         AVG(w.annual_income) AS avg_income,
         MAX(w.annual_income) AS max_income,
         SUM(w.workers)       AS total_workers,
         COUNT(DISTINCT w.industry_name) AS industry_count
       FROM industry_wages w
       WHERE w.dataset_id = ?
         AND w.sex = ?
         AND w.enterprise_size = ?
         AND w.education = ?`,
      [targetDatasetId, sex, enterpriseSize, education]
    ) as Array<{ avg_income: number; max_income: number; total_workers: number; industry_count: number }>
    const stats = statsRows[0]

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
        avg_income:        toWan(stats?.avg_income),
        max_income:        toWan(stats?.max_income),
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
