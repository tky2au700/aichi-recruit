'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Play, Pause, RotateCcw, ChevronUp } from 'lucide-react'

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

// ─── カラーパレット（最大30件分） ───────────────────────────────
const PALETTE = [
  '#F59E0B','#1a73e8','#0F9D58','#DB4437','#46BDC6',
  '#7B61FF','#FF6D00','#00796B','#AD1457','#1565C0',
  '#E91E63','#009688','#FF5722','#607D8B','#795548',
  '#3F51B5','#8BC34A','#FF9800','#9C27B0','#00BCD4',
  '#F44336','#4CAF50','#2196F3','#FFC107','#673AB7',
  '#03A9F4','#CDDC39','#FF4081','#00E5FF','#69F0AE',
]

function easeOutCubic(t: number) { return 1 - Math.pow(1 - t, 3) }
function easeOutBack(t: number) {
  const c1 = 1.70158, c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

function fmtVal(v: number, unit: string) {
  return `${Math.round(v).toLocaleString()}${unit}`
}

// ─── 1アイテムあたりの演出時間 ─────────────────────────────────
const ITEM_DURATION = 420  // ms（各アイテムの登場時間）
const ITEM_PAUSE    = 100  // ms（アイテム間のポーズ）

export function RankingBarRace({
  data,
  title,
  surveyYear,
  unit = '万円',
  primaryColor = '#1a73e8',
}: RankingBarRaceProps) {
  const canvasRef      = useRef<HTMLCanvasElement>(null)
  const rafRef         = useRef<number>(0)
  const startRef       = useRef<number | null>(null)
  const [revealedCount, setRevealedCount] = useState(0)
  const [playing, setPlaying]   = useState(false)
  const [finished, setFinished] = useState(false)

  // 全件を逆順（最下位→1位）で並べて使う
  const allItems = data.map((d, i) => ({
    ...d,
    color: PALETTE[i % PALETTE.length],
    rank: i + 1,
  }))
  const reversed = [...allItems].reverse() // 最下位から

  const maxVal = Math.max(...allItems.map(d => d.value), 1)

  // ─── 描画 ────────────────────────────────────────────────────
  const draw = useCallback((revealed: number, currentItemProg: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const CW  = canvas.width  / dpr
    const CH  = canvas.height / dpr
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.save()
    ctx.scale(dpr, dpr)

    const TOTAL   = allItems.length
    const PAD_L   = Math.round(CW * 0.31)
    const PAD_R   = Math.round(CW * 0.13)
    const PAD_T   = 14
    const PAD_B   = 20
    const CHART_H = CH - PAD_T - PAD_B
    const BAR_SLOT = CHART_H / TOTAL
    const BAR_H    = Math.floor(BAR_SLOT * 0.72)
    const BAR_GAP  = BAR_SLOT - BAR_H
    const MAX_W    = CW - PAD_L - PAD_R

    // 背景グリッド
    ctx.strokeStyle = '#F1F5F9'
    ctx.lineWidth   = 1
    for (let g = 0; g <= 5; g++) {
      const x = PAD_L + MAX_W * (g / 5)
      ctx.beginPath()
      ctx.moveTo(x, PAD_T - 4)
      ctx.lineTo(x, CH - PAD_B + 4)
      ctx.stroke()
      ctx.font         = `400 10px sans-serif`
      ctx.fillStyle    = '#CBD5E1'
      ctx.textAlign    = 'center'
      ctx.textBaseline = 'bottom'
      ctx.fillText(fmtVal(maxVal * g / 5, unit), x, CH - PAD_B + 14)
    }

    // 確定済みアイテム（今表示されているすべて）
    // 描画順は1位が上（index=0）→ TOTAL-1位が下（index=TOTAL-1）
    allItems.forEach((item, displayIdx) => {
      // この item は逆順でいつ登場したか
      const revealIdx = TOTAL - 1 - displayIdx // 最下位が revealIdx=0
      const isRevealed  = revealIdx < revealed
      const isCurrent   = revealIdx === revealed

      let barProg = 0
      if (isRevealed)  barProg = 1
      if (isCurrent)   barProg = easeOutBack(Math.min(currentItemProg * 1.2, 1))

      if (barProg <= 0) return

      const barW   = Math.max(4, Math.round(MAX_W * (item.value / maxVal) * easeOutCubic(Math.min(barProg, 1))))
      const radius = Math.min(Math.round(BAR_H * 0.30), barW / 2)
      const x      = PAD_L
      const y      = PAD_T + displayIdx * BAR_SLOT + BAR_GAP / 2

      // スライドイン（右から、isCurrent時のみ）
      const slideOffset = isCurrent ? (1 - easeOutCubic(currentItemProg)) * 30 : 0

      ctx.save()
      ctx.translate(slideOffset, 0)

      // バー
      ctx.beginPath()
      const r = Math.min(radius, barW / 2)
      ctx.moveTo(x, y)
      ctx.lineTo(x + barW - r, y)
      ctx.quadraticCurveTo(x + barW, y, x + barW, y + r)
      ctx.lineTo(x + barW, y + BAR_H - r)
      ctx.quadraticCurveTo(x + barW, y + BAR_H, x + barW - r, y + BAR_H)
      ctx.lineTo(x, y + BAR_H)
      ctx.closePath()

      // 1位は金グラデ
      if (item.rank === 1) {
        const grad = ctx.createLinearGradient(x, y, x + barW, y)
        grad.addColorStop(0, '#F59E0B')
        grad.addColorStop(0.5, '#FBBF24')
        grad.addColorStop(1, '#D97706')
        ctx.fillStyle = isCurrent ? grad : '#F59E0B'
      } else {
        ctx.fillStyle = item.color
      }
      ctx.fill()

      // 光沢
      const hi = ctx.createLinearGradient(x, y, x, y + BAR_H)
      hi.addColorStop(0, 'rgba(255,255,255,0.25)')
      hi.addColorStop(0.5, 'rgba(255,255,255,0.05)')
      hi.addColorStop(1, 'rgba(0,0,0,0.05)')
      ctx.beginPath()
      ctx.moveTo(x, y); ctx.lineTo(x + barW - r, y)
      ctx.quadraticCurveTo(x + barW, y, x + barW, y + r)
      ctx.lineTo(x + barW, y + BAR_H - r)
      ctx.quadraticCurveTo(x + barW, y + BAR_H, x + barW - r, y + BAR_H)
      ctx.lineTo(x, y + BAR_H); ctx.closePath()
      ctx.fillStyle = hi; ctx.fill()

      // ランク番号
      const rankFs = Math.round(BAR_H * 0.50)
      ctx.font      = `800 ${rankFs}px sans-serif`
      ctx.fillStyle = item.rank === 1 ? '#F59E0B' : item.rank === 2 ? '#94A3B8' : item.rank === 3 ? '#CD7F32' : '#94A3B8'
      ctx.textAlign    = 'right'
      ctx.textBaseline = 'middle'
      ctx.fillText(`${item.rank}`, PAD_L - 26, y + BAR_H / 2)

      // 職種名
      const nameFs = Math.round(BAR_H * 0.40)
      ctx.font      = `500 ${nameFs}px sans-serif`
      ctx.fillStyle = isCurrent ? '#0F172A' : '#334155'
      ctx.textAlign    = 'right'
      ctx.textBaseline = 'middle'
      const maxNameW = PAD_L - 44
      let name = item.name
      while (name.length > 2 && ctx.measureText(name).width > maxNameW) {
        name = name.slice(0, -1)
      }
      if (name !== item.name) name += '…'
      ctx.fillText(name, PAD_L - 42, y + BAR_H / 2)

      // 数値
      if (barW > 24) {
        const currentVal = item.value * easeOutCubic(Math.min(barProg, 1))
        const valFs = Math.round(BAR_H * 0.44)
        ctx.font      = `700 ${valFs}px sans-serif`
        ctx.fillStyle = item.rank === 1 ? '#92400E' : item.color
        ctx.textAlign    = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(fmtVal(currentVal, unit), x + barW + 8, y + BAR_H / 2)
      }

      ctx.restore()

      // 現在登場中アイテムのフラッシュ強調
      if (isCurrent && currentItemProg < 0.4) {
        const flashAlpha = (1 - currentItemProg / 0.4) * 0.18
        ctx.save()
        ctx.translate(slideOffset, 0)
        ctx.beginPath()
        ctx.moveTo(x, y); ctx.lineTo(x + barW - r, y)
        ctx.quadraticCurveTo(x + barW, y, x + barW, y + r)
        ctx.lineTo(x + barW, y + BAR_H - r)
        ctx.quadraticCurveTo(x + barW, y + BAR_H, x + barW - r, y + BAR_H)
        ctx.lineTo(x, y + BAR_H); ctx.closePath()
        ctx.fillStyle = `rgba(255,255,255,${flashAlpha})`
        ctx.fill()
        ctx.restore()
      }
    })

    // 年ウォーターマーク
    if (surveyYear) {
      ctx.font      = `800 ${Math.round(CW * 0.08)}px sans-serif`
      ctx.fillStyle = `${primaryColor}10`
      ctx.textAlign    = 'right'
      ctx.textBaseline = 'bottom'
      ctx.fillText(`${surveyYear}年`, CW - 4, CH - 2)
    }

    ctx.restore()
  }, [allItems, maxVal, surveyYear, unit, primaryColor])

  // ─── アニメーションループ ─────────────────────────────────────
  const runLoop = useCallback((ts: number) => {
    if (startRef.current === null) startRef.current = ts
    const elapsed = ts - startRef.current

    const totalStep = ITEM_DURATION + ITEM_PAUSE
    const currentIdx = Math.floor(elapsed / totalStep) // 何番目のアイテムを表示中か
    const itemElapsed = elapsed - currentIdx * totalStep
    const itemProg    = Math.min(itemElapsed / ITEM_DURATION, 1)

    if (currentIdx >= reversed.length) {
      draw(reversed.length, 1)
      setRevealedCount(reversed.length)
      setPlaying(false)
      setFinished(true)
      return
    }

    draw(currentIdx, itemProg)
    setRevealedCount(currentIdx)
    rafRef.current = requestAnimationFrame(runLoop)
  }, [draw, reversed.length])

  const startPlay = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    startRef.current = null
    setRevealedCount(0)
    setFinished(false)
    setPlaying(true)
    rafRef.current = requestAnimationFrame(runLoop)
  }, [runLoop])

  const stopPlay = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    setPlaying(false)
  }, [])

  // データ変化 → 自動再生
  useEffect(() => {
    if (allItems.length === 0) return
    const timer = setTimeout(() => startPlay(), 300)
    return () => {
      clearTimeout(timer)
      cancelAnimationFrame(rafRef.current)
    }
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps

  // Canvas サイズ設定
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = () => {
      const dpr  = window.devicePixelRatio || 1
      const W    = canvas.parentElement?.clientWidth ?? 640
      const rows = allItems.length
      // 1行あたり最低20px、最大36px
      const rowH = Math.max(20, Math.min(36, Math.floor(480 / rows)))
      const H    = rows * rowH + 34
      canvas.width         = W * dpr
      canvas.height        = H * dpr
      canvas.style.width   = `${W}px`
      canvas.style.height  = `${H}px`
    }
    resize()
    const ro = new ResizeObserver(resize)
    if (canvas.parentElement) ro.observe(canvas.parentElement)
    return () => ro.disconnect()
  }, [allItems.length])

  if (allItems.length === 0) return null

  // 現在フィーチャー中のアイテム（最下位側から数えて revealedCount番目 → 元データの末尾から）
  const currentItem = reversed[revealedCount] ?? null

  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: 16,
      border: '1px solid #E2E8F0',
      overflow: 'hidden',
      boxShadow: '0 8px 32px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)',
      marginTop: 20,
    }}>
      {/* ヘッダー */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px',
        background: `linear-gradient(135deg, ${primaryColor}F5 0%, ${primaryColor}CC 100%)`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* 音波アニメ */}
          <div style={{ display: 'flex', gap: 2.5, alignItems: 'flex-end', height: 16 }}>
            {[8, 14, 11, 16, 9, 13, 7].map((h, j) => (
              <div
                key={j}
                style={{
                  width: 2.5,
                  height: playing ? h : 4,
                  background: 'rgba(255,255,255,0.85)',
                  borderRadius: 2,
                  transition: `height ${0.25 + j * 0.07}s ease-in-out`,
                  animation: playing ? `none` : 'none',
                }}
              />
            ))}
          </div>
          <span style={{ color: '#fff', fontWeight: 800, fontSize: 13, letterSpacing: '-0.01em' }}>
            {title}
          </span>
          {surveyYear && (
            <span style={{
              background: 'rgba(255,255,255,0.25)', color: '#fff',
              padding: '1px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700,
            }}>
              {surveyYear}年 全{allItems.length}件
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* 現在登場中アイテム表示 */}
          {playing && currentItem && (
            <div style={{
              background: 'rgba(255,255,255,0.2)',
              borderRadius: 8,
              padding: '3px 10px',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{
                background: 'rgba(255,255,255,0.9)',
                color: primaryColor,
                fontWeight: 800, fontSize: 11,
                padding: '0px 6px', borderRadius: 4,
              }}>
                {currentItem.rank}位
              </span>
              <span style={{ color: '#fff', fontSize: 11, fontWeight: 600, maxWidth: 120, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                {currentItem.name}
              </span>
            </div>
          )}
          {finished && (
            <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11 }}>完成</span>
          )}

          <button
            onClick={startPlay}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: 'rgba(255,255,255,0.9)',
              color: primaryColor,
              border: 'none', borderRadius: 8,
              padding: '5px 12px',
              fontSize: 11, fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            <RotateCcw size={11} />
            最初から
          </button>

          <button
            onClick={playing ? stopPlay : startPlay}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: playing ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.9)',
              color: playing ? '#fff' : primaryColor,
              border: playing ? '1px solid rgba(255,255,255,0.4)' : 'none',
              borderRadius: 8,
              padding: '5px 12px',
              fontSize: 11, fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            {playing ? <><Pause size={11} />一時停止</> : <><Play size={11} />再生</>}
          </button>
        </div>
      </div>

      {/* プログレスバー */}
      <div style={{ height: 3, background: '#F1F5F9' }}>
        <div style={{
          height: '100%',
          width: `${(revealedCount / Math.max(allItems.length, 1)) * 100}%`,
          background: `linear-gradient(90deg, ${primaryColor}, ${primaryColor}99)`,
          transition: 'width 0.1s linear',
        }} />
      </div>

      {/* Canvas */}
      <div style={{ padding: '12px 16px 8px' }}>
        <canvas ref={canvasRef} style={{ display: 'block', width: '100%' }} />
      </div>

      {/* フッター */}
      <div style={{ padding: '4px 16px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: '#CBD5E1' }}>
          {playing
            ? `${allItems.length - revealedCount}位 〜 登場中`
            : finished ? `全${allItems.length}件のランキングを表示中` : '再生ボタンで開始'}
        </span>
        <span style={{ fontSize: 10, color: '#CBD5E1' }}>出典: 厚生労働省 賃金構造基本統計調査</span>
      </div>
    </div>
  )
}
