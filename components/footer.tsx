import Link from 'next/link'
import { BarChart3 } from 'lucide-react'

const SECTIONS = [
  {
    title: '年収推移',
    links: [
      { href: '/salary/trend', label: '年収推移グラフ（2021〜2025年）' },
    ],
  },
  {
    title: '職種別',
    links: [
      { href: '/salary/ranking/occupation',              label: '職種別年収ランキング' },
      { href: '/salary/ranking/male',                    label: '男性年収ランキング' },
      { href: '/salary/ranking/female',                  label: '女性年収ランキング' },
      { href: '/salary/ranking/occupation?sort=annual_bonus', label: 'ボーナスランキング' },
      { href: '/salary/ranking/overtime-wage',           label: '残業・時給ランキング' },
      { href: '/salary/ranking/growth',                  label: '年収増加率ランキング' },
      { href: '/salary/ranking/high-income-low-overtime', label: '残業少ない高年収' },
      { href: '/salary/ranking/high-income-large-workforce', label: '需要×高年収ランキング' },
    ],
  },
  {
    title: '産業別',
    links: [
      { href: '/salary/ranking/industry',                      label: '産業別年収ランキング' },
      { href: '/salary/ranking/industry?sex=male',             label: '男性産業別ランキング' },
      { href: '/salary/ranking/industry?sex=female',           label: '女性産業別ランキング' },
      { href: '/salary/ranking/industry?sort=avg_bonus',       label: '産業別賞与ランキング' },
      { href: '/salary/ranking/industry?size=large',           label: '大企業の産業別ランキング' },
      { href: '/salary/ranking/industry?education=university', label: '大卒の産業別ランキング' },
    ],
  },
  {
    title: '属性別',
    links: [
      { href: '/salary/ranking/education',   label: '学歴別年収ランキング' },
      { href: '/salary/ranking/age-group',   label: '年齢階級別年収ランキング' },
      { href: '/salary/ranking/role',        label: '役職別年収ランキング' },
      { href: '/salary/prefecture',          label: '都道府県別年収' },
      { href: '/salary/age',                 label: '年齢別年収' },
      { href: '/salary/education',           label: '学歴別年収' },
    ],
  },
]

export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-gray-100 bg-gray-50 mt-16">
      {/* サイトマップ */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        {/* ロゴ + 説明 */}
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-[#1a73e8] flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900 text-sm">AIリクルート</span>
            <span className="text-gray-400 text-xs">年収データベース</span>
          </Link>
          <p className="text-xs text-gray-500 leading-relaxed max-w-sm">
            厚生労働省「賃金構造基本統計調査」（e-Stat）に基づく年収データベース。
            職種・産業・都道府県・学歴・年齢別の年収ランキングと推移グラフを無料で提供します。
          </p>
        </div>

        {/* リンクグリッド */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8">
          {SECTIONS.map(section => (
            <div key={section.title}>
              <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                {section.title}
              </h3>
              <ul className="space-y-2">
                {section.links.map(link => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-xs text-gray-600 hover:text-[#1a73e8] transition-colors leading-snug"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* ボトムバー */}
      <div className="border-t border-gray-100 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-[11px] text-gray-400">
            &copy; {year} AIリクルート. データ出典: 厚生労働省 賃金構造基本統計調査
          </p>
          <div className="flex items-center gap-4">
            <Link href="/sitemap-page" className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors">
              サイトマップ
            </Link>
            <p className="text-[11px] text-gray-400">
              本サービスのデータは統計情報であり、個別企業・個人の年収を保証するものではありません。
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
