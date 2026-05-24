import type { Metadata } from 'next'

const BASE_URL = 'https://ai-recruit.jp'
const DEFAULT_OG_IMAGE = `${BASE_URL}/og-default.jpg`

interface PageSeoOptions {
  title: string
  description: string
  keywords?: string[]
  path: string
  ogImage?: string
}

export function buildMetadata({ title, description, keywords = [], path, ogImage }: PageSeoOptions): Metadata {
  const url      = `${BASE_URL}${path}`
  const imageUrl = ogImage ?? DEFAULT_OG_IMAGE

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
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
    },
  }
}
