'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Database,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Table2,
  Server,
  Play,
} from 'lucide-react'

type ConnectionResult = {
  success: boolean
  message: string
  connection?: {
    host: string
    port: string
    database: string
    user: string
  }
  server?: {
    current_db: string
    version: string
    server_time: string
  }
  ping?: { result: number }
  tables?: Record<string, string>[]
  tableCount?: number
  error?: string
  code?: string
}

type SetupResult = {
  success: boolean
  message: string
  data?: Record<string, any>[]
  count?: number
  error?: string
}

export default function DbTestPage() {
  const [connResult, setConnResult] = useState<ConnectionResult | null>(null)
  const [setupResult, setSetupResult] = useState<SetupResult | null>(null)
  const [dataResult, setDataResult] = useState<SetupResult | null>(null)
  const [connLoading, setConnLoading] = useState(false)
  const [setupLoading, setSetupLoading] = useState(false)
  const [dataLoading, setDataLoading] = useState(false)

  const testConnection = async () => {
    setConnLoading(true)
    setConnResult(null)
    try {
      const res = await fetch('/api/db-test')
      const data = await res.json()
      setConnResult(data)
    } catch (e: any) {
      setConnResult({ success: false, message: 'フェッチエラー', error: e.message })
    } finally {
      setConnLoading(false)
    }
  }

  const setupDatabase = async () => {
    setSetupLoading(true)
    setSetupResult(null)
    try {
      const res = await fetch('/api/db-setup', { method: 'POST' })
      const data = await res.json()
      setSetupResult(data)
    } catch (e: any) {
      setSetupResult({ success: false, message: 'フェッチエラー', error: e.message })
    } finally {
      setSetupLoading(false)
    }
  }

  const fetchData = async () => {
    setDataLoading(true)
    setDataResult(null)
    try {
      const res = await fetch('/api/db-setup')
      const data = await res.json()
      setDataResult(data)
    } catch (e: any) {
      setDataResult({ success: false, message: 'フェッチエラー', error: e.message })
    } finally {
      setDataLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="max-w-3xl mx-auto space-y-8">

        {/* ヘッダー */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <Database className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">MySQL 接続テスト</h1>
            <p className="text-sm text-muted-foreground">xserver VPS — recruit_db</p>
          </div>
        </div>

        {/* 接続情報カード */}
        <div className="bg-card rounded-2xl border border-border p-5">
          <div className="flex items-center gap-2 mb-4">
            <Server className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-semibold text-sm text-foreground">接続設定</h2>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {[
              ['ホスト', '162.43.24.67'],
              ['ポート', '3306'],
              ['データベース', 'recruit_db'],
              ['ユーザー', 'emoji_user'],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between border-b border-border/50 pb-1.5">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-mono text-foreground">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Step 1: 接続テスト */}
        <section className="bg-card rounded-2xl border border-border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white text-xs font-bold">1</span>
              <h2 className="font-semibold text-foreground">接続テスト</h2>
            </div>
            <Button onClick={testConnection} disabled={connLoading} size="sm">
              {connLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              {connLoading ? '接続中...' : '接続を確認'}
            </Button>
          </div>

          {connResult && (
            <div className={`rounded-xl p-4 space-y-3 ${connResult.success ? 'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800'}`}>
              <div className="flex items-center gap-2">
                {connResult.success
                  ? <CheckCircle2 className="w-5 h-5 text-green-600" />
                  : <XCircle className="w-5 h-5 text-red-600" />
                }
                <span className={`font-semibold text-sm ${connResult.success ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                  {connResult.message}
                </span>
              </div>

              {connResult.success && connResult.server && (
                <dl className="grid grid-cols-1 gap-1.5 text-xs mt-2">
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground w-28 shrink-0">現在のDB</dt>
                    <dd className="font-mono text-foreground">{connResult.server.current_db}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground w-28 shrink-0">MySQLバージョン</dt>
                    <dd className="font-mono text-foreground">{connResult.server.version}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground w-28 shrink-0">サーバー時刻</dt>
                    <dd className="font-mono text-foreground">{connResult.server.server_time}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground w-28 shrink-0">テーブル数</dt>
                    <dd className="font-mono text-foreground">{connResult.tableCount}件</dd>
                  </div>
                </dl>
              )}

              {!connResult.success && connResult.error && (
                <p className="text-xs font-mono text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 p-2 rounded-lg break-all">
                  [{connResult.code}] {connResult.error}
                </p>
              )}
            </div>
          )}
        </section>

        {/* Step 2: テーブル作成＆データ挿入 */}
        <section className="bg-card rounded-2xl border border-border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white text-xs font-bold">2</span>
              <div>
                <h2 className="font-semibold text-foreground">テーブル作成 + データ挿入</h2>
                <p className="text-xs text-muted-foreground mt-0.5">test_companiesテーブルを作成してサンプルデータを挿入</p>
              </div>
            </div>
            <Button onClick={setupDatabase} disabled={setupLoading} size="sm" variant="outline">
              {setupLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Table2 className="w-4 h-4" />
              )}
              {setupLoading ? '実行中...' : 'セットアップ実行'}
            </Button>
          </div>

          {setupResult && (
            <div className={`rounded-xl p-4 space-y-3 ${setupResult.success ? 'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800'}`}>
              <div className="flex items-center gap-2">
                {setupResult.success
                  ? <CheckCircle2 className="w-5 h-5 text-green-600" />
                  : <XCircle className="w-5 h-5 text-red-600" />
                }
                <span className={`font-semibold text-sm ${setupResult.success ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                  {setupResult.message}
                </span>
                {setupResult.count !== undefined && (
                  <Badge variant="secondary" className="ml-auto">{setupResult.count}件</Badge>
                )}
              </div>
              {!setupResult.success && setupResult.error && (
                <p className="text-xs font-mono text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 p-2 rounded-lg break-all">
                  [{setupResult.code}] {setupResult.error}
                </p>
              )}
            </div>
          )}
        </section>

        {/* Step 3: データ取得 */}
        <section className="bg-card rounded-2xl border border-border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white text-xs font-bold">3</span>
              <div>
                <h2 className="font-semibold text-foreground">データ取得・表示</h2>
                <p className="text-xs text-muted-foreground mt-0.5">test_companiesテーブルのデータを一覧表示</p>
              </div>
            </div>
            <Button onClick={fetchData} disabled={dataLoading} size="sm" variant="outline">
              {dataLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Database className="w-4 h-4" />
              )}
              {dataLoading ? '取得中...' : 'データを取得'}
            </Button>
          </div>

          {dataResult && (
            <div className="space-y-3">
              <div className={`rounded-xl p-3 flex items-center gap-2 ${dataResult.success ? 'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800'}`}>
                {dataResult.success
                  ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                  : <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                }
                <span className={`text-sm font-semibold ${dataResult.success ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                  {dataResult.message}
                </span>
                {dataResult.count !== undefined && (
                  <Badge variant="secondary" className="ml-auto">{dataResult.count}件</Badge>
                )}
              </div>

              {dataResult.success && dataResult.data && dataResult.data.length > 0 && (
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-secondary/50 border-b border-border">
                        {Object.keys(dataResult.data[0]).map((col) => (
                          <th key={col} className="text-left px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wide">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {dataResult.data.map((row, i) => (
                        <tr key={i} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                          {Object.values(row).map((val, j) => (
                            <td key={j} className="px-3 py-2.5 font-mono text-foreground">
                              {String(val)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {!dataResult.success && dataResult.error && (
                <p className="text-xs font-mono text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 p-2 rounded-lg break-all">
                  {dataResult.error}
                </p>
              )}
            </div>
          )}
        </section>

      </div>
    </div>
  )
}
