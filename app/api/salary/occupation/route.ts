import { NextResponse } from 'next/server'
import { fetchStatData, normalizeClass, STATS_IDS } from '@/lib/estat'

export async function GET() {
  const data = await fetchStatData(STATS_IDS.OCCUPATION)
  if (!data) {
    return NextResponse.json({ error: 'データ取得失敗' }, { status: 500 })
  }

  const classObjs = data.CLASS_INF.CLASS_OBJ
  const occupationMap = new Map<string, string>()
  const timeMap = new Map<string, string>()
  const sexMap = new Map<string, string>()

  for (const obj of classObjs) {
    const classes = normalizeClass(obj.CLASS)
    if (obj['@id'] === 'cat01') {
      for (const c of classes) occupationMap.set(c['@id'], c['@name'])
    } else if (obj['@id'] === 'cat02') {
      for (const c of classes) sexMap.set(c['@id'], c['@name'])
    } else if (obj['@id'] === 'time') {
      for (const c of classes) timeMap.set(c['@id'], c['@name'])
    }
  }

  const values = data.DATA_INF.VALUE
  const latestTime = [...timeMap.keys()].sort().reverse()[0]

  // 職種別・男女計・1時間当たり給与額を年収に換算（月160時間・12ヶ月として概算）
  const occupationWage: Record<string, number | null> = {}

  // 男女計のコードを特定
  const sexTotalId = [...sexMap.entries()].find(([, v] ) => v.includes('計') || v === '計')?.[0]

  for (const v of values) {
    const time = (v as any)['@time']
    const cat01 = (v as any)['@cat01']
    const cat02 = (v as any)['@cat02']

    if (time !== latestTime) continue
    if (sexTotalId && cat02 !== sexTotalId) continue

    const name = occupationMap.get(cat01) ?? cat01
    if (name.includes('計') || name === '職種計') continue

    const num = v.value ? parseFloat(v.value) : null
    if (num === null) continue

    // 1時間当たり給与額（円）→ 年収（万円）: × 160時間 × 12ヶ月 ÷ 10000
    occupationWage[name] = Math.round(num * 160 * 12 / 10000)
  }

  const ranking = Object.entries(occupationWage)
    .map(([name, annual]) => ({ name, annual }))
    .filter(r => r.annual !== null && r.annual > 0)
    .sort((a, b) => (b.annual ?? 0) - (a.annual ?? 0))

  return NextResponse.json({
    ranking: ranking.slice(0, 20),
    surveyYear: timeMap.get(latestTime) ?? latestTime,
    source: '賃金構造基本統計調査（臨時労働者・職種別）',
    note: '1時間当たり給与額 × 160時間 × 12ヶ月で年収を概算しています',
  })
}
