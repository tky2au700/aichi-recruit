import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const sex            = searchParams.get('sex')             || '計'
  const enterpriseSize = searchParams.get('enterprise_size') || '10人以上'
  const tenureCategory = searchParams.get('tenure_category') || '勤続年数計'
  const surveyYear     = searchParams.get('survey_year') ? Number(searchParams.get('survey_year')) : null
  const limit          = Math.min(Number(searchParams.get('limit') || '200'), 500)

  try {
    // 利用可能な年度一覧（occupation と同じ形式）
    const years = await query(`
      SELECT DISTINCT d.survey_year, d.id AS dataset_id, dg.id AS group_id,
             dg.survey_group_name, dg.survey_table_name, dg.name AS legacy_name
      FROM datasets d
      JOIN dataset_groups dg ON d.group_id = dg.id
      WHERE d.record_count > 0 AND dg.target_table = 'role_wages'
      ORDER BY d.survey_year DESC
    `) as Array<{
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

    // 対象データセット決定
    const target = surveyYear
      ? (years.find(y => y.survey_year === surveyYear) ?? years[0])
      : years[0]
    const { dataset_id: datasetId, survey_year: targetYear, group_id: targetGroupId } = target

    // ランキングデータ + 統計を並列取得
    const safeLimit = Math.min(Math.max(1, Math.floor(limit)), 500)
    const [rows, statsRows, sizes, tenures] = await Promise.all([
      query(
        `SELECT role_name, sex, enterprise_size, tenure_category,
                scheduled_wage, annual_bonus, annual_income, workers
         FROM role_wages
         WHERE dataset_id = ? AND sex = ? AND enterprise_size = ? AND tenure_category = ?
         ORDER BY annual_income DESC
         LIMIT ${safeLimit}`,
        [datasetId, sex, enterpriseSize, tenureCategory]
      ) as Promise<Array<{
        role_name: string; sex: string; enterprise_size: string; tenure_category: string
        scheduled_wage: number | null; annual_bonus: number | null
        annual_income: number | null; workers: number | null
      }>>,
      query(
        `SELECT AVG(annual_income) AS avg_income, MAX(annual_income) AS max_income,
                SUM(workers) AS total_workers, COUNT(DISTINCT role_name) AS role_count
         FROM role_wages
         WHERE dataset_id = ? AND sex = ? AND enterprise_size = ? AND tenure_category = ?`,
        [datasetId, sex, enterpriseSize, tenureCategory]
      ) as Promise<Array<{ avg_income: number; max_income: number; total_workers: number; role_count: number }>>,
      query(
        `SELECT DISTINCT enterprise_size FROM role_wages WHERE dataset_id = ? ORDER BY enterprise_size`,
        [datasetId]
      ) as Promise<Array<{ enterprise_size: string }>>,
      query(
        `SELECT DISTINCT tenure_category FROM role_wages WHERE dataset_id = ? ORDER BY tenure_category`,
        [datasetId]
      ) as Promise<Array<{ tenure_category: string }>>,
    ])

    const stats = statsRows[0]
    const groupInfo = years.find(y => y.dataset_id === datasetId)

    // DB値は千円単位 → 万円換算（occupation と同じ）
    const toWan = (v: any) => v != null ? Math.round(Number(v) / 10) : null

    return NextResponse.json({
      success: true,
      data: rows.map(r => ({
        ...r,
        scheduled_wage: toWan(r.scheduled_wage),
        annual_bonus:   toWan(r.annual_bonus),
        annual_income:  toWan(r.annual_income),
      })),
      years: years.map(y => ({ survey_year: y.survey_year, dataset_id: y.dataset_id, group_id: y.group_id })),
      enterprise_sizes:   sizes.map(s => s.enterprise_size),
      tenure_categories:  tenures.map(t => t.tenure_category),
      meta: {
        survey_year:        targetYear,
        dataset_id:         datasetId,
        group_id:           targetGroupId,
        sex,
        enterprise_size:    enterpriseSize,
        tenure_category:    tenureCategory,
        survey_group_name:  groupInfo?.survey_group_name ?? groupInfo?.legacy_name ?? '賃金構造基本統計調査',
        survey_table_name:  groupInfo?.survey_table_name ?? null,
        avg_income:         stats?.avg_income  ? Math.round(Number(stats.avg_income)  / 10) : null,
        max_income:         stats?.max_income  ? Math.round(Number(stats.max_income)  / 10) : null,
        total_workers:      stats?.total_workers ? Number(stats.total_workers) : null,
        role_count:         stats?.role_count  ? Number(stats.role_count) : 0,
      },
    })
  } catch (error: any) {
    if (error.message?.includes("doesn't exist") || error.code === 'ER_NO_SUCH_TABLE') {
      return NextResponse.json({ success: true, data: [], years: [], meta: null })
    }
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}
