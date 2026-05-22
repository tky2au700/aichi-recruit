import { NextResponse } from 'next/server'
import { fetchStatData, normalizeClass, toAnnualIncome, STATS_IDS } from '@/lib/estat'

export async function GET() {
  const data = await fetchStatData(STATS_IDS.AGE_BY_TENURE)
  if (!data) {
    return NextResponse.json({ error: 'データ取得失敗' }, { status: 500 })
  }

  const classObjs = data.CLASS_INF.CLASS_OBJ
  const ageMap = new Map<string, string>()
  const itemMap = new Map<string, string>()
  const timeMap = new Map<string, string>()
  const tenureMap = new Map<string, string>()

  for (const obj of classObjs) {
    const classes = normalizeClass(obj.CLASS)
    if (obj['@id'] === 'cat01') {
      for (const c of classes) ageMap.set(c['@id'], c['@name'])
    } else if (obj['@id'] === 'cat02') {
      for (const c of classes) tenureMap.set(c['@id'], c['@name'])
    } else if (obj['@id'] === 'cat03') {
      for (const c of classes) itemMap.set(c['@id'], c['@name'])
    } else if (obj['@id'] === 'time') {
      for (const c of classes) timeMap.set(c['@id'], c['@name'])
    }
  }

  const values = data.DATA_INF.VALUE
  const latestTime = [...timeMap.keys()].sort().reverse()[0]

  // 年齢別（勤続年数計）の年収データ
  const ageTotalId = [...tenureMap.entries()].find(([, v]) => v.includes('計') || v === '計')?.[0]

  const ageIncome: Record<string, { wage: number | null; bonus: number | null; order: number }> = {}

  const ageOrder = ['～19歳', '20～24歳', '25～29歳', '30～34歳', '35～39歳', '40～44歳', '45～49歳', '50～54歳', '55～59歳', '60～64歳', '65～69歳', '70歳～']

  for (const v of values) {
    const time = (v as any)['@time']
    const cat01 = (v as any)['@cat01']
    const cat02 = (v as any)['@cat02']
    const cat03 = (v as any)['@cat03']

    if (time !== latestTime) continue
    if (ageTotalId && cat02 !== ageTotalId) continue

    const name = ageMap.get(cat01) ?? cat01
    if (!ageIncome[name]) {
      ageIncome[name] = { wage: null, bonus: null, order: ageOrder.indexOf(name) }
    }

    const num = v.value ? parseFloat(v.value) : null
    const item = itemMap.get(cat03) ?? ''

    if (item.includes('所定内給与')) ageIncome[name].wage = num
    else if (item.includes('年間賞与')) ageIncome[name].bonus = num
  }

  const ageData = Object.entries(ageIncome)
    .map(([name, { wage, bonus, order }]) => ({
      name,
      annual: toAnnualIncome(wage, bonus, '千円'),
      order,
    }))
    .filter(d => d.annual !== null && !name_isTotal(d.name))
    .sort((a, b) => (a.order >= 0 && b.order >= 0 ? a.order - b.order : a.name.localeCompare(b.name)))

  // 産業計の年齢別推移（最新年のみ）→ ランキングとして使用
  const ranking = [...ageData].sort((a, b) => (b.annual ?? 0) - (a.annual ?? 0))

  return NextResponse.json({
    ageData,
    ranking: ranking.slice(0, 15),
    surveyYear: timeMap.get(latestTime) ?? latestTime,
    source: '賃金構造基本統計調査',
  })
}

function name_isTotal(name: string) {
  return name === '計' || name === '産業計' || name.startsWith('合計')
}
