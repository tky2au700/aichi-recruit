import { NextResponse } from 'next/server'
import { fetchStatData, buildCodeMap, normalizeClass, toAnnualIncome, STATS_IDS } from '@/lib/estat'

export async function GET() {
  const data = await fetchStatData(STATS_IDS.INDUSTRY_BY_AGE)
  if (!data) {
    return NextResponse.json({ error: 'データ取得失敗' }, { status: 500 })
  }

  const classObjs = data.CLASS_INF.CLASS_OBJ
  // cat01: 産業、cat02: 性別、cat03: 年齢、time: 年
  const industryMap = new Map<string, string>()
  const timeMap = new Map<string, string>()
  const sexMap = new Map<string, string>()
  const ageMap = new Map<string, string>()
  const itemMap = new Map<string, string>() // 給与項目

  for (const obj of classObjs) {
    const classes = normalizeClass(obj.CLASS)
    if (obj['@id'] === 'cat01') {
      for (const c of classes) industryMap.set(c['@id'], c['@name'])
    } else if (obj['@id'] === 'cat02') {
      for (const c of classes) sexMap.set(c['@id'], c['@name'])
    } else if (obj['@id'] === 'cat03') {
      for (const c of classes) ageMap.set(c['@id'], c['@name'])
    } else if (obj['@id'] === 'cat04') {
      for (const c of classes) itemMap.set(c['@id'], c['@name'])
    } else if (obj['@id'] === 'time') {
      for (const c of classes) timeMap.set(c['@id'], c['@name'])
    }
  }

  const values = data.DATA_INF.VALUE

  // 産業別・男女計・全年齢・年間賞与を含む最新年のデータを集計
  // 所定内給与額(cat04=020) + 年間賞与(cat04=030) → 年収
  const latestTime = [...timeMap.keys()].sort().reverse()[0]

  // 産業別の年収ランキング用データ
  const industryIncome: Record<string, { wage: number | null; bonus: number | null }> = {}

  for (const v of values) {
    const time = (v as any)['@time']
    const cat01 = (v as any)['@cat01']
    const cat02 = (v as any)['@cat02']
    const cat03 = (v as any)['@cat03']
    const cat04 = (v as any)['@cat04']

    if (time !== latestTime) continue
    if (cat02 !== '110') continue // 男女計
    if (cat03 !== '000') continue // 年齢計

    const name = industryMap.get(cat01) ?? cat01
    if (!industryIncome[name]) industryIncome[name] = { wage: null, bonus: null }

    const num = v.value ? parseFloat(v.value) : null
    const item = itemMap.get(cat04) ?? ''

    if (item.includes('所定内給与') || cat04 === '020') {
      industryIncome[name].wage = num
    } else if (item.includes('年間賞与') || cat04 === '030') {
      industryIncome[name].bonus = num
    }
  }

  const ranking = Object.entries(industryIncome)
    .map(([name, { wage, bonus }]) => ({
      name,
      annual: toAnnualIncome(wage, bonus, '千円'),
    }))
    .filter(r => r.annual !== null)
    .sort((a, b) => (b.annual ?? 0) - (a.annual ?? 0))

  // 推移データ（産業計）
  const totalIndustryId = [...industryMap.entries()].find(([, v]) => v.includes('産業計'))?.[0]
  const trend: Record<string, { wage: number | null; bonus: number | null }> = {}

  for (const v of values) {
    const time = (v as any)['@time']
    const cat01 = (v as any)['@cat01']
    const cat02 = (v as any)['@cat02']
    const cat03 = (v as any)['@cat03']
    const cat04 = (v as any)['@cat04']

    if (cat01 !== totalIndustryId) continue
    if (cat02 !== '110') continue
    if (cat03 !== '000') continue

    const year = timeMap.get(time) ?? time
    if (!trend[year]) trend[year] = { wage: null, bonus: null }
    const num = v.value ? parseFloat(v.value) : null
    const item = itemMap.get(cat04) ?? ''

    if (item.includes('所定内給与') || cat04 === '020') trend[year].wage = num
    else if (item.includes('年間賞与') || cat04 === '030') trend[year].bonus = num
  }

  const trendData = Object.entries(trend)
    .map(([year, { wage, bonus }]) => ({
      year,
      annual: toAnnualIncome(wage, bonus, '千円'),
    }))
    .filter(d => d.annual !== null)
    .sort((a, b) => a.year.localeCompare(b.year))

  return NextResponse.json({
    ranking: ranking.slice(0, 20),
    trend: trendData,
    surveyYear: timeMap.get(latestTime) ?? latestTime,
    source: '賃金構造基本統計調査',
  })
}
