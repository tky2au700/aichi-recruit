'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Menu, X, Briefcase, ChevronDown, Bell, User } from 'lucide-react'
import { Button } from '@/components/ui/button'

const navItems = [
  {
    label: '求人を探す',
    href: '/jobs',
    children: [
      { label: 'ITエンジニア', href: '/jobs?category=it' },
      { label: '営業・マーケティング', href: '/jobs?category=sales' },
      { label: '管理・バックオフィス', href: '/jobs?category=admin' },
      { label: 'デザイン・クリエイティブ', href: '/jobs?category=design' },
    ],
  },
  {
    label: '企業を探す',
    href: '/companies',
  },
  {
    label: 'キャリアコラム',
    href: '/column',
  },
]

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState<string | null>(null)

  return (
    <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-sm border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* ロゴ */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Briefcase className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-primary tracking-tight">
              AIリクルート
            </span>
          </Link>

          {/* デスクトップナビ */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) =>
              item.children ? (
                <div
                  key={item.label}
                  className="relative"
                  onMouseEnter={() => setDropdownOpen(item.label)}
                  onMouseLeave={() => setDropdownOpen(null)}
                >
                  <button className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-foreground/80 hover:text-primary rounded-md hover:bg-secondary transition-colors">
                    {item.label}
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  {dropdownOpen === item.label && (
                    <div className="absolute top-full left-0 mt-1 w-52 bg-card rounded-xl shadow-lg border border-border py-1 z-50">
                      {item.children.map((child) => (
                        <Link
                          key={child.label}
                          href={child.href}
                          className="block px-4 py-2.5 text-sm text-foreground/80 hover:text-primary hover:bg-secondary transition-colors"
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  key={item.label}
                  href={item.href}
                  className="px-4 py-2 text-sm font-medium text-foreground/80 hover:text-primary rounded-md hover:bg-secondary transition-colors"
                >
                  {item.label}
                </Link>
              )
            )}
          </nav>

          {/* 右側アクション */}
          <div className="hidden md:flex items-center gap-3">
            <button className="p-2 text-foreground/60 hover:text-primary rounded-md hover:bg-secondary transition-colors">
              <Bell className="w-5 h-5" />
              <span className="sr-only">通知</span>
            </button>
            <Button variant="outline" size="sm" asChild className="border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground">
              <Link href="/login">ログイン</Link>
            </Button>
            <Button size="sm" asChild className="bg-[oklch(0.72_0.18_55)] hover:bg-[oklch(0.65_0.18_55)] text-white font-semibold">
              <Link href="/register">無料登録</Link>
            </Button>
          </div>

          {/* モバイルメニューボタン */}
          <button
            className="md:hidden p-2 text-foreground/70 hover:text-primary rounded-md"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="メニューを開く"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* モバイルメニュー */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-card">
          <nav className="px-4 py-3 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="block px-3 py-2.5 text-sm font-medium text-foreground/80 hover:text-primary hover:bg-secondary rounded-md transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="px-4 pb-4 flex flex-col gap-2">
            <Button variant="outline" asChild className="w-full border-primary/30 text-primary">
              <Link href="/login">ログイン</Link>
            </Button>
            <Button asChild className="w-full bg-[oklch(0.72_0.18_55)] hover:bg-[oklch(0.65_0.18_55)] text-white font-semibold">
              <Link href="/register">無料登録</Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  )
}
