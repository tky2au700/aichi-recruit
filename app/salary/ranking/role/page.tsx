import { Suspense } from 'react'
import { RoleRankingClient } from './client'

export const metadata = {
  title: '役職別年収ランキング | 賃金構造基本統計調査',
  description: '部長級・課長級・係長級など役職別の年収・給与を勤続年数・企業規模別に比較。厚生労働省 賃金構造基本統計調査データに基づく。',
}

export default function RoleRankingPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>読み込み中...</div>}>
      <RoleRankingClient />
    </Suspense>
  )
}
