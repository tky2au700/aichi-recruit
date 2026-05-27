'use client'

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'

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
  '#4FC3F7','#81C784','#FFB74D','#E57373','#CE93D8',
  '#64B5F6','#A5D6A7','#FFF176','#FF8A65','#80DEEA',
  '#F48FB1','#BCAAA4','#B0BEC5','#80CBC4','#FFCC80',
  '#EF9A9A','#C5E1A5','#90CAF9','#FFAB91','#A3E4D7',
]

const DOT_R   = 5
const LABEL_FS = 10.5
const LINE_LEN = 12

// 背景・グリッド色
const BG      = '#ffffff'
const GRID    = 'rgba(0,0,0,0.07)'
const AXIS_C  = 'rgba(0,0,0,0.18)'
const TICK_C  = '#64748B'
const LABEL_C = '#475569'

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
  // ラベル位置（テキスト直置き、pillなし）
  lx: number; ly: number   // ラベル左端・中央Y
  goRight: boolean
}

export function RankingBarRace({ data, surveyYear }: RankingBarRaceProps) {
  const [xAxis,         setXAxis]         = useState<AxisDef>(AXIS_OPTIONS[0])
  const [yAxis,         setYAxis]         = useState<AxisDef>(AXIS_OPTIONS[1])
  const [hoveredIdx,    setHoveredIdx]    = useState<number | null>(null)
  const [sharing,       setSharing]       = useState(false)
  const [shareModal,    setShareModal]    = useState(false)
  const [previewUrl,    setPreviewUrl]    = useState<string | null>(null)
  const [previewCanvas, setPreviewCanvas] = useState<HTMLCanvasElement | null>(null)
  const [videoProgress, setVideoProgress] = useState<number | null>(null)
  const [videoBlobUrl,  setVideoBlobUrl]  = useState<string | null>(null)
  const [size,          setSize]          = useState({ w: 480 })

  const wrapRef      = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      setSize({ w: Math.round(entry.contentRect.width) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // 正方形: W = H
  const W = size.w
  const H = W
  const PAD_L = 58, PAD_R = 16, PAD_T = 20, PAD_B = 44
  const MIN_GAP = LABEL_FS + 3

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

    const LABEL_OFFSET = DOT_R + 3  // ドット下端からラベル上端までの余白

    const result: Entry[] = items.map((item, i) => {
      const xv    = getVal(item, xAxis.key)!
      const yv    = getVal(item, yAxis.key)!
      const dx    = toX(xv)
      const dy    = toY(yv)
      const color = COLORS[i % COLORS.length]
      // ラベルはドット中央X・ドット真下
      const lx    = dx
      const ly    = dy + LABEL_OFFSET + LABEL_FS
      return { i, item, color, dx, dy, xv, yv, lx, ly, goRight: true }
    })

    // Y重なり回避（同じX付近の点が下方向に積み上がる）
    const sorted = [...result].sort((a, b) => a.ly - b.ly)
    for (let k = 1; k < sorted.length; k++) {
      if (sorted[k].ly - sorted[k - 1].ly < MIN_GAP) {
        sorted[k].ly = sorted[k - 1].ly + MIN_GAP
      }
    }

    // 画面外クランプ（Y下端のみ）
    result.forEach(e => {
      if (e.ly > H - PAD_B - 2) e.ly = H - PAD_B - 2
    })

    return result
  }, [data, xAxis, yAxis, W, H, PAD_L, PAD_R, PAD_T, PAD_B, MIN_GAP])

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

  // 共有モーダルを開く
  const openShareModal = useCallback(async () => {
    setSharing(true)
    setVideoBlobUrl(null)
    setPreviewUrl(null)
    setPreviewCanvas(null)
    setShareModal(true)
    try {
      const svgEl = wrapRef.current?.querySelector('svg')
      if (!svgEl) { setSharing(false); return }
      const svgStr = new XMLSerializer().serializeToString(svgEl)
      const blob   = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
      const url    = URL.createObjectURL(blob)
      const img    = new Image()
      img.crossOrigin = 'anonymous'
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve(); img.onerror = reject; img.src = url
      })
      const scale = 2
      const cvs   = document.createElement('canvas')
      cvs.width   = svgEl.clientWidth  * scale
      cvs.height  = svgEl.clientHeight * scale
      const ctx2  = cvs.getContext('2d')!
      ctx2.scale(scale, scale)
      ctx2.fillStyle = BG
      ctx2.fillRect(0, 0, svgEl.clientWidth, svgEl.clientHeight)
      ctx2.drawImage(img, 0, 0, svgEl.clientWidth, svgEl.clientHeight)
      URL.revokeObjectURL(url)
      setPreviewCanvas(cvs)
      setPreviewUrl(cvs.toDataURL('image/png'))
    } catch {
      // プレビューなしでモーダルは開いたまま
    } finally {
      setSharing(false)
    }
  }, [wrapRef])

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

  const shareToX = useCallback(() => {
    const text = encodeURIComponent('職種別 散布図 | 残業が少なくて年収が高い職種ランキング #AIリクルート')
    const url  = encodeURIComponent(window.location.href)
    window.open(`https://x.com/intent/tweet?text=${text}&url=${url}`, '_blank')
  }, [])

  const generateVideo = useCallback(async () => {
    if (entries.length === 0) return
    setVideoProgress(0)
    setVideoBlobUrl(null)
    const W2 = size.w, H2 = W2, dpr = 2
    const offscreen = document.createElement('canvas')
    offscreen.width = W2 * dpr; offscreen.height = H2 * dpr
    const ctx = offscreen.getContext('2d')!
    ctx.scale(dpr, dpr)
    const PL = 58, PR = 16, PT = 20, PB = 44
    const cW2 = W2 - PL - PR, cH2 = H2 - PT - PB
    const xVals2 = entries.map(e => e.xv), yVals2 = entries.map(e => e.yv)
    const xMin2 = Math.min(...xVals2), xMax2 = Math.max(...xVals2)
    const yMin2 = Math.min(...yVals2), yMax2 = Math.max(...yVals2)
    const toX2 = (v: number) => PL + ((v - xMin2) / (xMax2 - xMin2 || 1)) * cW2
    const toY2 = (v: number) => PT + cH2 - ((v - yMin2) / (yMax2 - yMin2 || 1)) * cH2
    const FPS = 30
    const INTRO = Math.floor(FPS * 0.5)
    const INTV  = Math.max(1, Math.floor(FPS / 8))
    const DOTS  = entries.length * INTV
    const LBFS  = Math.floor(FPS * 0.8)
    const OUTRO = FPS * 1.5
    const TOTAL = INTRO + DOTS + LBFS + OUTRO

    const drawFrame = (frame: number) => {
      ctx.clearRect(0, 0, W2, H2)
      ctx.fillStyle = BG; ctx.fillRect(0, 0, W2, H2)
      ctx.strokeStyle = GRID; ctx.lineWidth = 1; ctx.setLineDash([3, 4])
      for (let i = 0; i <= 6; i++) {
        const gx = PL + (cW2 / 6) * i, gy = PT + (cH2 / 5) * i
        ctx.beginPath(); ctx.moveTo(gx, PT); ctx.lineTo(gx, H2 - PB); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(PL, gy); ctx.lineTo(W2 - PR, gy); ctx.stroke()
      }
      ctx.setLineDash([])
      ctx.strokeStyle = AXIS_C; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(PL, PT); ctx.lineTo(PL, H2 - PB); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(PL, H2 - PB); ctx.lineTo(W2 - PR, H2 - PB); ctx.stroke()
      if (surveyYear) {
        ctx.font = `700 42px 'Noto Sans JP',sans-serif`
        ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'
        ctx.fillText(`${surveyYear}年`, W2 - PR - 8, H2 - PB - 8)
      }
      if (frame < INTRO) return
      const dotFrame = frame - INTRO
      const visCount = Math.min(entries.length, Math.floor(dotFrame / INTV) + 1)
      for (let i = 0; i < visCount; i++) {
        const e = entries[i]
        const scale = i === visCount - 1 ? Math.min(1, (dotFrame % INTV) / INTV * 2) : 1
        ctx.beginPath(); ctx.arc(toX2(e.xv), toY2(e.yv), DOT_R * scale, 0, Math.PI * 2)
        ctx.fillStyle = e.color; ctx.fill()
      }
      if (frame < INTRO + DOTS) return
      const lbAlpha = Math.min(1, (frame - INTRO - DOTS) / LBFS)
      entries.forEach(e => {
        const ex = toX2(e.xv), ey = toY2(e.yv)
        ctx.beginPath(); ctx.arc(ex, ey, DOT_R, 0, Math.PI * 2)
        ctx.fillStyle = e.color; ctx.fill()
        const goR = ex < (PL + W2 - PR) / 2
        const lx2 = goR ? ex + DOT_R + LINE_LEN : ex - DOT_R - LINE_LEN - approxTextWidth(e.item.name, LABEL_FS)
        ctx.globalAlpha = lbAlpha
        ctx.strokeStyle = e.color + '80'; ctx.lineWidth = 1; ctx.setLineDash([2, 3])
        ctx.beginPath(); ctx.moveTo(goR ? ex + DOT_R : ex - DOT_R, ey)
        ctx.lineTo(goR ? lx2 : lx2 + approxTextWidth(e.item.name, LABEL_FS), ey); ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = '#fff'
        ctx.font = `500 ${LABEL_FS}px 'Noto Sans JP',sans-serif`
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
        ctx.fillText(e.item.name, lx2, ey)
        ctx.globalAlpha = 1
      })
    }

    const stream = offscreen.captureStream(FPS)
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm'
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_000_000 })
    const chunks: Blob[] = []
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType })
      setVideoBlobUrl(URL.createObjectURL(blob))
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

  const downloadVideo = useCallback(() => {
    if (!videoBlobUrl) return
    const a = document.createElement('a'); a.href = videoBlobUrl; a.download = 'scatter.webm'; a.click()
  }, [videoBlobUrl])

  if (data.length === 0) return null

  const hovered = hoveredIdx !== null ? entries.find(e => e.i === hoveredIdx) ?? null : null

  const actionRowStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '11px 14px', borderRadius: 10,
    border: '1px solid #E2E8F0', background: '#F8FAFC',
    cursor: 'pointer', width: '100%', textAlign: 'left' as const,
  }
  const iconBoxStyle = (bg: string): React.CSSProperties => ({
    width: 34, height: 34, borderRadius: 8, background: bg,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  })

  const selectStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: '#334155',
    background: '#F8FAFC', border: '1px solid #E2E8F0',
    borderRadius: 6, padding: '4px 8px', cursor: 'pointer', outline: 'none',
  }

  return (
    <div ref={containerRef} style={{
      background: BG, borderRadius: 16,
      padding: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.08)',
      border: '1px solid #E2E8F0',
    }}>
      {/* 外側: 左=チャート正方形 / 右=コントロール */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

        {/* 左: SVG散布図（正方形） */}
        <div ref={wrapRef} style={{ flex: '1 1 0', minWidth: 0 }}>
          <svg
            width={W} height={W}
            style={{ display: 'block', overflow: 'visible', userSelect: 'none', borderRadius: 8 }}
          >
            {/* 背景 */}
            <rect x={0} y={0} width={W} height={H} fill={BG} rx={8} />

            {/* グリッド線 */}
            {yTicks.map(v => (
              <line key={`yg-${v}`} x1={PAD_L} y1={toY(v)} x2={W - PAD_R} y2={toY(v)}
                stroke={GRID} strokeWidth={1} strokeDasharray="3 4" />
            ))}
            {xTicks.map(v => (
              <line key={`xg-${v}`} x1={toX(v)} y1={PAD_T} x2={toX(v)} y2={H - PAD_B}
                stroke={GRID} strokeWidth={1} strokeDasharray="3 4" />
            ))}

            {/* 軸線 */}
            <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={H - PAD_B} stroke={AXIS_C} strokeWidth={1} />
            <line x1={PAD_L} y1={H - PAD_B} x2={W - PAD_R} y2={H - PAD_B} stroke={AXIS_C} strokeWidth={1} />

            {/* 軸ラベル（目盛り） */}
            {yTicks.map(v => (
              <text key={`yt-${v}`} x={PAD_L - 6} y={toY(v)}
                textAnchor="end" dominantBaseline="middle"
                fontSize={9} fill={TICK_C} fontFamily="'Noto Sans JP',sans-serif">
                {yAxis.format(v)}
              </text>
            ))}
            {xTicks.map(v => (
              <text key={`xt-${v}`} x={toX(v)} y={H - PAD_B + 7}
                textAnchor="middle" dominantBaseline="hanging"
                fontSize={9} fill={TICK_C} fontFamily="'Noto Sans JP',sans-serif">
                {xAxis.format(v)}
              </text>
            ))}

            {/* 軸タイトル */}
            <text
              transform={`translate(13,${PAD_T + (H - PAD_T - PAD_B) / 2}) rotate(-90)`}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={10} fontWeight={600} fill={LABEL_C} fontFamily="'Noto Sans JP',sans-serif">
              {yAxis.label}（{yAxis.unit}）
            </text>
            <text x={PAD_L + (W - PAD_L - PAD_R) / 2} y={H - 5}
              textAnchor="middle" dominantBaseline="auto"
              fontSize={10} fontWeight={600} fill={LABEL_C} fontFamily="'Noto Sans JP',sans-serif">
              {xAxis.label}（{xAxis.unit}）
            </text>

            {/* 調査年透かし */}
            {surveyYear && (
              <text x={W - PAD_R - 8} y={H - PAD_B - 8} textAnchor="end" dominantBaseline="auto"
                fontSize={44} fontWeight={700} fill="rgba(0,0,0,0.05)" fontFamily="'Noto Sans JP',sans-serif">
                {surveyYear}年
              </text>
            )}



            {/* ドット（非ホバー） */}
            {entries.map(e => e.i === hoveredIdx ? null : (
              <circle key={`d-${e.i}`} cx={e.dx} cy={e.dy} r={DOT_R}
                fill={e.color}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredIdx(e.i)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
            ))}

            {/* ラベル（全件、非ホバー） */}
            {entries.map(e => {
              if (e.i === hoveredIdx) return null
              return (
                <text key={`lb-${e.i}`}
                  x={e.lx} y={e.ly}
                  textAnchor="middle" dominantBaseline="auto"
                  fontSize={LABEL_FS} fontWeight={500}
                  fill="#334155" fillOpacity={0.9}
                  fontFamily="'Noto Sans JP',sans-serif"
                  style={{ pointerEvents: 'none' }}
                >
                  {e.item.name}
                </text>
              )
            })}

            {/* ホバー：ドット拡大 + ツールチップ */}
            {hovered && (() => {
              const e = hovered
              const tipLines = [
                e.item.name,
                `${xAxis.label}: ${xAxis.format(e.xv)}`,
                `${yAxis.label}: ${yAxis.format(e.yv)}`,
              ]
              const tipW = 210, tipLH = 18, tipH = tipLines.length * tipLH + 14
              let tx = e.dx + DOT_R + 10, ty = e.dy - tipH / 2
              if (tx + tipW > W - PAD_R) tx = e.dx - DOT_R - tipW - 10
              if (tx < PAD_L)            tx = PAD_L
              if (ty < PAD_T)            ty = PAD_T
              if (ty + tipH > H - PAD_B) ty = H - PAD_B - tipH

              return (
                <g>
                  {/* ホバードット */}
                  <circle cx={e.dx} cy={e.dy} r={DOT_R + 3} fill={e.color} opacity={0.25} />
                  <circle cx={e.dx} cy={e.dy} r={DOT_R + 1} fill={e.color}
                    stroke="#fff" strokeWidth={1.5}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredIdx(e.i)}
                    onMouseLeave={() => setHoveredIdx(null)} />
                  {/* ラベル（ホバー時は濃くはっきり） */}
                  <text x={e.lx} y={e.ly}
                    textAnchor="middle" dominantBaseline="auto"
                    fontSize={LABEL_FS} fontWeight={700}
                    fill="#0F172A" fillOpacity={1}
                    fontFamily="'Noto Sans JP',sans-serif"
                    style={{ pointerEvents: 'none' }}>
                    {e.item.name}
                  </text>
                  {/* ツールチップ */}
                  <rect x={tx} y={ty} width={tipW} height={tipH} rx={8}
                    fill={e.color} fillOpacity={0.95} />
                  <rect x={tx} y={ty} width={tipW} height={tipH} rx={8}
                    fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
                  {tipLines.map((line, li) => (
                    <text key={li}
                      x={tx + 12} y={ty + 7 + li * tipLH + tipLH / 2}
                      dominantBaseline="middle"
                      fontSize={li === 0 ? 11 : 10} fontWeight={li === 0 ? 700 : 500}
                      fill={li === 0 ? '#fff' : 'rgba(255,255,255,0.8)'}
                      fontFamily="'Noto Sans JP',sans-serif">
                      {line}
                    </text>
                  ))}
                </g>
              )
            })()}
          </svg>

          {/* 出典 */}
          <div style={{ textAlign: 'right', marginTop: 6 }}>
            <span style={{ fontSize: 9, color: '#94A3B8' }}>
              出典: 厚生労働省 賃金構造基本統計調査
            </span>
          </div>
        </div>

        {/* 右: コントロールパネル */}
        <div style={{
          width: 190, flexShrink: 0,
          display: 'flex', flexDirection: 'column', gap: 16,
          paddingTop: 4,
        }}>
          {/* タイトル */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B', lineHeight: 1.4 }}>散布図</div>
            {surveyYear && (
              <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 3 }}>{surveyYear}年調査</div>
            )}
          </div>

          {/* 軸設定 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, letterSpacing: '0.05em' }}>軸設定</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10, color: '#64748B', width: 28, flexShrink: 0 }}>横軸</span>
                <select value={xAxis.key as string}
                  onChange={e => { const f = AXIS_OPTIONS.find(a => a.key === e.target.value); if (f) { setXAxis(f); setHoveredIdx(null) } }}
                  style={{ ...selectStyle, flex: 1 }}>
                  {AXIS_OPTIONS.map(a => <option key={a.key as string} value={a.key as string}>{a.label}</option>)}
                </select>
              </div>

              {/* 入れ替えボタン */}
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button
                  onClick={() => { setXAxis(yAxis); setYAxis(xAxis); setHoveredIdx(null) }}
                  title="縦横を入れ替え"
                  style={{
                    background: '#F1F5F9', border: '1px solid #E2E8F0',
                    borderRadius: 6, width: 28, height: 24, cursor: 'pointer',
                    color: '#64748B', fontSize: 13, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                  }}>⇄</button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10, color: '#64748B', width: 28, flexShrink: 0 }}>縦軸</span>
                <select value={yAxis.key as string}
                  onChange={e => { const f = AXIS_OPTIONS.find(a => a.key === e.target.value); if (f) { setYAxis(f); setHoveredIdx(null) } }}
                  style={{ ...selectStyle, flex: 1 }}>
                  {AXIS_OPTIONS.map(a => <option key={a.key as string} value={a.key as string}>{a.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* 共有ボタン */}
          <div style={{ marginTop: 'auto' }}>
            <button
              onClick={openShareModal} disabled={sharing}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                width: '100%', padding: '9px 0', borderRadius: 8,
                background: sharing ? '#F1F5F9' : '#1a73e8',
                border: 'none',
                color: sharing ? '#94A3B8' : '#fff',
                fontSize: 12, fontWeight: 600, cursor: sharing ? 'default' : 'pointer',
              }}>
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
              {sharing ? '準備中...' : '共有する'}
            </button>
          </div>
        </div>
      </div>

      {/* 共有モーダル */}
      {shareModal && (
        <div onClick={() => setShareModal(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: 16,
        }}>
          <div onClick={ev => ev.stopPropagation()} style={{
            background: '#fff', borderRadius: 20, width: '100%', maxWidth: 820,
            boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
            border: '1px solid #E2E8F0',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>

            {/* モーダルヘッダー */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 20px', borderBottom: '1px solid #F1F5F9',
            }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#1E293B' }}>共有</span>
              <button onClick={() => setShareModal(false)} style={{
                width: 28, height: 28, borderRadius: '50%', border: 'none',
                background: '#F1F5F9', cursor: 'pointer',
                color: '#64748B',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
              }}>✕</button>
            </div>

            {/* 本体: 左=プレビュー / 右=アクション */}
            <div style={{ display: 'flex', minHeight: 340 }}>

              {/* 左: プレビューエリア */}
              <div style={{
                flex: '1 1 0',
                background: '#F8FAFC',
                display: 'flex', flexDirection: 'column',
                borderRight: '1px solid #F1F5F9',
              }}>
                {/* プレビュータブ */}
                <div style={{ display: 'flex', borderBottom: '1px solid #F1F5F9' }}>
                  {(['image', 'video'] as const).map(tab => {
                    const active = (tab === 'image' && !videoBlobUrl) || (tab === 'video' && !!videoBlobUrl)
                    return (
                      <button key={tab} style={{
                        flex: 1, padding: '10px 0', border: 'none', cursor: 'default',
                        background: active ? '#fff' : 'transparent',
                        fontSize: 11, fontWeight: 600,
                        color: active ? '#1E293B' : '#94A3B8',
                        borderBottom: active ? '2px solid #1a73e8' : '2px solid transparent',
                      }}>
                        {tab === 'image' ? '画像プレビュー' : '動画プレビュー'}
                      </button>
                    )
                  })}
                </div>

                {/* プレビュー本体 */}
                <div style={{
                  flex: 1, position: 'relative',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
                }}>
                  {previewUrl && !videoBlobUrl && (
                    <img src={previewUrl} alt="散布図プレビュー"
                      style={{ width: '100%', height: 'auto', borderRadius: 10, display: 'block',
                        boxShadow: '0 2px 16px rgba(0,0,0,0.1)', border: '1px solid #E2E8F0' }} />
                  )}
                  {videoBlobUrl && (
                    <video src={videoBlobUrl} controls autoPlay loop muted
                      style={{ width: '100%', height: 'auto', borderRadius: 10, display: 'block',
                        boxShadow: '0 2px 16px rgba(0,0,0,0.1)' }} />
                  )}
                  {!previewUrl && !videoBlobUrl && videoProgress === null && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                      <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth={1.5}>
                        <rect x="3" y="3" width="18" height="18" rx="3"/>
                        <circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                      </svg>
                      <span style={{ fontSize: 11, color: '#94A3B8' }}>プレビューを準備中...</span>
                    </div>
                  )}
                  {/* 動画生成中オーバーレイ */}
                  {videoProgress !== null && (
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'rgba(248,250,252,0.9)',
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center', gap: 14,
                    }}>
                      <svg width={40} height={40} viewBox="0 0 36 36" className="animate-spin">
                        <circle cx={18} cy={18} r={15} fill="none" stroke="#E2E8F0" strokeWidth={3} />
                        <path d="M18 3 a15 15 0 0 1 15 15" fill="none" stroke="#1a73e8" strokeWidth={3} strokeLinecap="round" />
                      </svg>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#1E293B' }}>動画を生成中... {videoProgress}%</span>
                      <div style={{ width: 200, height: 4, background: '#E2E8F0', borderRadius: 2 }}>
                        <div style={{
                          height: '100%', width: `${videoProgress}%`,
                          background: '#1a73e8', borderRadius: 2, transition: 'width 0.1s'
                        }} />
                      </div>
                    </div>
                  )}
                  {/* PNGバッジ */}
                  {previewUrl && !videoBlobUrl && (
                    <div style={{
                      position: 'absolute', bottom: 28, right: 28,
                      background: 'rgba(15,23,42,0.45)', borderRadius: 6,
                      padding: '2px 8px', fontSize: 9, color: '#fff', fontWeight: 700,
                    }}>PNG × 2x</div>
                  )}
                </div>
              </div>

              {/* 右: アクションボタン */}
              <div style={{ width: 260, padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ fontSize: 10, color: '#94A3B8', margin: '0 0 6px', fontWeight: 600, letterSpacing: '0.05em' }}>
                  共有方法を選択
                </p>

                {/* 画像をコピー */}
                <button onClick={copyImage} style={actionRowStyle}>
                  <span style={iconBoxStyle('#EFF6FF')}>
                    <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="#1a73e8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2"/>
                      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                    </svg>
                  </span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#1E293B' }}>画像をコピー</div>
                    <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>クリップボードにPNG</div>
                  </div>
                </button>

                {/* Xで共有 */}
                <button onClick={shareToX} style={actionRowStyle}>
                  <span style={iconBoxStyle('#000')}>
                    <svg width={15} height={15} viewBox="0 0 24 24" fill="#fff">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/>
                    </svg>
                  </span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#1E293B' }}>Xで共有</div>
                    <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>X (Twitter) に投稿</div>
                  </div>
                </button>

                <div style={{ height: 1, background: '#F1F5F9', margin: '4px 0' }} />

                {/* 動画生成 / ダウンロード */}
                {!videoBlobUrl ? (
                  <button onClick={generateVideo} disabled={videoProgress !== null} style={{
                    ...actionRowStyle, opacity: videoProgress !== null ? 0.5 : 1,
                    cursor: videoProgress !== null ? 'default' : 'pointer',
                  }}>
                    <span style={iconBoxStyle('#FEF3C7')}>
                      <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="23 7 16 12 23 17 23 7"/>
                        <rect x="1" y="5" width="15" height="14" rx="2"/>
                      </svg>
                    </span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#1E293B' }}>
                        {videoProgress !== null ? `生成中... ${videoProgress}%` : '動画を生成する'}
                      </div>
                      <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>アニメーション付きWebM</div>
                    </div>
                  </button>
                ) : (
                  <button onClick={downloadVideo} style={actionRowStyle}>
                    <span style={iconBoxStyle('#F0FDF4')}>
                      <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                    </span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#16A34A' }}>動画をダウンロード</div>
                      <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>WebMファイルとして保存</div>
                    </div>
                  </button>
                )}

                {videoBlobUrl && (
                  <p style={{ fontSize: 10, color: '#94A3B8', margin: '4px 0 0', lineHeight: 1.5 }}>
                    左のプレビューで動画を確認できます
                  </p>
                )}
              </div>
            </div>

            {/* フッター */}
            <div style={{
              padding: '10px 20px', borderTop: '1px solid #F1F5F9',
              display: 'flex', justifyContent: 'flex-end',
            }}>
              <button onClick={() => setShareModal(false)} style={{
                padding: '6px 16px', borderRadius: 8,
                border: '1px solid #E2E8F0',
                background: '#F8FAFC',
                fontSize: 12, fontWeight: 600, color: '#64748B', cursor: 'pointer',
              }}>閉じる</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
