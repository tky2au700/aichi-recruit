import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const sex            = searchParams.get('sex')            || '計'
  const enterpriseSize = searchParams.get('enterprise_size') || '企業規模計'
  const surveyYear     = searchParams.get('survey_year')    ? Number(searchParams.get('survey_year')) : null
  const limit          = Math.min(Number(searchParams.get('limit') || '200'), 500)

  try {
    const yearsQuery = `
      SELECT DISTINCT d.survey_year, d.id as dataset_id, dg.id as group_id,
             dg.survey_group_name, dg.survey_table_name, dg.name as legacy_name
      FROM datasets d
      JOIN dataset_groups dg ON d.group_id = dg.id
      WHERE d.record_count > 0 AND dg.target_table = 'age_wages'
      ORDER BY d.survey_year DESC
    `
    const years = await query(yearsQuery) as Array<{
      survey_year: number; dataset_id: number; group_id: number
      survey_group_name: string; survey_table_name: string | null; legacy_name: string
    }>

    if (years.length === 0) {
      return NextResponse.json({ success: true, data: [], years: [], meta: null })
    }

    let targetDatasetId: number
    let targetYear: number
    let targetGroupId: number

    if (surveyYear) {
      const match = years.find(y => y.survey_year === surveyYear)
      if (!match) return NextResponse.json({ success: false, message: '指定された年度のデータが見つかりません' }, { status: 404 })
      targetDatasetId = match.dataset_id; targetYear = match.survey_year; targetGroupId = match.group_id
    } else {
      targetDatasetId = years[0].dataset_id; targetYear = years[0].survey_year; targetGroupId = years[0].group_id
    }

    const safeLimit = Math.min(Math.max(1, Math.floor(limit)), 500)

    // 年齢階級順序の定義（年齢順にソート）
    const AGE_ORDER = ['～19歳','20～24歳','25～29歳','30～34歳','35～39歳','40～44歳','45～49歳','50～54歳','55～59歳','60～64歳','65～69歳','70歳～','学歴計']

    const [rows, statsRows] = await Promise.all([
      query(
        `SELECT age_group,
                sex, enterprise_size,
                age, tenure_years, scheduled_hours, overtime_hours,
                monthly_wage, scheduled_wage, annual_bonus, annual_income, workers
         FROM age_wages
         WHERE dataset_id = ?
           AND sex = ?
           AND enterprise_size = ?
           AND education = '学歴計'
           AND age_group != '学歴計'
         ORDER BY annual_income DESC
         LIMIT ${safeLimit}`,
        [targetDatasetId, sex, enterpriseSize]
      ) as Promise<Array<{
        age_group: string; sex: string; enterprise_size: string
        age: number | null; tenure_years: number | null; scheduled_hours: number | null
        overtime_hours: number | null; monthly_wage: number | null; scheduled_wage: number | null
        annual_bonus: number | null; annual_income: number | null; workers: number | null
      }>>,
      query(
        `SELECT AVG(annual_income) as avg_income, MAX(annual_income) as max_income,
                SUM(workers) as total_workers, COUNT(*) as count
         FROM age_wages
         WHERE dataset_id = ? AND sex = ? AND enterprise_size = ?
           AND education = '学歴計' AND age_group != '学歴計'`,
        [targetDatasetId, sex, enterpriseSize]
      ) as Promise<Array<{ avg_income: number; max_income: number; total_workers: number; count: number }>>,
    ])
    const stats = statsRows[0]
    const groupInfo = years.find(y => y.dataset_id === targetDatasetId)

    const toWan = (v: unknown) => v != null ? Math.round(Number(v) / 10) : null
    const calcHourly = (scheduledWage: unknown, scheduledHours: unknown): number | null => {
      const w = Number(scheduledWage); const h = Number(scheduledHours)
      if (!w || !h || h <= 0) return null
      return Math.round((w * 1000) / h)
    }
    const convertedRows = rows.map((r) => ({
      ...r,
      annual_income:  toWan(r.annual_income),
      monthly_wage:   toWan(r.monthly_wage),
      scheduled_wage: toWan(r.scheduled_wage),
      annual_bonus:   toWan(r.annual_bonus),
      hourly_wage:    calcHourly(r.scheduled_wage, r.scheduled_hours),
      age_order: AGE_ORDER.indexOf(r.age_group),
    }))

    return NextResponse.json({
      success: true,
      data: convertedRows,
      years: years.map(y => ({ survey_year: y.survey_year, dataset_id: y.dataset_id, group_id: y.group_id })),
      meta: {
        survey_year: targetYear, dataset_id: targetDatasetId, group_id: targetGroupId,
        sex, enterprise_size: enterpriseSize,
        survey_group_name: groupInfo?.survey_group_name ?? groupInfo?.legacy_name ?? '',
        survey_table_name: groupInfo?.survey_table_name ?? null,
        avg_income: stats?.avg_income ? Math.round(Number(stats.avg_income) / 10) : null,
        max_income: stats?.max_income ? Math.round(Number(stats.max_income) / 10) : null,
        total_workers: stats?.total_workers ? Number(stats.total_workers) : null,
        row_count: stats?.count ? Number(stats.count) : 0,
      },
    })
  } catch (error: unknown) {
    const err = error as { message?: string; code?: string }
    if (err.message?.includes("doesn't exist") || err.code === 'ER_NO_SUCH_TABLE') {
      return NextResponse.json({ success: true, data: [], years: [], meta: null })
    }
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}
