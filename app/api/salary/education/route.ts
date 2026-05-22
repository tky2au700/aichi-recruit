import { NextResponse } from 'next/server'
import { fetchStatData, normalizeClass, toAnnualIncome, STATS_IDS } from '@/lib/estat'

export async function GET() {
  // 労働者の種類別（学歴別）データ
  const data = await fetchStatData(STATS_IDS.WORKER_TYPE)
  if (!data) {
    return NextResponse.json({ error: 'データ取得失敗' }, { status: 500 })
  }

  const classObjs = data.CLASS_INF.CLASS_OBJ
  const workerMap = new Map<string, string>()
  const ageMap = new Map<string, string>()
  const itemMap = new Map<string, string>()
  const timeMap = new Map<string, string>()

  for (const obj of classObjs) {
    const classes = normalizeClass(obj.CLASS)
    if (obj['@id'] === 'cat01') {
      for (const c of classes) workerMap.set(c['@id'], c['@name'])
    } else if (obj['@id'] === 'cat02') {
      for (const c of classes) ageMap.set(c['@id'], c['@name'])
    } else if (obj['@id'] === 'cat03') {
      for (const c of classes) itemMap.set(c['@id'], c['@name'])
    } else if (obj['@id'] === 'time') {
      for (const c of classes) timeMap.set(c['@id'], c['@name'])
    }
  }

  const values = data.DATA_INF.VALUE
  const latestTime = [...timeMap.keys()].sort().reverse()[0]

  // 全年齢計のコード
  const ageTotalId = [...ageMap.entries()].find(([, v]) => v === '計' || v === '年齢計')?.[0]

  // 学歴別（労働者種類に学歴が含まれることがある）の全年齢・年収
  const workerIncome: Record<string, { wage: number | null; bonus: number | null }> = {}

  for (const v of values) {
    const time = (v as any)['@time']
    const cat01 = (v as any)['@cat01']
    const cat02 = (v as any)['@cat02']
    const cat03 = (v as any)['@cat03']

    if (time !== latestTime) continue
    if (ageTotalId && cat02 !== ageTotalId) continue

    const name = workerMap.get(cat01) ?? cat01
    if (!workerIncome[name]) workerIncome[name] = { wage: null, bonus: null }

    const num = v.value ? parseFloat(v.value) : null
    const item = itemMap.get(cat03) ?? ''

    if (item.includes('所定内給与')) workerIncome[name].wage = num
    else if (item.includes('年間賞与')) workerIncome[name].bonus = num
  }

  const ranking = Object.entries(workerIncome)
    .map(([name, { wage, bonus }]) => ({
      name,
      annual: toAnnualIncome(wage, bonus, '千円'),
    }))
    .filter(r => r.annual !== null && r.annual > 0)
    .sort((a, b) => (b.annual ?? 0) - (a.annual ?? 0))

  // 年収推移（一般労働者計）
  const generalId = [...workerMap.entries()].find(([, v]) => v.includes('一般') && v.includes('計'))?.[0]
  const trend: Record<string, { wage: number | null; bonus: number | null }> = {}

  for (const v of values) {
    const time = (v as any)['@time']
    const cat01 = (v as any)['@cat01']
    const cat02 = (v as any)['@cat02']
    const cat03 = (v as any)['@cat03']

    if (generalId && cat01 !== generalId) continue
    if (ageTotalId && cat02 !== ageTotalId) continue

    const year = timeMap.get(time) ?? time
    if (!trend[year]) trend[year] = { wage: null, bonus: null }
    const num = v.value ? parseFloat(v.value) : null
    const item = itemMap.get(cat03) ?? ''

    if (item.includes('所定内給与')) trend[year].wage = num
    else if (item.includes('年間賞与')) trend[year].bonus = num
  }

  const trendData = Object.entries(trend)
    .map(([year, { wage, bonus }]) => ({
      year,
      annual: toAnnualIncome(wage, bonus, '千円'),
    }))
    .filter(d => d.annual !== null)
    .sort((a, b) => a.year.localeCompare(b.year))

  return NextResponse.json({
    ranking,
    trend: trendData,
    surveyYear: timeMap.get(latestTime) ?? latestTime,
    source: '賃金構造基本統計調査（労働者種類別）',
  })
}
