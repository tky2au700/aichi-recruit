import { Nav } from '@/components/nav'
import { Footer } from '@/components/footer'
import { SitemapClient } from './client'
import { buildMetadata } from '@/lib/seo'

export const metadata = buildMetadata({
  title: 'サイトマップ | AIリクルート 年収データベース',
  description: 'AIリクルート 年収データベースの全ページ一覧。職種別・産業別・都道府県別・学歴別・年齢別・役職別の年収データページをまとめています。',
  keywords: ['サイトマップ', '年収データベース', 'AIリクルート'],
  path: '/sitemap-page',
})

export default function SitemapPage() {
  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <SitemapClient />
    </div>
  )
}
