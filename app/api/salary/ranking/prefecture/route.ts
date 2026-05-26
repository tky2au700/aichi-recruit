import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const sex        = searchParams.get('sex')         || '計'
  const surveyYear = searchParams.get('survey_year') ? Number(searchParams.get('survey_year')) : null

  try {
    // 利用可能な年度一覧
    const years = await query(
      `SELECT DISTINCT d.survey_year, d.id AS dataset_id
       FROM datasets d
       JOIN dataset_groups dg ON d.group_id = dg.id
       WHERE d.record_count > 0 AND dg.target_table = 'prefecture_wages'
       ORDER BY d.survey_year DESC`
    ) as Array<{ survey_year: number; dataset_id: number }>

    if (years.length === 0) {
      return NextResponse.json({ success: true, data: [], years: [], meta: null })
    }

    // 対象データセット決定
    const target = surveyYear
      ? years.find(y => y.survey_year === surveyYear) ?? years[0]
      : years[0]

    const { dataset_id: datasetId, survey_year: targetYear } = target

    const [rows, statsRows] = await Promise.all([
      query(
        `SELECT prefecture, sex, age, tenure_years,
                scheduled_hours, overtime_hours,
                monthly_wage, scheduled_wage, annual_bonus,
                annual_income, workers
         FROM prefecture_wages
         WHERE dataset_id = ? AND sex = ? AND prefecture != '全国'
         ORDER BY annual_income DESC`,
        [datasetId, sex]
      ) as Promise<Array<{
        prefecture: string
        sex: string
        age: number | null
        tenure_years: number | null
        scheduled_hours: number | null
        overtime_hours: number | null
        monthly_wage: number | null
        scheduled_wage: number | null
        annual_bonus: number | null
        annual_income: number | null
        workers: number | null
      }>>,
      query(
        `SELECT AVG(annual_income) AS avg_income, MAX(annual_income) AS max_income,
                SUM(workers) AS total_workers, COUNT(*) AS cnt
         FROM prefecture_wages
         WHERE dataset_id = ? AND sex = ? AND prefecture != '全国'`,
        [datasetId, sex]
      ) as Promise<Array<{ avg_income: number; max_income: number; total_workers: number; cnt: number }>>,
    ])

    const stats = statsRows[0]

    // DB値は千円単位 → 万円換算
    const toWan = (v: any) => v != null ? Math.round(Number(v) / 10) : null
    const calcHourly = (scheduledWage: any, scheduledHours: any): number | null => {
      const w = Number(scheduledWage)
      const h = Number(scheduledHours)
      if (!w || !h || h <= 0) return null
      return Math.round((w * 1000) / h)
    }

    const convertedRows = rows.map((r: any) => ({
      ...r,
      annual_income:  toWan(r.annual_income),
      monthly_wage:   toWan(r.monthly_wage),
      scheduled_wage: toWan(r.scheduled_wage),
      annual_bonus:   toWan(r.annual_bonus),
      hourly_wage:    calcHourly(r.scheduled_wage, r.scheduled_hours),
    }))

    // 重複排除した年度一覧
    const seen = new Set<number>()
    const uniqueYears = years.filter(y => {
      if (seen.has(y.survey_year)) return false
      seen.add(y.survey_year)
      return true
    })

    return NextResponse.json({
      success: true,
      data: convertedRows,
      years: uniqueYears,
      meta: {
        survey_year:       targetYear,
        dataset_id:        datasetId,
        sex,
        avg_income:        stats?.avg_income  ? toWan(stats.avg_income)  : null,
        max_income:        stats?.max_income  ? toWan(stats.max_income)  : null,
        total_workers:     stats?.total_workers ? Number(stats.total_workers) : null,
        prefecture_count:  stats?.cnt ? Number(stats.cnt) : 0,
      },
    })
  } catch (error: any) {
    if (error.message?.includes("doesn't exist") || error.code === 'ER_NO_SUCH_TABLE') {
      return NextResponse.json({ success: true, data: [], years: [], meta: null })
    }
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}
