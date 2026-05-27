'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
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
  const [labelMode, setLabelMode] = useState<'top10' | 'bottom10'>('top10')
  const [sharing, setSharing] = useState(false)
  const [shareModal, setShareModal] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewCanvas, setPreviewCanvas] = useState<HTMLCanvasElement | null>(null)
  const [videoProgress, setVideoProgress] = useState<number | null>(null)
  const wrapRef      = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
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
      showCard: labelMode === 'top10'
        ? item.rank <= 10
        : item.rank > (items.length - 10),
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

  // モーダルを開く（キャプチャしてプレビュー生成）
  const openShareModal = useCallback(async () => {
    if (!containerRef.current) return
    setSharing(true)
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
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ])
      } catch {
        // フォールバック: ダウンロード
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

  // 動画保存（ドットが順番に出現するアニメーションを録画）
  const saveVideo = useCallback(async () => {
    if (!containerRef.current || !wrapRef.current) return
    setVideoProgress(0)

    const W2 = size.w, H2 = 380
    const dpr = 2
    const offscreen = document.createElement('canvas')
    offscreen.width  = W2 * dpr
    offscreen.height = H2 * dpr
    const ctx = offscreen.getContext('2d')!
    ctx.scale(dpr, dpr)

    const PAD_L2 = 68, PAD_R2 = 20, PAD_T2 = 24, PAD_B2 = 46
    const cW = W2 - PAD_L2 - PAD_R2, cH = H2 - PAD_T2 - PAD_B2

    // 現在の entries を使って描画
    const currentEntries = [...entries]
    const xVals = currentEntries.map(e => e.xv).filter(v => v != null) as number[]
    const yVals = currentEntries.map(e => e.yv).filter(v => v != null) as number[]
    const xMin2 = Math.min(...xVals), xMax2 = Math.max(...xVals)
    const yMin2 = Math.min(...yVals), yMax2 = Math.max(...yVals)
    const toX2 = (v: number) => PAD_L2 + ((v - xMin2) / (xMax2 - xMin2 || 1)) * cW
    const toY2 = (v: number) => PAD_T2 + cH - ((v - yMin2) / (yMax2 - yMin2 || 1)) * cH

    const FPS = 30
    const INTRO_FRAMES  = FPS * 0.5  // 0.5秒: グリッド描画
    const DOT_INTERVAL  = Math.max(1, Math.floor(FPS / 6)) // ドット1つずつ
    const DOT_FRAMES    = currentEntries.length * DOT_INTERVAL
    const CARD_FRAMES   = FPS * 1    // 1秒: カードフェードイン
    const OUTRO_FRAMES  = FPS * 1.5  // 1.5秒: 静止
    const TOTAL_FRAMES  = INTRO_FRAMES + DOT_FRAMES + CARD_FRAMES + OUTRO_FRAMES

    const drawFrame = (frame: number) => {
      ctx.clearRect(0, 0, W2, H2)
      // 背景
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W2, H2)
      // グリッド
      ctx.strokeStyle = '#E2E8F0'; ctx.lineWidth = 1; ctx.setLineDash([4, 4])
      for (let i = 0; i <= 5; i++) {
        const x = PAD_L2 + (cW / 5) * i, y = PAD_T2 + (cH / 4) * i
        ctx.beginPath(); ctx.moveTo(x, PAD_T2); ctx.lineTo(x, H2 - PAD_B2); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(PAD_L2, y); ctx.lineTo(W2 - PAD_R2, y); ctx.stroke()
      }
      ctx.setLineDash([])
      // 軸線
      ctx.strokeStyle = '#CBD5E1'; ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.moveTo(PAD_L2, PAD_T2); ctx.lineTo(PAD_L2, H2 - PAD_B2); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(PAD_L2, H2 - PAD_B2); ctx.lineTo(W2 - PAD_R2, H2 - PAD_B2); ctx.stroke()

      // 調査年透かし
      if (surveyYear) {
        ctx.font = `700 48px 'Noto Sans JP',sans-serif`
        ctx.fillStyle = '#E2E8F0'; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'
        ctx.fillText(`${surveyYear}年`, W2 - PAD_R2 - 8, H2 - PAD_B2 - 8)
      }

      if (frame < INTRO_FRAMES) return

      // ドット出現
      const dotFrame = frame - INTRO_FRAMES
      const visibleCount = Math.min(
        currentEntries.length,
        Math.floor(dotFrame / DOT_INTERVAL) + 1
      )
      for (let i = 0; i < visibleCount; i++) {
        const e = currentEntries[i]
        const isLast = i === visibleCount - 1
        const scale  = isLast ? Math.min(1, (dotFrame % DOT_INTERVAL) / DOT_INTERVAL * 2) : 1
        const r = DOT_R * scale
        ctx.beginPath(); ctx.arc(toX2(e.xv), toY2(e.yv), r, 0, Math.PI * 2)
        ctx.fillStyle = e.color + 'CC'; ctx.fill()
      }

      if (frame < INTRO_FRAMES + DOT_FRAMES) return

      // カードフェードイン
      const cardFrame = frame - INTRO_FRAMES - DOT_FRAMES
      const cardAlpha = Math.min(1, cardFrame / CARD_FRAMES)
      currentEntries.forEach(e => {
        // 全ドット（フル）
        ctx.beginPath(); ctx.arc(toX2(e.xv), toY2(e.yv), DOT_R, 0, Math.PI * 2)
        ctx.fillStyle = e.color + 'CC'; ctx.fill()

        if (!e.showCard) return
        const cx = toX2(e.xv), cy = toY2(e.yv)
        ctx.globalAlpha = cardAlpha
        // カード
        ctx.fillStyle = e.color
        ctx.beginPath(); ctx.roundRect(e.cardX, e.cardY, e.cardW, CARD_H, 10); ctx.fill()
        ctx.fillStyle = '#fff'
        ctx.font = `600 ${CARD_FS}px 'Noto Sans JP',sans-serif`
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
        ctx.fillText(e.item.name, e.cardX + 8, e.cardY + CARD_H / 2)
        // 引き出し線
        ctx.strokeStyle = e.color; ctx.lineWidth = 1; ctx.setLineDash([3, 3])
        ctx.beginPath()
        ctx.moveTo(e.goRight ? cx + DOT_R : cx - DOT_R, cy)
        ctx.lineTo(e.goRight ? e.cardX : e.cardX + e.cardW, e.cardY + CARD_H / 2)
        ctx.stroke(); ctx.setLineDash([])
        ctx.globalAlpha = 1
      })
    }

    // MediaRecorder で録画
    const stream = offscreen.captureStream(FPS)
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9' : 'video/webm'
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_000_000 })
    const chunks: Blob[] = []
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'scatter.webm'; a.click()
      URL.revokeObjectURL(url)
      setVideoProgress(null)
    }
    recorder.start()

    let frame = 0
    const tick = () => {
      drawFrame(frame)
      setVideoProgress(Math.round((frame / TOTAL_FRAMES) * 100))
      frame++
      if (frame <= TOTAL_FRAMES) {
        setTimeout(tick, 1000 / FPS)
      } else {
        recorder.stop()
      }
    }
    tick()
  }, [entries, size, surveyYear])

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

  const btnBase: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: 26, borderRadius: 6, border: '1px solid #E2E8F0',
    background: '#F8FAFC', cursor: 'pointer', color: '#64748B',
    fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0, padding: '0 8px',
  }

  return (
    <div ref={containerRef} style={{
      background: '#fff', border: '1px solid #E8EFF5', borderRadius: 12,
      padding: '16px 16px 12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      {/* ヘッダー */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        {/* 左: タイトル + 年 + ラベルトグル */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>散布図</span>
          {surveyYear && (
            <span style={{ fontSize: 10, background: '#F1F5F9', color: '#64748B', borderRadius: 4, padding: '2px 6px' }}>
              {surveyYear}年調査
            </span>
          )}
          {/* 上位/下位トグル */}
          <div style={{ display: 'flex', border: '1px solid #E2E8F0', borderRadius: 6, overflow: 'hidden' }}>
            {(['top10', 'bottom10'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setLabelMode(mode)}
                style={{
                  ...btnBase,
                  border: 'none', borderRadius: 0,
                  background: labelMode === mode ? '#1a73e8' : '#F8FAFC',
                  color: labelMode === mode ? '#fff' : '#64748B',
                  padding: '0 10px',
                }}
              >{mode === 'top10' ? '上位10件' : '下位10件'}</button>
            ))}
          </div>
        </div>
        {/* 右: 軸セレクタ + 入替 + 共有 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <AxisSelect label="横軸:" value={xAxis} onChange={a => { setXAxis(a); setHoveredIdx(null) }} />
          <button
            onClick={() => { setXAxis(yAxis); setYAxis(xAxis); setHoveredIdx(null) }}
            title="縦横を入れ替え"
            style={{ ...btnBase, width: 26, padding: 0, fontSize: 14 }}
          >⇄</button>
          <AxisSelect label="縦軸:" value={yAxis} onChange={a => { setYAxis(a); setHoveredIdx(null) }} />
          <button
            onClick={openShareModal}
            disabled={sharing}
            title="共有"
            style={{ ...btnBase, gap: 4, background: sharing ? '#E2E8F0' : '#F8FAFC', color: sharing ? '#94A3B8' : '#475569' }}
          >
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
            {sharing ? '処理中...' : '共有'}
          </button>
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
                <rect x={tx} y={ty} width={tipW} height={tipH} rx={8} fill={e.color} fillOpacity={0.95} />
                {tipLines.map((line, li) => (
                  <text
                    key={li}
                    x={tx + 10} y={ty + 7 + li * tipLineH + tipLineH / 2}
                    dominantBaseline="middle"
                    fontSize={li === 0 ? 11 : 10}
                    fontWeight={li === 0 ? 700 : 500}
                    fill={li === 0 ? '#fff' : 'rgba(255,255,255,0.85)'}
                    fontFamily="'Noto Sans JP',sans-serif"
                  >{line}</text>
                ))}
              </g>
            )
          })()}

      {/* 出典 */}
      <div style={{ textAlign: 'right', marginTop: 4 }}>
        <span style={{ fontSize: 9, color: '#94A3B8' }}>出典: 厚生労働省 賃金構造基本統計調査</span>
      </div>

      {/* 共有モーダル */}
      {shareModal && (
        <div
          onClick={() => setShareModal(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: 16,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 16, padding: 24,
              width: '100%', maxWidth: 540,
              boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
              display: 'flex', flexDirection: 'column', gap: 16,
            }}
          >
            {/* モーダルヘッダー */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#1E293B' }}>散布図を共有</span>
              <button
                onClick={() => setShareModal(false)}
                style={{
                  width: 28, height: 28, borderRadius: '50%', border: 'none',
                  background: '#F1F5F9', cursor: 'pointer', fontSize: 16, color: '#64748B',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >✕</button>
            </div>

            {/* プレビュー */}
            {previewUrl && (
              <div style={{
                border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden',
                background: '#F8FAFC',
              }}>
                <img
                  src={previewUrl} alt="散布図プレビュー"
                  style={{ width: '100%', height: 'auto', display: 'block' }}
                />
              </div>
            )}

            {/* アクションボタン */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

              {/* 画像をコピー */}
              <button
                onClick={copyImage}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', borderRadius: 10,
                  border: '1px solid #E2E8F0', background: '#F8FAFC',
                  cursor: 'pointer', width: '100%', textAlign: 'left',
                }}
              >
                <span style={{
                  width: 36, height: 36, borderRadius: 8, background: '#EFF6FF',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#1a73e8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                  </svg>
                </span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B' }}>画像をコピー</div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>クリップボードにPNG画像をコピー</div>
                </div>
              </button>

              {/* Xで共有 */}
              <button
                onClick={shareToX}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', borderRadius: 10,
                  border: '1px solid #E2E8F0', background: '#F8FAFC',
                  cursor: 'pointer', width: '100%', textAlign: 'left',
                }}
              >
                <span style={{
                  width: 36, height: 36, borderRadius: 8, background: '#000',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="#fff">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/>
                  </svg>
                </span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B' }}>Xで共有</div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>X (Twitter) に投稿する</div>
                </div>
              </button>

              {/* 動画を保存 */}
              <button
                onClick={saveVideo}
                disabled={videoProgress !== null}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', borderRadius: 10,
                  border: '1px solid #E2E8F0',
                  background: videoProgress !== null ? '#F1F5F9' : '#F8FAFC',
                  cursor: videoProgress !== null ? 'default' : 'pointer',
                  width: '100%', textAlign: 'left',
                }}
              >
                <span style={{
                  width: 36, height: 36, borderRadius: 8, background: '#FEF3C7',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  position: 'relative', overflow: 'hidden',
                }}>
                  {videoProgress !== null ? (
                    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                      <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
                    </svg>
                  ) : (
                    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
                    </svg>
                  )}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: videoProgress !== null ? '#94A3B8' : '#1E293B' }}>
                    {videoProgress !== null ? `動画を生成中... ${videoProgress}%` : '動画を保存'}
                  </div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
                    {videoProgress !== null
                      ? <div style={{ height: 4, background: '#E2E8F0', borderRadius: 2, marginTop: 4 }}>
                          <div style={{ height: '100%', width: `${videoProgress}%`, background: '#D97706', borderRadius: 2, transition: 'width 0.1s' }} />
                        </div>
                      : 'アニメーション付きWebM動画をダウンロード'
                    }
                  </div>
                </div>
              </button>

            </div>
          </div>
        </div>
      )}
    </div>
  )
}


