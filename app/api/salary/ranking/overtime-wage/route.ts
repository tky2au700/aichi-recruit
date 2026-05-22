import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const surveyYear    = searchParams.get('survey_year') ? Number(searchParams.get('survey_year')) : null
  const limit         = Math.min(Number(searchParams.get('limit') || '200'), 500)

  // 性別・企業規模フィルター
  const sexParam  = searchParams.get('sex')
  const sizeParam = searchParams.get('size')
  const SEX_MAP:  Record<string, string> = { male: '男', female: '女' }
  const SIZE_MAP: Record<string, string> = { large: '1000人以上', medium: '100～999人', small: '10～99人' }
  const sexVal  = sexParam  ? (SEX_MAP[sexParam]  ?? '計')        : '計'
  const sizeVal = sizeParam ? (SIZE_MAP[sizeParam] ?? '企業規模計') : '企業規模計'

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

    // 対象データセットID決定
    let targetDatasetId: number
    let targetYear: number
    let targetGroupId: number

    if (surveyYear) {
      const match = years.find(y => y.survey_year === surveyYear)
      if (!match) {
        return NextResponse.json({ success: false, message: '指定された年度のデータが見つかりません' }, { status: 404 })
      }
      targetDatasetId = match.dataset_id
      targetYear      = match.survey_year
      targetGroupId   = match.group_id
    } else {
      targetDatasetId = years[0].dataset_id
      targetYear      = years[0].survey_year
      targetGroupId   = years[0].group_id
    }

    // occupation_slug の存在チェック
    const colCheck = await query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'occupation_wages'
         AND COLUMN_NAME = 'occupation_slug'`
    ) as Array<{ COLUMN_NAME: string }>
    const slugCol = colCheck.length > 0 ? 'occupation_slug' : 'NULL AS occupation_slug'

    const safeLimit = Math.min(Math.max(1, Math.floor(limit)), 500)
    const rows = await query(
      `SELECT occupation_name, ${slugCol},
              overtime_hours, scheduled_hours, annual_income,
              scheduled_wage, workers
       FROM occupation_wages
       WHERE dataset_id = ? AND sex = ? AND enterprise_size = ?
         AND overtime_hours IS NOT NULL
       ORDER BY overtime_hours DESC
       LIMIT ${safeLimit}`,
      [targetDatasetId, sexVal, sizeVal]
    ) as Array<{
      occupation_name: string
      occupation_slug: string | null
      overtime_hours: number | null
      scheduled_hours: number | null
      annual_income: number | null
      scheduled_wage: number | null
      workers: number | null
    }>

    // 統計（overtime_hours がある全件）
    const statsRows = await query(
      `SELECT AVG(overtime_hours) as avg_overtime,
              MAX(overtime_hours) as max_overtime,
              AVG(scheduled_hours) as avg_scheduled,
              SUM(workers) as total_workers,
              COUNT(*) as count
       FROM occupation_wages
       WHERE dataset_id = ? AND sex = ? AND enterprise_size = ?
         AND overtime_hours IS NOT NULL`,
      [targetDatasetId, sexVal, sizeVal]
    ) as Array<{
      avg_overtime: number; max_overtime: number
      avg_scheduled: number; total_workers: number; count: number
    }>
    const stats = statsRows[0]

    const groupInfo = years.find(y => y.dataset_id === targetDatasetId)

    // 変換: scheduled_wage（千円）÷ scheduled_hours（時間）× 1000 → 円/時
    const toWan = (v: any) => v != null ? Math.round(Number(v) / 10) : null
    const calcHourly = (wage: any, hours: any): number | null => {
      const w = Number(wage)
      const h = Number(hours)
      if (!w || !h || h <= 0) return null
      return Math.round((w * 1000) / h)
    }

    const convertedRows = rows.map((r: any) => ({
      ...r,
      annual_income:   toWan(r.annual_income),
      hourly_wage:     calcHourly(r.scheduled_wage, r.scheduled_hours),
      overtime_hours:  r.overtime_hours  != null ? Number(Number(r.overtime_hours).toFixed(1))  : null,
      scheduled_hours: r.scheduled_hours != null ? Number(Number(r.scheduled_hours).toFixed(1)) : null,
      total_hours:     (r.scheduled_hours != null && r.overtime_hours != null)
        ? Number((Number(r.scheduled_hours) + Number(r.overtime_hours)).toFixed(1))
        : null,
    }))

    return NextResponse.json({
      success: true,
      data: convertedRows,
      years: years.map(y => ({ survey_year: y.survey_year, dataset_id: y.dataset_id, group_id: y.group_id })),
      meta: {
        survey_year:      targetYear,
        dataset_id:       targetDatasetId,
        group_id:         targetGroupId,
        sex:              sexVal,
        enterprise_size:  sizeVal,
        survey_group_name: groupInfo?.survey_group_name ?? groupInfo?.legacy_name ?? '',
        survey_table_name: groupInfo?.survey_table_name ?? null,
        avg_overtime:    stats?.avg_overtime ? Number(Number(stats.avg_overtime).toFixed(1)) : null,
        max_overtime:    stats?.max_overtime ? Number(Number(stats.max_overtime).toFixed(1)) : null,
        avg_scheduled:   stats?.avg_scheduled ? Number(Number(stats.avg_scheduled).toFixed(1)) : null,
        total_workers:   stats?.total_workers ? Number(stats.total_workers) : null,
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
