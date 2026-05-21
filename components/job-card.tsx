'use client'

import Link from 'next/link'
import { MapPin, Clock, Bookmark, Building2, TrendingUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type Job = {
  id: string
  title: string
  company: string
  companyLogo?: string
  location: string
  salary: string
  tags: string[]
  type: string
  postedAt: string
  isNew?: boolean
  isFeatured?: boolean
  description: string
}

interface JobCardProps {
  job: Job
  compact?: boolean
}

export function JobCard({ job, compact }: JobCardProps) {
  return (
    <Link href={`/jobs/${job.id}`}>
      <article
        className={cn(
          'group bg-card rounded-xl border border-border hover:border-primary/30 hover:shadow-lg transition-all duration-200 cursor-pointer',
          compact ? 'p-4' : 'p-5'
        )}
      >
        <div className="flex items-start gap-4">
          {/* 企業ロゴ */}
          <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center shrink-0 text-primary group-hover:bg-primary/5 transition-colors overflow-hidden">
            {job.companyLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={job.companyLogo} alt={job.company} className="w-full h-full object-contain p-1" />
            ) : (
              <Building2 className="w-6 h-6" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  {job.isNew && (
                    <span className="text-[10px] font-bold bg-[oklch(0.72_0.18_55)] text-white px-2 py-0.5 rounded-full">
                      NEW
                    </span>
                  )}
                  {job.isFeatured && (
                    <span className="text-[10px] font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded-full flex items-center gap-0.5">
                      <TrendingUp className="w-2.5 h-2.5" />
                      注目
                    </span>
                  )}
                </div>
                <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors text-sm sm:text-base leading-snug truncate">
                  {job.title}
                </h3>
                <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">{job.company}</p>
              </div>
              <button
                className="p-1.5 text-muted-foreground hover:text-primary rounded-lg hover:bg-secondary transition-colors shrink-0"
                onClick={(e) => e.preventDefault()}
                aria-label="ブックマーク"
              >
                <Bookmark className="w-4 h-4" />
              </button>
            </div>

            {!compact && (
              <p className="text-muted-foreground text-xs mt-2 line-clamp-2 leading-relaxed">
                {job.description}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-3">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="w-3.5 h-3.5" />
                {job.location}
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                {job.postedAt}
              </span>
              <span className="text-xs font-semibold text-[oklch(0.72_0.18_55)]">
                {job.salary}
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5 mt-3">
              <Badge variant="secondary" className="text-xs font-normal px-2 py-0.5">
                {job.type}
              </Badge>
              {job.tags.slice(0, compact ? 2 : 3).map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs font-normal px-2 py-0.5 text-muted-foreground">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </article>
    </Link>
  )
}
