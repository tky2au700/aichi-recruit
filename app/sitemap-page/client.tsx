'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import {
  Activity, BarChart2, TrendingUp, Building2, MapPin, GraduationCap,
  Users, Briefcase, ChevronRight, ExternalLink,
} from 'lucide-react'

interface SitemapData {
  occupations: string[]
  industries:  string[]
  prefectures: string[]
  educations:  string[]
  ageGroups:   string[]
  roles:       string[]
}

// カテゴリラベル整形
function cleanIndustry(name: string) {
  return name.replace(/^\(民＋公\)[A-Z\uFF21-\uFF3A]/, '').trim()
}

// セクションヘッダー
function SectionHeader({ icon, title, count, color }: { icon: React.ReactNode; title: string; count?: number; color: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}18` }}>
        <span style={{ color }}>{icon}</span>
      </div>
      <h2 className="text-base font-bold text-gray-800">{title}</h2>
      {count != null && (
        <span className="ml-auto text-[11px] text-gray-400 tabular-nums">{count}件</span>
      )}
    </div>
  )
}

// 静的リンクリスト
function StaticLinks({ links }: { links: { href: string; label: string; badge?: string }[] }) {
  return (
    <ul className="space-y-1">
      {links.map(l => (
        <li key={l.href}>
          <Link
            href={l.href}
            className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-50 transition-colors group"
          >
            <ChevronRight className="w-3 h-3 text-gray-300 group-hover:text-gray-500 shrink-0" />
            <span className="text-sm text-gray-700 group-hover:text-gray-900">{l.label}</span>
            {l.badge && (
              <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">{l.badge}</span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  )
}

// 動的リンクグリッド（全件表示）
function DynamicLinks({ items, buildHref, formatLabel }: {
  items: string[]
  buildHref: (item: string) => string
  formatLabel?: (item: string) => string
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1">
      {items.map(item => (
        <Link
          key={item}
          href={buildHref(item)}
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-gray-50 transition-colors group text-sm text-gray-700 hover:text-gray-900"
        >
          <ChevronRight className="w-3 h-3 text-gray-300 group-hover:text-gray-500 shrink-0" />
          <span className="truncate">{formatLabel ? formatLabel(item) : item}</span>
        </Link>
      ))}
    </div>
  )
}

// カードラッパー
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
      {children}
    </div>
  )
}

export function SitemapClient() {
  const [data, setData] = useState<SitemapData | null>(null)

  useEffect(() => {
    fetch('/api/sitemap-data')
      .then(r => r.json())
      .then(setData)
  }, [])

  const totalPages = data
    ? 17 + data.occupations.length + data.industries.length + data.prefectures.length
      + data.educations.length + data.ageGroups.length + data.roles.length
    : null

  return (
    <main className="max-w-6xl mx-auto px-4 py-10">

      {/* ヘッダー */}
      <div className="mb-10">
        <p className="text-xs font-semibold text-blue-600 uppercase tracking-widest mb-2">Sitemap</p>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 text-balance">サイトマップ</h1>
        <p className="mt-2 text-sm text-gray-500">
          AIリクルート 年収データベースの全ページ一覧です。
          {totalPages != null && <span className="ml-1 font-medium text-gray-700">全 {totalPages.toLocaleString()} ページ</span>}
        </p>
      </div>

      <div className="space-y-6">

        {/* メインページ */}
        <Card>
          <SectionHeader icon={<ExternalLink className="w-4 h-4" />} title="メインページ" color="#1a73e8" />
          <StaticLinks links={[
            { href: '/',               label: 'トップページ',     badge: 'TOP' },
            { href: '/salary/trend',   label: '年収推移グラフ',   badge: '推移' },
            { href: '/sitemap-page',   label: 'サイトマップ' },
          ]} />
        </Card>

        {/* ランキング */}
        <Card>
          <SectionHeader icon={<TrendingUp className="w-4 h-4" />} title="ランキング" color="#f59e0b" />
          <StaticLinks links={[
            { href: '/salary/ranking/occupation',                  label: '職種別年収ランキング' },
            { href: '/salary/ranking/industry',                    label: '産業別年収ランキング' },
            { href: '/salary/ranking/role',                        label: '役職別年収ランキング' },
            { href: '/salary/ranking/age-group',                   label: '年齢別年収ランキング' },
            { href: '/salary/ranking/education',                   label: '学歴別年収ランキング' },
            { href: '/salary/ranking/growth',                      label: '年収成長率ランキング' },
            { href: '/salary/ranking/bonus',                       label: '賞与ランキング' },
            { href: '/salary/ranking/overtime-wage',               label: '残業代ランキング' },
            { href: '/salary/ranking/hourly-wage',                 label: '時給換算ランキング' },
            { href: '/salary/ranking/male',                        label: '男性年収ランキング' },
            { href: '/salary/ranking/female',                      label: '女性年収ランキング' },
            { href: '/salary/ranking/high-income-large-workforce', label: '大企業×高年収ランキング' },
            { href: '/salary/ranking/high-income-low-overtime',    label: '残業少×高年収ランキング' },
          ]} />
        </Card>

        {/* カテゴリ一覧ページ */}
        <Card>
          <SectionHeader icon={<BarChart2 className="w-4 h-4" />} title="カテゴリ一覧" color="#16a34a" />
          <StaticLinks links={[
            { href: '/salary/education', label: '学歴別年収' },
            { href: '/salary/age',       label: '年齢別年収' },
            { href: '/salary/prefecture',label: '都道府県別年収' },
          ]} />
        </Card>

        {/* 職種別詳細 */}
        <Card>
          <SectionHeader
            icon={<Briefcase className="w-4 h-4" />}
            title="職種別詳細ページ"
            count={data?.occupations.length}
            color="#1a73e8"
          />
          {data ? (
            <DynamicLinks
              items={data.occupations}
              buildHref={item => `/salary/occupation/${encodeURIComponent(item)}`}
            />
          ) : (
            <p className="text-sm text-gray-400">読み込み中...</p>
          )}
        </Card>

        {/* 産業別詳細 */}
        <Card>
          <SectionHeader
            icon={<Building2 className="w-4 h-4" />}
            title="産業別詳細ページ"
            count={data?.industries.length}
            color="#7c3aed"
          />
          {data ? (
            <DynamicLinks
              items={data.industries}
              buildHref={item => `/salary/industry/${encodeURIComponent(item)}`}
              formatLabel={cleanIndustry}
            />
          ) : (
            <p className="text-sm text-gray-400">読み込み中...</p>
          )}
        </Card>

        {/* 都道府県別詳細 */}
        <Card>
          <SectionHeader
            icon={<MapPin className="w-4 h-4" />}
            title="都道府県別詳細ページ"
            count={data?.prefectures.length}
            color="#0891b2"
          />
          {data ? (
            <DynamicLinks
              items={data.prefectures}
              buildHref={item => `/salary/prefecture/${encodeURIComponent(item)}`}
            />
          ) : (
            <p className="text-sm text-gray-400">読み込み中...</p>
          )}
        </Card>

        {/* 学歴別詳細 */}
        <Card>
          <SectionHeader
            icon={<GraduationCap className="w-4 h-4" />}
            title="学歴別詳細ページ"
            count={data?.educations.length}
            color="#db2777"
          />
          {data ? (
            <DynamicLinks
              items={data.educations.filter(e => e !== '不明')}
              buildHref={item => `/salary/education/${encodeURIComponent(item)}`}
            />
          ) : (
            <p className="text-sm text-gray-400">読み込み中...</p>
          )}
        </Card>

        {/* 年齢別詳細 */}
        <Card>
          <SectionHeader
            icon={<Users className="w-4 h-4" />}
            title="年齢別詳細ページ"
            count={data?.ageGroups.length}
            color="#ea580c"
          />
          {data ? (
            <DynamicLinks
              items={data.ageGroups}
              buildHref={item => `/salary/age-group/${encodeURIComponent(item)}`}
            />
          ) : (
            <p className="text-sm text-gray-400">読み込み中...</p>
          )}
        </Card>

        {/* 役職別詳細 */}
        <Card>
          <SectionHeader
            icon={<Activity className="w-4 h-4" />}
            title="役職別詳細ページ"
            count={data?.roles.length}
            color="#16a34a"
          />
          {data ? (
            <DynamicLinks
              items={data.roles}
              buildHref={item => `/salary/role/${encodeURIComponent(item)}`}
            />
          ) : (
            <p className="text-sm text-gray-400">読み込み中...</p>
          )}
        </Card>

      </div>

      {/* 出典 */}
      <p className="mt-10 text-center text-xs text-gray-400">
        出典: 厚生労働省 賃金構造基本統計調査 / e-Stat
      </p>
    </main>
  )
}
