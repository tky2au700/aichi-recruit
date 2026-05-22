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

    // occupation_slug 列の存在チェック（hourly_wageはDB計算で代替するため不要）
    const colCheck = await query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'occupation_wages'
         AND COLUMN_NAME = 'occupation_slug'`
    ) as Array<{ COLUMN_NAME: string }>
    const hasSlug = colCheck.length > 0
    const slugCol = hasSlug ? 'occupation_slug' : 'NULL AS occupation_slug'

    // hourly-wage ソートは scheduled_wage÷scheduled_hours×1000（円/時）で計算
    const effectiveSortCol = cfg.sort_col === 'hourly_wage'
      ? 'ROUND(scheduled_wage / NULLIF(scheduled_hours, 0) * 1000, 0)'
      : cfg.sort_col

    const safeLimit = Math.floor(limit)
    const filterClause = cfg.filter ? `AND ${cfg.filter}` : ''

    const rows = await query(
      `SELECT occupation_name, ${slugCol}, sex, enterprise_size,
              age, tenure_years, scheduled_hours, overtime_hours,
              monthly_wage, scheduled_wage, annual_bonus, annual_income, workers
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

    const statsRows = await query(
      `SELECT AVG(annual_income) as avg_income, MAX(annual_income) as max_income,
              MAX(annual_bonus) as max_bonus,
              MAX(ROUND(scheduled_wage / NULLIF(scheduled_hours, 0) * 1000, 0)) as max_hourly,
              COUNT(*) as count
       FROM occupation_wages
       WHERE dataset_id = ? AND sex = ? AND enterprise_size = ?`,
      [target.dataset_id, cfg.sex, cfg.enterprise_size]
    ) as any[]
    const stats = statsRows[0]

    // DB値は千円単位 → 万円換算
    // 時給換算: scheduled_wage（千円/月）÷ scheduled_hours（時間/月）× 1000 → 円/時
    const toWan = (v: any) => v != null ? Math.round(Number(v) / 10) : null
    const calcHourly = (wage: any, hours: any): number | null => {
      const w = Number(wage); const h = Number(hours)
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

    return NextResponse.json({
      success: true,
      data: convertedRows,
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
