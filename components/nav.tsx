'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  TrendingUp, Building2, MapPin, GraduationCap, BarChart3,
  Menu, X, ChevronDown, Users, Clock, Award, LineChart, BarChart2,
} from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

const rankingItems = [
  {
    href: '/salary/ranking/occupation',
    label: '職種別年収ランキング',
    description: '全職種の年収を一覧',
    icon: TrendingUp,
    color: '#1a73e8',
  },
  {
    href: '/salary/ranking/male',
    label: '男性年収ランキング',
    description: '男性労働者の職種別ランキング',
    icon: Users,
    color: '#1a73e8',
  },
  {
    href: '/salary/ranking/female',
    label: '女性年収ランキング',
    description: '女性労働者の職種別ランキング',
    icon: Users,
    color: '#e8336d',
  },
  {
    href: '/salary/ranking/bonus',
    label: 'ボーナスランキング',
    description: '年間賞与額が多い職種',
    icon: Award,
    color: '#f59e0b',
  },
  {
    href: '/salary/ranking/hourly-wage',
    label: '時給換算ランキング',
    description: '時給に換算した場合のランキング',
    icon: Clock,
    color: '#0ea5e9',
  },
  {
    href: '/salary/ranking/growth',
    label: '年収増加率ランキング',
    description: '過去数年で最も伸びた職種',
    icon: LineChart,
    color: '#16a34a',
  },
  {
    href: '/salary/ranking/high-income-low-overtime',
    label: '残業少ない高年収',
    description: '月10時間以下残業で高年収',
    icon: BarChart2,
    color: '#7c3aed',
  },
]

const categoryItems = [
  { href: '/salary/industry',   label: '産業別',       icon: Building2,    description: '業界・産業ごとの年収比較' },
  { href: '/salary/prefecture', label: '都道府県別',   icon: MapPin,        description: '地域ごとの賃金水準' },
  { href: '/salary/education',  label: '学歴別',       icon: GraduationCap, description: '学歴による年収の違い' },
  { href: '/salary/age',        label: '年齢・勤続別', icon: BarChart3,     description: '年齢・経験年数と年収の関係' },
]

export function Nav() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [megaOpen, setMegaOpen] = useState(false)
  const megaRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isRankingActive = pathname.startsWith('/salary/ranking')

  function openMega()  {
    if (timerRef.current) clearTimeout(timerRef.current)
    setMegaOpen(true)
  }
  function closeMega() {
    timerRef.current = setTimeout(() => setMegaOpen(false), 120)
  }

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="mx-auto max-w-7xl px-4 lg:px-6">
        <div className="flex h-16 items-center gap-8">

          {/* ---- ロゴ ---- */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0 mr-2">
            <div className="w-8 h-8 rounded-lg bg-[#1a73e8] flex items-center justify-center shadow-sm">
              <BarChart3 className="w-4.5 h-4.5 text-white" style={{ width: 18, height: 18 }} />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[15px] font-bold text-gray-900 tracking-tight">年収データベース</span>
              <span className="text-[10px] text-gray-400 font-normal tracking-wide">AIリクルート</span>
            </div>
          </Link>

          {/* ---- デスクトップナビ ---- */}
          <nav className="hidden md:flex items-center gap-1 flex-1">

            {/* メガメニュートリガー: ランキング */}
            <div
              ref={megaRef}
              className="relative"
              onMouseEnter={openMega}
              onMouseLeave={closeMega}
            >
              <button
                aria-haspopup="true"
                aria-expanded={megaOpen}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors select-none ${
                  isRankingActive
                    ? 'bg-blue-50 text-[#1a73e8]'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                ランキング
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${megaOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* メガメニューパネル */}
              {megaOpen && (
                <div
                  onMouseEnter={openMega}
                  onMouseLeave={closeMega}
                  className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50"
                  style={{ width: 560 }}
                >
                  {/* 上向き三角 */}
                  <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-l border-t border-gray-200 rotate-45" />

                  <div className="relative bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden">
                    <div className="px-5 pt-4 pb-2">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">年収ランキング</p>
                    </div>
                    <div className="grid grid-cols-2 gap-0.5 px-3 pb-3">
                      {rankingItems.map(({ href, label, description, icon: Icon, color }) => (
                        <Link
                          key={href}
                          href={href}
                          onClick={() => setMegaOpen(false)}
                          className={`flex items-start gap-3 px-3 py-2.5 rounded-xl transition-colors group ${
                            pathname === href ? 'bg-blue-50' : 'hover:bg-gray-50'
                          }`}
                        >
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                            style={{ background: `${color}18` }}
                          >
                            <Icon className="w-4 h-4" style={{ color }} />
                          </div>
                          <div className="min-w-0">
                            <p className={`text-[13px] font-medium leading-snug group-hover:text-[#1a73e8] transition-colors ${
                              pathname === href ? 'text-[#1a73e8]' : 'text-gray-800'
                            }`}>
                              {label}
                            </p>
                            <p className="text-[11px] text-gray-400 mt-0.5 leading-tight">{description}</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                    <div className="border-t border-gray-100 px-5 py-2.5 bg-gray-50/60 flex items-center justify-between">
                      <span className="text-[11px] text-gray-400">賃金構造基本統計調査データをもとに算出</span>
                      <Link
                        href="/salary/ranking/occupation"
                        onClick={() => setMegaOpen(false)}
                        className="text-[12px] text-[#1a73e8] font-medium hover:underline"
                      >
                        すべて見る →
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* カテゴリリンク */}
            {categoryItems.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href)
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'bg-blue-50 text-[#1a73e8]'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              )
            })}
          </nav>

          {/* 右側: データソース表記 */}
          <div className="hidden lg:flex items-center ml-auto">
            <span className="text-[11px] text-gray-400 whitespace-nowrap">出典: e-Stat 賃金構造基本統計調査</span>
          </div>

          {/* モバイルメニューボタン */}
          <button
            className="md:hidden ml-auto p-2 text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors"
            onClick={() => setMobileOpen(v => !v)}
            aria-label="メニューを開く"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* ---- モバイルメニュー ---- */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white">
          <div className="px-4 pt-3 pb-1">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">ランキング</p>
            {rankingItems.map(({ href, label, icon: Icon, color }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}18` }}>
                  <Icon className="w-3.5 h-3.5" style={{ color }} />
                </div>
                <span className="text-sm text-gray-700 font-medium">{label}</span>
              </Link>
            ))}
          </div>
          <div className="border-t border-gray-100 px-4 pt-3 pb-4">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">カテゴリ</p>
            {categoryItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Icon className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-700 font-medium">{label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  )
}
