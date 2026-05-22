import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const years = Math.min(Number(searchParams.get('years') || '5'), 10)
  const limit = Math.min(Math.max(1, Number(searchParams.get('limit') || '200')), 500)

  // 性別・企業規模フィルター（occupation rankingと同じマッピング）
  const sexParam  = searchParams.get('sex')
  const sizeParam = searchParams.get('size')
  const SEX_MAP: Record<string, string>  = { male: '男', female: '女' }
  const SIZE_MAP: Record<string, string> = { large: '1000人以上', medium: '100～999人', small: '10～99人' }
  const sexVal  = sexParam  ? (SEX_MAP[sexParam]  ?? '計')        : '計'
  const sizeVal = sizeParam ? (SIZE_MAP[sizeParam] ?? '企業規模計') : '企業規模計'

  try {
    // 利用可能な年度一覧（降順）
    const allYears = await query(
      `SELECT DISTINCT d.survey_year, d.id as dataset_id
       FROM datasets d WHERE d.record_count > 0 ORDER BY d.survey_year DESC`
    ) as Array<{ survey_year: number; dataset_id: number }>

    if (allYears.length < 2) {
      return NextResponse.json({ success: true, data: [], available_years: allYears.map(y => y.survey_year), message: '比較するデータが不足しています（最低2年分必要）' })
    }

    const latestDs  = allYears[0]
    // 指定年数前に最も近い年度
    const baseYear  = latestDs.survey_year - years
    const baseDs    = allYears.find(y => y.survey_year <= baseYear) ?? allYears[allYears.length - 1]

    if (latestDs.dataset_id === baseDs.dataset_id) {
      return NextResponse.json({ success: true, data: [], available_years: allYears.map(y => y.survey_year), message: '比較に必要な年度数のデータがありません' })
    }

    // occupation_slug / hourly_wage はマイグレーション後に追加される列なので存在チェック
    const colCheck = await query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'occupation_wages'
       AND COLUMN_NAME IN ('occupation_slug','hourly_wage')`
    ) as Array<{ COLUMN_NAME: string }>
    const existingCols = new Set(colCheck.map((r: any) => r.COLUMN_NAME))
    const slugCol   = existingCols.has('occupation_slug') ? 'occupation_slug' : 'NULL AS occupation_slug'
    const hourlyCol = existingCols.has('hourly_wage')     ? 'hourly_wage'     : 'NULL AS hourly_wage'

    // 追加カラム存在チェック
    const extraColCheck = await query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'occupation_wages'
       AND COLUMN_NAME IN ('annual_bonus','scheduled_hours','overtime_hours','age','tenure_years')`
    ) as Array<{ COLUMN_NAME: string }>
    const extraCols = new Set(extraColCheck.map((r: any) => r.COLUMN_NAME))
    const bonusCol   = extraCols.has('annual_bonus')    ? 'annual_bonus'    : 'NULL AS annual_bonus'
    const ageCol     = extraCols.has('age')             ? 'age'             : 'NULL AS age'
    const tenureCol  = extraCols.has('tenure_years')    ? 'tenure_years'    : 'NULL AS tenure_years'
    const overtimeCol= extraCols.has('overtime_hours')  ? 'overtime_hours'  : 'NULL AS overtime_hours'

    // 最新年度データ（sex/sizeフィルター適用）
    const latestRows = await query(
      `SELECT occupation_name, ${slugCol}, annual_income, monthly_wage, ${hourlyCol},
              ${bonusCol}, ${ageCol}, ${tenureCol}, ${overtimeCol}, workers
       FROM occupation_wages
       WHERE dataset_id = ? AND sex = ? AND enterprise_size = ? AND annual_income IS NOT NULL`,
      [latestDs.dataset_id, sexVal, sizeVal]
    ) as Array<{
      occupation_name: string; occupation_slug: string | null
      annual_income: number; monthly_wage: number | null; hourly_wage: number | null
      annual_bonus: number | null; age: number | null; tenure_years: number | null; overtime_hours: number | null
      workers: number | null
    }>

    // 基準年度データ（同じsex/sizeフィルター）
    const baseRows = await query(
      `SELECT occupation_name, annual_income
       FROM occupation_wages
       WHERE dataset_id = ? AND sex = ? AND enterprise_size = ? AND annual_income IS NOT NULL`,
      [baseDs.dataset_id, sexVal, sizeVal]
    ) as Array<{ occupation_name: string; annual_income: number }>

    const baseMap = new Map(baseRows.map(r => [r.occupation_name, r.annual_income]))

    // 増加率計算（DB値は千円単位 → 万円換算。growth_rateは%なのでそのまま）
    const toWan  = (v: number | null | undefined) => v != null ? Math.round(Number(v) / 10) : null
    const toHour = (v: number | null | undefined) => v != null ? Math.round(Number(v) * 1000) : null
    const growthData = latestRows
      .map(r => {
        const baseIncome = baseMap.get(r.occupation_name)
        if (!baseIncome || baseIncome <= 0) return null
        const growth_rate   = ((r.annual_income - baseIncome) / baseIncome) * 100
        const growth_amount = r.annual_income - baseIncome
        return {
          ...r,
          annual_income:  toWan(r.annual_income),
          monthly_wage:   toWan(r.monthly_wage),
          hourly_wage:    toHour(r.hourly_wage),
          annual_bonus:   toWan(r.annual_bonus),
          age:            r.age            != null ? Number(Number(r.age).toFixed(1))            : null,
          tenure_years:   r.tenure_years   != null ? Number(Number(r.tenure_years).toFixed(1))   : null,
          overtime_hours: r.overtime_hours != null ? Number(Number(r.overtime_hours).toFixed(1)) : null,
          base_income:    toWan(baseIncome),
          growth_rate,
          growth_amount:  toWan(growth_amount),
        }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => b.growth_rate - a.growth_rate)
      .slice(0, limit)

    return NextResponse.json({
      success: true,
      data: growthData,
      latest_year: latestDs.survey_year,
      base_year: baseDs.survey_year,
      actual_years: latestDs.survey_year - baseDs.survey_year,
      available_years: allYears.map(y => y.survey_year),
    })
  } catch (error: any) {
    if (error.message?.includes("doesn't exist") || error.code === 'ER_NO_SUCH_TABLE') {
      return NextResponse.json({ success: true, data: [], available_years: [], message: 'データが見つかりません' })
    }
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}
