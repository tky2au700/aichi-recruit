'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { RotateCcw } from 'lucide-react'

export interface ScatterItem {
  name: string
  income: number        // 推定年収（万円）
  age: number | null    // 平均年齢（歳）
  workers?: number | null // 労働者数（千人）
  rank: number
}

interface RankingBarRaceProps {
  data: ScatterItem[]
  title: string
  surveyYear: number | null
  unit?: string
  primaryColor?: string
}

const COLORS = [
  '#1a73e8', '#0F9D58', '#F4B400', '#DB4437', '#46BDC6',
  '#7B61FF', '#FF6D00', '#00796B', '#AD1457', '#1565C0',
  '#558B2F', '#6D4C41', '#00838F', '#283593', '#BF360C',
  '#37474F', '#880E4F', '#1B5E20', '#4A148C', '#E65100',
]

const ANIM_DURATION = 2200   // 全体アニメーション時間(ms)
const STAGGER      = 80      // アイテム間の遅延(ms)

function easeOutBack(t: number) {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

export function RankingBarRace({
  data,
  title,
  surveyYear,
  primaryColor = '#1a73e8',
}: RankingBarRaceProps) {
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const rafRef      = useRef<number>(0)
  const startRef    = useRef<number | null>(null)
  const [progress, setProgress] = useState(0)
  const [playing,  setPlaying]  = useState(false)
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const mouseRef = useRef<{ x: number; y: number } | null>(null)

  // データの有効アイテム（年齢あり）
  const items = data.filter(d => d.age != null && d.income > 0)

  // スケール計算
  const minAge    = Math.min(...items.map(d => d.age!)) - 3
  const maxAge    = Math.max(...items.map(d => d.age!)) + 3
  const minIncome = Math.max(0, Math.min(...items.map(d => d.income)) - 100)
  const maxIncome = Math.max(...items.map(d => d.income)) + 150
  const maxWorkers = Math.max(...items.map(d => d.workers ?? 1), 1)

  // バブル半径: 労働者数に基づく（min 8px, max 32px）
  function bubbleRadius(workers: number | null | undefined) {
    if (!workers || workers <= 0) return 10
    return 8 + (Math.sqrt(workers / maxWorkers)) * 26
  }

  // データ→Canvas座標変換（描画内部で使う）
  function toCanvasXY(
    age: number, income: number,
    padL: number, padR: number, padT: number, padB: number,
    W: number, H: number,
  ) {
    const x = padL + ((age - minAge) / (maxAge - minAge)) * (W - padL - padR)
    const y = H - padB - ((income - minIncome) / (maxIncome - minIncome)) * (H - padT - padB)
    return { x, y }
  }

  const draw = useCallback((prog: number, hovered: number | null) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const W   = canvas.width  / dpr
    const H   = canvas.height / dpr

    ctx.save()
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, W, H)

    const PAD_L = 62, PAD_R = 24, PAD_T = 20, PAD_B = 42

    // --- 背景 ---
    ctx.fillStyle = '#FAFBFC'
    ctx.fillRect(0, 0, W, H)

    // --- グリッド線 ---
    const gridColor = '#E2E8F0'

    // Y軸グリッド（年収）
    const ySteps = 5
    for (let i = 0; i <= ySteps; i++) {
      const income = minIncome + ((maxIncome - minIncome) * i) / ySteps
      const { y } = toCanvasXY(minAge, income, PAD_L, PAD_R, PAD_T, PAD_B, W, H)
      ctx.strokeStyle = gridColor
      ctx.lineWidth   = 1
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(PAD_L, y)
      ctx.lineTo(W - PAD_R, y)
      ctx.stroke()
      ctx.setLineDash([])

      ctx.fillStyle   = '#94A3B8'
      ctx.font        = `500 10px 'Noto Sans JP', sans-serif`
      ctx.textAlign   = 'right'
      ctx.textBaseline = 'middle'
      ctx.fillText(`${Math.round(income)}万`, PAD_L - 6, y)
    }

    // X軸グリッド（年齢）
    const ageRange  = maxAge - minAge
    const ageStep   = ageRange > 20 ? 5 : 2
    const ageStart  = Math.ceil(minAge / ageStep) * ageStep
    for (let a = ageStart; a <= maxAge; a += ageStep) {
      const { x } = toCanvasXY(a, minIncome, PAD_L, PAD_R, PAD_T, PAD_B, W, H)
      ctx.strokeStyle = gridColor
      ctx.lineWidth   = 1
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(x, PAD_T)
      ctx.lineTo(x, H - PAD_B)
      ctx.stroke()
      ctx.setLineDash([])

      ctx.fillStyle    = '#94A3B8'
      ctx.font         = `500 10px 'Noto Sans JP', sans-serif`
      ctx.textAlign    = 'center'
      ctx.textBaseline = 'top'
      ctx.fillText(`${a}歳`, x, H - PAD_B + 6)
    }

    // 軸ラベル
    ctx.save()
    ctx.translate(13, (H - PAD_T - PAD_B) / 2 + PAD_T)
    ctx.rotate(-Math.PI / 2)
    ctx.fillStyle    = '#64748B'
    ctx.font         = `600 11px 'Noto Sans JP', sans-serif`
    ctx.textAlign    = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('推定年収（万円）', 0, 0)
    ctx.restore()

    ctx.fillStyle    = '#64748B'
    ctx.font         = `600 11px 'Noto Sans JP', sans-serif`
    ctx.textAlign    = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillText('平均年齢（歳）', PAD_L + (W - PAD_L - PAD_R) / 2, H - 2)

    // --- 軸線 ---
    ctx.strokeStyle = '#CBD5E1'
    ctx.lineWidth   = 1.5
    ctx.setLineDash([])
    ctx.beginPath()
    ctx.moveTo(PAD_L, PAD_T)
    ctx.lineTo(PAD_L, H - PAD_B)
    ctx.lineTo(W - PAD_R, H - PAD_B)
    ctx.stroke()

    // --- バブル描画（アニメーション） ---
    const totalItems = items.length
    items.forEach((item, i) => {
      const delay   = (i / totalItems) * (ANIM_DURATION - 600)
      const elapsed = prog * ANIM_DURATION - delay
      const t       = Math.max(0, Math.min(1, elapsed / 600))
      const ease    = easeOutBack(t)
      if (t <= 0) return

      const { x, y } = toCanvasXY(item.age!, item.income, PAD_L, PAD_R, PAD_T, PAD_B, W, H)
      const r         = bubbleRadius(item.workers) * ease
      const color     = COLORS[i % COLORS.length]
      const isHovered = hovered === i
      const isTop3    = item.rank <= 3

      // 影（ホバー or TOP3）
      if (isHovered || isTop3) {
        ctx.shadowColor   = color + '60'
        ctx.shadowBlur    = isHovered ? 20 : 12
        ctx.shadowOffsetX = 0
        ctx.shadowOffsetY = isHovered ? 4 : 2
      }

      // バブル本体
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fillStyle = color + (isHovered ? 'FF' : 'CC')
      ctx.fill()

      // ハイライトリング
      if (isTop3 || isHovered) {
        ctx.strokeStyle = color
        ctx.lineWidth   = isHovered ? 2.5 : 1.5
        ctx.beginPath()
        ctx.arc(x, y, r + 3, 0, Math.PI * 2)
        ctx.stroke()
      }

      ctx.shadowColor   = 'transparent'
      ctx.shadowBlur    = 0

      // バブル内のランク番号
      const fontSize = Math.max(9, Math.min(r * 0.72, 15))
      ctx.font        = `700 ${fontSize}px 'Noto Sans JP', sans-serif`
      ctx.fillStyle   = '#fff'
      ctx.textAlign   = 'center'
      ctx.textBaseline = 'middle'
      if (r > 10) ctx.fillText(`${item.rank}`, x, y)

      // ラベル（ホバー時 or TOP5 かつアニメ完了後）
      const showLabel = isHovered || (isTop3 && t >= 0.9)
      if (showLabel && t > 0.5) {
        const label      = item.name.length > 12 ? item.name.slice(0, 12) + '…' : item.name
        const incomeLabel = `${Math.round(item.income).toLocaleString()}万円`
        const ageLabel   = `${item.age}歳`

        const boxW  = 140
        const boxH  = isHovered ? 58 : 38
        let   bx    = x + r + 8
        let   by    = y - boxH / 2

        // 右端に出るとき左に
        if (bx + boxW > W - PAD_R) bx = x - r - boxW - 8
        if (by < PAD_T) by = PAD_T
        if (by + boxH > H - PAD_B) by = H - PAD_B - boxH

        // 吹き出し背景
        ctx.fillStyle = 'rgba(15, 23, 42, 0.88)'
        const bRadius = 7
        ctx.beginPath()
        ctx.roundRect(bx, by, boxW, boxH, bRadius)
        ctx.fill()

        // テキスト
        ctx.fillStyle    = '#fff'
        ctx.font         = `600 11px 'Noto Sans JP', sans-serif`
        ctx.textAlign    = 'left'
        ctx.textBaseline = 'top'
        ctx.fillText(label, bx + 8, by + 8)

        ctx.fillStyle = '#93C5FD'
        ctx.font      = `700 12px 'Noto Sans JP', sans-serif`
        ctx.fillText(incomeLabel, bx + 8, by + 24)

        if (isHovered) {
          ctx.fillStyle = '#86EFAC'
          ctx.font      = `500 11px 'Noto Sans JP', sans-serif`
          ctx.fillText(`平均年齢 ${ageLabel}`, bx + 8, by + 40)
        }
      }
    })

    // ウォーターマーク
    if (surveyYear) {
      ctx.font        = `800 ${Math.round(H * 0.14)}px 'Noto Sans JP', sans-serif`
      ctx.fillStyle   = `${primaryColor}0D`
      ctx.textAlign   = 'right'
      ctx.textBaseline = 'bottom'
      ctx.fillText(`${surveyYear}年`, W - PAD_R, H - PAD_B - 4)
    }

    ctx.restore()
  }, [items, minAge, maxAge, minIncome, maxIncome, maxWorkers, primaryColor, surveyYear])

  // アニメーションループ
  const animate = useCallback((ts: number) => {
    if (startRef.current === null) startRef.current = ts
    const elapsed = ts - startRef.current
    const prog    = Math.min(elapsed / ANIM_DURATION, 1)
    setProgress(prog)
    draw(prog, mouseRef.current ? hoveredIdx : null)
    if (prog < 1) {
      rafRef.current = requestAnimationFrame(animate)
    } else {
      setPlaying(false)
    }
  }, [draw, hoveredIdx])

  const startAnimation = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    startRef.current = null
    setPlaying(true)
    rafRef.current = requestAnimationFrame(animate)
  }, [animate])

  const resetAndPlay = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    startRef.current = null
    setProgress(0)
    setPlaying(true)
    rafRef.current = requestAnimationFrame(animate)
  }, [animate])

  // データ変化時に自動再生
  useEffect(() => {
    if (items.length === 0) return
    startAnimation()
    return () => cancelAnimationFrame(rafRef.current)
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps

  // Canvas DPR対応リサイズ
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const container = canvas.parentElement
    if (!container) return
    const W = container.clientWidth
    const H = 380
    canvas.width  = W * dpr
    canvas.height = H * dpr
    canvas.style.width  = `${W}px`
    canvas.style.height = `${H}px`
    const ctx = canvas.getContext('2d')
    if (ctx) ctx.scale(dpr, dpr)
  }, [])

  // マウス追跡 → ホバー判定
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const dpr  = window.devicePixelRatio || 1
    const mx   = (e.clientX - rect.left)
    const my   = (e.clientY - rect.top)
    mouseRef.current = { x: mx, y: my }

    const W   = canvas.width  / dpr
    const H   = canvas.height / dpr
    const PAD_L = 62, PAD_R = 24, PAD_T = 20, PAD_B = 42

    let found: number | null = null
    items.forEach((item, i) => {
      if (item.age == null) return
      const { x, y } = toCanvasXY(item.age, item.income, PAD_L, PAD_R, PAD_T, PAD_B, W, H)
      const r = bubbleRadius(item.workers)
      const dist = Math.sqrt((mx - x) ** 2 + (my - y) ** 2)
      if (dist < r + 6) found = i
    })

    if (found !== hoveredIdx) {
      setHoveredIdx(found)
      draw(progress, found)
    }
  }, [items, progress, draw, hoveredIdx, minAge, maxAge, minIncome, maxIncome])

  const handleMouseLeave = useCallback(() => {
    mouseRef.current = null
    setHoveredIdx(null)
    draw(progress, null)
  }, [progress, draw])

  if (items.length === 0) return null

  return (
    <div style={{
      background: '#fff',
      borderRadius: 14,
      border: '1px solid #E2E8F0',
      overflow: 'hidden',
      boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
      marginBottom: 20,
    }}>
      {/* ヘッダー */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        borderBottom: '1px solid #F1F5F9',
        background: '#FAFBFC',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: playing ? '#22C55E' : '#CBD5E1',
            boxShadow: playing ? '0 0 0 3px rgba(34,197,94,0.2)' : 'none',
            transition: 'all 0.3s',
            flexShrink: 0,
          }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>
            推定年収 × 平均年齢　散布図
          </span>
          {surveyYear && (
            <span style={{
              fontSize: 11, color: '#94A3B8',
              background: '#F1F5F9', padding: '2px 8px', borderRadius: 20,
            }}>
              {surveyYear}年調査
            </span>
          )}
          <span style={{ fontSize: 11, color: '#CBD5E1' }}>
            ●のサイズ = 労働者数
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 72, height: 4, background: '#F1F5F9', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${progress * 100}%`,
              background: primaryColor,
              borderRadius: 4,
              transition: 'width 0.05s linear',
            }} />
          </div>
          <button
            onClick={resetAndPlay}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: 'none', border: '1px solid #E2E8F0',
              borderRadius: 7, padding: '4px 10px',
              fontSize: 11, fontWeight: 600, color: '#64748B',
              cursor: 'pointer',
            }}
            title="再生"
          >
            <RotateCcw size={12} />
            再生
          </button>
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
