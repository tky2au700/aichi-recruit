'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Play, Pause, RotateCcw } from 'lucide-react'

interface BarItem {
  name: string
  value: number
  color?: string
}

interface RankingBarRaceProps {
  data: BarItem[]
  title: string
  surveyYear: number | null
  unit?: string
  primaryColor?: string
}

// 各バーに固有カラーを割り当て
const PALETTE = [
  '#1a73e8', // 1位: ブルー
  '#0F9D58', // 2位: グリーン
  '#F4B400', // 3位: アンバー
  '#DB4437', // 4位: レッド
  '#46BDC6', // 5位: ティール
  '#7B61FF', // 6位: パープル
  '#FF6D00', // 7位: オレンジ
  '#00796B', // 8位: ダークティール
  '#AD1457', // 9位: ピンク
  '#1565C0', // 10位: ダークブルー
]

const BAR_COUNT   = 10
const TOTAL_MS    = 2400   // 全体アニメーション時間
const STAGGER_MAX = 600    // 最後のバーが始まるオフセット
const LOOP_PAUSE  = 2000   // ループ前の静止時間 (ms)

function easeOutExpo(t: number) {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
}
function easeOutBack(t: number) {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

// 数値を省略表示
function fmtVal(v: number, unit: string) {
  return `${Math.round(v).toLocaleString()}${unit}`
}

export function RankingBarRace({
  data,
  title,
  surveyYear,
  unit = '万円',
  primaryColor = '#1a73e8',
}: RankingBarRaceProps) {
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const rafRef       = useRef<number>(0)
  const startRef     = useRef<number | null>(null)
  const pauseRef     = useRef<number | null>(null) // ループ一時停止開始時刻
  const [progress, setProgress] = useState(0)
  const [playing, setPlaying]   = useState(false)

  const items = data
    .slice(0, BAR_COUNT)
    .map((d, i) => ({ ...d, color: PALETTE[i % PALETTE.length] }))
  const maxVal = Math.max(...items.map(d => d.value), 1)

  // ───────────── Canvas描画 ─────────────
  const draw = useCallback((globalProg: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr  = window.devicePixelRatio || 1
    const CW   = canvas.width  / dpr  // CSS px
    const CH   = canvas.height / dpr

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.save()
    ctx.scale(dpr, dpr)

    // --- レイアウト定数 ---
    const PAD_LEFT   = Math.round(CW * 0.30)
    const PAD_RIGHT  = Math.round(CW * 0.14)
    const PAD_TOP    = 14
    const PAD_BOTTOM = 24
    const CHART_H    = CH - PAD_TOP - PAD_BOTTOM
    const BAR_SLOT   = CHART_H / BAR_COUNT
    const BAR_H      = Math.floor(BAR_SLOT * 0.72)
    const BAR_GAP    = BAR_SLOT - BAR_H
    const MAX_BAR_W  = CW - PAD_LEFT - PAD_RIGHT
    const GRID_STEPS = 5

    // --- 背景グリッド ---
    ctx.strokeStyle = '#F1F5F9'
    ctx.lineWidth   = 1
    for (let g = 0; g <= GRID_STEPS; g++) {
      const x = PAD_LEFT + MAX_BAR_W * (g / GRID_STEPS)
      ctx.beginPath()
      ctx.moveTo(x, PAD_TOP - 4)
      ctx.lineTo(x, CH - PAD_BOTTOM + 4)
      ctx.stroke()
      // 軸ラベル
      ctx.font         = `400 10px 'Noto Sans JP', sans-serif`
      ctx.fillStyle    = '#CBD5E1'
      ctx.textAlign    = 'center'
      ctx.textBaseline = 'bottom'
      ctx.fillText(fmtVal(maxVal * g / GRID_STEPS, unit), x, CH - PAD_BOTTOM + 14)
    }

    // --- 各バー描画 ---
    items.forEach((item, i) => {
      // このバーの個別進捗 (stagger)
      const staggerOffset = (i / Math.max(items.length - 1, 1)) * STAGGER_MAX
      const barStart      = staggerOffset / TOTAL_MS
      const barDuration   = (TOTAL_MS - staggerOffset) / TOTAL_MS
      const rawProg       = Math.max(0, (globalProg - barStart) / barDuration)
      const barProg       = Math.min(rawProg, 1)

      const ease   = easeOutExpo(barProg)
      const barW   = Math.round(MAX_BAR_W * (item.value / maxVal) * ease)
      const radius = Math.round(BAR_H * 0.28)
      const x      = PAD_LEFT
      const y      = PAD_TOP + i * BAR_SLOT + BAR_GAP / 2

      if (barProg === 0) return

      // バー本体
      ctx.beginPath()
      const r = Math.min(radius, barW / 2)
      ctx.moveTo(x, y)
      ctx.lineTo(x + barW - r, y)
      ctx.quadraticCurveTo(x + barW, y, x + barW, y + r)
      ctx.lineTo(x + barW, y + BAR_H - r)
      ctx.quadraticCurveTo(x + barW, y + BAR_H, x + barW - r, y + BAR_H)
      ctx.lineTo(x, y + BAR_H)
      ctx.closePath()
      ctx.fillStyle = item.color
      ctx.fill()

      // 1位は光沢オーバーレイ
      if (i === 0) {
        const glow = ctx.createLinearGradient(x, y, x + barW, y)
        glow.addColorStop(0, 'rgba(255,255,255,0.22)')
        glow.addColorStop(0.6, 'rgba(255,255,255,0.06)')
        glow.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x + barW - r, y)
        ctx.quadraticCurveTo(x + barW, y, x + barW, y + r)
        ctx.lineTo(x + barW, y + BAR_H - r)
        ctx.quadraticCurveTo(x + barW, y + BAR_H, x + barW - r, y + BAR_H)
        ctx.lineTo(x, y + BAR_H)
        ctx.closePath()
        ctx.fillStyle = glow
        ctx.fill()
      }

      // 上部ハイライト（全バー共通）
      const hi = ctx.createLinearGradient(x, y, x, y + BAR_H * 0.5)
      hi.addColorStop(0, 'rgba(255,255,255,0.18)')
      hi.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + barW - r, y)
      ctx.quadraticCurveTo(x + barW, y, x + barW, y + r)
      ctx.lineTo(x + barW, y + BAR_H * 0.5)
      ctx.lineTo(x, y + BAR_H * 0.5)
      ctx.closePath()
      ctx.fillStyle = hi
      ctx.fill()

      // --- ランク番号 ---
      const rankFontSize = Math.round(BAR_H * 0.52)
      ctx.font         = `700 ${rankFontSize}px 'Noto Sans JP', sans-serif`
      ctx.fillStyle    = i === 0 ? '#F59E0B' : i === 1 ? '#94A3B8' : i === 2 ? '#CD7F32' : '#94A3B8'
      ctx.textAlign    = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(`${i + 1}`, PAD_LEFT - 26, y + BAR_H / 2)

      // --- 職種名（左側） ---
      const nameFontSize = Math.round(BAR_H * 0.42)
      ctx.font         = `500 ${nameFontSize}px 'Noto Sans JP', sans-serif`
      ctx.fillStyle    = '#1E293B'
      ctx.textAlign    = 'right'
      ctx.textBaseline = 'middle'
      const maxNameW   = PAD_LEFT - 44
      let   name       = item.name
      while (name.length > 2 && ctx.measureText(name).width > maxNameW) {
        name = name.slice(0, -1)
      }
      if (name !== item.name) name += '…'
      ctx.fillText(name, PAD_LEFT - 42, y + BAR_H / 2)

      // --- 数値（バー右端・カウントアップ） ---
      if (barProg > 0.05 && barW > 20) {
        const currentVal = item.value * ease
        const valFontSize = Math.round(BAR_H * 0.48)
        ctx.font         = `700 ${valFontSize}px 'Noto Sans JP', sans-serif`
        ctx.fillStyle    = item.color
        ctx.textAlign    = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(fmtVal(currentVal, unit), x + barW + 8, y + BAR_H / 2)
      }
    })

    // --- 年ウォーターマーク ---
    if (surveyYear) {
      ctx.font         = `800 ${Math.round(CH * 0.16)}px 'Noto Sans JP', sans-serif`
      ctx.fillStyle    = `${primaryColor}0D`
      ctx.textAlign    = 'right'
      ctx.textBaseline = 'bottom'
      ctx.fillText(`${surveyYear}年`, CW - 6, CH - 2)
    }

    ctx.restore()
  }, [items, maxVal, surveyYear, unit, primaryColor])

  // ───────────── アニメーションループ ─────────────
  const runLoop = useCallback((ts: number) => {
    // ループ一時停止中
    if (pauseRef.current !== null) {
      const elapsed = ts - pauseRef.current
      if (elapsed < LOOP_PAUSE) {
        rafRef.current = requestAnimationFrame(runLoop)
        return
      }
      pauseRef.current = null
      startRef.current = ts // リセット
    }

    if (startRef.current === null) startRef.current = ts
    const elapsed = ts - startRef.current
    const prog = elapsed / TOTAL_MS

    if (prog >= 1) {
      draw(1)
      setProgress(1)
      // 一時停止してからループ
      pauseRef.current = ts
      rafRef.current = requestAnimationFrame(runLoop)
      return
    }

    draw(prog)
    setProgress(prog)
    rafRef.current = requestAnimationFrame(runLoop)
  }, [draw])

  const startPlay = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    startRef.current  = null
    pauseRef.current  = null
    setPlaying(true)
    rafRef.current = requestAnimationFrame(runLoop)
  }, [runLoop])

  const stopPlay = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    setPlaying(false)
  }, [])

  const resetPlay = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    startRef.current  = null
    pauseRef.current  = null
    setProgress(0)
    setPlaying(false)
    draw(0)
  }, [draw])

  // データ変化 → 自動再生
  useEffect(() => {
    if (items.length === 0) return
    startPlay()
    return () => cancelAnimationFrame(rafRef.current)
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps

  // DPR対応リサイズ
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const W   = canvas.parentElement?.clientWidth ?? 600
      const H   = BAR_COUNT * 46 + 38
      canvas.width         = W * dpr
      canvas.height        = H * dpr
      canvas.style.width   = `${W}px`
      canvas.style.height  = `${H}px`
    }
    resize()
    const ro = new ResizeObserver(resize)
    if (canvas.parentElement) ro.observe(canvas.parentElement)
    return () => ro.disconnect()
  }, [])

  if (items.length === 0) return null

  const looping = pauseRef.current !== null || playing

  return (
    <div style={{
      background: 'linear-gradient(135deg, #ffffff 0%, #F8FAFC 100%)',
      borderRadius: 16,
      border: '1px solid #E2E8F0',
      overflow: 'hidden',
      boxShadow: '0 4px 24px rgba(0,0,0,0.07), 0 1px 4px rgba(0,0,0,0.04)',
      marginTop: 20,
      marginBottom: 4,
    }}>
      {/* ヘッダーバー */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        background: 'rgba(255,255,255,0.8)',
        borderBottom: '1px solid #F1F5F9',
        backdropFilter: 'blur(8px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* 再生インジケーター */}
          <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
            {[0, 1, 2].map(j => (
              <div key={j} style={{
                width: 3,
                height: playing ? [10, 14, 8][j] : 5,
                borderRadius: 2,
                background: playing ? primaryColor : '#CBD5E1',
                transition: `height ${0.3 + j * 0.1}s ease`,
              }} />
            ))}
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#334155', letterSpacing: '-0.01em' }}>
            {title} TOP{items.length}
          </span>
          {surveyYear && (
            <span style={{
              fontSize: 11, color: '#fff',
              background: primaryColor,
              padding: '1px 8px', borderRadius: 20, fontWeight: 600,
            }}>
              {surveyYear}年
            </span>
          )}
          <span style={{ fontSize: 10, color: '#94A3B8' }}>インフォグラフィック</span>
        </div>

        {/* コントロール */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* プログレスバー */}
          <div style={{
            width: 64, height: 3,
            background: '#E2E8F0',
            borderRadius: 4,
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${Math.min(progress, 1) * 100}%`,
              background: `linear-gradient(90deg, ${primaryColor}, ${primaryColor}BB)`,
              borderRadius: 4,
              transition: 'width 0.08s linear',
            }} />
          </div>

          <button
            onClick={resetPlay}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#94A3B8', padding: '3px 5px', borderRadius: 6,
              display: 'flex', alignItems: 'center',
              transition: 'color 0.15s',
            }}
            title="最初から"
          >
            <RotateCcw size={13} />
          </button>

          <button
            onClick={playing ? stopPlay : startPlay}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: playing ? '#F1F5F9' : primaryColor,
              color: playing ? '#475569' : '#fff',
              border: 'none', borderRadius: 8,
              padding: '5px 12px',
              fontSize: 11, fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s',
              boxShadow: playing ? 'none' : `0 2px 8px ${primaryColor}44`,
            }}
          >
            {playing
              ? <><Pause size={12} />停止</>
              : <><Play  size={12} />再生</>
            }
          </button>
        </div>
      </div>

      {/* Canvas エリア */}
      <div style={{ padding: '14px 18px 10px', background: 'transparent' }}>
        <canvas ref={canvasRef} style={{ display: 'block', width: '100%' }} />
      </div>

      {/* フッター */}
      <div style={{
        padding: '6px 16px 8px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 10, color: '#CBD5E1' }}>
          自動ループ再生中
        </span>
        <span style={{ fontSize: 10, color: '#CBD5E1' }}>
          出典: 厚生労働省 賃金構造基本統計調査
        </span>
      </div>
    </div>
  )
}
