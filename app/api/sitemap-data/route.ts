import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const [occupations, industries, prefectures, educations, ageGroups, roles] = await Promise.all([
    query(`SELECT DISTINCT occupation_name FROM occupation_wages WHERE sex='計' AND enterprise_size='企業規模計' ORDER BY occupation_name`).catch(() => []) as Promise<{ occupation_name: string }[]>,
    query(`SELECT DISTINCT industry_name FROM industry_wages WHERE sex='計' AND enterprise_size='企業規模計' AND education='学歴計' ORDER BY industry_name`).catch(() => []) as Promise<{ industry_name: string }[]>,
    query(`SELECT DISTINCT prefecture FROM prefecture_wages WHERE sex='計' ORDER BY prefecture`).catch(() => []) as Promise<{ prefecture: string }[]>,
    query(`SELECT DISTINCT education FROM age_wages WHERE sex='計' AND enterprise_size='企業規模計' AND age_group='学歴計' AND education!='学歴計' ORDER BY education`).catch(() => []) as Promise<{ education: string }[]>,
    query(`SELECT DISTINCT age_group FROM age_wages WHERE sex='計' AND enterprise_size='企業規模計' AND education='学歴計' AND age_group!='学歴計' ORDER BY age_group`).catch(() => []) as Promise<{ age_group: string }[]>,
    query(`SELECT DISTINCT role_name FROM role_wages WHERE sex='計' ORDER BY role_name`).catch(() => []) as Promise<{ role_name: string }[]>,
  ])

  return NextResponse.json({
    occupations: (occupations as { occupation_name: string }[]).map(r => r.occupation_name),
    industries:  (industries  as { industry_name:  string }[]).map(r => r.industry_name),
    prefectures: (prefectures as { prefecture:      string }[]).map(r => r.prefecture),
    educations:  (educations  as { education:       string }[]).map(r => r.education),
    ageGroups:   (ageGroups   as { age_group:       string }[]).map(r => r.age_group),
    roles:       (roles       as { role_name:       string }[]).map(r => r.role_name),
  })
}
