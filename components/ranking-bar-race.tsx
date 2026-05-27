'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

export interface ScatterItem {
  name:      string
  income:    number        // 推定年収（万円）
  age:       number | null // 平均年齢
  workers?:  number | null // 労働者数（千人）
  rank:      number
  tenure?:   number | null // 勤続年数
  overtime?: number | null // 超過労働時間
  bonus?:    number | null // 年間賞与
  hourly?:   number | null // 時給換算
  monthly?:  number | null // 月給
}

interface RankingBarRaceProps {
  data:         ScatterItem[]
  title:        string
  surveyYear:   number | null
  primaryColor?: string
}

const COLORS = [
  '#1a73e8','#0F9D58','#F4B400','#DB4437','#46BDC6',
  '#7B61FF','#FF6D00','#00796B','#AD1457','#1565C0',
  '#558B2F','#6D4C41','#00838F','#283593','#BF360C',
  '#37474F','#880E4F','#1B5E20','#4A148C','#E65100',
]

// 軸定義
interface AxisDef {
  key:    keyof ScatterItem
  label:  string
  unit:   string
  format: (v: number) => string
}

const AXIS_OPTIONS: AxisDef[] = [
  { key: 'income',   label: '推定年収',       unit: '万円', format: v => `${Math.round(v)}万円` },
  { key: 'age',      label: '平均年齢',        unit: '歳',   format: v => `${v.toFixed(1)}歳`   },
  { key: 'tenure',   label: '平均勤続年数',    unit: '年',   format: v => `${v.toFixed(1)}年`   },
  { key: 'overtime', label: '月残業時間',      unit: 'h',    format: v => `${v.toFixed(1)}h`    },
  { key: 'bonus',    label: '年間賞与',        unit: '万円', format: v => `${Math.round(v)}万円` },
  { key: 'hourly',   label: '時給換算',        unit: '円',   format: v => `${Math.round(v)}円`  },
  { key: 'monthly',  label: '月給',            unit: '万円', format: v => `${Math.round(v)}万円` },
  { key: 'workers',  label: '労働者数',        unit: '千人', format: v => `${v.toFixed(0)}千人` },
]

function getVal(item: ScatterItem, key: keyof ScatterItem): number | null {
  const v = item[key]
  if (v == null || typeof v !== 'number') return null
  return v
}

function nice(min: number, max: number, steps: number) {
  const range  = max - min
  const raw    = range / steps
  const mag    = Math.pow(10, Math.floor(Math.log10(raw)))
  const tick   = Math.ceil(raw / mag) * mag
  const nMin   = Math.floor(min / tick) * tick
  const nMax   = Math.ceil(max / tick) * tick
  return { nMin, nMax, tick }
}

export function RankingBarRace({
  data,
  title,
  surveyYear,
  primaryColor = '#1a73e8',
}: RankingBarRaceProps) {
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const [xAxis, setXAxis] = useState<AxisDef>(AXIS_OPTIONS[0]) // 推定年収
  const [yAxis, setYAxis] = useState<AxisDef>(AXIS_OPTIONS[1]) // 平均年齢
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const itemsRef = useRef<{ x: number; y: number; r: number; item: ScatterItem; i: number }[]>([])

  // 有効データ（両軸が存在するもの）
  const items = data.filter(d => getVal(d, xAxis.key) != null && getVal(d, yAxis.key) != null)
  function bubbleR(_workers?: number | null) {
    return 28
  }

  const draw = useCallback((hovered: number | null) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const W   = parseFloat(canvas.style.width)  || canvas.width  / dpr
    const H   = parseFloat(canvas.style.height) || canvas.height / dpr
    ctx.save()
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, W, H)

    const PAD_L = 68, PAD_R = 28, PAD_T = 20, PAD_B = 46

    const xVals = items.map(d => getVal(d, xAxis.key)!)
    const yVals = items.map(d => getVal(d, yAxis.key)!)
    if (!xVals.length || !yVals.length) { ctx.restore(); return }

    const { nMin: xMin, nMax: xMax, tick: xTick } = nice(
      Math.min(...xVals), Math.max(...xVals), 6
    )
    const { nMin: yMin, nMax: yMax, tick: yTick } = nice(
      Math.min(...yVals), Math.max(...yVals), 5
    )

    function toXY(xv: number, yv: number) {
      const x = PAD_L + ((xv - xMin) / (xMax - xMin)) * (W - PAD_L - PAD_R)
      const y = H - PAD_B - ((yv - yMin) / (yMax - yMin)) * (H - PAD_T - PAD_B)
      return { x, y }
    }

    // 背景
    ctx.fillStyle = '#FAFBFC'
    ctx.fillRect(0, 0, W, H)

    // グリッド Y
    for (let yv = yMin; yv <= yMax + yTick * 0.01; yv += yTick) {
      const { y } = toXY(xMin, yv)
      ctx.strokeStyle = '#E2E8F0'; ctx.lineWidth = 1; ctx.setLineDash([4,4])
      ctx.beginPath(); ctx.moveTo(PAD_L, y); ctx.lineTo(W - PAD_R, y); ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = '#94A3B8'; ctx.font = `500 10px 'Noto Sans JP',sans-serif`
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
      ctx.fillText(yAxis.format(yv), PAD_L - 6, y)
    }
    // グリッド X
    for (let xv = xMin; xv <= xMax + xTick * 0.01; xv += xTick) {
      const { x } = toXY(xv, yMin)
      ctx.strokeStyle = '#E2E8F0'; ctx.lineWidth = 1; ctx.setLineDash([4,4])
      ctx.beginPath(); ctx.moveTo(x, PAD_T); ctx.lineTo(x, H - PAD_B); ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = '#94A3B8'; ctx.font = `500 10px 'Noto Sans JP',sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'top'
      ctx.fillText(xAxis.format(xv), x, H - PAD_B + 6)
    }

    // Y軸ラベル
    ctx.save()
    ctx.translate(13, (H - PAD_T - PAD_B) / 2 + PAD_T)
    ctx.rotate(-Math.PI / 2)
    ctx.fillStyle = '#64748B'; ctx.font = `600 11px 'Noto Sans JP',sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(`${yAxis.label}（${yAxis.unit}）`, 0, 0)
    ctx.restore()

    // X軸ラベル
    ctx.fillStyle = '#64748B'; ctx.font = `600 11px 'Noto Sans JP',sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
    ctx.fillText(`${xAxis.label}（${xAxis.unit}）`, PAD_L + (W - PAD_L - PAD_R) / 2, H - 2)

    // 軸線
    ctx.strokeStyle = '#CBD5E1'; ctx.lineWidth = 1.5; ctx.setLineDash([])
    ctx.beginPath()
    ctx.moveTo(PAD_L, PAD_T); ctx.lineTo(PAD_L, H - PAD_B); ctx.lineTo(W - PAD_R, H - PAD_B)
    ctx.stroke()

    // バブル描画（ホバー以外を先に、ホバーを最後に描く）
    const positions: typeof itemsRef.current = []

    // 外部ラベル用の配置リスト（後でまとめて描画）
    type OuterLabel = { x: number; y: number; lx: number; ly: number; text: string; color: string; lineColor: string }
    const outerLabels: OuterLabel[] = []

    const renderBubble = (item: ScatterItem, i: number, isHovered: boolean) => {
      const xv = getVal(item, xAxis.key)!
      const yv = getVal(item, yAxis.key)!
      const { x, y } = toXY(xv, yv)
      const r     = bubbleR(item.workers)
      const color = COLORS[i % COLORS.length]
      const isTop = item.rank <= 5

      positions.push({ x, y, r, item, i })

      // バブル
      if (isHovered) {
        ctx.shadowColor = color + '60'; ctx.shadowBlur = 20
        ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 3
      }
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fillStyle = color + (isHovered ? 'EE' : 'CC')
      ctx.fill()
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0

      // 枠線（上位・ホバー）
      if (isTop || isHovered) {
        ctx.strokeStyle = '#fff'; ctx.lineWidth = isHovered ? 2.5 : 1.5
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke()
      }

      // バブル内テキスト
      const INNER_LABEL_R = 18 // この半径以上なら内側に名前を書く
      if (r >= INNER_LABEL_R) {
        // バブル内に収まる文字数を計算（半径に応じて）
        const maxChars = Math.max(2, Math.floor(r / 6))
        const label = item.name.length <= maxChars
          ? item.name
          : item.name.slice(0, maxChars - 1) + '…'
        const fs = Math.max(8, Math.min(r * 0.35, 12))
        ctx.font = `700 ${fs}px 'Noto Sans JP',sans-serif`
        ctx.fillStyle = '#fff'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        // テキストが円に収まるか確認
        const tw = ctx.measureText(label).width
        if (tw < r * 1.6) {
          ctx.fillText(label, x, y)
        } else {
          // 収まらなければ1行目・2行目に分割
          const half = Math.ceil(label.length / 2)
          const line1 = label.slice(0, half)
          const line2 = label.slice(half)
          ctx.fillText(line1, x, y - fs * 0.6)
          ctx.fillText(line2, x, y + fs * 0.6)
        }
      } else {
        // 小さいバブル → 外部ラベルとして後で描画
        // 引き出し先の座標（バブル中心から放射方向）
        const angle = Math.atan2(y - H / 2, x - W / 2)
        const lx = x + Math.cos(angle) * (r + 28)
        const ly = y + Math.sin(angle) * (r + 20)
        const shortName = item.name.length > 8 ? item.name.slice(0, 7) + '…' : item.name
        outerLabels.push({ x, y, lx, ly, text: shortName, color, lineColor: color })
      }

      // ホバー時ツールチップ
      if (isHovered) {
        const xLabel  = xAxis.format(xv)
        const yLabel  = yAxis.format(yv)
        const lines   = [item.name, `${xAxis.label}: ${xLabel}`, `${yAxis.label}: ${yLabel}`]
        const boxW    = 180
        const lineH   = 18
        const boxH    = lines.length * lineH + 16
        let bx = x + r + 10, by = y - boxH / 2
        if (bx + boxW > W - PAD_R) bx = x - r - boxW - 10
        if (by < PAD_T + 4) by = PAD_T + 4
        if (by + boxH > H - PAD_B - 4) by = H - PAD_B - boxH - 4

        ctx.fillStyle = 'rgba(15,23,42,0.93)'
        ctx.beginPath(); ctx.roundRect(bx, by, boxW, boxH, 8); ctx.fill()

        lines.forEach((line, li) => {
          ctx.fillStyle = li === 0 ? '#fff' : li === 1 ? '#93C5FD' : '#86EFAC'
          ctx.font = li === 0 ? `700 11px 'Noto Sans JP',sans-serif` : `500 10.5px 'Noto Sans JP',sans-serif`
          ctx.textAlign = 'left'; ctx.textBaseline = 'top'
          ctx.fillText(line, bx + 10, by + 8 + li * lineH)
        })
      }
    }

    // ホバー以外 → ホバー の順に描画
    items.forEach((item, i) => { if (i !== hovered) renderBubble(item, i, false) })
    if (hovered !== null && items[hovered]) renderBubble(items[hovered], hovered, true)

    // 外部ラベルをまとめて描画（バブルの上に重ねる）
    outerLabels.forEach(({ x, y, lx, ly, text, color, lineColor }) => {
      // 引き出し線
      ctx.strokeStyle = lineColor + '99'; ctx.lineWidth = 1; ctx.setLineDash([2, 2])
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(lx, ly); ctx.stroke()
      ctx.setLineDash([])
      // ラベル背景
      ctx.font = `600 9px 'Noto Sans JP',sans-serif`
      const tw = ctx.measureText(text).width
      const bw = tw + 8, bh = 15
      const tx = lx - bw / 2, ty = ly - bh / 2
      ctx.fillStyle = color + 'DD'
      ctx.beginPath(); ctx.roundRect(tx, ty, bw, bh, 4); ctx.fill()
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(text, lx, ly)
    })

    itemsRef.current = positions

    // ウォーターマーク
    if (surveyYear) {
      ctx.font = `800 ${Math.round(H * 0.13)}px 'Noto Sans JP',sans-serif`
      ctx.fillStyle = `${primaryColor}0D`
      ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'
      ctx.fillText(`${surveyYear}年`, W - PAD_R, H - PAD_B - 4)
    }

    ctx.restore()
  }, [items, xAxis, yAxis, primaryColor, surveyYear])

  // 軸・データ変化で再描画
  useEffect(() => { draw(hoveredIdx) }, [draw, hoveredIdx])

  // Canvas DPR リサイズ（ResizeObserver で正確にサイズ取得）
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const W   = canvas.parentElement?.getBoundingClientRect().width || 600
      canvas.width        = Math.round(W * dpr)
      canvas.height       = Math.round(360 * dpr)
      canvas.style.width  = `${W}px`
      canvas.style.height = '360px'
      draw(null)
    }

    resize()
    const ro = new ResizeObserver(resize)
    if (canvas.parentElement) ro.observe(canvas.parentElement)
    return () => ro.disconnect()
  }, [xAxis, yAxis, data, draw])

  // ホバー判定
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left, my = e.clientY - rect.top
    let found: number | null = null
    ;[...itemsRef.current].reverse().forEach(p => {
      if (found !== null) return
      const dist = Math.sqrt((mx - p.x) ** 2 + (my - p.y) ** 2)
      if (dist < p.r + 4) found = p.i
    })
    if (found !== hoveredIdx) setHoveredIdx(found)
  }, [hoveredIdx])

  const handleMouseLeave = useCallback(() => setHoveredIdx(null), [])

  if (data.length === 0) return null

  // 軸セレ��タ UI
  const AxisSelect = ({ value, onChange, label }: {
    value: AxisDef
    onChange: (a: AxisDef) => void
    label: string
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
          borderRadius: 6, padding: '3px 6px', cursor: 'pointer',
          outline: 'none',
        }}
      >
        {AXIS_OPTIONS.map(a => (
          <option key={a.key as string} value={a.key as string}>{a.label}</option>
        ))}
      </select>
    </div>
  )

  return (
    <div style={{
      background: '#fff', borderRadius: 14,
      border: '1px solid #E2E8F0', overflow: 'hidden',
      boxShadow: '0 2px 12px rgba(0,0,0,0.07)', marginBottom: 20,
    }}>
      {/* ヘッダー */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 8,
        padding: '10px 16px', borderBottom: '1px solid #F1F5F9', background: '#FAFBFC',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>
            散布図
          </span>
          {surveyYear && (
            <span style={{
              fontSize: 11, color: '#94A3B8',
              background: '#F1F5F9', padding: '2px 8px', borderRadius: 20,
            }}>{surveyYear}年調査</span>
          )}

        </div>

        {/* 軸セレクタ */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <AxisSelect label="横軸:" value={xAxis} onChange={a => { setXAxis(a); setHoveredIdx(null) }} />
          <AxisSelect label="縦軸:" value={yAxis} onChange={a => { setYAxis(a); setHoveredIdx(null) }} />
        </div>
      </div>

      {/* Canvas */}
      <div style={{ padding: '12px 16px 8px', background: '#fff' }}>
        <canvas
          ref={canvasRef}
          style={{ display: 'block', width: '100%', cursor: 'crosshair' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />
      </div>

      <div style={{ padding: '4px 16px 10px', fontSize: 10, color: '#CBD5E1', textAlign: 'right' }}>
        出典: 厚生労働省 賃金構造基本統計調査
      </div>
    </div>
  )
}
