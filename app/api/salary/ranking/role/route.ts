import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const sex            = searchParams.get('sex')             || '計'
  const enterpriseSize = searchParams.get('enterprise_size') || '10人以上'
  const tenureCategory = searchParams.get('tenure_category') || '勤続年数計'
  const surveyYear     = searchParams.get('survey_year') ? Number(searchParams.get('survey_year')) : null

  try {
    // 利用可能な年度一覧
    const years = await query(`
      SELECT d.survey_year, d.id as dataset_id
      FROM datasets d
      WHERE d.group_id = 4 AND d.record_count > 0
      ORDER BY d.survey_year DESC
    `) as Array<{ survey_year: number; dataset_id: number }>

    if (years.length === 0) {
      return NextResponse.json({ success: true, data: [], years: [], meta: null })
    }

    const target = surveyYear
      ? years.find(y => y.survey_year === surveyYear) ?? years[0]
      : years[0]

    const { dataset_id: datasetId, survey_year: targetYear } = target

    // 役職一覧と各役職の年収 (指定条件)
    const rows = await query(`
      SELECT
        role_name,
        sex,
        enterprise_size,
        tenure_category,
        scheduled_wage,
        annual_bonus,
        annual_income,
        workers
      FROM role_wages
      WHERE dataset_id = ?
        AND sex = ?
        AND enterprise_size = ?
        AND tenure_category = ?
      ORDER BY annual_income DESC
    `, [datasetId, sex, enterpriseSize, tenureCategory]) as Array<{
      role_name: string
      sex: string
      enterprise_size: string
      tenure_category: string
      scheduled_wage: number | null
      annual_bonus: number | null
      annual_income: number | null
      workers: number | null
    }>

    const toWan = (v: any) => v != null ? Math.round(Number(v) / 10) : null

    // 企業規模・勤続年数の選択肢
    const [sizes, tenures] = await Promise.all([
      query(`SELECT DISTINCT enterprise_size FROM role_wages WHERE dataset_id = ? ORDER BY enterprise_size`, [datasetId]) as Promise<Array<{ enterprise_size: string }>>,
      query(`SELECT DISTINCT tenure_category FROM role_wages WHERE dataset_id = ? ORDER BY tenure_category`, [datasetId]) as Promise<Array<{ tenure_category: string }>>,
    ])

    return NextResponse.json({
      success: true,
      data: rows.map(r => ({
        ...r,
        scheduled_wage: toWan(r.scheduled_wage),
        annual_bonus:   toWan(r.annual_bonus),
        annual_income:  toWan(r.annual_income),
      })),
      years: years.map(y => ({ survey_year: y.survey_year, dataset_id: y.dataset_id })),
      enterprise_sizes: sizes.map(s => s.enterprise_size),
      tenure_categories: tenures.map(t => t.tenure_category),
      meta: {
        survey_year: targetYear,
        dataset_id: datasetId,
        sex,
        enterprise_size: enterpriseSize,
        tenure_category: tenureCategory,
      },
    })
  } catch (error: any) {
    if (error.message?.includes("doesn't exist") || error.code === 'ER_NO_SUCH_TABLE') {
      return NextResponse.json({ success: true, data: [], years: [], meta: null })
    }
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}
