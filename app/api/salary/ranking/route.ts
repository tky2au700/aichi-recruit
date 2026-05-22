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

    const safeLimit = Math.floor(limit)
    const filterClause = cfg.filter ? `AND ${cfg.filter}` : ''

    const rows = await query(
      `SELECT occupation_name, occupation_slug, sex, enterprise_size,
              age, tenure_years, scheduled_hours, overtime_hours,
              monthly_wage, scheduled_wage, annual_bonus, annual_income, hourly_wage, workers
       FROM occupation_wages
       WHERE dataset_id = ?
         AND sex = ?
         AND enterprise_size = ?
         AND ${cfg.sort_col} IS NOT NULL
         ${filterClause}
       ORDER BY ${cfg.sort_col} ${cfg.order}
       LIMIT ${safeLimit}`,
      [target.dataset_id, cfg.sex, cfg.enterprise_size]
    ) as any[]

    const statsRows = await query(
      `SELECT AVG(annual_income) as avg_income, MAX(annual_income) as max_income,
              MAX(annual_bonus) as max_bonus, MAX(hourly_wage) as max_hourly,
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
        avg_income:  stats?.avg_income  ? Math.round(Number(stats.avg_income))  : null,
        max_income:  stats?.max_income  ? Math.round(Number(stats.max_income))  : null,
        max_bonus:   stats?.max_bonus   ? Math.round(Number(stats.max_bonus))   : null,
        max_hourly:  stats?.max_hourly  ? Number(Number(stats.max_hourly).toFixed(1)) : null,
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
