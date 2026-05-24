// JSON-LD 構造化データコンポーネント

const BASE_URL = 'https://ai-recruit.jp'

interface OccupationJsonLdProps {
  occupationName: string
  annualIncomeWan: number | null   // 万円単位
  monthlyWageWan: number | null    // 万円単位
  annualBonusWan: number | null    // 万円単位
  surveyYear: number
  slug: string
}

export function OccupationJsonLd({
  occupationName,
  annualIncomeWan,
  monthlyWageWan,
  annualBonusWan,
  surveyYear,
  slug,
}: OccupationJsonLdProps) {
  const url = `${BASE_URL}/salary/occupation/${slug}`

  // Schema.org Occupation
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Occupation',
    'name': occupationName,
    'url': url,
    'occupationalCategory': occupationName,
    'estimatedSalary': annualIncomeWan != null ? [{
      '@type': 'MonetaryAmountDistribution',
      'name': '年収（推定）',
      'currency': 'JPY',
      'duration': 'P1Y',
      'median': annualIncomeWan * 10000,
    }] : undefined,
    'mainEntityOfPage': {
      '@type': 'WebPage',
      '@id': url,
    },
    'description': `${occupationName}の${surveyYear}年平均年収データ。賃金構造基本統計調査（厚生労働省）に基づく統計データです。`,
  }

  // BreadcrumbList
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': [
      { '@type': 'ListItem', 'position': 1, 'name': 'AIリクルート', 'item': BASE_URL },
      { '@type': 'ListItem', 'position': 2, 'name': '職種別年収ランキング', 'item': `${BASE_URL}/salary/ranking/occupation` },
      { '@type': 'ListItem', 'position': 3, 'name': `${occupationName}の平均年収`, 'item': url },
    ],
  }

  // Dataset
  const dataset = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    'name': `${occupationName}の年収データ（${surveyYear}年）`,
    'description': `賃金構造基本統計調査による${occupationName}の${surveyYear}年平均年収・月給・賞与データ`,
    'url': url,
    'creator': {
      '@type': 'Organization',
      'name': '厚生労働省',
      'url': 'https://www.mhlw.go.jp/',
    },
    'publisher': {
      '@type': 'Organization',
      'name': 'AIリクルート',
      'url': BASE_URL,
    },
    'temporalCoverage': `${surveyYear}`,
    'license': 'https://www.e-stat.go.jp/terms-of-use',
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(dataset) }} />
    </>
  )
}

interface IndustryJsonLdProps {
  industryName: string
  annualIncomeWan: number | null
  monthlyWageWan: number | null
  annualBonusWan: number | null
  surveyYear: number
  slug: string
}

export function IndustryJsonLd({
  industryName,
  annualIncomeWan,
  monthlyWageWan,
  annualBonusWan,
  surveyYear,
  slug,
}: IndustryJsonLdProps) {
  const url = `${BASE_URL}/salary/industry/${slug}`

  const dataset = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    'name': `${industryName}の年収データ（${surveyYear}年）`,
    'description': `賃金構造基本統計調査による${industryName}の${surveyYear}年平均年収・月給・賞与データ`,
    'url': url,
    'creator': {
      '@type': 'Organization',
      'name': '厚生労働省',
      'url': 'https://www.mhlw.go.jp/',
    },
    'publisher': {
      '@type': 'Organization',
      'name': 'AIリクルート',
      'url': BASE_URL,
    },
    'temporalCoverage': `${surveyYear}`,
    'license': 'https://www.e-stat.go.jp/terms-of-use',
    ...(annualIncomeWan != null && {
      'variableMeasured': [
        { '@type': 'PropertyValue', 'name': '平均年収', 'value': annualIncomeWan * 10000, 'unitCode': 'JPY' },
        ...(monthlyWageWan != null ? [{ '@type': 'PropertyValue', 'name': '月給', 'value': monthlyWageWan * 10000, 'unitCode': 'JPY' }] : []),
        ...(annualBonusWan != null ? [{ '@type': 'PropertyValue', 'name': '年間賞与', 'value': annualBonusWan * 10000, 'unitCode': 'JPY' }] : []),
      ],
    }),
  }

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': [
      { '@type': 'ListItem', 'position': 1, 'name': 'AIリクルート', 'item': BASE_URL },
      { '@type': 'ListItem', 'position': 2, 'name': '産業別年収ランキング', 'item': `${BASE_URL}/salary/ranking/industry` },
      { '@type': 'ListItem', 'position': 3, 'name': `${industryName}の平均年収`, 'item': url },
    ],
  }

  const webpage = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    'name': `${industryName}の平均年収【${surveyYear}年】`,
    'description': `${industryName}の${surveyYear}年平均年収データ。賃金構造基本統計調査（厚生労働省）に基づく統計データです。`,
    'url': url,
    'publisher': { '@type': 'Organization', 'name': 'AIリクルート', 'url': BASE_URL },
    'inLanguage': 'ja-JP',
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webpage) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(dataset) }} />
    </>
  )
}

interface RankingJsonLdProps {
  title: string
  description: string
  url: string
  breadcrumbs: { name: string; url: string }[]
}

export function RankingJsonLd({ title, description, url, breadcrumbs }: RankingJsonLdProps) {
  const webpage = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    'name': title,
    'description': description,
    'url': url,
    'publisher': {
      '@type': 'Organization',
      'name': 'AIリクルート',
      'url': BASE_URL,
    },
    'inLanguage': 'ja-JP',
  }

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': [
      { '@type': 'ListItem', 'position': 1, 'name': 'AIリクルート', 'item': BASE_URL },
      ...breadcrumbs.map((b, i) => ({
        '@type': 'ListItem',
        'position': i + 2,
        'name': b.name,
        'item': b.url,
      })),
    ],
  }

  const faq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    'mainEntity': [
      {
        '@type': 'Question',
        'name': 'このデータはどこから取得していますか？',
        'acceptedAnswer': {
          '@type': 'Answer',
          'text': '厚生労働省が実施する賃金構造基本統計調査のデータをe-Stat（政府統計の総合窓口）を通じて取得・加工しています。',
        },
      },
      {
        '@type': 'Question',
        'name': '年収はどのように計算されていますか？',
        'acceptedAnswer': {
          '@type': 'Answer',
          'text': '所定内給与額×12ヶ月＋年間賞与その他特別給与額の合計を推定年収として表示しています。',
        },
      },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webpage) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faq) }} />
    </>
  )
}
