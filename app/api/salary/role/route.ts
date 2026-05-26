import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const roleName   = searchParams.get('role_name')
  const surveyYear = searchParams.get('survey_year') ? Number(searchParams.get('survey_year')) : null

  if (!roleName) {
    return NextResponse.json({ success: false, message: 'role_name は必須です' }, { status: 400 })
  }

  try {
    // 利用可能年度
    const years = await query(`
      SELECT d.survey_year, d.id as dataset_id
      FROM datasets d
      WHERE d.group_id = 4 AND d.record_count > 0
      ORDER BY d.survey_year DESC
    `) as Array<{ survey_year: number; dataset_id: number }>

    if (years.length === 0) {
      return NextResponse.json({ success: false, message: 'データがありません' }, { status: 404 })
    }

    const target = surveyYear
      ? years.find(y => y.survey_year === surveyYear) ?? years[0]
      : years[0]

    const { dataset_id: datasetId, survey_year: targetYear } = target

    const toWan = (v: any) => v != null ? Math.round(Number(v) / 10) : null

    // 全データ（全組み合わせ）
    const allRows = await query(`
      SELECT sex, enterprise_size, tenure_category, education, age_group,
             scheduled_wage, annual_bonus, annual_income, workers
      FROM role_wages
      WHERE dataset_id = ? AND role_name = ?
      ORDER BY enterprise_size, tenure_category, sex, age_group
    `, [datasetId, roleName]) as Array<{
      sex: string
      enterprise_size: string
      tenure_category: string
      education: string
      age_group: string
      scheduled_wage: number | null
      annual_bonus: number | null
      annual_income: number | null
      workers: number | null
    }>

    if (allRows.length === 0) {
      return NextResponse.json({ success: false, message: '該当データが見つかりません' }, { status: 404 })
    }

    // 勤続年数ごとの推移 (計・10人以上・学歴計・学歴計)
    const tenureRows = await query(`
      SELECT tenure_category, sex,
             AVG(scheduled_wage) as scheduled_wage,
             AVG(annual_bonus)   as annual_bonus,
             AVG(annual_income)  as annual_income,
             SUM(workers)        as workers
      FROM role_wages
      WHERE dataset_id = ?
        AND role_name = ?
        AND enterprise_size = '10人以上'
        AND education = '学歴計'
        AND age_group = '学歴計'
      GROUP BY tenure_category, sex
      ORDER BY
        CASE tenure_category
          WHEN '勤続年数計' THEN 0
          WHEN '0年' THEN 1
          WHEN '1～2年' THEN 2
          WHEN '3～4年' THEN 3
          WHEN '5～9年' THEN 4
          WHEN '10～14年' THEN 5
          WHEN '15～19年' THEN 6
          WHEN '20年以上' THEN 7
          ELSE 99
        END, sex
    `, [datasetId, roleName]) as Array<{
      tenure_category: string
      sex: string
      scheduled_wage: number | null
      annual_bonus: number | null
      annual_income: number | null
      workers: number | null
    }>

    // 年齢グループ別 (計・10人以上・学歴計)
    const ageRows = await query(`
      SELECT age_group, sex,
             AVG(scheduled_wage) as scheduled_wage,
             AVG(annual_bonus)   as annual_bonus,
             AVG(annual_income)  as annual_income,
             SUM(workers)        as workers
      FROM role_wages
      WHERE dataset_id = ?
        AND role_name = ?
        AND enterprise_size = '10人以上'
        AND tenure_category = '勤続年数計'
        AND education = '学歴計'
      GROUP BY age_group, sex
      ORDER BY
        CASE age_group
          WHEN '学歴計' THEN 0
          WHEN '〜19歳' THEN 1
          WHEN '20〜24歳' THEN 2
          WHEN '25〜29歳' THEN 3
          WHEN '30〜34歳' THEN 4
          WHEN '35〜39歳' THEN 5
          WHEN '40〜44歳' THEN 6
          WHEN '45〜49歳' THEN 7
          WHEN '50〜54歳' THEN 8
          WHEN '55〜59歳' THEN 9
          WHEN '60〜64歳' THEN 10
          WHEN '65歳〜' THEN 11
          ELSE 99
        END, sex
    `, [datasetId, roleName]) as Array<{
      age_group: string
      sex: string
      scheduled_wage: number | null
      annual_bonus: number | null
      annual_income: number | null
      workers: number | null
    }>

    // 企業規模別 (計・勤続年数計・学歴計・学歴計)
    const sizeRows = await query(`
      SELECT enterprise_size, sex,
             AVG(scheduled_wage) as scheduled_wage,
             AVG(annual_bonus)   as annual_bonus,
             AVG(annual_income)  as annual_income,
             SUM(workers)        as workers
      FROM role_wages
      WHERE dataset_id = ?
        AND role_name = ?
        AND tenure_category = '勤続年数計'
        AND education = '学歴計'
        AND age_group = '学歴計'
      GROUP BY enterprise_size, sex
      ORDER BY enterprise_size, sex
    `, [datasetId, roleName]) as Array<{
      enterprise_size: string
      sex: string
      scheduled_wage: number | null
      annual_bonus: number | null
      annual_income: number | null
      workers: number | null
    }>

    // 複数年推移 (計・10人以上・勤続年数計・学歴計)
    const timeSeries = await query(`
      SELECT d.survey_year,
             rw.sex,
             AVG(rw.scheduled_wage) as scheduled_wage,
             AVG(rw.annual_bonus)   as annual_bonus,
             AVG(rw.annual_income)  as annual_income
      FROM role_wages rw
      JOIN datasets d ON rw.dataset_id = d.id
      WHERE d.group_id = 4
        AND rw.role_name = ?
        AND rw.enterprise_size = '10人以上'
        AND rw.tenure_category = '勤続年数計'
        AND rw.education = '学歴計'
        AND rw.age_group = '学歴計'
      GROUP BY d.survey_year, rw.sex
      ORDER BY d.survey_year ASC, rw.sex
    `, [roleName]) as Array<{
      survey_year: number
      sex: string
      scheduled_wage: number | null
      annual_bonus: number | null
      annual_income: number | null
    }>

    const convertRows = <T extends { scheduled_wage?: any; annual_bonus?: any; annual_income?: any }>(rows: T[]) =>
      rows.map(r => ({ ...r, scheduled_wage: toWan(r.scheduled_wage), annual_bonus: toWan(r.annual_bonus), annual_income: toWan(r.annual_income) }))

    return NextResponse.json({
      success: true,
      role_name: roleName,
      survey_year: targetYear,
      dataset_id: datasetId,
      years: years.map(y => ({ survey_year: y.survey_year, dataset_id: y.dataset_id })),
      tenure_rows:  convertRows(tenureRows),
      age_rows:     convertRows(ageRows),
      size_rows:    convertRows(sizeRows),
      time_series:  convertRows(timeSeries),
    })
  } catch (error: any) {
    if (error.message?.includes("doesn't exist") || error.code === 'ER_NO_SUCH_TABLE') {
      return NextResponse.json({ success: false, message: 'データがありません' }, { status: 404 })
    }
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}
