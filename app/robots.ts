import type { MetadataRoute } from 'next'

const BASE_URL = 'https://ai-recruit.jp'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // API ルートとクローラーに不要なフィルタ付きページはインデックスさせない
        disallow: ['/api/', '/_next/'],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  }
}
