import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

const ESTAT_APP_ID = '96e742b6d323113c85923dfe28ff598ed5878e8d'

// e-Stat 統計データID マッピング（学歴・年齢・性別別賃金）
// statsDataId は調査年ごとに異なる
const STATS_DATA_IDS: Record<number, string> = {
  2019: '0003425893',
  2018: '0003348233',
  2017: '0003265435',
  2016: '0003214070',
  2015: '0003152524',
}

// e-Stat の classCode → DB値 マッピング
// 性別
const SEX_MAP: Record<string, '計' | '男' | '女'> = {
  '1': '計',
  '2': '男',
  '3': '女',
  '計': '計',
  '男': '男',
  '女': '女',
}

// 企業規模
const SIZE_MAP: Record<string, string> = {
  '1': '企業規模計',
  '2': '1,000人以上',
  '3': '100～999人',
  '4': '10～99人',
  '100': '企業規模計',
  '200': '1,000人以上',
  '300': '100～999人',
  '400': '10～99人',
}

interface EStatValue {
  '@tab':  string
  '@cat01'?: string
  '@cat02'?: string
  '@cat03'?: string
  '@cat04'?: string
  '@cat05'?: string
  '@area'?: string
  '@time'?: string
  '$': string | number
  '@unit'?: string
}

interface ClassObj {
  '@code': string
  '@name': string
  '@level'?: string
  '@parentCode'?: string
}

export async function POST(req: NextRequest) {
  try {
    const { dataset_id, survey_year, stats_data_id } = await req.json()

    if (!dataset_id || !survey_year) {
      return NextResponse.json({ success: false, message: 'dataset_id と survey_year は必須です' }, { status: 400 })
    }

    // statsDataId の決定（引数 > マッピングテーブル）
    const statsId: string = stats_data_id ?? STATS_DATA_IDS[Number(survey_year)]
    if (!statsId) {
      return NextResponse.json({
        success: false,
        message: `${survey_year}年の statsDataId が不明です。stats_data_id を明示的に指定してください。`,
      }, { status: 400 })
    }

    // ---- e-Stat API 呼び出し（全データ取得） ----
    const fetchPage = async (startPosition: number) => {
      const url = new URL('https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData')
      url.searchParams.set('appId', ESTAT_APP_ID)
      url.searchParams.set('lang', 'J')
      url.searchParams.set('statsDataId', statsId)
      url.searchParams.set('metaGetFlg', 'Y')
      url.searchParams.set('cntGetFlg', 'N')
      url.searchParams.set('sectionHeaderFlg', '1')
      url.searchParams.set('replaceSpChars', '0')
      url.searchParams.set('limit', '10000')
      url.searchParams.set('startPosition', String(startPosition))
      const res = await fetch(url.toString())
      if (!res.ok) throw new Error(`e-Stat API HTTP ${res.status}`)
      return res.json()
    }

    // 1ページ目取得（メタデータ含む）
    const firstPage = await fetchPage(1)
    const root = firstPage?.GET_STATS_DATA?.STATISTICAL_DATA

    if (!root) {
      const errMsg = firstPage?.GET_STATS_DATA?.RESULT?.ERROR_MSG ?? 'e-Stat APIからデータを取得できませんでした'
      return NextResponse.json({ success: false, message: errMsg }, { status: 502 })
    }

    // ---- メタデータ解析（CLASSオブジェクト） ----
    const classInfoList: Array<{ id: string; classes: ClassObj[] }> =
      root.CLASS_INF?.CLASS_OBJ
        ? (Array.isArray(root.CLASS_INF.CLASS_OBJ)
            ? root.CLASS_INF.CLASS_OBJ
            : [root.CLASS_INF.CLASS_OBJ])
        : []

    // 各分類のコード→名称マップを構築
    const classMaps: Record<string, Record<string, string>> = {}
    for (const co of classInfoList) {
      const classArr: ClassObj[] = Array.isArray(co.classes)
        ? (co.classes as unknown as ClassObj[])
        : (co as unknown as { CLASS: ClassObj | ClassObj[] }).CLASS
          ? (Array.isArray((co as unknown as { CLASS: ClassObj | ClassObj[] }).CLASS)
              ? (co as unknown as { CLASS: ClassObj[] }).CLASS
              : [(co as unknown as { CLASS: ClassObj }).CLASS])
          : []
      classMaps[co.id] = {}
      for (const c of classArr) {
        if (c['@code'] && c['@name']) {
          classMaps[co.id][c['@code']] = c['@name']
        }
      }
    }

    // TABコード→指標マップ
    const tabMap = classMaps['tab'] ?? classMaps['TAB'] ?? {}

    // 指標コード（表頭: tab）の解析
    // 指標名から DB カラムを特定する
    const resolveColumn = (tabCode: string): string | null => {
      const name = tabMap[tabCode] ?? tabCode
      const n = name.replace(/\s+/g, '').replace(/　/g, '')
      if (n.includes('年齢') && !n.includes('勤続'))    return 'average_age'
      if (n.includes('勤続年数'))                       return 'tenure_years'
      if (n.includes('所定内労働時間'))                 return 'scheduled_hours'
      if (n.includes('超過労働時間'))                   return 'overtime_hours'
      if (n.includes('きまって支給する現金給与額') ||
          n.includes('月給'))                           return 'monthly_wage'
      if (n.includes('所定内給与額'))                   return 'scheduled_wage'
      if (n.includes('年間賞与') || n.includes('特別給与')) return 'annual_bonus'
      if (n.includes('労働者数') || n.includes('千人')) return 'workers'
      return null
    }

    // ---- 全ページのデータ値を収集 ----
    const totalCount: number = Number(root.RESULT_INF?.TOTAL_NUMBER ?? 0)
    let allValues: EStatValue[] = []

    const extractValues = (data: unknown): EStatValue[] => {
      const valueData = (data as Record<string, unknown>)
        ?.GET_STATS_DATA?.STATISTICAL_DATA?.DATA_INF?.VALUE
      if (!valueData) return []
      return Array.isArray(valueData) ? valueData : [valueData]
    }

    allValues = extractValues(firstPage)

    // 10,000件超の場合は追加ページを取得
    if (totalCount > 10000) {
      const pages = Math.ceil(totalCount / 10000)
      for (let p = 2; p <= pages; p++) {
        const pageData = await fetchPage((p - 1) * 10000 + 1)
        allValues = allValues.concat(extractValues(pageData))
      }
    }

    // ---- データ値を (分類キー) → (指標 → 値) の Map に整理 ----
    // キー: cat01〜cat05 の各コードを結合したもの
    // 分類軸の特定（e-Statの統計ごとに異なる）
    // 共通マップを使い柔軟に処理
    type RowKey = string   // `${sex}|${ageGroup}|${education}|${enterpriseSize}`
    const rowMap: Map<RowKey, Record<string, number>> = new Map()

    // cat01〜cat05 のどれが sex/age/edu/size か分類する
    // classInfoList の id で判定
    const catIds = classInfoList.map(c => c.id)

    const getSexCode    = (v: EStatValue) => getCatValue(v, catIds, classMaps, 'sex', ['sex', '01', 'cat01'])
    const getAgeCode    = (v: EStatValue) => getCatValue(v, catIds, classMaps, 'age', ['age', '02', 'cat02'])
    const getEduCode    = (v: EStatValue) => getCatValue(v, catIds, classMaps, 'edu', ['edu', '03', 'cat03'])
    const getSizeCode   = (v: EStatValue) => getCatValue(v, catIds, classMaps, 'size', ['size', 'ent', '04', 'cat04'])

    for (const v of allValues) {
      if (v['$'] === '-' || v['$'] === '' || v['$'] == null) continue
      const num = parseFloat(String(v['$']).replace(/,/g, ''))
      if (isNaN(num)) continue

      const col = resolveColumn(v['@tab'])
      if (!col) continue

      const sexRaw  = getSexCode(v)
      const ageRaw  = getAgeCode(v)
      const eduRaw  = getEduCode(v)
      const sizeRaw = getSizeCode(v)

      const sexName  = resolveLabel(sexRaw,  classMaps, catIds) ?? '計'
      const ageName  = resolveLabel(ageRaw,  classMaps, catIds) ?? '学歴計'
      const eduName  = resolveLabel(eduRaw,  classMaps, catIds) ?? '学歴計'
      const sizeName = resolveLabel(sizeRaw, classMaps, catIds) ?? '企業規模計'

      const key: RowKey = `${sexName}|${ageName}|${eduName}|${sizeName}`
      if (!rowMap.has(key)) rowMap.set(key, {})
      rowMap.get(key)![col] = num
    }

    // ---- INSERT ----
    let inserted = 0

    // 既存データを削除（再インポート対応）
    await query('DELETE FROM age_wages WHERE dataset_id = ?', [dataset_id])

    for (const [key, cols] of rowMap.entries()) {
      const [sexName, ageName, eduName, sizeName] = key.split('|')

      // DB の sex は '計'/'男'/'女' に正規化
      const sex: '計' | '男' | '女' = SEX_MAP[sexName] ?? (
        sexName.includes('男女') ? '計' :
        sexName.includes('男')   ? '男' :
        sexName.includes('女')   ? '女' : '計'
      )
      const enterpriseSize = SIZE_MAP[sizeName] ?? sizeName

      const monthlyWage   = cols['monthly_wage']   ?? null
      const scheduledWage = cols['scheduled_wage']  ?? null
      const annualBonus   = cols['annual_bonus']    ?? null
      const workers       = cols['workers']         ?? null
      const averageAge    = cols['average_age']     ?? null
      const tenureYears   = cols['tenure_years']    ?? null
      const scheduledHours = cols['scheduled_hours'] ?? null
      const overtimeHours  = cols['overtime_hours']  ?? null

      // 年収 = 月給 × 12 + 賞与（万円単位で格納）
      const annualIncome = (monthlyWage != null && annualBonus != null)
        ? Math.round((monthlyWage * 12 + annualBonus) * 10) / 10
        : null

      await query(
        `INSERT INTO age_wages
           (dataset_id, sex, age_group, education, enterprise_size,
            monthly_wage, scheduled_wage, annual_bonus, annual_income,
            workers, average_age, tenure_years, scheduled_hours, overtime_hours)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [dataset_id, sex, ageName, eduName, enterpriseSize,
         monthlyWage, scheduledWage, annualBonus, annualIncome,
         workers, averageAge, tenureYears, scheduledHours, overtimeHours]
      )
      inserted++
    }

    // dataset の record_count を更新
    await query('UPDATE datasets SET record_count = ?, imported_at = NOW() WHERE id = ?', [inserted, dataset_id])

    return NextResponse.json({ success: true, inserted, survey_year, stats_data_id: statsId })
  } catch (error: any) {
    console.error('[v0] estat-import-age error:', error)
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}

// ---- ヘルパー: 分類軸からコード値を取得 ----
function getCatValue(
  v: EStatValue,
  catIds: string[],
  classMaps: Record<string, Record<string, string>>,
  keyword: string,
  fallbackKeys: string[],
): string {
  // keyword に部分一致する catId を優先
  for (const id of catIds) {
    if (id.toLowerCase().includes(keyword)) {
      const code = (v as Record<string, unknown>)[`@${id}`] as string | undefined
      if (code != null) return code
    }
  }
  // fallback: cat01〜cat05 をキーとして試す
  for (const key of fallbackKeys) {
    const code = (v as Record<string, unknown>)[`@${key}`] as string | undefined
    if (code != null) return code
  }
  return ''
}

// ---- ヘルパー: コードから名称を解決 ----
function resolveLabel(
  code: string,
  classMaps: Record<string, Record<string, string>>,
  catIds: string[],
): string | null {
  if (!code) return null
  for (const id of catIds) {
    const name = classMaps[id]?.[code]
    if (name) return name
  }
  return code  // コードをそのまま返す
}
