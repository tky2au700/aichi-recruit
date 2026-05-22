/**
 * e-Stat API ユーティリティ
 * 賃金構造基本統計調査データ取得
 */

const BASE_URL = 'https://api.e-stat.go.jp/rest/3.0/app/json'

// 統計表ID定数
export const STATS_IDS = {
  // 産業別・年齢階級別給与額（産業計・産業別）
  INDUSTRY_BY_AGE: '0003029886',
  // 年齢階級・勤続年数別所定内給与額（産業計）
  AGE_BY_TENURE: '0003029921',
  // 職種別1時間当たり給与額（臨時労働者）
  OCCUPATION: '0003031009',
  // 都道府県別新規学卒初任給
  PREFECTURE: '0003031016',
  // 労働者種類別・年齢階級別給与額
  WORKER_TYPE: '0003030006',
} as const

export type StatId = typeof STATS_IDS[keyof typeof STATS_IDS]

export interface EstatValue {
  unit: string
  value: string | null
  area?: string
  cat01?: string
  cat02?: string
  cat03?: string
  time?: string
  $: string
}

export interface EstatMetaClass {
  '@id': string
  '@name': string
  '@level'?: string
  '@parentCode'?: string
  '@addInf'?: string
}

export interface EstatMeta {
  CLASS_INF: {
    CLASS_OBJ: Array<{
      '@id': string
      '@name': string
      CLASS: EstatMetaClass | EstatMetaClass[]
    }>
  }
}

export interface EstatStatsData {
  TABLE_INF: {
    '@id': string
    STAT_NAME: { $: string }
    TITLE: { $: string }
    SURVEY_DATE: string | number
  }
  CLASS_INF: EstatMeta['CLASS_INF']
  DATA_INF: {
    VALUE: EstatValue[]
  }
}

// 統計表のメタデータと値を取得
export async function fetchStatData(statsDataId: string): Promise<EstatStatsData | null> {
  const appId = process.env.ESTAT_API_KEY
  if (!appId) {
    console.error('[estat] ESTAT_API_KEY is not set')
    return null
  }

  const url = `${BASE_URL}/getStatsData?appId=${appId}&statsDataId=${statsDataId}&metaGetFlg=Y&cntGetFlg=N&explanationGetFlg=N&annotationGetFlg=N&sectionHeaderFlg=1`

  try {
    const res = await fetch(url, { next: { revalidate: 86400 } }) // 24時間キャッシュ
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    const statsData = json?.GET_STATS_DATA?.STATISTICAL_DATA
    if (!statsData) return null
    return statsData as EstatStatsData
  } catch (err) {
    console.error('[estat] fetchStatData error:', err)
    return null
  }
}

// 統計表一覧を検索
export async function searchStats(keyword: string, limit = 20) {
  const appId = process.env.ESTAT_API_KEY
  if (!appId) return []

  const encoded = encodeURIComponent(keyword)
  const url = `${BASE_URL}/getStatsList?appId=${appId}&searchWord=${encoded}&limit=${limit}`

  try {
    const res = await fetch(url, { next: { revalidate: 3600 } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    const tables = json?.GET_STATS_LIST?.DATALIST_INF?.TABLE_INF
    return Array.isArray(tables) ? tables : tables ? [tables] : []
  } catch (err) {
    console.error('[estat] searchStats error:', err)
    return []
  }
}

// クラス情報を配列に正規化
export function normalizeClass(cls: EstatMetaClass | EstatMetaClass[]): EstatMetaClass[] {
  return Array.isArray(cls) ? cls : [cls]
}

// 値をマップに変換（コード -> 名称）
export function buildCodeMap(classObj: { CLASS: EstatMetaClass | EstatMetaClass[] }): Map<string, string> {
  const map = new Map<string, string>()
  const classes = normalizeClass(classObj.CLASS)
  for (const c of classes) {
    map.set(c['@id'], c['@name'])
  }
  return map
}

// 万円に変換（千円単位の値を万円に）
export function toManYen(value: string | null, unit?: string): number | null {
  if (!value || value === '-') return null
  const num = parseFloat(value)
  if (isNaN(num)) return null
  // 単位が千円の場合は万円に変換
  if (unit?.includes('千円')) return Math.round(num / 10) / 10
  // 単位が円の場合
  if (unit?.includes('円') && !unit?.includes('千')) return Math.round(num / 10000 * 10) / 10
  return num
}

// 年収に換算（月額 × 12 + 賞与）
export function toAnnualIncome(
  monthlyWage: number | null,
  bonus: number | null,
  unit?: string
): number | null {
  if (monthlyWage === null) return null
  const monthly = unit?.includes('千円') ? monthlyWage * 1000 : monthlyWage
  const annualBonus = bonus !== null ? (unit?.includes('千円') ? bonus * 1000 : bonus) : 0
  return Math.round((monthly * 12 + annualBonus) / 10000) // 万円
}
