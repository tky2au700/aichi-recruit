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

    const PAD_L = 68, PAD_R = 20, PAD_T = 24, PAD_B = 46

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
    const DOT_R        = 6
    const CARD_H       = 20
    const CARD_FS      = 10
    const LINE_LEN     = 20
    const LABEL_LIMIT  = 15   // 常時カード表示する上位N件
    const MIN_GAP      = CARD_H + 3

    const positions: typeof itemsRef.current = []

    type CardEntry = {
      dot:   { x: number; y: number }
      card:  { cx: number; cy: number; goRight: boolean }
      cardW: number
      item:  ScatterItem
      color: string
      xv: number; yv: number
      i: number
      showCard: boolean
    }

    // 1パス目: 座標計算 + カード幅計算
    ctx.font = `600 ${CARD_FS}px 'Noto Sans JP',sans-serif`
    const entries: CardEntry[] = items.map((item, i) => {
      const xv = getVal(item, xAxis.key)!
      const yv = getVal(item, yAxis.key)!
      const { x, y } = toXY(xv, yv)
      const color = COLORS[i % COLORS.length]
      const nameW  = ctx.measureText(item.name).width
      ctx.font = `500 ${CARD_FS}px 'Noto Sans JP',sans-serif`
      const valW   = ctx.measureText(xAxis.format(xv)).width
      ctx.font = `600 ${CARD_FS}px 'Noto Sans JP',sans-serif`
      const cardW  = nameW + valW + 28
      // 右半分の点は左向きにカードを伸ばす
      const goRight = x < (PAD_L + W - PAD_R) / 2
      const cx = goRight ? x + DOT_R + LINE_LEN : x - DOT_R - LINE_LEN - cardW
      const showCard = item.rank <= LABEL_LIMIT
      return { dot: { x, y }, card: { cx, cy: y, goRight }, cardW, item, color, xv, yv, i, showCard }
    })

    // 2パス目: カード表示対象のY重なり回避（左右別に処理）
    for (const side of [true, false]) {
      const sideEntries = entries
        .filter(e => e.showCard && e.card.goRight === side)
        .sort((a, b) => a.dot.y - b.dot.y)
      for (let k = 1; k < sideEntries.length; k++) {
        const prev = sideEntries[k - 1].card
        const cur  = sideEntries[k].card
        if (cur.cy - prev.cy < MIN_GAP) {
          cur.cy = prev.cy + MIN_GAP
        }
      }
    }

    // 3パス目: 画面外クランプ（カードが枠を超えないよう補正）
    entries.forEach(e => {
      if (!e.showCard) return
      const { card, cardW } = e
      // 上下クランプ
      const halfH = CARD_H / 2
      if (card.cy - halfH < PAD_T)          card.cy = PAD_T + halfH
      if (card.cy + halfH > H - PAD_B)       card.cy = H - PAD_B - halfH
      // 左右クランプ
      if (card.cx < PAD_L)                   card.cx = PAD_L
      if (card.cx + cardW > W - PAD_R)       card.cx = W - PAD_R - cardW
    })

    // ホバー判定用に位置を登録
    entries.forEach(e => {
      positions.push({ x: e.dot.x, y: e.dot.y, r: DOT_R + 6, item: e.item, i: e.i })
    })

    // ドット描画
    const renderDot = (e: CardEntry, isHovered: boolean) => {
      const { dot, item, color } = e
      ctx.beginPath(); ctx.arc(dot.x, dot.y, DOT_R, 0, Math.PI * 2)
      ctx.fillStyle = isHovered ? color : color + 'CC'
      ctx.fill()
      if (isHovered || item.rank <= 5) {
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2
        ctx.stroke()
      }
    }

    // カード描画（引き出し線 + pill）
    const renderCard = (e: CardEntry, isHovered: boolean) => {
      const { dot, card, cardW, item, color, xv } = e
      const { cx, cy, goRight } = card
      const cardY = cy - CARD_H / 2

      // 引き出し線: ドットの端 → カードの端
      const lineStartX = goRight ? dot.x + DOT_R : dot.x - DOT_R
      const lineEndX   = goRight ? cx             : cx + cardW
      ctx.strokeStyle = color + '70'; ctx.lineWidth = 1; ctx.setLineDash([3, 3])
      ctx.beginPath(); ctx.moveTo(lineStartX, dot.y); ctx.lineTo(lineEndX, cy); ctx.stroke()
      ctx.setLineDash([])

      // カード背景
      const alpha = isHovered ? 'EE' : 'CC'
      ctx.fillStyle = color + alpha
      ctx.beginPath(); ctx.roundRect(cx, cardY, cardW, CARD_H, 10); ctx.fill()

      // 職種名
      ctx.fillStyle = '#fff'
      ctx.font = `600 ${CARD_FS}px 'Noto Sans JP',sans-serif`
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
      const nameText = item.name
      const nameW = ctx.measureText(nameText).width
      ctx.fillText(nameText, cx + 8, cy)

      // 区切り
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1
      const sepX = cx + 8 + nameW + 5
      ctx.beginPath(); ctx.moveTo(sepX, cardY + 4); ctx.lineTo(sepX, cardY + CARD_H - 4); ctx.stroke()

      // 数値
      ctx.fillStyle = 'rgba(255,255,255,0.88)'
      ctx.font = `500 ${CARD_FS}px 'Noto Sans JP',sans-serif`
      ctx.fillText(xAxis.format(xv), cx + 8 + nameW + 12, cy)
    }

    // ホバー時ツールチップ（カード非表示の点にも出す）
    const renderTooltip = (e: CardEntry) => {
      const { dot, card, cardW, item, color, xv, yv } = e
      const lines = [
        item.name,
        `${xAxis.label}: ${xAxis.format(xv)}`,
        `${yAxis.label}: ${yAxis.format(yv)}`,
      ]
      const lineH = 18
      const tipW  = 200
      const tipH  = lines.length * lineH + 14
      // カード表示済みの場合はカードの下/右にヒント、未表示ならドット近くに
      let tx = e.showCard
        ? (card.goRight ? card.cx + cardW + 6 : card.cx - tipW - 6)
        : dot.x + DOT_R + 8
      let ty = (e.showCard ? card.cy : dot.y) - tipH / 2
      if (tx + tipW > W - PAD_R) tx = dot.x - tipW - 8
      if (tx < PAD_L)            tx = PAD_L
      if (ty < PAD_T)            ty = PAD_T
      if (ty + tipH > H - PAD_B) ty = H - PAD_B - tipH

      ctx.fillStyle = 'rgba(15,23,42,0.94)'
      ctx.beginPath(); ctx.roundRect(tx, ty, tipW, tipH, 8); ctx.fill()
      lines.forEach((line, li) => {
        ctx.fillStyle = li === 0 ? '#fff' : li === 1 ? '#93C5FD' : '#86EFAC'
        ctx.font = li === 0 ? `700 11px 'Noto Sans JP',sans-serif` : `500 10px 'Noto Sans JP',sans-serif`
        ctx.textAlign = 'left'; ctx.textBaseline = 'top'
        ctx.fillText(line, tx + 10, ty + 7 + li * lineH)
      })
    }

    // ホバー判定用の positions を常に最新にセット（draw呼び出しごと）
    itemsRef.current = positions

    // 描画順: ドット全件 → カード（非ホバー） → ホバーのドット+カード+ツールチップ
    entries.forEach(e => { if (e.i !== hovered) renderDot(e, false) })
    entries.forEach(e => { if (e.i !== hovered && e.showCard) renderCard(e, false) })
    if (hovered !== null && entries[hovered]) {
      const e = entries[hovered]
      renderDot(e, true)
      if (e.showCard) renderCard(e, true)
      renderTooltip(e)
    }

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
    // CSS座標 → canvas論理座標（style.widthとrect.widthが異なる場合に補正）
    const scaleX = parseFloat(canvas.style.width  || String(rect.width))  / rect.width
    const scaleY = parseFloat(canvas.style.height || String(rect.height)) / rect.height
    const mx = (e.clientX - rect.left) * scaleX
    const my = (e.clientY - rect.top)  * scaleY
    let found: number | null = null
    ;[...itemsRef.current].reverse().forEach(p => {
      if (found !== null) return
      const dist = Math.sqrt((mx - p.x) ** 2 + (my - p.y) ** 2)
      if (dist < p.r + 6) found = p.i
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

        {/* 軸セレクタ + 入れ替えボタン */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <AxisSelect label="横軸:" value={xAxis} onChange={a => { setXAxis(a); setHoveredIdx(null) }} />
          <button
            onClick={() => { setXAxis(yAxis); setYAxis(xAxis); setHoveredIdx(null) }}
            title="縦横を入れ替え"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 26, height: 26, borderRadius: 6,
              border: '1px solid #E2E8F0', background: '#F8FAFC',
              cursor: 'pointer', color: '#64748B', fontSize: 14,
              flexShrink: 0,
            }}
          >⇄</button>
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
