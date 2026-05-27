'use client'

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import html2canvas from 'html2canvas'

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
  { key: 'tenure',   label: '平均勤続年数', unit: '年',  format: v => `${v.toFixed(1)}年`     },
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

const DOT_R    = 6
const CARD_H   = 22
const CARD_FS  = 10
const LINE_LEN = 18
const MIN_GAP  = CARD_H + 3

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

const approxTextWidth = (text: string, fs: number) => text.length * fs * 0.62

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

export function RankingBarRace({ data, surveyYear }: RankingBarRaceProps) {
  // --- すべてのフックを最上部に宣言（早期returnより前）---
  const [xAxis,         setXAxis]         = useState<AxisDef>(AXIS_OPTIONS[0])
  const [yAxis,         setYAxis]         = useState<AxisDef>(AXIS_OPTIONS[1])
  const [hoveredIdx,    setHoveredIdx]    = useState<number | null>(null)
  const [labelMode,     setLabelMode]     = useState<'top10' | 'bottom10'>('top10')
  const [sharing,       setSharing]       = useState(false)
  const [shareModal,    setShareModal]    = useState(false)
  const [previewUrl,    setPreviewUrl]    = useState<string | null>(null)
  const [previewCanvas, setPreviewCanvas] = useState<HTMLCanvasElement | null>(null)
  const [videoProgress, setVideoProgress] = useState<number | null>(null)
  const [size,          setSize]          = useState({ w: 700, h: 380 })
  const [videoBlobUrl,  setVideoBlobUrl]  = useState<string | null>(null)

  const wrapRef      = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      setSize({ w: entry.contentRect.width, h: 380 })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const { w: W, h: H } = size
  const PAD_L = 68, PAD_R = 24, PAD_T = 24, PAD_B = 48

  // entries を useMemo で計算（data/xAxis/yAxis/labelMode/size が変わった時のみ再計算）
  const entries = useMemo<Entry[]>(() => {
    const items = data.filter(
      d => getVal(d, xAxis.key) != null && getVal(d, yAxis.key) != null
    )
    if (items.length === 0) return []

    const xVals = items.map(d => getVal(d, xAxis.key)!)
    const yVals = items.map(d => getVal(d, yAxis.key)!)
    const { nMin: xMin, nMax: xMax } = nice(Math.min(...xVals), Math.max(...xVals), 6)
    const { nMin: yMin, nMax: yMax } = nice(Math.min(...yVals), Math.max(...yVals), 5)
    const toX = (v: number) => PAD_L + ((v - xMin) / (xMax - xMin || 1)) * (W - PAD_L - PAD_R)
    const toY = (v: number) => H - PAD_B - ((v - yMin) / (yMax - yMin || 1)) * (H - PAD_T - PAD_B)

    const result: Entry[] = items.map((item, i) => {
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
        showCard: labelMode === 'top10'
          ? item.rank <= 10
          : item.rank > (items.length - 10),
        cardX: cx, cardY: dy - CARD_H / 2,
        cardW, goRight,
      }
    })

    // 重なり回避
    for (const side of [true, false]) {
      const group = result
        .filter(e => e.showCard && e.goRight === side)
        .sort((a, b) => a.dy - b.dy)
      for (let k = 1; k < group.length; k++) {
        const prev = group[k - 1], cur = group[k]
        if ((cur.cardY + CARD_H / 2) - (prev.cardY + CARD_H / 2) < MIN_GAP) {
          cur.cardY = prev.cardY + MIN_GAP
        }
      }
    }

    // 画面外クランプ
    result.forEach(e => {
      if (!e.showCard) return
      if (e.cardY < PAD_T)               e.cardY = PAD_T
      if (e.cardY + CARD_H > H - PAD_B)  e.cardY = H - PAD_B - CARD_H
      if (e.cardX < PAD_L)               e.cardX = PAD_L
      if (e.cardX + e.cardW > W - PAD_R) e.cardX = W - PAD_R - e.cardW
    })

    return result
  }, [data, xAxis, yAxis, labelMode, W, H, PAD_L, PAD_R, PAD_T, PAD_B])

  // グリッド用
  const { xTicks, yTicks, toX, toY } = useMemo(() => {
    const items = data.filter(
      d => getVal(d, xAxis.key) != null && getVal(d, yAxis.key) != null
    )
    if (items.length === 0) return { xTicks: [], yTicks: [], toX: (_v: number) => 0, toY: (_v: number) => 0 }
    const xVals = items.map(d => getVal(d, xAxis.key)!)
    const yVals = items.map(d => getVal(d, yAxis.key)!)
    const { nMin: xMin, nMax: xMax, tick: xTick } = nice(Math.min(...xVals), Math.max(...xVals), 6)
    const { nMin: yMin, nMax: yMax, tick: yTick } = nice(Math.min(...yVals), Math.max(...yVals), 5)
    const toX = (v: number) => PAD_L + ((v - xMin) / (xMax - xMin || 1)) * (W - PAD_L - PAD_R)
    const toY = (v: number) => H - PAD_B - ((v - yMin) / (yMax - yMin || 1)) * (H - PAD_T - PAD_B)
    const xT: number[] = []; for (let v = xMin; v <= xMax + xTick * 0.01; v += xTick) xT.push(v)
    const yT: number[] = []; for (let v = yMin; v <= yMax + yTick * 0.01; v += yTick) yT.push(v)
    return { xTicks: xT, yTicks: yT, toX, toY }
  }, [data, xAxis, yAxis, W, H, PAD_L, PAD_R, PAD_T, PAD_B])

  // モーダルを開く
  const openShareModal = useCallback(async () => {
    if (!containerRef.current) return
    setSharing(true)
    setVideoBlobUrl(null)
    try {
      const c = await html2canvas(containerRef.current, {
        backgroundColor: '#ffffff', scale: 2, useCORS: true,
      })
      setPreviewCanvas(c)
      setPreviewUrl(c.toDataURL('image/png'))
      setShareModal(true)
    } finally {
      setSharing(false)
    }
  }, [])

  // 画像コピー
  const copyImage = useCallback(async () => {
    if (!previewCanvas) return
    previewCanvas.toBlob(async blob => {
      if (!blob) return
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      } catch {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = url; a.download = 'scatter.png'; a.click()
        URL.revokeObjectURL(url)
      }
    }, 'image/png')
  }, [previewCanvas])

  // Xで共有
  const shareToX = useCallback(() => {
    const text = encodeURIComponent('職種別 散布図 | 残業が少なくて年収が高い職種ランキング #AIリクルート')
    const url  = encodeURIComponent(window.location.href)
    window.open(`https://x.com/intent/tweet?text=${text}&url=${url}`, '_blank')
  }, [])

  // 動画生成
  const generateVideo = useCallback(async () => {
    if (entries.length === 0) return
    setVideoProgress(0)
    setVideoBlobUrl(null)

    const W2 = size.w, H2 = 380, dpr = 2
    const offscreen = document.createElement('canvas')
    offscreen.width = W2 * dpr; offscreen.height = H2 * dpr
    const ctx = offscreen.getContext('2d')!
    ctx.scale(dpr, dpr)

    const PL = 68, PR = 20, PT = 24, PB = 46
    const cW = W2 - PL - PR, cH = H2 - PT - PB
    const xVals2 = entries.map(e => e.xv)
    const yVals2 = entries.map(e => e.yv)
    const xMin2 = Math.min(...xVals2), xMax2 = Math.max(...xVals2)
    const yMin2 = Math.min(...yVals2), yMax2 = Math.max(...yVals2)
    const toX2 = (v: number) => PL + ((v - xMin2) / (xMax2 - xMin2 || 1)) * cW
    const toY2 = (v: number) => PT + cH - ((v - yMin2) / (yMax2 - yMin2 || 1)) * cH

    const FPS = 30
    const INTRO  = Math.floor(FPS * 0.5)
    const INTV   = Math.max(1, Math.floor(FPS / 6))
    const DOTS   = entries.length * INTV
    const CARDS  = FPS * 1
    const OUTRO  = FPS * 1.5
    const TOTAL  = INTRO + DOTS + CARDS + OUTRO

    const drawFrame = (frame: number) => {
      ctx.clearRect(0, 0, W2, H2)
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W2, H2)
      ctx.strokeStyle = '#E2E8F0'; ctx.lineWidth = 1; ctx.setLineDash([4, 4])
      for (let i = 0; i <= 5; i++) {
        const gx = PL + (cW / 5) * i, gy = PT + (cH / 4) * i
        ctx.beginPath(); ctx.moveTo(gx, PT); ctx.lineTo(gx, H2 - PB); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(PL, gy); ctx.lineTo(W2 - PR, gy); ctx.stroke()
      }
      ctx.setLineDash([])
      ctx.strokeStyle = '#CBD5E1'; ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.moveTo(PL, PT); ctx.lineTo(PL, H2 - PB); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(PL, H2 - PB); ctx.lineTo(W2 - PR, H2 - PB); ctx.stroke()
      if (surveyYear) {
        ctx.font = `700 48px 'Noto Sans JP',sans-serif`
        ctx.fillStyle = '#E2E8F0'; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'
        ctx.fillText(`${surveyYear}年`, W2 - PR - 8, H2 - PB - 8)
      }
      if (frame < INTRO) return
      const dotFrame = frame - INTRO
      const visCount = Math.min(entries.length, Math.floor(dotFrame / INTV) + 1)
      for (let i = 0; i < visCount; i++) {
        const e = entries[i]
        const isLast = i === visCount - 1
        const scale  = isLast ? Math.min(1, (dotFrame % INTV) / INTV * 2) : 1
        ctx.beginPath(); ctx.arc(toX2(e.xv), toY2(e.yv), DOT_R * scale, 0, Math.PI * 2)
        ctx.fillStyle = e.color + 'CC'; ctx.fill()
      }
      if (frame < INTRO + DOTS) return
      const cardAlpha = Math.min(1, (frame - INTRO - DOTS) / CARDS)
      entries.forEach(e => {
        ctx.beginPath(); ctx.arc(toX2(e.xv), toY2(e.yv), DOT_R, 0, Math.PI * 2)
        ctx.fillStyle = e.color + 'CC'; ctx.fill()
        if (!e.showCard) return
        const cx2 = toX2(e.xv), cy2 = toY2(e.yv)
        ctx.globalAlpha = cardAlpha
        ctx.fillStyle = e.color
        ctx.beginPath(); ctx.roundRect(e.cardX, e.cardY, e.cardW, CARD_H, 10); ctx.fill()
        ctx.fillStyle = '#fff'
        ctx.font = `600 ${CARD_FS}px 'Noto Sans JP',sans-serif`
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
        ctx.fillText(e.item.name, e.cardX + 8, e.cardY + CARD_H / 2)
        ctx.strokeStyle = e.color; ctx.lineWidth = 1; ctx.setLineDash([3, 3])
        ctx.beginPath()
        ctx.moveTo(e.goRight ? cx2 + DOT_R : cx2 - DOT_R, cy2)
        ctx.lineTo(e.goRight ? e.cardX : e.cardX + e.cardW, e.cardY + CARD_H / 2)
        ctx.stroke(); ctx.setLineDash([])
        ctx.globalAlpha = 1
      })
    }

    const stream = offscreen.captureStream(FPS)
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9' : 'video/webm'
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_000_000 })
    const chunks: Blob[] = []
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType })
      const url = URL.createObjectURL(blob)
      setVideoBlobUrl(url)
      setVideoProgress(null)
    }
    recorder.start()
    let frame = 0
    const tick = () => {
      drawFrame(frame)
      setVideoProgress(Math.round((frame / TOTAL) * 100))
      frame++
      if (frame <= TOTAL) setTimeout(tick, 1000 / FPS)
      else recorder.stop()
    }
    tick()
  }, [entries, size, surveyYear])

  // 動画ダウンロード
  const downloadVideo = useCallback(() => {
    if (!videoBlobUrl) return
    const a = document.createElement('a'); a.href = videoBlobUrl; a.download = 'scatter.webm'; a.click()
  }, [videoBlobUrl])

  // 早期return（フック定義後のみ）
  if (data.length === 0) return null

  const hovered = hoveredIdx !== null ? entries.find(e => e.i === hoveredIdx) ?? null : null

  const btnBase: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: 26, borderRadius: 6, border: '1px solid #E2E8F0',
    background: '#F8FAFC', cursor: 'pointer', color: '#64748B',
    fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' as const, flexShrink: 0, padding: '0 8px',
  }

  const AxisSelect = ({ value, onChange, label }: {
    value: AxisDef; onChange: (a: AxisDef) => void; label: string
  }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 10, color: '#94A3B8', whiteSpace: 'nowrap' }}>{label}</span>
      <select
        value={value.key as string}
        onChange={e => { const f = AXIS_OPTIONS.find(a => a.key === e.target.value); if (f) onChange(f) }}
        style={{
          fontSize: 11, fontWeight: 600, color: '#475569',
          background: '#F8FAFC', border: '1px solid #E2E8F0',
          borderRadius: 6, padding: '3px 6px', cursor: 'pointer', outline: 'none',
        }}
      >
        {AXIS_OPTIONS.map(a => <option key={a.key as string} value={a.key as string}>{a.label}</option>)}
      </select>
    </div>
  )

  const actionRowStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '12px 16px', borderRadius: 10,
    border: '1px solid #E2E8F0', background: '#fff',
    cursor: 'pointer', width: '100%', textAlign: 'left' as const,
    transition: 'background 0.15s',
  }
  const iconBoxStyle = (bg: string): React.CSSProperties => ({
    width: 36, height: 36, borderRadius: 8, background: bg,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  })

  return (
    <div ref={containerRef} style={{
      background: '#fff', border: '1px solid #E8EFF5', borderRadius: 12,
      padding: '16px 16px 12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      {/* ヘッダー */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>散布図</span>
          {surveyYear && (
            <span style={{ fontSize: 10, background: '#F1F5F9', color: '#64748B', borderRadius: 4, padding: '2px 6px' }}>
              {surveyYear}年調査
            </span>
          )}
          <div style={{ display: 'flex', border: '1px solid #E2E8F0', borderRadius: 6, overflow: 'hidden' }}>
            {(['top10', 'bottom10'] as const).map(mode => (
              <button key={mode} onClick={() => setLabelMode(mode)} style={{
                ...btnBase, border: 'none', borderRadius: 0,
                background: labelMode === mode ? '#1a73e8' : '#F8FAFC',
                color: labelMode === mode ? '#fff' : '#64748B', padding: '0 10px',
              }}>{mode === 'top10' ? '上位10件' : '下位10件'}</button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <AxisSelect label="横軸:" value={xAxis} onChange={a => { setXAxis(a); setHoveredIdx(null) }} />
          <button onClick={() => { setXAxis(yAxis); setYAxis(xAxis); setHoveredIdx(null) }}
            title="縦横を入れ替え" style={{ ...btnBase, width: 26, padding: 0, fontSize: 14 }}>⇄</button>
          <AxisSelect label="縦軸:" value={yAxis} onChange={a => { setYAxis(a); setHoveredIdx(null) }} />
          <button onClick={openShareModal} disabled={sharing}
            style={{ ...btnBase, gap: 4, background: sharing ? '#E2E8F0' : '#F8FAFC', color: sharing ? '#94A3B8' : '#475569' }}>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
            {sharing ? '処理中...' : '共有'}
          </button>
        </div>
      </div>

      {/* SVG散布図 */}
      <div ref={wrapRef} style={{ width: '100%' }}>
        <svg width={W} height={H} style={{ display: 'block', overflow: 'visible', userSelect: 'none' }}>
          {yTicks.map(v => (
            <g key={v}>
              <line x1={PAD_L} y1={toY(v)} x2={W - PAD_R} y2={toY(v)} stroke="#E2E8F0" strokeWidth={1} strokeDasharray="4 4" />
              <text x={PAD_L - 6} y={toY(v)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="#94A3B8" fontFamily="'Noto Sans JP',sans-serif">{yAxis.format(v)}</text>
            </g>
          ))}
          {xTicks.map(v => (
            <g key={v}>
              <line x1={toX(v)} y1={PAD_T} x2={toX(v)} y2={H - PAD_B} stroke="#E2E8F0" strokeWidth={1} strokeDasharray="4 4" />
              <text x={toX(v)} y={H - PAD_B + 8} textAnchor="middle" dominantBaseline="hanging" fontSize={10} fill="#94A3B8" fontFamily="'Noto Sans JP',sans-serif">{xAxis.format(v)}</text>
            </g>
          ))}
          <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={H - PAD_B} stroke="#CBD5E1" strokeWidth={1.5} />
          <line x1={PAD_L} y1={H - PAD_B} x2={W - PAD_R} y2={H - PAD_B} stroke="#CBD5E1" strokeWidth={1.5} />
          <text transform={`translate(13,${PAD_T + (H - PAD_T - PAD_B) / 2}) rotate(-90)`}
            textAnchor="middle" dominantBaseline="middle" fontSize={11} fontWeight={600} fill="#64748B" fontFamily="'Noto Sans JP',sans-serif">
            {yAxis.label}（{yAxis.unit}）
          </text>
          <text x={PAD_L + (W - PAD_L - PAD_R) / 2} y={H - 4}
            textAnchor="middle" dominantBaseline="auto" fontSize={11} fontWeight={600} fill="#64748B" fontFamily="'Noto Sans JP',sans-serif">
            {xAxis.label}（{xAxis.unit}）
          </text>
          {surveyYear && (
            <text x={W - PAD_R - 8} y={H - PAD_B - 8} textAnchor="end" dominantBaseline="auto"
              fontSize={48} fontWeight={700} fill="#E2E8F0" fontFamily="'Noto Sans JP',sans-serif">
              {surveyYear}年
            </text>
          )}

          {/* 引き出し線 */}
          {entries.map(e => {
            if (!e.showCard || e.i === hoveredIdx) return null
            const lsx = e.goRight ? e.dx + DOT_R : e.dx - DOT_R
            const lex = e.goRight ? e.cardX : e.cardX + e.cardW
            return <line key={`line-${e.i}`} x1={lsx} y1={e.dy} x2={lex} y2={e.cardY + CARD_H / 2}
              stroke={e.color} strokeWidth={1} strokeDasharray="3 3" strokeOpacity={0.5} />
          })}

          {/* ドット（非ホバー） */}
          {entries.map(e => e.i === hoveredIdx ? null : (
            <circle key={`dot-${e.i}`} cx={e.dx} cy={e.dy} r={DOT_R}
              fill={e.color} fillOpacity={0.85}
              stroke={e.item.rank <= 5 ? '#fff' : 'none'} strokeWidth={1.5}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHoveredIdx(e.i)}
              onMouseLeave={() => setHoveredIdx(null)}
            />
          ))}

          {/* カード（非ホバー） */}
          {entries.map(e => {
            if (!e.showCard || e.i === hoveredIdx) return null
            const cy    = e.cardY + CARD_H / 2
            const nameW = approxTextWidth(e.item.name, CARD_FS)
            return (
              <g key={`card-${e.i}`} style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredIdx(e.i)} onMouseLeave={() => setHoveredIdx(null)}>
                <rect x={e.cardX} y={e.cardY} width={e.cardW} height={CARD_H} rx={10} fill={e.color} fillOpacity={0.85} />
                <text x={e.cardX + 8} y={cy} dominantBaseline="middle" fontSize={CARD_FS} fontWeight={600} fill="#fff" fontFamily="'Noto Sans JP',sans-serif">{e.item.name}</text>
                <line x1={e.cardX + 8 + nameW + 5} y1={e.cardY + 4} x2={e.cardX + 8 + nameW + 5} y2={e.cardY + CARD_H - 4} stroke="rgba(255,255,255,0.35)" strokeWidth={1} />
                <text x={e.cardX + 8 + nameW + 12} y={cy} dominantBaseline="middle" fontSize={CARD_FS} fontWeight={500} fill="rgba(255,255,255,0.9)" fontFamily="'Noto Sans JP',sans-serif">{xAxis.format(e.xv)}</text>
              </g>
            )
          })}

          {/* ホバー */}
          {hovered && (() => {
            const e = hovered
            const lsx    = e.goRight ? e.dx + DOT_R : e.dx - DOT_R
            const lex    = e.goRight ? e.cardX : e.cardX + e.cardW
            const cy     = e.cardY + CARD_H / 2
            const nameW  = approxTextWidth(e.item.name, CARD_FS)
            const tipLines = [e.item.name, `${xAxis.label}: ${xAxis.format(e.xv)}`, `${yAxis.label}: ${yAxis.format(e.yv)}`]
            const tipW = 210, tipLH = 18, tipH = tipLines.length * tipLH + 14
            let tx = e.dx + DOT_R + 10, ty = e.dy - tipH / 2
            if (tx + tipW > W - PAD_R) tx = e.dx - DOT_R - tipW - 10
            if (tx < PAD_L)            tx = PAD_L
            if (ty < PAD_T)            ty = PAD_T
            if (ty + tipH > H - PAD_B) ty = H - PAD_B - tipH
            return (
              <g>
                {e.showCard && <line x1={lsx} y1={e.dy} x2={lex} y2={cy} stroke={e.color} strokeWidth={1} strokeDasharray="3 3" strokeOpacity={0.7} />}
                <circle cx={e.dx} cy={e.dy} r={DOT_R + 2} fill={e.color} stroke="#fff" strokeWidth={2}
                  style={{ cursor: 'pointer' }} onMouseEnter={() => setHoveredIdx(e.i)} onMouseLeave={() => setHoveredIdx(null)} />
                {e.showCard && (
                  <g>
                    <rect x={e.cardX} y={e.cardY} width={e.cardW} height={CARD_H} rx={10} fill={e.color} />
                    <text x={e.cardX + 8} y={cy} dominantBaseline="middle" fontSize={CARD_FS} fontWeight={600} fill="#fff" fontFamily="'Noto Sans JP',sans-serif">{e.item.name}</text>
                    <line x1={e.cardX + 8 + nameW + 5} y1={e.cardY + 4} x2={e.cardX + 8 + nameW + 5} y2={e.cardY + CARD_H - 4} stroke="rgba(255,255,255,0.35)" strokeWidth={1} />
                    <text x={e.cardX + 8 + nameW + 12} y={cy} dominantBaseline="middle" fontSize={CARD_FS} fontWeight={500} fill="rgba(255,255,255,0.9)" fontFamily="'Noto Sans JP',sans-serif">{xAxis.format(e.xv)}</text>
                  </g>
                )}
                <rect x={tx} y={ty} width={tipW} height={tipH} rx={8} fill={e.color} fillOpacity={0.95} />
                {tipLines.map((line, li) => (
                  <text key={li} x={tx + 10} y={ty + 7 + li * tipLH + tipLH / 2}
                    dominantBaseline="middle" fontSize={li === 0 ? 11 : 10} fontWeight={li === 0 ? 700 : 500}
                    fill={li === 0 ? '#fff' : 'rgba(255,255,255,0.85)'} fontFamily="'Noto Sans JP',sans-serif">{line}</text>
                ))}
              </g>
            )
          })()}
        </svg>
      </div>

      {/* 出典 */}
      <div style={{ textAlign: 'right', marginTop: 4 }}>
        <span style={{ fontSize: 9, color: '#94A3B8' }}>出典: 厚生労働省 賃金構造基本統計調査</span>
      </div>

      {/* 共有モーダル */}
      {shareModal && (
        <div onClick={() => setShareModal(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: 16,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#F8FAFC', borderRadius: 20, width: '100%', maxWidth: 520,
            boxShadow: '0 24px 64px rgba(0,0,0,0.28)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            {/* モーダルヘッダー */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px', background: '#fff', borderBottom: '1px solid #E2E8F0',
            }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#1E293B' }}>共有</span>
              <button onClick={() => setShareModal(false)} style={{
                width: 28, height: 28, borderRadius: '50%', border: 'none',
                background: '#F1F5F9', cursor: 'pointer', fontSize: 14, color: '#64748B',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>✕</button>
            </div>

            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* プレビュータブ：画像 / 動画 */}
              <div style={{
                borderRadius: 12, overflow: 'hidden', border: '1px solid #E2E8F0',
                background: '#fff', position: 'relative',
              }}>
                {/* 画像プレビュー */}
                {previewUrl && !videoBlobUrl && (
                  <img src={previewUrl} alt="散布図プレビュー" style={{ width: '100%', height: 'auto', display: 'block' }} />
                )}
                {/* 動画プレビュー */}
                {videoBlobUrl && (
                  <video src={videoBlobUrl} controls autoPlay loop muted
                    style={{ width: '100%', height: 'auto', display: 'block' }} />
                )}
                {/* 動画生成中オーバーレイ */}
                {videoProgress !== null && (
                  <div style={{
                    position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.65)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>動画を生成中... {videoProgress}%</span>
                    <div style={{ width: 200, height: 6, background: 'rgba(255,255,255,0.2)', borderRadius: 3 }}>
                      <div style={{ height: '100%', width: `${videoProgress}%`, background: '#F4B400', borderRadius: 3, transition: 'width 0.1s' }} />
                    </div>
                  </div>
                )}
                {/* プレビュー左上バッジ */}
                <div style={{
                  position: 'absolute', top: 8, left: 8,
                  background: 'rgba(15,23,42,0.55)', borderRadius: 6,
                  padding: '2px 8px', fontSize: 10, fontWeight: 600, color: '#fff',
                }}>
                  {videoBlobUrl ? '動画プレビュー' : '画像プレビュー'}
                </div>
              </div>

              {/* アクションボタン群 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

                {/* 画像をコピー */}
                <button onClick={copyImage} style={actionRowStyle}>
                  <span style={iconBoxStyle('#EFF6FF')}>
                    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#1a73e8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2"/>
                      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                    </svg>
                  </span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B' }}>画像をコピー</div>
                    <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>クリップボードにPNG画像をコピー</div>
                  </div>
                </button>

                {/* Xで共有 */}
                <button onClick={shareToX} style={actionRowStyle}>
                  <span style={iconBoxStyle('#000')}>
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="#fff">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/>
                    </svg>
                  </span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B' }}>Xで共有</div>
                    <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>X (Twitter) に投稿する</div>
                  </div>
                </button>

                {/* 動画：生成 or ダウンロード */}
                {!videoBlobUrl ? (
                  <button onClick={generateVideo} disabled={videoProgress !== null} style={{
                    ...actionRowStyle, background: videoProgress !== null ? '#F8FAFC' : '#fff',
                    cursor: videoProgress !== null ? 'default' : 'pointer', opacity: videoProgress !== null ? 0.7 : 1,
                  }}>
                    <span style={iconBoxStyle('#FEF3C7')}>
                      <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
                      </svg>
                    </span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B' }}>動画を生成する</div>
                      <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>ドット出現アニメーション付きWebM</div>
                    </div>
                  </button>
                ) : (
                  <button onClick={downloadVideo} style={actionRowStyle}>
                    <span style={iconBoxStyle('#F0FDF4')}>
                      <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                    </span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B' }}>動画をダウンロード</div>
                      <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>WebMファイルとして保存</div>
                    </div>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
