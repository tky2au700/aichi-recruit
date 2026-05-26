import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { query } from '@/lib/db'

// 勤続年数区分とブロック内オフセット
const TENURE_CATS: Array<{ label: string; offset: number }> = [
  { label: '勤続年数計', offset: 0  },
  { label: '0年',        offset: 3  },
  { label: '1～2年',     offset: 6  },
  { label: '3～4年',     offset: 9  },
  { label: '5～9年',     offset: 12 },
  { label: '10～14年',   offset: 15 },
  { label: '15～19年',   offset: 18 },
  { label: '20～24年',   offset: 21 },
  { label: '25～29年',   offset: 24 },
  { label: '30年以上',   offset: 27 },
]

// 役職コード → 役職名マッピング
const ROLE_CODE_MAP: Record<string, string> = {
  '101': '部長級',
  '102': '課長級',
  '103': '係長級',
  '104': '職長・班長級',
  '105': '非役職',
}

const EDUCATION_LABELS = ['中学', '高校', '専門学校', '高専・短大', '大学', '大学院', '不明']

/** DB登録前正規化 */
function normalizeAgeGroup(raw: string): string {
  return raw.replace(/^[\s　]+/, '').replace(/~/g, '～')
}
function normalizeSex(sex: '計' | '男' | '女'): string {
  return sex === '計' ? '男女計' : sex
}

/** セル値を数値に変換 */
function n(v: unknown): number | null {
  if (v === null || v === undefined) return null
  const s = String(v).replace(/[\s,]/g, '').trim()
  if (!s || s === '-' || s === '−' || s === 'ー') return null
  const num = parseFloat(s)
  return isNaN(num) ? null : num
}

/** シートのセル値取得 */
function cv(ws: XLSX.WorkSheet, r: number, c: number): unknown {
  return ws[XLSX.utils.encode_cell({ r, c })]?.v ?? ''
}

/** 文字列の空白・改行を正規化 */
function clean(v: unknown): string {
  return String(v ?? '').replace(/[\s\u3000\n\r]/g, '').trim()
}

type RoleRow = {
  roleName: string
  enterpriseSize: string
  sex: '計' | '男' | '女'
  education: string
  ageGroup: string
  tenureCategory: string
  scheduledWage: number | null
  annualBonus: number | null
  workers: number | null
  annualIncome: number | null
}

/** 1シートをパース */
function parseSheet(ws: XLSX.WorkSheet, _surveyYear: number): RoleRow[] {
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1:A1')
  const maxRow = range.e.r
  const maxCol = range.e.c
  const rows: RoleRow[] = []

  let roleRow = -1
  let sizeRow = -1
  let dataStartRow = 12
  for (let r = 0; r <= Math.min(25, maxRow); r++) {
    const labels = [clean(cv(ws, r, 0)), clean(cv(ws, r, 1)), clean(cv(ws, r, 2))]
    const label = labels.find(l => l.length > 0) ?? ''
    if (label.includes('役職') && !label.includes('部長') && !label.includes('課長')) roleRow = r
    if (label.includes('企業規模')) sizeRow = r
    if (label.includes('区分') || label === '区分') dataStartRow = r + 3
  }

  const effectiveRoleRow = roleRow >= 0 ? roleRow : 7
  const effectiveSizeRow = sizeRow >= 0 ? sizeRow : 6

  let dataColStart = 2
  for (let c = 1; c <= Math.min(10, maxCol); c++) {
    const v = clean(cv(ws, effectiveRoleRow, c))
    if (v.match(/^\d{3}/)) { dataColStart = c; break }
  }

  type Block = { colBase: number; roleName: string; enterpriseSize: string }
  const blocks: Block[] = []

  for (let c = dataColStart; c <= maxCol; c++) {
    const roleCell = clean(cv(ws, effectiveRoleRow, c))
    if (!roleCell || !roleCell.match(/^\d{3}/)) continue
    const codeMatch = roleCell.match(/^(\d+)(.+)$/)
    const roleName = codeMatch ? (ROLE_CODE_MAP[codeMatch[1]] ?? codeMatch[2]) : roleCell
    const sizeCell = clean(cv(ws, effectiveSizeRow, c)) || '10人以上'
    blocks.push({ colBase: c, roleName, enterpriseSize: sizeCell })
    c += 30
  }

  if (blocks.length === 0) return rows

  // col1=ラベル列、col2=データ開始
  const LABEL_OFFSET = -1
  const DATA_OFFSET  = 0

  let currentSex: '計' | '男' | '女' = '計'
  let currentEducation = '学歴計'

  for (let r = dataStartRow; r <= maxRow; r++) {
    const labelCol = blocks[0].colBase + LABEL_OFFSET
    const rawLabel = String(cv(ws, r, labelCol) ?? '').trim()
    const cleanLabel = rawLabel.replace(/[\r\n]/g, '').replace(/^[\s　]+/, '').trim()
    if (!cleanLabel) continue

    let isHeader = false
    if (cleanLabel.includes('男女計') && cleanLabel.includes('学歴計')) {
      currentSex = '計'; currentEducation = '学歴計'; isHeader = true
    } else if (cleanLabel.includes('男') && cleanLabel.includes('学歴計') && !cleanLabel.includes('男女')) {
      currentSex = '男'; currentEducation = '学歴計'; isHeader = true
    } else if (cleanLabel.includes('女') && cleanLabel.includes('学歴計')) {
      currentSex = '女'; currentEducation = '学歴計'; isHeader = true
    } else if (cleanLabel.includes('男女計') && cleanLabel.includes('大学')) {
      currentSex = '計'; currentEducation = cleanLabel.includes('院') ? '大学院' : '大学'; isHeader = true
    } else if (cleanLabel.includes('男') && cleanLabel.includes('大学') && !cleanLabel.includes('男女')) {
      currentSex = '男'; currentEducation = cleanLabel.includes('院') ? '大学院' : '大学'; isHeader = true
    } else if (cleanLabel.includes('女') && cleanLabel.includes('大学')) {
      currentSex = '女'; currentEducation = cleanLabel.includes('院') ? '大学院' : '大学'; isHeader = true
    } else if (EDUCATION_LABELS.some(e => cleanLabel === e)) {
      currentEducation = cleanLabel; isHeader = true
    }

    const finalAgeGroup = isHeader ? '学歴計' : cleanLabel

    for (const block of blocks) {
      for (const tc of TENURE_CATS) {
        const base = block.colBase + DATA_OFFSET + tc.offset
        const sw = n(cv(ws, r, base))
        const ab = n(cv(ws, r, base + 1))
        const wkRaw = n(cv(ws, r, base + 2))

        if (sw === null && ab === null && wkRaw === null) continue

        const workers = wkRaw !== null ? Math.round(wkRaw * 10) : null
        const annualIncome = sw !== null ? Math.round(sw * 12 + (ab ?? 0)) : null

        rows.push({
          roleName:       block.roleName,
          enterpriseSize: block.enterpriseSize,
          sex:            normalizeSex(currentSex),
          education:      currentEducation,
          ageGroup:       normalizeAgeGroup(finalAgeGroup),
          tenureCategory: tc.label,
          scheduledWage:  sw,
          annualBonus:    ab,
          workers,
          annualIncome,
        })
      }
    }
  }

  return rows
}

export async function POST(req: NextRequest) {
  const formData      = await req.formData()
  const file          = formData.get('file')        as File   | null
  const rawDatasetId  = formData.get('dataset_id')  as string | null
  const rawSurveyYear = formData.get('survey_year') as string | null

  if (!file) {
    return NextResponse.json({ success: false, error: 'ファイルが指定されていません' }, { status: 400 })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      function send(obj: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))
      }

      try {
        const ROLE_GROUP_ID = 4
        let datasetId: number | null = rawDatasetId ? Number(rawDatasetId) : null
        let surveyYear = rawSurveyYear ? Number(rawSurveyYear) : new Date().getFullYear()

        if (datasetId) {
          const dsRows = await query<{ survey_year: number }>(
            'SELECT survey_year FROM datasets WHERE id = ?', [datasetId]
          )
          if (dsRows.length === 0) {
            datasetId = null
          } else {
            surveyYear = dsRows[0].survey_year
          }
        }

        if (!datasetId) {
          const year = rawSurveyYear ? Number(rawSurveyYear) : new Date().getFullYear()
          const existRows = await query<{ id: number }>(
            'SELECT id FROM datasets WHERE group_id = ? AND survey_year = ?', [ROLE_GROUP_ID, year]
          )
          if (existRows.length > 0) {
            datasetId = existRows[0].id
            surveyYear = year
          } else {
            const ins = await query(
              'INSERT INTO datasets (group_id, survey_year) VALUES (?, ?)', [ROLE_GROUP_ID, year]
            )
            datasetId = (ins as any).insertId
            surveyYear = year
          }
        }

        const buf = Buffer.from(await file.arrayBuffer())
        const wb  = XLSX.read(buf, { type: 'buffer' })

        send({ type: 'start', total: wb.SheetNames.length })

        let totalInserted = 0

        await query('DELETE FROM role_wages WHERE dataset_id = ?', [datasetId])

        for (const sheetName of wb.SheetNames) {
          send({ type: 'processing', sheet_name: sheetName })

          try {
            const ws = wb.Sheets[sheetName]
            if (!ws || !ws['!ref']) {
              send({ type: 'sheet', sheet_name: sheetName, inserted: 0, error: 'シートが空' })
              continue
            }

            const parsed = parseSheet(ws, surveyYear)

            if (parsed.length === 0) {
              send({ type: 'sheet', sheet_name: sheetName, inserted: 0, error: 'データ行なし' })
              continue
            }

            const CHUNK = 500
            let sheetInserted = 0
            for (let i = 0; i < parsed.length; i += CHUNK) {
              const chunk = parsed.slice(i, i + CHUNK)
              const ph   = chunk.map(() => '(?,?,?,?,?,?,?,?,?,?)').join(',')
              const vals = chunk.flatMap(r => [
                datasetId, r.roleName, r.enterpriseSize, r.sex,
                r.education, r.ageGroup, r.tenureCategory,
                r.scheduledWage, r.annualBonus, r.workers,
              ])
              await query(
                `INSERT INTO role_wages
                   (dataset_id, role_name, enterprise_size, sex, education, age_group,
                    tenure_category, scheduled_wage, annual_bonus, workers)
                 VALUES ${ph}`,
                vals
              )
              sheetInserted += chunk.length
            }

            totalInserted += sheetInserted
            send({ type: 'sheet', sheet_name: sheetName, inserted: sheetInserted, total_so_far: totalInserted })

          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)

            send({ type: 'sheet', sheet_name: sheetName, inserted: 0, error: msg })
          }
        }

        await query(
          `UPDATE role_wages
           SET annual_income = ROUND(scheduled_wage * 12 + COALESCE(annual_bonus, 0), 1)
           WHERE dataset_id = ? AND scheduled_wage IS NOT NULL`,
          [datasetId]
        )

        await query(
          'UPDATE datasets SET record_count = ?, imported_at = NOW() WHERE id = ?',
          [totalInserted, datasetId]
        )

        send({ type: 'done', total_inserted: totalInserted, dataset_id: datasetId })
        controller.close()

      } catch (err) {
        console.error('[role-import]', err)
        const msg = err instanceof Error ? err.message : String(err)
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: msg })}\n\n`))
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
