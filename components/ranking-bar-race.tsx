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
// 全角12文字に切り詰める（全角1文字=1、半角=0.5として計算）
const truncateLabel = (text: string, maxFullWidth = 12): string => {
  let w = 0
  let result = ''
  for (const ch of text) {
    const isFullWidth = ch.match(/[^\x00-\x7F]/) !== null
    w += isFullWidth ? 1 : 0.5
    if (w > maxFullWidth) return result + '…'
    result += ch
  }
  return result
}

type Entry = {
  i: number; item: OccupationWage; color: string
  dx: number; dy: number; xv: number; yv: number
  lx: number; ly: number; goRight: boolean; showLabel: boolean
}

export function RankingBarRace({ data, surveyYear }: RankingBarRaceProps) {
  const [xAxis,         setXAxis]         = useState<AxisDef>(AXIS_OPTIONS[0])
  const [yAxis,         setYAxis]         = useState<AxisDef>(AXIS_OPTIONS[1])
  const [hoveredIdx,    setHoveredIdx]    = useState<number | null>(null)
  const [displayMode,   setDisplayMode]   = useState<'top20' | 'bottom20' | 'all'>('top20')
  const [sharing,       setSharing]       = useState(false)
  const [shareModal,    setShareModal]    = useState(false)
  const [previewUrl,    setPreviewUrl]    = useState<string | null>(null)
  const [previewCanvas, setPreviewCanvas] = useState<HTMLCanvasElement | null>(null)
  const [videoProgress, setVideoProgress] = useState<number | null>(null)
  const [videoBlobUrl,  setVideoBlobUrl]  = useState<string | null>(null)
  const [size,          setSize]          = useState({ w: 480 })
  const [zoom,          setZoom]          = useState(1)
  const [panX,          setPanX]          = useState(0)
  const [panY,          setPanY]          = useState(0)
  const svgRef = useRef<SVGSVGElement>(null)

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

  const resetZoom = useCallback(() => { setZoom(1); setPanX(0); setPanY(0) }, [])

  const zoomIn  = useCallback(() => {
    const cx = size.w / 2, cy = size.w / 2
    setZoom(z => {
      const next = Math.min(8, +(z * 1.5).toFixed(2))
      setPanX(px => cx - (cx - px) * (next / z))
      setPanY(py => cy - (cy - py) * (next / z))
      return next
    })
  }, [size.w])

  const zoomOut = useCallback(() => {
    const cx = size.w / 2, cy = size.w / 2
    setZoom(z => {
      const next = Math.max(1, +(z / 1.5).toFixed(2))
      if (next <= 1) { setPanX(0); setPanY(0) }
      else {
        setPanX(px => cx - (cx - px) * (next / z))
        setPanY(py => cy - (cy - py) * (next / z))
      }
      return next
    })
  }, [size.w])

  const pan = useCallback((dx: number, dy: number) => {
    setPanX(px => px + dx)
    setPanY(py => py + dy)
  }, [])

  // 正方形: W = H
  const W = size.w
  const H = W
  const PAD_L = 58, PAD_R = 16, PAD_T = 20, PAD_B = 44


  const entries = useMemo<Entry[]>(() => {
    const allItems = data.filter(
      d => getVal(d, xAxis.key) != null && getVal(d, yAxis.key) != null
    )
    if (allItems.length === 0) return []

    // 軸スケールは常に全データから計算（フィルタで変わらない）
    const allXVals = allItems.map(d => getVal(d, xAxis.key)!)
    const allYVals = allItems.map(d => getVal(d, yAxis.key)!)
    const { nMin: xMin, nMax: xMax } = nice(Math.min(...allXVals), Math.max(...allXVals), 6)
    const { nMin: yMin, nMax: yMax } = nice(Math.min(...allYVals), Math.max(...allYVals), 5)
    const toX = (v: number) => PAD_L + ((v - xMin) / (xMax - xMin || 1)) * (W - PAD_L - PAD_R)
    const toY = (v: number) => H - PAD_B - ((v - yMin) / (yMax - yMin || 1)) * (H - PAD_T - PAD_B)

    // ラベルを表示する職種セットを決定（ドットは常に全件）
    let labelSet: Set<string> | null = null  // null = すべて表示
    if (displayMode !== 'all') {
      const sorted = [...allItems].sort((a, b) => {
        const av = getVal(a, xAxis.key) ?? 0
        const bv = getVal(b, xAxis.key) ?? 0
        return bv - av
      })
      const sliced = displayMode === 'top20' ? sorted.slice(0, 20) : sorted.slice(-20)
      labelSet = new Set(sliced.map(d => d.name))
    }

    // ラベルはドット真下に固定距離・中央揃え
    const LABEL_OFFSET = DOT_R + 4

    return allItems.map((item, i) => {
      const xv       = getVal(item, xAxis.key)!
      const yv       = getVal(item, yAxis.key)!
      const dx       = toX(xv)
      const dy       = toY(yv)
      const color    = COLORS[i % COLORS.length]
      const showLabel = labelSet === null || labelSet.has(item.name)
      return { i, item, color, dx, dy, xv, yv, lx: dx, ly: dy + LABEL_OFFSET + LABEL_FS, goRight: true, showLabel }
    })
  }, [data, xAxis, yAxis, displayMode, W, H, PAD_L, PAD_R, PAD_T, PAD_B])

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
      const scale  = 2
      const sw     = svgEl.clientWidth
      const sh     = svgEl.clientHeight
      const TITLE_H = 36  // タイトル行の高さ
      const SOURCE_H = 20 // 出典行の高さ
      const cvs    = document.createElement('canvas')
      cvs.width    = sw  * scale
      cvs.height   = (sh + TITLE_H + SOURCE_H) * scale
      const ctx2   = cvs.getContext('2d')!
      ctx2.scale(scale, scale)

      // 背景
      ctx2.fillStyle = '#ffffff'
      ctx2.fillRect(0, 0, sw, sh + TITLE_H + SOURCE_H)

      // タイトル行
      const titleCx = sw / 2
      ctx2.textBaseline = 'middle'
      const ty = TITLE_H / 2
      ctx2.fillStyle = '#94A3B8'; ctx2.font = `500 9px 'Noto Sans JP',sans-serif`
      ctx2.textAlign = 'right'
      ctx2.fillText('縦軸', titleCx - 108, ty)
      ctx2.fillStyle = '#1E293B'; ctx2.font = `700 13px 'Noto Sans JP',sans-serif`
      ctx2.textAlign = 'left'
      ctx2.fillText(yAxis.label, titleCx - 100, ty)
      const ylw = ctx2.measureText(yAxis.label).width
      ctx2.fillStyle = '#94A3B8'; ctx2.font = `500 11px 'Noto Sans JP',sans-serif`
      ctx2.fillText(' × ', titleCx - 100 + ylw, ty)
      const sepw = ctx2.measureText(' × ').width
      ctx2.fillStyle = '#1E293B'; ctx2.font = `700 13px 'Noto Sans JP',sans-serif`
      ctx2.fillText(xAxis.label, titleCx - 100 + ylw + sepw, ty)
      const xlw = ctx2.measureText(xAxis.label).width
      ctx2.fillStyle = '#94A3B8'; ctx2.font = `500 9px 'Noto Sans JP',sans-serif`
      ctx2.fillText('横軸', titleCx - 100 + ylw + sepw + xlw + 4, ty)
      if (surveyYear) {
        const xyw = ctx2.measureText('横軸').width
        ctx2.fillText(`（${surveyYear}年調査）`, titleCx - 100 + ylw + sepw + xlw + 4 + xyw + 4, ty)
      }

      // SVG本体
      ctx2.drawImage(img, 0, TITLE_H, sw, sh)
      URL.revokeObjectURL(url)

      // 出典行
      ctx2.fillStyle = '#94A3B8'; ctx2.font = `500 9px 'Noto Sans JP',sans-serif`
      ctx2.textAlign = 'right'; ctx2.textBaseline = 'middle'
      ctx2.fillText('出典：厚生労働省 賃金構造基本統計調査', sw - 8, sh + TITLE_H + SOURCE_H / 2)

      setPreviewCanvas(cvs)
      setPreviewUrl(cvs.toDataURL('image/png'))
    } catch {
      // プレビューなしでモーダルは開いたまま
    } finally {
      setSharing(false)
    }
  }, [wrapRef, xAxis, yAxis, surveyYear])

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

    // 軸スケールは data 全件から計算（フィルタに依存しない）
    const allValid = data.filter(d => getVal(d, xAxis.key) != null && getVal(d, yAxis.key) != null)
    const allXVals = allValid.map(d => getVal(d, xAxis.key)!)
    const allYVals = allValid.map(d => getVal(d, yAxis.key)!)
    const { nMin: xMin2, nMax: xMax2, tick: xTick2 } = nice(Math.min(...allXVals), Math.max(...allXVals), 6)
    const { nMin: yMin2, nMax: yMax2, tick: yTick2 } = nice(Math.min(...allYVals), Math.max(...allYVals), 5)
    const toX2 = (v: number) => PL + ((v - xMin2) / (xMax2 - xMin2 || 1)) * cW2
    const toY2 = (v: number) => PT + cH2 - ((v - yMin2) / (yMax2 - yMin2 || 1)) * cH2
    const xTicks2: number[] = []; for (let v = xMin2; v <= xMax2 + xTick2 * 0.01; v += xTick2) xTicks2.push(v)
    const yTicks2: number[] = []; for (let v = yMin2; v <= yMax2 + yTick2 * 0.01; v += yTick2) yTicks2.push(v)

    // 全データのEntryに相当する座標を計算（動画用・全件）
    const allEntries = allValid.map((item, i) => {
      const xv = getVal(item, xAxis.key)!
      const yv = getVal(item, yAxis.key)!
      return { i, item, xv, yv, color: COLORS[i % COLORS.length] }
    })

    // スライドイン対象リスト
    // top20/all: 降順に並べて [19位, 18位, ..., 1位] の順（20位→1位）
    // bottom20 : 昇順に並べて [下位20位, ..., 下位1位] の順
    const sorted20 = [...allEntries]
      .sort((a, b) => displayMode === 'bottom20' ? a.xv - b.xv : b.xv - a.xv)
      .slice(0, 20)
      .reverse()  // 最下位（20位 or 下位20位）から出現させる

    const FPS    = 30
    const INTRO  = Math.floor(FPS * 0.5)   // グリッド描画
    const INTV   = Math.max(2, Math.floor(FPS / 5))  // 1点あたりのフレーム数
    const SLIDE  = sorted20.length * INTV   // 20点スライドイン
    const FADEIN = Math.floor(FPS * 0.8)   // 全件フェードイン
    const OUTRO  = Math.floor(FPS * 1.5)   // 静止
    const TOTAL  = INTRO + SLIDE + FADEIN + OUTRO

    // 背景・グリッド・軸・目盛り描画（常時）
    const drawBase = () => {
      ctx.clearRect(0, 0, W2, H2)
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W2, H2)

      // グリッド線
      ctx.strokeStyle = 'rgba(0,0,0,0.08)'; ctx.lineWidth = 1; ctx.setLineDash([3, 4])
      xTicks2.forEach(v => {
        const gx = toX2(v)
        ctx.beginPath(); ctx.moveTo(gx, PT); ctx.lineTo(gx, H2 - PB); ctx.stroke()
      })
      yTicks2.forEach(v => {
        const gy = toY2(v)
        ctx.beginPath(); ctx.moveTo(PL, gy); ctx.lineTo(W2 - PR, gy); ctx.stroke()
      })
      ctx.setLineDash([])

      // 軸線
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.moveTo(PL, PT); ctx.lineTo(PL, H2 - PB); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(PL, H2 - PB); ctx.lineTo(W2 - PR, H2 - PB); ctx.stroke()

      // 目盛りラベル
      ctx.fillStyle = '#475569'
      ctx.font = `500 10px 'Noto Sans JP',sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'top'
      xTicks2.forEach(v => {
        const label = xAxis.unit === '万円' ? `${Math.round(v)}万円` : `${v}${xAxis.unit ?? ''}`
        ctx.fillText(label, toX2(v), H2 - PB + 6)
      })
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
      yTicks2.forEach(v => {
        const label = yAxis.unit ? `${v}${yAxis.unit}` : `${v}`
        ctx.fillText(label, PL - 6, toY2(v))
      })

      // 軸ラベル
      ctx.fillStyle = '#334155'; ctx.font = `600 11px 'Noto Sans JP',sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
      ctx.fillText(xAxis.label, PL + cW2 / 2, H2 - 4)
      ctx.save()
      ctx.translate(12, PT + cH2 / 2)
      ctx.rotate(-Math.PI / 2)
      ctx.textAlign = 'center'; ctx.textBaseline = 'top'
      ctx.fillText(yAxis.label, 0, 0)
      ctx.restore()

      // 透かし年
      if (surveyYear) {
        ctx.font = `700 42px 'Noto Sans JP',sans-serif`
        ctx.fillStyle = 'rgba(0,0,0,0.05)'; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'
        ctx.fillText(`${surveyYear}年`, W2 - PR - 8, H2 - PB - 8)
      }

      // タイトル（上部中央）
      const titleY = 18
      ctx.textAlign = 'center'; ctx.textBaseline = 'top'
      ctx.fillStyle = '#94A3B8'; ctx.font = `500 11px 'Noto Sans JP',sans-serif`
      ctx.fillText('縦軸', PL + cW2 / 2 - 110, titleY)
      ctx.fillStyle = '#1E293B'; ctx.font = `700 14px 'Noto Sans JP',sans-serif`
      ctx.fillText(yAxis.label, PL + cW2 / 2 - 60, titleY)
      ctx.fillStyle = '#94A3B8'; ctx.font = `500 12px 'Noto Sans JP',sans-serif`
      ctx.fillText('×', PL + cW2 / 2 + 28, titleY)
      ctx.fillStyle = '#1E293B'; ctx.font = `700 14px 'Noto Sans JP',sans-serif`
      ctx.fillText(xAxis.label, PL + cW2 / 2 + 70, titleY)
      ctx.fillStyle = '#94A3B8'; ctx.font = `500 11px 'Noto Sans JP',sans-serif`
      ctx.fillText('横軸', PL + cW2 / 2 + 130, titleY)
      if (surveyYear) {
        ctx.fillStyle = '#94A3B8'; ctx.font = `500 10px 'Noto Sans JP',sans-serif`
        ctx.fillText(`（${surveyYear}年調査）`, PL + cW2 / 2 + 195, titleY + 2)
      }

      // 出典（右下）
      ctx.fillStyle = '#94A3B8'; ctx.font = `500 9px 'Noto Sans JP',sans-serif`
      ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'
      ctx.fillText('出典：厚生労働省 賃金構造基本統計調査', W2 - PR, H2 - 2)
    }

    // ドット描画（共通）
    const drawDot = (e: Entry, alpha = 1, r = DOT_R) => {
      ctx.globalAlpha = alpha
      ctx.beginPath(); ctx.arc(toX2(e.xv), toY2(e.yv), r, 0, Math.PI * 2)
      ctx.fillStyle = e.color; ctx.fill()
      ctx.globalAlpha = 1
    }

    // ラベル描画（ドット真下・中央揃え、スライドオフセット付き）
    const drawLabel = (e: Entry, alpha: number, slideX = 0) => {
      const ex = toX2(e.xv), ey = toY2(e.yv)
      const lx = ex + slideX
      const ly = ey + DOT_R + 4 + LABEL_FS
      ctx.globalAlpha = alpha
      ctx.fillStyle = '#000000'
      ctx.font = `500 ${LABEL_FS}px 'Noto Sans JP',sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'
      ctx.fillText(truncateLabel(e.item.name), lx, ly)
      ctx.globalAlpha = 1
    }

    const slideSet = new Set(sorted20.map(e => e.i))

    const drawFrame = (frame: number) => {
      drawBase()  // 軸・グリッドは常に最初から表示

      if (frame < INTRO) return

      const slideFrame = frame - INTRO

      // フェーズ1: 20点を20位→1位の順にスライドイン
      // 各点 i は slideFrame = i*INTV から (i+1)*INTV までの間に出現
      for (let i = 0; i < sorted20.length; i++) {
        const startF = i * INTV
        if (slideFrame < startF) break          // まだ出現していない
        const progress = Math.min(1, (slideFrame - startF) / INTV)
        const e = sorted20[i]
        drawDot(e, progress, DOT_R * Math.min(1, progress * 2))
        const slideX = (1 - progress) * 40
        drawLabel(e, progress, slideX)
      }

      if (frame < INTRO + SLIDE) return

      // フェーズ2: 残り全件をフェードイン（スライドイン済みの20点も再描画して確定）
      const fadeProgress = Math.min(1, (frame - INTRO - SLIDE) / FADEIN)
      for (const e of sorted20) { drawDot(e); drawLabel(e, 1) }
      for (const e of allEntries) {
        if (slideSet.has(e.i)) continue
        drawDot(e, fadeProgress)
      }
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
  }, [entries, data, xAxis, yAxis, size, surveyYear, displayMode])

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
    colorScheme: 'light',
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

          {/* 動的タイトル：「縦軸 Y軸名 × X軸名 横軸」＋調査年 */}
          <div style={{ textAlign: 'center', marginBottom: 6 }}>
            <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
              <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 500 }}>縦軸</span>
              <span style={{ fontSize: 19, fontWeight: 700, color: '#1E293B' }}>{yAxis.label}</span>
              <span style={{ fontSize: 15, color: '#94A3B8', fontWeight: 500, margin: '0 3px' }}>×</span>
              <span style={{ fontSize: 19, fontWeight: 700, color: '#1E293B' }}>{xAxis.label}</span>
              <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 500 }}>横軸</span>
              {surveyYear && (
                <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500, marginLeft: 8 }}>（{surveyYear}年調査）</span>
              )}
            </div>
          </div>

          <svg
            ref={svgRef}
            width={W} height={W}
            style={{ display: 'block', overflow: 'hidden', userSelect: 'none', borderRadius: 8 }}
            onMouseLeave={() => setHoveredIdx(null)}
          >
            {/* 背景（ズーム外） */}
            <rect x={0} y={0} width={W} height={H} fill={BG} rx={8} />

            {/* ズーム・パン対象グループ */}
            <defs>
              <clipPath id="chart-clip">
                <rect x={PAD_L} y={PAD_T} width={W - PAD_L - PAD_R} height={H - PAD_T - PAD_B} />
              </clipPath>
            </defs>

            {/* 軸ラベル（目盛り）— ズーム外・常に固定 */}
            {yTicks.map(v => (
              <text key={`yt-${v}`} x={PAD_L - 6} y={toY(v)}
                textAnchor="end" dominantBaseline="middle"
                fontSize={11} fill={TICK_C} fontFamily="'Noto Sans JP',sans-serif">
                {yAxis.format(v)}
              </text>
            ))}
            {xTicks.map(v => (
              <text key={`xt-${v}`} x={toX(v)} y={H - PAD_B + 7}
                textAnchor="middle" dominantBaseline="hanging"
                fontSize={11} fill={TICK_C} fontFamily="'Noto Sans JP',sans-serif">
                {xAxis.format(v)}
              </text>
            ))}

            {/* 軸タイトル — ズーム外 */}
            <text
              transform={`translate(13,${PAD_T + (H - PAD_T - PAD_B) / 2}) rotate(-90)`}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={12} fontWeight={600} fill={LABEL_C} fontFamily="'Noto Sans JP',sans-serif">
              {yAxis.label}（{yAxis.unit}）
            </text>
            <text x={PAD_L + (W - PAD_L - PAD_R) / 2} y={H - 5}
              textAnchor="middle" dominantBaseline="auto"
              fontSize={12} fontWeight={600} fill={LABEL_C} fontFamily="'Noto Sans JP',sans-serif">
              {xAxis.label}（{xAxis.unit}）
            </text>

            {/* ズーム・パン変換グループ（チャートエリアにclip） */}
            <g clipPath="url(#chart-clip)">
              <g transform={`translate(${panX},${panY}) scale(${zoom})`}>

                {/* グリッド線 */}
                {yTicks.map(v => (
                  <line key={`yg-${v}`} x1={PAD_L} y1={toY(v)} x2={W - PAD_R} y2={toY(v)}
                    stroke={GRID} strokeWidth={1 / zoom} strokeDasharray={`${3 / zoom} ${4 / zoom}`} />
                ))}
                {xTicks.map(v => (
                  <line key={`xg-${v}`} x1={toX(v)} y1={PAD_T} x2={toX(v)} y2={H - PAD_B}
                    stroke={GRID} strokeWidth={1 / zoom} strokeDasharray={`${3 / zoom} ${4 / zoom}`} />
                ))}

                {/* 軸線 */}
                <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={H - PAD_B} stroke={AXIS_C} strokeWidth={1 / zoom} />
                <line x1={PAD_L} y1={H - PAD_B} x2={W - PAD_R} y2={H - PAD_B} stroke={AXIS_C} strokeWidth={1 / zoom} />

                {/* 調査年透かし */}
                {surveyYear && (
                  <text x={W - PAD_R - 8} y={H - PAD_B - 8} textAnchor="end" dominantBaseline="auto"
                    fontSize={44 / zoom} fontWeight={700} fill="rgba(0,0,0,0.05)" fontFamily="'Noto Sans JP',sans-serif">
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

                {/* ラベル（showLabel=trueかつ非ホバーのみ） */}
                {entries.map(e => {
                  if (e.i === hoveredIdx) return null
                  if (!e.showLabel) return null
                  return (
                    <text key={`lb-${e.i}`}
                      x={e.lx} y={e.ly}
                      textAnchor="middle" dominantBaseline="auto"
                      fontSize={LABEL_FS / zoom} fontWeight={500}
                      fill="#000000" fillOpacity={0.85}
                      fontFamily="'Noto Sans JP',sans-serif"
                      style={{ pointerEvents: 'none' }}
                    >
                      {truncateLabel(e.item.name)}
                    </text>
                  )
                })}

                {/* ホバー：ドット拡大 */}
                {hovered && (() => {
                  const e = hovered
                  const tipLines = [
                    e.item.name,
                    `${xAxis.label}: ${xAxis.format(e.xv)}`,
                    `${yAxis.label}: ${yAxis.format(e.yv)}`,
                  ]
                  const tipW = 210 / zoom, tipLH = 18 / zoom, tipH = tipLines.length * tipLH + 14 / zoom
                  let tx = e.dx + (DOT_R + 10) / zoom, ty = e.dy - tipH / 2
                  if (tx * zoom + panX + tipW * zoom > W - PAD_R) tx = e.dx - (DOT_R + 10) / zoom - tipW
                  if (ty < PAD_T / zoom) ty = PAD_T / zoom
                  if (ty + tipH > (H - PAD_B) / zoom) ty = (H - PAD_B) / zoom - tipH

                  return (
                    <g>
                      <circle cx={e.dx} cy={e.dy} r={(DOT_R + 3) / zoom} fill={e.color} opacity={0.25} />
                      <circle cx={e.dx} cy={e.dy} r={(DOT_R + 1) / zoom} fill={e.color}
                        stroke="#fff" strokeWidth={1.5 / zoom}
                        style={{ cursor: 'pointer' }}
                        onMouseEnter={() => setHoveredIdx(e.i)}
                        onMouseLeave={() => setHoveredIdx(null)} />
                      <text x={e.lx} y={e.ly}
                        textAnchor="middle" dominantBaseline="auto"
                        fontSize={LABEL_FS / zoom} fontWeight={700}
                        fill="#000000" fillOpacity={1}
                        fontFamily="'Noto Sans JP',sans-serif"
                        style={{ pointerEvents: 'none' }}>
                        {truncateLabel(e.item.name)}
                      </text>
                      <rect x={tx} y={ty} width={tipW} height={tipH} rx={8 / zoom}
                        fill={e.color} fillOpacity={0.95} />
                      <rect x={tx} y={ty} width={tipW} height={tipH} rx={8 / zoom}
                        fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={1 / zoom} />
                      {tipLines.map((line, li) => (
                        <text key={li}
                          x={tx + 12 / zoom} y={ty + 7 / zoom + li * tipLH + tipLH / 2}
                          dominantBaseline="middle"
                          fontSize={(li === 0 ? 11 : 10) / zoom} fontWeight={li === 0 ? 700 : 500}
                      fill={li === 0 ? '#fff' : 'rgba(255,255,255,0.8)'}
                      fontFamily="'Noto Sans JP',sans-serif">
                      {line}
                    </text>
                  ))}
                </g>
              )
            })()}

              </g>{/* /scale */}
            </g>{/* /clipPath */}
          </svg>

          {/* 出典 */}
          <div style={{ textAlign: 'right', marginTop: 6 }}>
            <span style={{ fontSize: 10, color: '#94A3B8' }}>
              {'出典：厚生労働省 賃金構造基本統計調査'}
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
                  onChange={e => { const f = AXIS_OPTIONS.find(a => a.key === e.target.value); if (f) { setXAxis(f); setHoveredIdx(null); resetZoom() } }}
                  style={{ ...selectStyle, flex: 1 }}>
                  {AXIS_OPTIONS.map(a => <option key={a.key as string} value={a.key as string}>{a.label}</option>)}
                </select>
              </div>

              {/* 入れ替えボタン */}
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button
                  onClick={() => { setXAxis(yAxis); setYAxis(xAxis); setHoveredIdx(null); resetZoom() }}
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
                  onChange={e => { const f = AXIS_OPTIONS.find(a => a.key === e.target.value); if (f) { setYAxis(f); setHoveredIdx(null); resetZoom() } }}
                  style={{ ...selectStyle, flex: 1 }}>
                  {AXIS_OPTIONS.map(a => <option key={a.key as string} value={a.key as string}>{a.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* 表示件数 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, letterSpacing: '0.05em' }}>表示</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {([
                { key: 'top20',    label: '上位20' },
                { key: 'bottom20', label: '下位20' },
                { key: 'all',      label: 'すべて'  },
              ] as const).map(opt => (
                <button key={opt.key}
                  onClick={() => { setDisplayMode(opt.key); setHoveredIdx(null) }}
                  style={{
                    flex: 1, padding: '5px 0', borderRadius: 6, fontSize: 10, fontWeight: 600,
                    cursor: 'pointer',
                    border: displayMode === opt.key ? '1.5px solid #1a73e8' : '1px solid #E2E8F0',
                    background: displayMode === opt.key ? '#EFF6FF' : '#F8FAFC',
                    color: displayMode === opt.key ? '#1a73e8' : '#64748B',
                  }}>
                  {opt.label}
                </button>
              ))}
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

          {/* ズームコントロール */}
          {(() => {
            const btnBase: React.CSSProperties = {
              width: 28, height: 28, borderRadius: 6, border: '1px solid #E2E8F0',
              background: '#F8FAFC', color: '#334155', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 700, flexShrink: 0,
            }
            const STEP = 40
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 4, borderTop: '1px solid #F1F5F9' }}>
                <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, letterSpacing: '0.05em' }}>ズーム</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={zoomIn}  style={btnBase} title="ズームイン">＋</button>
                  <button onClick={zoomOut} style={btnBase} title="ズームアウト">－</button>
                  <button onClick={resetZoom} style={{ ...btnBase, width: 'auto', padding: '0 6px', fontSize: 9, color: zoom > 1 ? '#1a73e8' : '#94A3B8', background: zoom > 1 ? '#EFF6FF' : '#F8FAFC' }} title="リセット">
                    リセット
                  </button>
                  {zoom > 1 && <span style={{ fontSize: 9, color: '#94A3B8', alignSelf: 'center', marginLeft: 2 }}>×{zoom.toFixed(1)}</span>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '28px 28px 28px', gridTemplateRows: '28px 28px 28px', gap: 2, opacity: zoom > 1 ? 1 : 0.3 }}>
                  <span />
                  <button onClick={() => pan(0,  STEP)} style={btnBase} disabled={zoom <= 1} title="上">↑</button>
                  <span />
                  <button onClick={() => pan( STEP, 0)} style={btnBase} disabled={zoom <= 1} title="左">←</button>
                  <button onClick={resetZoom} style={{ ...btnBase, fontSize: 8, color: '#94A3B8' }} title="中央へ">●</button>
                  <button onClick={() => pan(-STEP, 0)} style={btnBase} disabled={zoom <= 1} title="右">→</button>
                  <span />
                  <button onClick={() => pan(0, -STEP)} style={btnBase} disabled={zoom <= 1} title="下">↓</button>
                  <span />
                </div>
              </div>
            )
          })()}
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

              {/* 左: ���レビューエリア */}
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
