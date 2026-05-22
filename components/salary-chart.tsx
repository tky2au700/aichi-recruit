'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  AreaChart,
  Cell,
} from 'recharts'

interface RankingItem {
  name: string
  annual: number | null
}

interface TrendItem {
  year: string
  annual: number | null
}

// カスタムツールチップ
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-sm">
      <p className="text-muted-foreground mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="font-semibold" style={{ color: p.color }}>
          {p.name}: {p.value?.toLocaleString()}万円
        </p>
      ))}
    </div>
  )
}

// 水平バーランキングチャート
export function RankingBarChart({ data, title }: { data: RankingItem[]; title: string }) {
  const maxVal = Math.max(...data.map(d => d.annual ?? 0))

  return (
    <div className="w-full">
      <h3 className="text-sm font-semibold text-muted-foreground mb-4">{title}</h3>
      <div className="space-y-2">
        {data.slice(0, 15).map((item, i) => {
          const pct = maxVal > 0 ? ((item.annual ?? 0) / maxVal) * 100 : 0
          const isTop3 = i < 3
          return (
            <div key={item.name} className="flex items-center gap-3">
              <span className={`w-6 text-right text-xs font-mono shrink-0 ${isTop3 ? 'text-accent font-bold' : 'text-muted-foreground'}`}>
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs text-foreground truncate pr-2">{item.name}</span>
                  <span className={`text-xs font-bold shrink-0 ${isTop3 ? 'text-accent' : 'text-primary'}`}>
                    {item.annual?.toLocaleString()}万円
                  </span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${pct}%`,
                      background: isTop3
                        ? 'oklch(0.78 0.17 70)'
                        : 'oklch(0.72 0.15 200)',
                    }}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// 縦棒グラフ（年齢別など）
export function SalaryBarChart({ data, xKey = 'name', yKey = 'annual', color }: {
  data: any[]
  xKey?: string
  yKey?: string
  color?: string
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.27 0.03 250)" vertical={false} />
        <XAxis
          dataKey={xKey}
          tick={{ fill: 'oklch(0.58 0.02 250)', fontSize: 10 }}
          angle={-35}
          textAnchor="end"
          interval={0}
        />
        <YAxis
          tick={{ fill: 'oklch(0.58 0.02 250)', fontSize: 10 }}
          tickFormatter={(v) => `${v}万`}
          width={45}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey={yKey} name="年収" radius={[3, 3, 0, 0]}>
          {data.map((_, i) => (
            <Cell
              key={i}
              fill={color ?? 'oklch(0.72 0.15 200)'}
              fillOpacity={0.85}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// エリアチャート（推移）
export function SalaryTrendChart({ data, xKey = 'year', yKey = 'annual' }: {
  data: any[]
  xKey?: string
  yKey?: string
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <defs>
          <linearGradient id="salaryGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="oklch(0.72 0.15 200)" stopOpacity={0.25} />
            <stop offset="95%" stopColor="oklch(0.72 0.15 200)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.27 0.03 250)" vertical={false} />
        <XAxis
          dataKey={xKey}
          tick={{ fill: 'oklch(0.58 0.02 250)', fontSize: 11 }}
        />
        <YAxis
          tick={{ fill: 'oklch(0.58 0.02 250)', fontSize: 11 }}
          tickFormatter={(v) => `${v}万`}
          width={50}
          domain={['auto', 'auto']}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey={yKey}
          name="年収"
          stroke="oklch(0.72 0.15 200)"
          strokeWidth={2}
          fill="url(#salaryGrad)"
          dot={{ fill: 'oklch(0.72 0.15 200)', r: 3 }}
          activeDot={{ r: 5 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
