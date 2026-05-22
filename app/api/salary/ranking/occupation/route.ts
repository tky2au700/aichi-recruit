import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const sex           = searchParams.get('sex')           || '計'
  const enterpriseSize = searchParams.get('enterprise_size') || '企業規模計'
  const surveyYear    = searchParams.get('survey_year')   ? Number(searchParams.get('survey_year')) : null
  const groupId       = searchParams.get('group_id')      ? Number(searchParams.get('group_id'))   : null
  const limit         = Math.min(Number(searchParams.get('limit') || '200'), 500)

  try {
    // 利用可能な年度一覧を取得
    const yearsQuery = `
      SELECT DISTINCT d.survey_year, d.id as dataset_id, dg.id as group_id,
             dg.survey_group_name, dg.survey_table_name, dg.name as legacy_name
      FROM datasets d
      JOIN dataset_groups dg ON d.group_id = dg.id
      WHERE d.record_count > 0
      ORDER BY d.survey_year DESC
    `
    const years = await query(yearsQuery) as Array<{
      survey_year: number
      dataset_id: number
      group_id: number
      survey_group_name: string
      survey_table_name: string | null
      legacy_name: string
    }>

    if (years.length === 0) {
      return NextResponse.json({ success: true, data: [], years: [], meta: null })
    }

    // 対象データセットIDを決定
    let targetDatasetId: number
    let targetYear: number
    let targetGroupId: number

    if (surveyYear && groupId) {
      const match = years.find(y => y.survey_year === surveyYear && y.group_id === groupId)
      if (!match) {
        return NextResponse.json({ success: false, message: '指定された年度・グループのデータが見つかりません' }, { status: 404 })
      }
      targetDatasetId = match.dataset_id
      targetYear = match.survey_year
      targetGroupId = match.group_id
    } else if (surveyYear) {
      const match = years.find(y => y.survey_year === surveyYear)
      if (!match) {
        return NextResponse.json({ success: false, message: '指定された年度のデータが見つかりません' }, { status: 404 })
      }
      targetDatasetId = match.dataset_id
      targetYear = match.survey_year
      targetGroupId = match.group_id
    } else {
      // 最新年度
      targetDatasetId = years[0].dataset_id
      targetYear = years[0].survey_year
      targetGroupId = years[0].group_id
    }

    // ランキングデータ取得（LIMIT は整数を直接埋め込みでバインドエラー回避）
    const safeLimit = Math.min(Math.max(1, Math.floor(limit)), 500)
    const rows = await query(
      `SELECT occupation_name, sex, enterprise_size,
              age, tenure_years, scheduled_hours, overtime_hours,
              monthly_wage, scheduled_wage, annual_bonus, annual_income, workers
       FROM occupation_wages
       WHERE dataset_id = ?
         AND sex = ?
         AND enterprise_size = ?
       ORDER BY annual_income DESC
       LIMIT ${safeLimit}`,
      [targetDatasetId, sex, enterpriseSize]
    ) as Array<{
      occupation_name: string
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
      workers: number | null
    }>

    // 全件中の統計
    const statsRows = await query(
      `SELECT AVG(annual_income) as avg_income, MAX(annual_income) as max_income,
              SUM(workers) as total_workers, COUNT(*) as count
       FROM occupation_wages
       WHERE dataset_id = ? AND sex = ? AND enterprise_size = ?`,
      [targetDatasetId, sex, enterpriseSize]
    ) as Array<{ avg_income: number; max_income: number; total_workers: number; count: number }>
    const stats = statsRows[0]

    const groupInfo = years.find(y => y.dataset_id === targetDatasetId)

    return NextResponse.json({
      success: true,
      data: rows,
      years: years.map(y => ({ survey_year: y.survey_year, dataset_id: y.dataset_id, group_id: y.group_id })),
      meta: {
        survey_year: targetYear,
        dataset_id: targetDatasetId,
        group_id: targetGroupId,
        sex,
        enterprise_size: enterpriseSize,
        survey_group_name: groupInfo?.survey_group_name ?? groupInfo?.legacy_name ?? '',
        survey_table_name: groupInfo?.survey_table_name ?? null,
        avg_income: stats?.avg_income ? Math.round(Number(stats.avg_income)) : null,
        max_income: stats?.max_income ? Math.round(Number(stats.max_income)) : null,
        total_workers: stats?.total_workers ? Number(stats.total_workers) : null,
        occupation_count: stats?.count ? Number(stats.count) : 0,
      },
    })
  } catch (error: any) {
    if (error.message?.includes("doesn't exist") || error.code === 'ER_NO_SUCH_TABLE') {
      return NextResponse.json({ success: true, data: [], years: [], meta: null })
    }
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}
