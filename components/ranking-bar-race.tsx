'use client'

import { useState, useRef, useEffect } from 'react'

export interface ScatterItem {
  name:      string
  income:    number
  age:       number | null
  workers?:  number | null
  rank:      number
  tenure?:   number | null
  overtime?: number | null
  bonus?:    number | null
  hourly?:   number | null
  monthly?:  number | null
}

interface RankingBarRaceProps {
  data:          ScatterItem[]
  title:         string
  surveyYear:    number | null
  primaryColor?: string
}

interface AxisDef {
  key:    keyof ScatterItem
  label:  string
  unit:   string
  format: (v: number) => string
}

const AXIS_OPTIONS: AxisDef[] = [
  { key: 'income',   label: '推定年収',    unit: '万円', format: v => `${Math.round(v)}万円`  },
  { key: 'age',      label: '平均年齢',    unit: '歳',   format: v => `${v.toFixed(1)}歳`     },
  { key: 'tenure',   label: '平均勤続年数', unit: '年',   format: v => `${v.toFixed(1)}年`    },
  { key: 'overtime', label: '月残業時間',  unit: 'h',    format: v => `${v.toFixed(1)}h`      },
  { key: 'bonus',    label: '年間賞与',    unit: '万円', format: v => `${Math.round(v)}万円`  },
  { key: 'hourly',   label: '時給換算',    unit: '円',   format: v => `${Math.round(v)}円`    },
  { key: 'monthly',  label: '月給',        unit: '万円', format: v => `${Math.round(v)}万円`  },
  { key: 'workers',  label: '労働者数',    unit: '千人', format: v => `${v.toFixed(0)}千人`   },
]

const COLORS = [
  '#1a73e8','#0F9D58','#F4B400','#DB4437','#46BDC6',
  '#7B61FF','#FF6D00','#00796B','#AD1457','#1565C0',
  '#558B2F','#6D4C41','#00838F','#283593','#BF360C',
  '#37474F','#880E4F','#1B5E20','#4A148C','#E65100',
]

function getVal(item: ScatterItem, key: keyof ScatterItem): number | null {
  const v = item[key]
  if (v == null || typeof v !== 'number') return null
  return v
}

function nice(min: number, max: number, steps: number) {
  const range = max - min
  const raw   = range / steps
  const mag   = Math.pow(10, Math.floor(Math.log10(raw)))
  const tick  = Math.ceil(raw / mag) * mag
  const nMin  = Math.floor(min / tick) * tick
  const nMax  = Math.ceil(max  / tick) * tick
  return { nMin, nMax, tick }
}

const DOT_R       = 6
const LABEL_LIMIT = 15
const CARD_H      = 22
const CARD_FS     = 10
const LINE_LEN    = 18
const MIN_GAP     = CARD_H + 3

export function RankingBarRace({
  data,
  surveyYear,
}: RankingBarRaceProps) {
  const [xAxis, setXAxis] = useState<AxisDef>(AXIS_OPTIONS[0])
  const [yAxis, setYAxis] = useState<AxisDef>(AXIS_OPTIONS[1])
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const wrapRef  = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 700, h: 380 })

  // コンテナ幅を監視
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      setSize({ w: entry.contentRect.width, h: 380 })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const items = data.filter(
    d => getVal(d, xAxis.key) != null && getVal(d, yAxis.key) != null
  )

  if (data.length === 0) return null

  const { w: W, h: H } = size
  const PAD_L = 68, PAD_R = 24, PAD_T = 24, PAD_B = 48

  const xVals = items.map(d => getVal(d, xAxis.key)!)
  const yVals = items.map(d => getVal(d, yAxis.key)!)
  const { nMin: xMin, nMax: xMax, tick: xTick } = nice(Math.min(...xVals), Math.max(...xVals), 6)
  const { nMin: yMin, nMax: yMax, tick: yTick } = nice(Math.min(...yVals), Math.max(...yVals), 5)

  const toX = (v: number) => PAD_L + ((v - xMin) / (xMax - xMin)) * (W - PAD_L - PAD_R)
  const toY = (v: number) => H - PAD_B - ((v - yMin) / (yMax - yMin)) * (H - PAD_T - PAD_B)

  // グリッド線
  const xTicks: number[] = []
  for (let v = xMin; v <= xMax + xTick * 0.01; v += xTick) xTicks.push(v)
  const yTicks: number[] = []
  for (let v = yMin; v <= yMax + yTick * 0.01; v += yTick) yTicks.push(v)

  // カード座標計算
  type Entry = {
    i: number
    item: ScatterItem
    color: string
    dx: number; dy: number
    xv: number; yv: number
    showCard: boolean
    cardX: number; cardY: number
    cardW: number
    goRight: boolean
  }

  // フォント計測用（擬似）
  const approxTextWidth = (text: string, fs: number) => text.length * fs * 0.62

  const entries: Entry[] = items.map((item, i) => {
    const xv    = getVal(item, xAxis.key)!
    const yv    = getVal(item, yAxis.key)!
    const dx    = toX(xv)
    const dy    = toY(yv)
    const color = COLORS[i % COLORS.length]
    const nameW = approxTextWidth(item.name, CARD_FS)
    const valW  = approxTextWidth(xAxis.format(xv), CARD_FS)
    const cardW = nameW + valW + 28
    const goRight = dx < (PAD_L + W - PAD_R) / 2
    const cx = goRight ? dx + DOT_R + LINE_LEN : dx - DOT_R - LINE_LEN - cardW
    return {
      i, item, color, dx, dy, xv, yv,
      showCard: item.rank <= LABEL_LIMIT,
      cardX: cx, cardY: dy - CARD_H / 2,
      cardW, goRight,
    }
  })

  // 重なり回避（左右別）
  for (const side of [true, false]) {
    const group = entries
      .filter(e => e.showCard && e.goRight === side)
      .sort((a, b) => a.dy - b.dy)
    for (let k = 1; k < group.length; k++) {
      const prev = group[k - 1], cur = group[k]
      const prevCy = prev.cardY + CARD_H / 2
      const curCy  = cur.cardY  + CARD_H / 2
      if (curCy - prevCy < MIN_GAP) {
        cur.cardY = prev.cardY + MIN_GAP
      }
    }
  }

  // 画面外クランプ
  entries.forEach(e => {
    if (!e.showCard) return
    if (e.cardY < PAD_T)                    e.cardY = PAD_T
    if (e.cardY + CARD_H > H - PAD_B)       e.cardY = H - PAD_B - CARD_H
    if (e.cardX < PAD_L)                    e.cardX = PAD_L
    if (e.cardX + e.cardW > W - PAD_R)      e.cardX = W - PAD_R - e.cardW
  })

  // AxisSelect コンポーネント
  const AxisSelect = ({ value, onChange, label }: {
    value: AxisDef; onChange: (a: AxisDef) => void; label: string
  }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 10, color: '#94A3B8', whiteSpace: 'nowrap' }}>{label}</span>
      <select
        value={value.key as string}
        onChange={e => {
          const found = AXIS_OPTIONS.find(a => a.key === e.target.value)
          if (found) onChange(found)
        }}
        style={{
          fontSize: 11, fontWeight: 600, color: '#475569',
          background: '#F8FAFC', border: '1px solid #E2E8F0',
          borderRadius: 6, padding: '3px 6px', cursor: 'pointer', outline: 'none',
        }}
      >
        {AXIS_OPTIONS.map(a => (
          <option key={a.key as string} value={a.key as string}>{a.label}</option>
        ))}
      </select>
    </div>
  )

  const hovered = hoveredIdx !== null ? entries.find(e => e.i === hoveredIdx) ?? null : null

  return (
    <div style={{
      background: '#fff', border: '1px solid #E8EFF5', borderRadius: 12,
      padding: '16px 16px 12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      {/* ヘッダー */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>散布図</span>
          {surveyYear && (
            <span style={{ fontSize: 10, background: '#F1F5F9', color: '#64748B', borderRadius: 4, padding: '2px 6px' }}>
              {surveyYear}年調査
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <AxisSelect label="横軸:" value={xAxis} onChange={a => { setXAxis(a); setHoveredIdx(null) }} />
          <button
            onClick={() => { setXAxis(yAxis); setYAxis(xAxis); setHoveredIdx(null) }}
            title="縦横を入れ替え"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 26, height: 26, borderRadius: 6,
              border: '1px solid #E2E8F0', background: '#F8FAFC',
              cursor: 'pointer', color: '#64748B', fontSize: 14, flexShrink: 0,
            }}
          >⇄</button>
          <AxisSelect label="縦軸:" value={yAxis} onChange={a => { setYAxis(a); setHoveredIdx(null) }} />
        </div>
      </div>

      {/* SVG 散布図本体 */}
      <div ref={wrapRef} style={{ width: '100%' }}>
        <svg
          width={W} height={H}
          style={{ display: 'block', overflow: 'visible', userSelect: 'none' }}
        >
          {/* グリッド Y */}
          {yTicks.map(v => (
            <g key={v}>
              <line
                x1={PAD_L} y1={toY(v)} x2={W - PAD_R} y2={toY(v)}
                stroke="#E2E8F0" strokeWidth={1} strokeDasharray="4 4"
              />
              <text
                x={PAD_L - 6} y={toY(v)}
                textAnchor="end" dominantBaseline="middle"
                fontSize={10} fill="#94A3B8" fontFamily="'Noto Sans JP',sans-serif"
              >{yAxis.format(v)}</text>
            </g>
          ))}

          {/* グリッド X */}
          {xTicks.map(v => (
            <g key={v}>
              <line
                x1={toX(v)} y1={PAD_T} x2={toX(v)} y2={H - PAD_B}
                stroke="#E2E8F0" strokeWidth={1} strokeDasharray="4 4"
              />
              <text
                x={toX(v)} y={H - PAD_B + 8}
                textAnchor="middle" dominantBaseline="hanging"
                fontSize={10} fill="#94A3B8" fontFamily="'Noto Sans JP',sans-serif"
              >{xAxis.format(v)}</text>
            </g>
          ))}

          {/* 軸線 */}
          <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={H - PAD_B} stroke="#CBD5E1" strokeWidth={1.5} />
          <line x1={PAD_L} y1={H - PAD_B} x2={W - PAD_R} y2={H - PAD_B} stroke="#CBD5E1" strokeWidth={1.5} />

          {/* Y軸ラベル */}
          <text
            transform={`translate(13,${PAD_T + (H - PAD_T - PAD_B) / 2}) rotate(-90)`}
            textAnchor="middle" dominantBaseline="middle"
            fontSize={11} fontWeight={600} fill="#64748B" fontFamily="'Noto Sans JP',sans-serif"
          >{yAxis.label}（{yAxis.unit}）</text>

          {/* X軸ラベル */}
          <text
            x={PAD_L + (W - PAD_L - PAD_R) / 2} y={H - 4}
            textAnchor="middle" dominantBaseline="auto"
            fontSize={11} fontWeight={600} fill="#64748B" fontFamily="'Noto Sans JP',sans-serif"
          >{xAxis.label}（{xAxis.unit}）</text>

          {/* 調査年透かし */}
          {surveyYear && (
            <text
              x={W - PAD_R - 8} y={H - PAD_B - 8}
              textAnchor="end" dominantBaseline="auto"
              fontSize={48} fontWeight={700} fill="#E2E8F0"
              fontFamily="'Noto Sans JP',sans-serif"
            >{surveyYear}年</text>
          )}

          {/* 引き出し線（カードあり・非ホバー） */}
          {entries.map(e => {
            if (!e.showCard || e.i === hoveredIdx) return null
            const lineStartX = e.goRight ? e.dx + DOT_R : e.dx - DOT_R
            const lineEndX   = e.goRight ? e.cardX : e.cardX + e.cardW
            const cardCy     = e.cardY + CARD_H / 2
            return (
              <line key={`line-${e.i}`}
                x1={lineStartX} y1={e.dy} x2={lineEndX} y2={cardCy}
                stroke={e.color} strokeWidth={1} strokeDasharray="3 3" strokeOpacity={0.5}
              />
            )
          })}

          {/* ドット（非ホバー） */}
          {entries.map(e => {
            if (e.i === hoveredIdx) return null
            return (
              <circle
                key={`dot-${e.i}`}
                cx={e.dx} cy={e.dy} r={DOT_R}
                fill={e.color} fillOpacity={0.85}
                stroke={e.item.rank <= 5 ? '#fff' : 'none'}
                strokeWidth={1.5}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredIdx(e.i)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
            )
          })}

          {/* カード（非ホバー） */}
          {entries.map(e => {
            if (!e.showCard || e.i === hoveredIdx) return null
            const cy      = e.cardY + CARD_H / 2
            const nameW   = approxTextWidth(e.item.name, CARD_FS)
            const valText = xAxis.format(e.xv)
            return (
              <g key={`card-${e.i}`}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredIdx(e.i)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                <rect
                  x={e.cardX} y={e.cardY} width={e.cardW} height={CARD_H}
                  rx={10} fill={e.color} fillOpacity={0.85}
                />
                <text
                  x={e.cardX + 8} y={cy}
                  dominantBaseline="middle"
                  fontSize={CARD_FS} fontWeight={600} fill="#fff"
                  fontFamily="'Noto Sans JP',sans-serif"
                >{e.item.name}</text>
                <line
                  x1={e.cardX + 8 + nameW + 5} y1={e.cardY + 4}
                  x2={e.cardX + 8 + nameW + 5} y2={e.cardY + CARD_H - 4}
                  stroke="rgba(255,255,255,0.35)" strokeWidth={1}
                />
                <text
                  x={e.cardX + 8 + nameW + 12} y={cy}
                  dominantBaseline="middle"
                  fontSize={CARD_FS} fontWeight={500} fill="rgba(255,255,255,0.9)"
                  fontFamily="'Noto Sans JP',sans-serif"
                >{valText}</text>
              </g>
            )
          })}

          {/* ホバー中の点 - 最前面に描画 */}
          {hovered && (() => {
            const e = hovered
            const lineStartX = e.goRight ? e.dx + DOT_R : e.dx - DOT_R
            const lineEndX   = e.goRight ? e.cardX : e.cardX + e.cardW
            const cardCy     = e.cardY + CARD_H / 2
            const nameW      = approxTextWidth(e.item.name, CARD_FS)
            const valText    = xAxis.format(e.xv)

            // ツールチップ
            const tipLines = [
              e.item.name,
              `${xAxis.label}: ${xAxis.format(e.xv)}`,
              `${yAxis.label}: ${yAxis.format(e.yv)}`,
            ]
            const tipW = 210, tipLineH = 18, tipH = tipLines.length * tipLineH + 14
            let tx = e.dx + DOT_R + 10
            let ty = e.dy - tipH / 2
            if (tx + tipW > W - PAD_R) tx = e.dx - DOT_R - tipW - 10
            if (tx < PAD_L)            tx = PAD_L
            if (ty < PAD_T)            ty = PAD_T
            if (ty + tipH > H - PAD_B) ty = H - PAD_B - tipH

            return (
              <g>
                {/* 引き出し線 */}
                {e.showCard && (
                  <line
                    x1={lineStartX} y1={e.dy} x2={lineEndX} y2={cardCy}
                    stroke={e.color} strokeWidth={1} strokeDasharray="3 3" strokeOpacity={0.7}
                  />
                )}
                {/* ドット（強調） */}
                <circle
                  cx={e.dx} cy={e.dy} r={DOT_R + 2}
                  fill={e.color} stroke="#fff" strokeWidth={2}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHoveredIdx(e.i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                />
                {/* カード */}
                {e.showCard && (
                  <g>
                    <rect
                      x={e.cardX} y={e.cardY} width={e.cardW} height={CARD_H}
                      rx={10} fill={e.color}
                    />
                    <text
                      x={e.cardX + 8} y={cardCy}
                      dominantBaseline="middle"
                      fontSize={CARD_FS} fontWeight={600} fill="#fff"
                      fontFamily="'Noto Sans JP',sans-serif"
                    >{e.item.name}</text>
                    <line
                      x1={e.cardX + 8 + nameW + 5} y1={e.cardY + 4}
                      x2={e.cardX + 8 + nameW + 5} y2={e.cardY + CARD_H - 4}
                      stroke="rgba(255,255,255,0.35)" strokeWidth={1}
                    />
                    <text
                      x={e.cardX + 8 + nameW + 12} y={cardCy}
                      dominantBaseline="middle"
                      fontSize={CARD_FS} fontWeight={500} fill="rgba(255,255,255,0.9)"
                      fontFamily="'Noto Sans JP',sans-serif"
                    >{valText}</text>
                  </g>
                )}
                {/* ツールチップ */}
                <rect x={tx} y={ty} width={tipW} height={tipH} rx={8} fill="rgba(15,23,42,0.94)" />
                {tipLines.map((line, li) => (
                  <text
                    key={li}
                    x={tx + 10} y={ty + 7 + li * tipLineH + tipLineH / 2}
                    dominantBaseline="middle"
                    fontSize={li === 0 ? 11 : 10}
                    fontWeight={li === 0 ? 700 : 500}
                    fill={li === 0 ? '#fff' : li === 1 ? '#93C5FD' : '#86EFAC'}
                    fontFamily="'Noto Sans JP',sans-serif"
                  >{line}</text>
                ))}
              </g>
            )
          })()}

          {/* 出典 */}
          <text
            x={W - PAD_R} y={H - 2}
            textAnchor="end" dominantBaseline="auto"
            fontSize={9} fill="#94A3B8" fontFamily="'Noto Sans JP',sans-serif"
          >出典: 厚生労働省 賃金構造基本統計調査</text>
        </svg>
      </div>
    </div>
  )
}
