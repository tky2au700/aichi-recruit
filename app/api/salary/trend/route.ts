import { NextResponse } from 'next/server'
import mysql from 'mysql2/promise'

const DB = {
  host: process.env.MYSQL_HOST ?? '162.43.24.67',
  port: Number(process.env.MYSQL_PORT ?? 3306),
  user: process.env.MYSQL_USER ?? 'emoji_user',
  password: process.env.MYSQL_PASSWORD ?? 'emoji-luft-700',
  database: process.env.MYSQL_DATABASE ?? 'recruit_db',
}

async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const conn = await mysql.createConnection(DB)
  const [rows] = await conn.execute(sql, params)
  await conn.end()
  return rows as T[]
}

export async function GET() {
  try {
    // 1. 全体・男性・女性の年収推移
    const overall = await query(`
      SELECT d.survey_year, aw.sex, ROUND(aw.annual_income / 10, 1) AS annual_income_man
      FROM age_wages aw
      JOIN datasets d ON aw.dataset_id = d.id
      WHERE aw.enterprise_size = '企業規模計'
        AND aw.age_group = '学歴計'
        AND aw.education = '学歴計'
      ORDER BY d.survey_year, aw.sex
    `)

    // 2. 年齢階級別の年収推移（主要年齢帯）
    const byAge = await query(`
      SELECT d.survey_year, aw.age_group, ROUND(aw.annual_income / 10, 1) AS annual_income_man
      FROM age_wages aw
      JOIN datasets d ON aw.dataset_id = d.id
      WHERE aw.enterprise_size = '企業規模計'
        AND aw.education = '学歴計'
        AND aw.sex = '計'
        AND aw.age_group NOT IN ('学歴計')
      ORDER BY d.survey_year,
        CASE aw.age_group
          WHEN '～19歳' THEN 1 WHEN '20～24歳' THEN 2 WHEN '25～29歳' THEN 3
          WHEN '30～34歳' THEN 4 WHEN '35～39歳' THEN 5 WHEN '40～44歳' THEN 6
          WHEN '45～49歳' THEN 7 WHEN '50～54歳' THEN 8 WHEN '55～59歳' THEN 9
          WHEN '60～64歳' THEN 10 WHEN '65～69歳' THEN 11 WHEN '70歳～' THEN 12
          ELSE 99
        END
    `)

    // 3. 企業規模別の年収推移
    const bySize = await query(`
      SELECT d.survey_year, aw.enterprise_size, ROUND(aw.annual_income / 10, 1) AS annual_income_man
      FROM age_wages aw
      JOIN datasets d ON aw.dataset_id = d.id
      WHERE aw.age_group = '学歴計'
        AND aw.education = '学歴計'
        AND aw.sex = '計'
      ORDER BY d.survey_year,
        CASE aw.enterprise_size
          WHEN '企業規模計' THEN 1 WHEN '1,000人以上' THEN 2
          WHEN '100～999人' THEN 3 WHEN '10～99人' THEN 4
          ELSE 5
        END
    `)

    // 4. 学歴別の年収推移
    const byEducation = await query(`
      SELECT d.survey_year, aw.education, ROUND(aw.annual_income / 10, 1) AS annual_income_man
      FROM age_wages aw
      JOIN datasets d ON aw.dataset_id = d.id
      WHERE aw.enterprise_size = '企業規模計'
        AND aw.age_group = '学歴計'
        AND aw.sex = '計'
      ORDER BY d.survey_year, aw.education
    `)

    const years = [...new Set(overall.map((r: any) => r.survey_year))].sort((a, b) => Number(a) - Number(b))

    // 全体・男性・女性の推移を年ごとにまとめる
    const overallByYear = years.map(y => {
      const rows = overall.filter((r: any) => r.survey_year === y)
      const total  = rows.find((r: any) => r.sex === '計')
      const male   = rows.find((r: any) => r.sex === '男')
      const female = rows.find((r: any) => r.sex === '女')
      return {
        year: y,
        total:  total  ? Number(total.annual_income_man)  : null,
        male:   male   ? Number(male.annual_income_man)   : null,
        female: female ? Number(female.annual_income_man) : null,
      }
    })

    // 年齢階級別の推移（年ごと・age_group別）
    const ageGroups = [...new Set(byAge.map((r: any) => r.age_group))]
    const byAgeFormatted = years.map(y => {
      const row: Record<string, any> = { year: y }
      ageGroups.forEach(ag => {
        const found = byAge.find((r: any) => r.survey_year === y && r.age_group === ag)
        row[ag as string] = found ? Number(found.annual_income_man) : null
      })
      return row
    })

    // 企業規模別の推移
    const sizes = [...new Set(bySize.map((r: any) => r.enterprise_size))]
    const bySizeFormatted = years.map(y => {
      const row: Record<string, any> = { year: y }
      sizes.forEach(s => {
        const found = bySize.find((r: any) => r.survey_year === y && r.enterprise_size === s)
        row[s as string] = found ? Number(found.annual_income_man) : null
      })
      return row
    })

    // 学歴別の推移
    const educations = [...new Set(byEducation.map((r: any) => r.education))]
    const byEducationFormatted = years.map(y => {
      const row: Record<string, any> = { year: y }
      educations.forEach(e => {
        const found = byEducation.find((r: any) => r.survey_year === y && r.education === e)
        row[e as string] = found ? Number(found.annual_income_man) : null
      })
      return row
    })

    return NextResponse.json({
      years,
      overall: overallByYear,
      ageGroups,
      byAge: byAgeFormatted,
      sizes,
      bySize: bySizeFormatted,
      educations,
      byEducation: byEducationFormatted,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'データ取得に失敗しました' }, { status: 500 })
  }
}
