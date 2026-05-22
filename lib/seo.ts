import type { Metadata } from 'next'

const BASE_URL = 'https://ai-recruit.jp'

interface PageSeoOptions {
  title: string
  description: string
  keywords?: string[]
  path: string
}

export function buildMetadata({ title, description, keywords = [], path }: PageSeoOptions): Metadata {
  const url = `${BASE_URL}${path}`
  return {
    title,
    description,
    keywords: [
      '年収', '平均年収', '給与', '賃金', '賃金構造基本統計調査', 'e-Stat',
      ...keywords,
    ],
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      locale: 'ja_JP',
      url,
      siteName: 'AIリクルート 年収データベース',
      title,
      description,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}
