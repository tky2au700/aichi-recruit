import type { Metadata } from 'next'
import { Noto_Sans_JP, Geist_Mono } from 'next/font/google'
import './globals.css'

const notoSansJP = Noto_Sans_JP({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
})

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
})

const BASE_URL = 'https://ai-recruit.jp'

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'AIリクルート | 年収データベース',
    template: '%s | AIリクルート',
  },
  description: '賃金構造基本統計調査（e-Stat）に基づく日本最大の年収データベース。職種別・産業別・都道府県別・学歴別・年齢別の年収ランキングと推移グラフを無料で提供します。',
  keywords: ['年収', '平均年収', '給与', '賃金', '職種別年収', '産業別年収', '都道府県別年収', '賃金構造基本統計調査', 'e-Stat', '年収ランキング', 'AIリクルート'],
  authors: [{ name: 'AIリクルート' }],
  creator: 'AIリクルート',
  publisher: 'AIリクルート',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'ja_JP',
    url: BASE_URL,
    siteName: 'AIリクルート 年収データベース',
    title: 'AIリクルート | 年収データベース',
    description: '賃金構造基本統計調査に基づく年収データベース。職種別・産業別・都道府県別・学歴別・年齢別の年収ランキングと推移グラフ。',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AIリクルート | 年収データベース',
    description: '賃金構造基本統計調査に基づく年収データベース。職種別・産業別・都道府県別・学歴別の年収ランキング。',
  },
  alternates: {
    canonical: BASE_URL,
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ja" className={`${notoSansJP.variable} ${geistMono.variable} bg-background`}>
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
