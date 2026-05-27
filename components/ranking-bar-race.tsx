'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Play, Pause, RotateCcw } from 'lucide-react'

interface BarItem {
  name: string
  value: number
  color: string
}

interface RankingBarRaceProps {
  data: BarItem[]          // 現在の年のTOP10
  title: string
  surveyYear: number | null
  unit?: string            // 例: '万円'
  primaryColor?: string
}

const COLORS = [
  '#1a73e8', '#0F9D58', '#F4B400', '#DB4437', '#46BDC6',
  '#7B61FF', '#FF6D00', '#00796B', '#AD1457', '#1565C0',
]

const FPS = 60
const DURATION_MS = 1800  // アニメーション全体の時間
const BAR_COUNT = 10      // 表示するバーの数

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3)
}

export function RankingBarRace({ data, title, surveyYear, unit = '万円', primaryColor = '#1a73e8' }: RankingBarRaceProps) {
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const rafRef      = useRef<number>(0)
  const startRef    = useRef<number | null>(null)
  const [playing, setPlaying]   = useState(false)
  const [progress, setProgress] = useState(0) // 0〜1
  const [ready, setReady]       = useState(false)

  // TOP10に絞り、色を割り当て
  const items: BarItem[] = data
    .slice(0, BAR_COUNT)
    .map((d, i) => ({ ...d, color: COLORS[i % COLORS.length] }))

  const maxVal = Math.max(...items.map(d => d.value), 1)

  // Canvas描画
  const draw = useCallback((prog: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height
    const dpr = window.devicePixelRatio || 1

    ctx.clearRect(0, 0, W, H)

    const PADDING_LEFT  = Math.round(W * 0.28)
    const PADDING_RIGHT = Math.round(W * 0.12)
    const PADDING_TOP   = 18 * dpr
    const BAR_AREA_H    = H - PADDING_TOP - 10 * dpr
    const BAR_H         = Math.floor(BAR_AREA_H / BAR_COUNT)
    const GAP           = Math.floor(BAR_H * 0.25)
    const BAR_REAL_H    = BAR_H - GAP
    const MAX_BAR_W     = W - PADDING_LEFT - PADDING_RIGHT

    const ease = easeOutCubic(prog)

    items.forEach((item, i) => {
      const y      = PADDING_TOP + i * BAR_H
      const barW   = Math.round(MAX_BAR_W * (item.value / maxVal) * ease)
      const radius = Math.round(BAR_REAL_H * 0.25)

      // バー本体
      ctx.beginPath()
      ctx.roundRect(PADDING_LEFT, y, Math.max(barW, radius * 2), BAR_REAL_H, [0, radius, radius, 0])
      ctx.fillStyle = item.color + (i === 0 ? 'FF' : 'DD')
      ctx.fill()

      // バーのハイライト（上部グラデーション）
      const grad = ctx.createLinearGradient(PADDING_LEFT, y, PADDING_LEFT, y + BAR_REAL_H)
      grad.addColorStop(0, 'rgba(255,255,255,0.18)')
      grad.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.beginPath()
      ctx.roundRect(PADDING_LEFT, y, Math.max(barW, radius * 2), BAR_REAL_H, [0, radius, radius, 0])
      ctx.fillStyle = grad
      ctx.fill()

      // ランク番号
      const fontSize = Math.round(BAR_REAL_H * 0.52)
      ctx.font        = `700 ${fontSize}px 'Noto Sans JP', sans-serif`
      ctx.fillStyle   = '#64748B'
      ctx.textAlign   = 'right'
      ctx.textBaseline = 'middle'
      const rankStr = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`
      if (i < 3) {
        ctx.font = `${fontSize}px sans-serif`
        ctx.fillText(rankStr, PADDING_LEFT - 8 * dpr, y + BAR_REAL_H / 2)
      } else {
        ctx.font = `600 ${fontSize}px 'Noto Sans JP', sans-serif`
        ctx.fillText(rankStr, PADDING_LEFT - 8 * dpr, y + BAR_REAL_H / 2)
      }

      // 職種名（バーの左側）
      const nameSize = Math.round(BAR_REAL_H * 0.44)
      ctx.font        = `500 ${nameSize}px 'Noto Sans JP', sans-serif`
      ctx.fillStyle   = '#1E293B'
      ctx.textAlign   = 'right'
      ctx.textBaseline = 'middle'
      // 長い名前は省略
      const maxNameW  = PADDING_LEFT - 36 * dpr
      let name        = item.name
      while (ctx.measureText(name).width > maxNameW && name.length > 2) {
        name = name.slice(0, -1)
      }
      if (name !== item.name) name += '…'
      ctx.fillText(name, PADDING_LEFT - 36 * dpr, y + BAR_REAL_H / 2)

      // 数値（バーの右端）
      if (prog > 0.15 && barW > 30) {
        const valSize = Math.round(BAR_REAL_H * 0.48)
        ctx.font        = `700 ${valSize}px 'Noto Sans JP', sans-serif`
        ctx.fillStyle   = item.color
        ctx.textAlign   = 'left'
        ctx.textBaseline = 'middle'
        const valLabel  = `${Math.round(item.value).toLocaleString()}${unit}`
        ctx.fillText(valLabel, PADDING_LEFT + barW + 8 * dpr, y + BAR_REAL_H / 2)
      }
    })

    // 年ウォーターマーク
    if (surveyYear) {
      ctx.font        = `800 ${Math.round(H * 0.13)}px 'Noto Sans JP', sans-serif`
      ctx.fillStyle   = `${primaryColor}12`
      ctx.textAlign   = 'right'
      ctx.textBaseline = 'bottom'
      ctx.fillText(`${surveyYear}年`, W - 8 * dpr, H - 4 * dpr)
    }
  }, [items, maxVal, surveyYear, unit, primaryColor])

  // アニメーションループ
  const animate = useCallback((ts: number) => {
    if (startRef.current === null) startRef.current = ts
    const elapsed = ts - startRef.current
    const prog = Math.min(elapsed / DURATION_MS, 1)
    setProgress(prog)
    draw(prog)
    if (prog < 1) {
      rafRef.current = requestAnimationFrame(animate)
    } else {
      setPlaying(false)
    }
  }, [draw])

  const startAnimation = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    startRef.current = null
    setPlaying(true)
    rafRef.current = requestAnimationFrame(animate)
  }, [animate])

  const resetAnimation = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    startRef.current = null
    setPlaying(false)
    setProgress(0)
    draw(0)
  }, [draw])

  // データ変化時に自動再生
  useEffect(() => {
    if (items.length === 0) return
    setReady(true)
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
    const H = Math.round(BAR_COUNT * 44 + 28)
    canvas.width  = W * dpr
    canvas.height = H * dpr
    canvas.style.width  = `${W}px`
    canvas.style.height = `${H}px`
    const ctx = canvas.getContext('2d')
    if (ctx) ctx.scale(dpr, dpr)
    setReady(true)
  }, [])

  const togglePlay = () => {
    if (playing) {
      cancelAnimationFrame(rafRef.current)
      setPlaying(false)
    } else if (progress >= 1) {
      startAnimation()
    } else {
      rafRef.current = requestAnimationFrame(animate)
      setPlaying(true)
    }
  }

  if (items.length === 0) return null

  return (
    <div style={{
      background: '#fff',
      borderRadius: 14,
      border: '1px solid #E2E8F0',
      overflow: 'hidden',
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      marginBottom: 20,
    }}>
      {/* ヘッダー */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 18px',
        borderBottom: '1px solid #F1F5F9',
        background: '#FAFBFC',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: playing ? '#22C55E' : '#CBD5E1',
            boxShadow: playing ? '0 0 0 3px rgba(34,197,94,0.2)' : 'none',
            transition: 'all 0.3s',
          }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>
            {title} TOP{BAR_COUNT}　インフォグラフィック
          </span>
          {surveyYear && (
            <span style={{ fontSize: 11, color: '#94A3B8', background: '#F1F5F9', padding: '2px 8px', borderRadius: 20 }}>
              {surveyYear}年調査
            </span>
          )}
        </div>
        {/* コントロール */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* プログレスバー */}
          <div style={{ width: 80, height: 4, background: '#F1F5F9', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${progress * 100}%`,
              background: primaryColor,
              borderRadius: 4,
              transition: 'width 0.05s linear',
            }} />
          </div>
          <button
            onClick={resetAnimation}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 4, display: 'flex', alignItems: 'center' }}
            title="リセット"
          >
            <RotateCcw size={14} />
          </button>
          <button
            onClick={togglePlay}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: primaryColor, color: '#fff',
              border: 'none', borderRadius: 7,
              padding: '5px 12px', fontSize: 12, fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {playing ? <Pause size={13} /> : <Play size={13} />}
            {playing ? '停止' : progress >= 1 ? '再生' : '再生'}
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div style={{ padding: '16px 20px 12px', background: '#fff' }}>
        <canvas
          ref={canvasRef}
          style={{ display: 'block', width: '100%' }}
        />
      </div>

      {/* 出典 */}
      <div style={{ padding: '6px 18px 10px', fontSize: 10, color: '#CBD5E1', textAlign: 'right' }}>
        出典: 厚生労働省 賃金構造基本統計調査
      </div>
    </div>
  )
}
