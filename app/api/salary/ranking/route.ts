import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

// ランキング種別ごとのソートキーと絞り込み条件
export type RankingType = 'female' | 'male' | 'bonus' | 'hourly-wage' | 'high-income-low-overtime'

const CONFIG: Record<RankingType, {
  sex: string
  enterprise_size: string
  sort_col: string
  order: 'DESC' | 'ASC'
  filter?: string
}> = {
  female: {
    sex: '女', enterprise_size: '企業規模計',
    sort_col: 'annual_income', order: 'DESC',
  },
  male: {
    sex: '男', enterprise_size: '企業規模計',
    sort_col: 'annual_income', order: 'DESC',
  },
  bonus: {
    sex: '計', enterprise_size: '企業規模計',
    sort_col: 'annual_bonus', order: 'DESC',
  },
  'hourly-wage': {
    sex: '計', enterprise_size: '企業規模計',
    sort_col: 'hourly_wage', order: 'DESC',
  },
  'high-income-low-overtime': {
    sex: '計', enterprise_size: '企業規模計',
    sort_col: 'annual_income', order: 'DESC',
    filter: 'overtime_hours <= 10',
  },
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const type       = (searchParams.get('type') ?? 'female') as RankingType
  const surveyYear = searchParams.get('survey_year') ? Number(searchParams.get('survey_year')) : null
  const limit      = Math.min(Math.max(1, Number(searchParams.get('limit') || '200')), 500)

  const cfg = CONFIG[type]
  if (!cfg) {
    return NextResponse.json({ success: false, message: '不明なランキング種別です' }, { status: 400 })
  }

  try {
    // 年度一覧
    const years = await query(
      `SELECT DISTINCT d.survey_year, d.id as dataset_id
       FROM datasets d WHERE d.record_count > 0 ORDER BY d.survey_year DESC`
    ) as Array<{ survey_year: number; dataset_id: number }>

    if (years.length === 0) {
      return NextResponse.json({ success: true, data: [], years: [], meta: null })
    }

    // 対象データセット決定
    const target = surveyYear
      ? years.find(y => y.survey_year === surveyYear) ?? years[0]
      : years[0]

    // 追加列の存在チェック（マイグレーション前でも動作するよう）
    const colCheck = await query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'occupation_wages'
         AND COLUMN_NAME IN ('occupation_slug','hourly_wage')`
    ) as Array<{ COLUMN_NAME: string }>
    const existingCols = new Set(colCheck.map((c: any) => c.COLUMN_NAME as string))
    const slugCol   = existingCols.has('occupation_slug') ? 'occupation_slug' : 'NULL AS occupation_slug'
    const hourlyCol = existingCols.has('hourly_wage')     ? 'hourly_wage'     : 'NULL AS hourly_wage'

    // hourly-wage ランキングは hourly_wage 列が存在しない場合 monthly_wage÷160 で代替
    const effectiveSortCol = cfg.sort_col === 'hourly_wage' && !existingCols.has('hourly_wage')
      ? 'ROUND(monthly_wage / 160, 1)'
      : cfg.sort_col

    const safeLimit = Math.floor(limit)
    const filterClause = cfg.filter ? `AND ${cfg.filter}` : ''

    const rows = await query(
      `SELECT occupation_name, ${slugCol}, sex, enterprise_size,
              age, tenure_years, scheduled_hours, overtime_hours,
              monthly_wage, scheduled_wage, annual_bonus, annual_income, ${hourlyCol}, workers
       FROM occupation_wages
       WHERE dataset_id = ?
         AND sex = ?
         AND enterprise_size = ?
         AND ${effectiveSortCol} IS NOT NULL
         ${filterClause}
       ORDER BY ${effectiveSortCol} ${cfg.order}
       LIMIT ${safeLimit}`,
      [target.dataset_id, cfg.sex, cfg.enterprise_size]
    ) as any[]

    const hourlyStatCol = existingCols.has('hourly_wage')
      ? 'MAX(hourly_wage)'
      : 'MAX(ROUND(monthly_wage / 160, 1))'
    const statsRows = await query(
      `SELECT AVG(annual_income) as avg_income, MAX(annual_income) as max_income,
              MAX(annual_bonus) as max_bonus, ${hourlyStatCol} as max_hourly,
              COUNT(*) as count
       FROM occupation_wages
       WHERE dataset_id = ? AND sex = ? AND enterprise_size = ?`,
      [target.dataset_id, cfg.sex, cfg.enterprise_size]
    ) as any[]
    const stats = statsRows[0]

    return NextResponse.json({
      success: true,
      data: rows,
      years: years.map(y => ({ survey_year: y.survey_year, dataset_id: y.dataset_id })),
      meta: {
        survey_year: target.survey_year,
        dataset_id: target.dataset_id,
        type,
        sex: cfg.sex,
        enterprise_size: cfg.enterprise_size,
        sort_col: cfg.sort_col,
        // DB値は千円単位 → ÷10 で万円換算。hourly_wageは千円/h → ×1000 で円換算
        avg_income:  stats?.avg_income  ? Math.round(Number(stats.avg_income)  / 10) : null,
        max_income:  stats?.max_income  ? Math.round(Number(stats.max_income)  / 10) : null,
        max_bonus:   stats?.max_bonus   ? Math.round(Number(stats.max_bonus)   / 10) : null,
        max_hourly:  stats?.max_hourly  ? Math.round(Number(stats.max_hourly) * 1000) : null,
        occupation_count: Number(stats?.count ?? 0),
      },
    })
  } catch (error: any) {
    if (error.message?.includes("doesn't exist") || error.code === 'ER_NO_SUCH_TABLE') {
      return NextResponse.json({ success: true, data: [], years: [], meta: null })
    }
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}
