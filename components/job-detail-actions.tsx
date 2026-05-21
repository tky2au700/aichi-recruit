'use client'

import { useState } from 'react'
import { Bookmark, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface JobDetailActionsProps {
  salary: string
}

export function JobDetailActions({ salary }: JobDetailActionsProps) {
  const [bookmarked, setBookmarked] = useState(false)
  const [shared, setShared] = useState(false)

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: document.title, url: window.location.href })
    } else {
      navigator.clipboard.writeText(window.location.href)
      setShared(true)
      setTimeout(() => setShared(false), 2000)
    }
  }

  return (
    <>
      {/* ヘッダー内アクションアイコン */}
      <div className="flex gap-1.5 shrink-0">
        <button
          onClick={handleShare}
          className="p-2 text-muted-foreground hover:text-primary rounded-lg hover:bg-secondary transition-colors"
          aria-label={shared ? 'コピー完了' : '共有'}
        >
          <Share2 className="w-4 h-4" />
        </button>
        <button
          onClick={() => setBookmarked(!bookmarked)}
          className={`p-2 rounded-lg hover:bg-secondary transition-colors ${bookmarked ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}
          aria-label={bookmarked ? 'ブックマーク解除' : 'ブックマーク'}
        >
          <Bookmark className={`w-4 h-4 ${bookmarked ? 'fill-current' : ''}`} />
        </button>
      </div>

      {/* 応募ボタングループ（カード内） */}
      <div className="flex gap-3 mt-6 pt-5 border-t border-border">
        <Button className="flex-1 bg-[oklch(0.72_0.18_55)] hover:bg-[oklch(0.65_0.18_55)] text-white font-bold py-3 rounded-xl text-base">
          この求人に応募する
        </Button>
        <button
          onClick={() => setBookmarked(!bookmarked)}
          className={`px-4 rounded-xl border transition-colors ${bookmarked ? 'border-primary text-primary bg-primary/5' : 'border-border text-muted-foreground hover:border-primary/30 hover:text-primary'}`}
          aria-label={bookmarked ? 'ブックマーク解除' : 'ブックマーク'}
        >
          <Bookmark className={`w-4 h-4 ${bookmarked ? 'fill-current' : ''}`} />
        </button>
      </div>
    </>
  )
}

export function JobSidebarActions({ salary }: { salary: string }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-5">
      <p className="text-sm font-semibold text-foreground mb-1">{salary}</p>
      <p className="text-xs text-muted-foreground mb-4">想定年収（スキル・経験による）</p>
      <Button className="w-full bg-[oklch(0.72_0.18_55)] hover:bg-[oklch(0.65_0.18_55)] text-white font-bold py-3 rounded-xl mb-3">
        今すぐ応募する
      </Button>
      <Button variant="outline" className="w-full border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground">
        スカウトを受け取る
      </Button>
      <p className="text-xs text-muted-foreground text-center mt-3">
        登録は無料・3分で完了
      </p>
    </div>
  )
}
