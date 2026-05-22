import { NextResponse } from 'next/server'
import { fetchStatData, normalizeClass, STATS_IDS } from '@/lib/estat'

export async function GET() {
  const data = await fetchStatData(STATS_IDS.PREFECTURE)
  if (!data) {
    return NextResponse.json({ error: 'データ取得失敗' }, { status: 500 })
  }

  const classObjs = data.CLASS_INF.CLASS_OBJ
  const prefMap = new Map<string, string>()
  const timeMap = new Map<string, string>()
  const itemMap = new Map<string, string>()
  const eduMap = new Map<string, string>()

  for (const obj of classObjs) {
    const classes = normalizeClass(obj.CLASS)
    if (obj['@id'] === 'area') {
      for (const c of classes) prefMap.set(c['@id'], c['@name'])
    } else if (obj['@id'] === 'cat01') {
      for (const c of classes) eduMap.set(c['@id'], c['@name'])
    } else if (obj['@id'] === 'cat02') {
      for (const c of classes) itemMap.set(c['@id'], c['@name'])
    } else if (obj['@id'] === 'time') {
      for (const c of classes) timeMap.set(c['@id'], c['@name'])
    }
  }

  const values = data.DATA_INF.VALUE
  const latestTime = [...timeMap.keys()].sort().reverse()[0]

  // 大卒・産業計の初任給を取得
  const uniGradId = [...eduMap.entries()].find(([, v]) => v.includes('大学') && !v.includes('院'))?.[0]
  // 初任給額のitem IDを特定
  const salaryItemId = [...itemMap.entries()].find(([, v]) => v.includes('初任給') || v.includes('給与額'))?.[0]

  const prefSalary: Record<string, number | null> = {}

  for (const v of values) {
    const time = (v as any)['@time']
    const area = (v as any)['@area']
    const cat01 = (v as any)['@cat01']
    const cat02 = (v as any)['@cat02']

    if (time !== latestTime) continue
    if (uniGradId && cat01 !== uniGradId) continue
    if (salaryItemId && cat02 !== salaryItemId) continue

    const prefName = prefMap.get(area) ?? area
    if (!prefName || prefName.includes('全国')) continue

    const num = v.value ? parseFloat(v.value) : null
    if (num === null) continue

    // 初任給は千円単位 → 万円換算 × 12で年収概算
    prefSalary[prefName] = Math.round(num * 12 / 10)
  }

  const ranking = Object.entries(prefSalary)
    .map(([name, annual]) => ({ name, annual }))
    .filter(r => r.annual !== null && r.annual > 0)
    .sort((a, b) => (b.annual ?? 0) - (a.annual ?? 0))

  return NextResponse.json({
    ranking,
    surveyYear: timeMap.get(latestTime) ?? latestTime,
    source: '賃金構造基本統計調査（新規学卒者・初任給）',
    note: '大学卒・産業計の初任給 × 12ヶ月で年収を概算しています',
  })
}
