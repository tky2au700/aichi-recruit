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

export const metadata: Metadata = {
  title: 'AIリクルート | 年収データベース',
  description: '賃金構造基本統計調査に基づく年収データベース。職種別・産業別・都道府県別・学歴別・年齢別の年収ランキングと推移グラフ。',
  keywords: '年収, 賃金, 給与, 職種別年収, 産業別年収, 都道府県別年収, 賃金構造基本統計調査',
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
