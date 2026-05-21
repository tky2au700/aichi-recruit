import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MapPin, Clock, Building2, CheckCircle2, ChevronRight } from 'lucide-react'
import { Header } from '@/components/header'
import { JobCard } from '@/components/job-card'
import { JobDetailActions, JobSidebarActions } from '@/components/job-detail-actions'
import { mockJobs } from '@/lib/mock-data'
import { Badge } from '@/components/ui/badge'

const jobDetails: Record<string, {
  responsibilities: string[]
  requirements: string[]
  preferred: string[]
  benefits: string[]
  workStyle: string[]
  companyId: string
}> = {
  '1': {
    responsibilities: [
      'フロントエンドアーキテクチャの設計・実装',
      'React/Next.jsを用いたプロダクト開発',
      'パフォーマンス最適化・品質向上',
      'ジュニアエンジニアのメンタリング',
      'バックエンドチームとの連携',
    ],
    requirements: [
      'React・TypeScript 3年以上の実務経験',
      'Web パフォーマンス最適化の知識',
      'CI/CD・テスト自動化の経験',
      'チームでのアジャイル開発経験',
    ],
    preferred: [
      'Next.js App Router の実務経験',
      'GraphQL・REST API 設計経験',
      '英語でのコミュニケーション能力',
    ],
    benefits: [
      '完全フレックス制度（コアタイムなし）',
      'リモートワーク可（出社頻度：週1〜2回）',
      '書籍・研修費用 月3万円まで補助',
      '健康保険・厚生年金・雇用保険完備',
      'ストックオプション制度あり',
      '社員持株制度あり',
    ],
    workStyle: ['フレックスタイム', 'リモート可', '残業少なめ'],
    companyId: 'c1',
  },
  '5': {
    responsibilities: [
      'Goを用いた決済APIの開発・保守',
      'マイクロサービスアーキテクチャの設計',
      'AWSインフラの構築・最適化',
      'パフォーマンス・セキュリティの改善',
    ],
    requirements: [
      'Go 2年以上の実務経験',
      'AWS（ECS/RDS/SQS）の運用経験',
      'マイクロサービス設計・開発経験',
    ],
    preferred: [
      'gRPC・Protocol Buffersの利用経験',
      'Kubernetes・Terraformの経験',
      'PCI DSS準拠の開発経験',
    ],
    benefits: [
      '年間休日 125日（土日祝＋夏季・年末年始）',
      '育児・介護休業制度完備',
      '自社サービス社員割引',
      '書籍購入補助 月2万円',
    ],
    workStyle: ['フルリモート可', '副業OK', 'フレックス制度'],
    companyId: 'c3',
  },
}

export function generateStaticParams() {
  return mockJobs.map((job) => ({ id: job.id }))
}

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const job = mockJobs.find((j) => j.id === id)
  if (!job) notFound()

  const detail = jobDetails[id] || jobDetails['1']
  const relatedJobs = mockJobs.filter((j) => j.id !== params.id).slice(0, 3)

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* パンくず */}
      <div className="bg-secondary/40 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Link href="/" className="hover:text-primary transition-colors">ホーム</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <Link href="/jobs" className="hover:text-primary transition-colors">求人一覧</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-foreground truncate max-w-48">{job.title}</span>
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* メインコンテンツ */}
          <div className="lg:col-span-2 space-y-6">
            {/* 求人ヘッダーカード */}
            <div className="bg-card rounded-2xl border border-border p-6">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                  <Building2 className="w-8 h-8 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        {job.isNew && (
                          <Badge className="bg-[oklch(0.72_0.18_55)] text-white text-[10px] font-bold px-2">NEW</Badge>
                        )}
                        {job.isFeatured && (
                          <Badge className="bg-primary text-primary-foreground text-[10px] px-2">注目</Badge>
                        )}
                        <Badge variant="secondary" className="text-xs">{job.type}</Badge>
                      </div>
                      <h1 className="text-xl sm:text-2xl font-bold text-foreground leading-tight text-balance">{job.title}</h1>
                      <p className="text-muted-foreground mt-1">{job.company}</p>
                    </div>
                    <JobDetailActions salary={job.salary} />
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-4 h-4" />{job.location}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />{job.postedAt}投稿
                    </span>
                    <span className="text-base font-bold text-[oklch(0.72_0.18_55)]">{job.salary}</span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mt-4">
                    {job.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs text-muted-foreground">{tag}</Badge>
                    ))}
                    {detail.workStyle.map((w) => (
                      <Badge key={w} variant="secondary" className="text-xs text-primary">{w}</Badge>
                    ))}
                  </div>
                </div>
              </div>

              
            </div>

            {/* 仕事内容 */}
            <section className="bg-card rounded-2xl border border-border p-6">
              <h2 className="text-lg font-bold text-foreground mb-4">仕事内容</h2>
              <p className="text-muted-foreground text-sm leading-relaxed mb-4">{job.description}</p>
              <h3 className="font-semibold text-foreground mb-3">主な業務内容</h3>
              <ul className="space-y-2.5">
                {detail.responsibilities.map((r) => (
                  <li key={r} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    {r}
                  </li>
                ))}
              </ul>
            </section>

            {/* 応募要件 */}
            <section className="bg-card rounded-2xl border border-border p-6">
              <h2 className="text-lg font-bold text-foreground mb-4">応募要件</h2>
              <h3 className="font-semibold text-foreground mb-3 text-sm">必須要件</h3>
              <ul className="space-y-2 mb-5">
                {detail.requirements.map((r) => (
                  <li key={r} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                    {r}
                  </li>
                ))}
              </ul>
              <h3 className="font-semibold text-foreground mb-3 text-sm">歓迎要件</h3>
              <ul className="space-y-2">
                {detail.preferred.map((r) => (
                  <li key={r} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground mt-2 shrink-0" />
                    {r}
                  </li>
                ))}
              </ul>
            </section>

            {/* 福利厚生 */}
            <section className="bg-card rounded-2xl border border-border p-6">
              <h2 className="text-lg font-bold text-foreground mb-4">福利厚生・社内制度</h2>
              <div className="grid sm:grid-cols-2 gap-2.5">
                {detail.benefits.map((b) => (
                  <div key={b} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 text-[oklch(0.72_0.18_55)] shrink-0" />
                    {b}
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* サイドバー */}
          <div className="space-y-5">
            {/* 応募ボタン（スティッキー） */}
            <div className="sticky top-20 space-y-5">
              <JobSidebarActions salary={job.salary} />

              {/* 関連求人 */}
              <div className="bg-card rounded-2xl border border-border p-5">
                <h3 className="font-semibold text-foreground mb-3 text-sm">関連する求人</h3>
                <div className="space-y-3">
                  {relatedJobs.map((j) => (
                    <JobCard key={j.id} job={j} compact />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
