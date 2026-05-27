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

    // ---- ドット + 横長カード方式 ----
    const DOT_R  = 5
    const CARD_H = 22
    const CARD_FONT_SIZE = 10
    const LINE_LEN = 16  // ドットからカードまでの線の長さ

    const positions: typeof itemsRef.current = []

    // 1パス目: 全ドットの座標を計算
    type CardEntry = {
      dot: { x: number; y: number }
      card: { cx: number; cy: number; w: number }  // cx=カード左端, cy=カード中央Y
      item: ScatterItem
      color: string
      xv: number; yv: number
      i: number
    }

    ctx.font = `600 ${CARD_FONT_SIZE}px 'Noto Sans JP',sans-serif`
    const entries: CardEntry[] = items.map((item, i) => {
      const xv = getVal(item, xAxis.key)!
      const yv = getVal(item, yAxis.key)!
      const { x, y } = toXY(xv, yv)
      const color = COLORS[i % COLORS.length]
      // カードのテキスト幅計算
      const nameW  = ctx.measureText(item.name).width
      const valueW = ctx.measureText(xAxis.format(xv)).width
      const cardW  = nameW + valueW + 28  // padding + 区切り分
      return { dot: { x, y }, card: { cx: x + DOT_R + LINE_LEN, cy: y }, item, color, xv, yv, i }
    })

    // 2パス目: カードY座標の重なり回避（Y近傍の点をずらす）
    const MIN_GAP = CARD_H + 2
    // Y昇順でソートして隣接を調整
    const sorted = [...entries].sort((a, b) => a.dot.y - b.dot.y)
    for (let k = 1; k < sorted.length; k++) {
      const prev = sorted[k - 1].card
      const cur  = sorted[k].card
      if (Math.abs(cur.cy - prev.cy) < MIN_GAP) {
        cur.cy = prev.cy + MIN_GAP
      }
    }

    // positionsをホバー判定用に登録
    entries.forEach(e => {
      positions.push({ x: e.dot.x, y: e.dot.y, r: DOT_R + 4, item: e.item, i: e.i })
    })

    // 描画関数
    const renderEntry = (e: CardEntry, isHovered: boolean) => {
      const { dot, card, item, color, xv, yv, i } = e

      // ドット
      ctx.beginPath(); ctx.arc(dot.x, dot.y, DOT_R, 0, Math.PI * 2)
      ctx.fillStyle = isHovered ? color : color + 'DD'
      ctx.fill()
      if (isHovered || item.rank <= 5) {
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5
        ctx.beginPath(); ctx.arc(dot.x, dot.y, DOT_R, 0, Math.PI * 2); ctx.stroke()
      }

      // ドット → カードへの細い引き出し線
      ctx.strokeStyle = color + '80'; ctx.lineWidth = 1; ctx.setLineDash([])
      ctx.beginPath()
      ctx.moveTo(dot.x + DOT_R, dot.y)
      ctx.lineTo(card.cx, card.cy)
      ctx.stroke()

      // 横長カード
      const nameText  = item.name
      const valueText = xAxis.format(xv)

      ctx.font = `600 ${CARD_FONT_SIZE}px 'Noto Sans JP',sans-serif`
      const nameW  = ctx.measureText(nameText).width
      ctx.font = `500 ${CARD_FONT_SIZE}px 'Noto Sans JP',sans-serif`
      const valW   = ctx.measureText(valueText).width
      const cardW  = nameW + valW + 26
      const cardX  = card.cx
      const cardY  = card.cy - CARD_H / 2

      // カード背景
      ctx.fillStyle = isHovered ? color : color + 'CC'
      ctx.beginPath(); ctx.roundRect(cardX, cardY, cardW, CARD_H, 11); ctx.fill()

      // 職種名（白・太字）
      ctx.fillStyle = '#fff'
      ctx.font = `600 ${CARD_FONT_SIZE}px 'Noto Sans JP',sans-serif`
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
      ctx.fillText(nameText, cardX + 8, card.cy)

      // 区切り線
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(cardX + 8 + nameW + 5, cardY + 4)
      ctx.lineTo(cardX + 8 + nameW + 5, cardY + CARD_H - 4)
      ctx.stroke()

      // 数値（白・細字）
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      ctx.font = `500 ${CARD_FONT_SIZE}px 'Noto Sans JP',sans-serif`
      ctx.fillText(valueText, cardX + 8 + nameW + 12, card.cy)

      // ホバー時の詳細ツールチップ（カードの右に追加表示）
      if (isHovered) {
        const yLabel  = yAxis.format(yv)
        const tipText = `${yAxis.label}: ${yLabel}`
        ctx.font = `500 10px 'Noto Sans JP',sans-serif`
        const tipW = ctx.measureText(tipText).width + 16
        const tipX = cardX + cardW + 6
        let tipY = card.cy - 14

        // 画面外チェック
        if (tipX + tipW > W - PAD_R) {
          // カードの左に表示
          const altX = cardX - tipW - 6
          ctx.fillStyle = 'rgba(15,23,42,0.92)'
          ctx.beginPath(); ctx.roundRect(altX, tipY, tipW, 28, 6); ctx.fill()
          ctx.fillStyle = '#86EFAC'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
          ctx.fillText(tipText, altX + 8, tipY + 14)
        } else {
          ctx.fillStyle = 'rgba(15,23,42,0.92)'
          ctx.beginPath(); ctx.roundRect(tipX, tipY, tipW, 28, 6); ctx.fill()
          ctx.fillStyle = '#86EFAC'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
          ctx.fillText(tipText, tipX + 8, tipY + 14)
        }
      }
    }

    // ホバー以外 → ホバーの順に描画
    entries.forEach(e => { if (e.i !== hovered) renderEntry(e, false) })
    if (hovered !== null && entries[hovered]) renderEntry(entries[hovered], true)

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
