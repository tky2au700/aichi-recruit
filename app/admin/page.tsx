'use client'

import { useState, useRef, useCallback } from 'react'
import {
  Upload, Database, FileText, CheckCircle2, AlertCircle,
  Loader2, Eye, Download, Trash2, Plus, X, Pencil, ChevronLeft, ChevronRight
} from 'lucide-react'

// ---------- 型定義 ----------
interface Dataset {
  id: number
  name: string
  category: string
  survey_year: number
  published_at: string | null
  source_name: string | null
  source_url: string | null
  record_count: number
  imported_at: string | null
  created_at: string
}

interface PreviewSummary {
  total_rows: number
  occupation_count: number
  sex_breakdown: { 計: number; 男: number; 女: number }
  file_name: string
  file_size: number
}

interface PreviewRow {
  occupation_name: string
  sex: string
  enterprise_size: string
  age: number | null
  tenure_years: number | null
  monthly_wage: number | null
  scheduled_wage: number | null
  annual_bonus: number | null
  annual_income: number | null
  workers: number | null
}

const CATEGORIES = [
  { value: 'occupation', label: '職種別' },
  { value: 'industry', label: '産業別' },
  { value: 'prefecture', label: '都道府県別' },
  { value: 'education', label: '学歴別' },
  { value: 'age', label: '年齢・経験年数別' },
]

function fmt(n: number | null, unit = ''): string {
  if (n === null || n === undefined) return '-'
  return n.toLocaleString() + unit
}

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

// ---------- メインコンポーネント ----------
export default function AdminPage() {
  // --- DB初期化 ---
  const [schemaStatus, setSchemaStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [schemaMessage, setSchemaMessage] = useState('')

  // --- データセット登録フォーム ---
  const [showDatasetForm, setShowDatasetForm] = useState(false)
  const [datasetForm, setDatasetForm] = useState({
    name: '',
    category: 'occupation',
    survey_year: new Date().getFullYear().toString(),
    published_at: '',
    source_name: '厚生労働省',
    source_url: '',
  })
  const [datasetSaving, setDatasetSaving] = useState(false)
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [datasetsLoaded, setDatasetsLoaded] = useState(false)

  // --- CSV ---
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>('')
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // --- プレビュー ---
  const [previewing, setPreviewing] = useState(false)
  const [preview, setPreview] = useState<{
    summary: PreviewSummary
    rows: PreviewRow[]
    occupations: string[]
  } | null>(null)
  const [previewPage, setPreviewPage] = useState(1)
  const PREVIEW_PAGE_SIZE = 50

  // --- データセット編集 ---
  const [editingDatasetId, setEditingDatasetId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({
    name: '',
    category: 'occupation',
    survey_year: '',
    published_at: '',
    source_name: '',
    source_url: '',
  })
  const [editSaving, setEditSaving] = useState(false)

  // --- 取込 ---
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(null)

  // ---- DB初期化 ----
  async function handleSetupSchema() {
    setSchemaStatus('loading')
    setSchemaMessage('')
    try {
      const res = await fetch('/api/admin/setup-schema', { method: 'POST' })
      const json = await res.json()
      if (json.success) {
        setSchemaStatus('done')
        setSchemaMessage(`テーブル作成完了: ${json.tables.join(', ')}`)
      } else {
        setSchemaStatus('error')
        setSchemaMessage(json.error || json.message)
      }
    } catch (e: any) {
      setSchemaStatus('error')
      setSchemaMessage(e.message)
    }
  }

  // ---- データセット一覧取得 ----
  async function loadDatasets() {
    try {
      const res = await fetch('/api/admin/datasets')
      const json = await res.json()
      if (json.success) {
        setDatasets(json.data)
        setDatasetsLoaded(true)
      }
    } catch {}
  }

  // ---- データセット登録 ----
  async function handleCreateDataset(e: React.FormEvent) {
    e.preventDefault()
    setDatasetSaving(true)
    try {
      const res = await fetch('/api/admin/datasets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...datasetForm,
          survey_year: parseInt(datasetForm.survey_year),
          published_at: datasetForm.published_at || null,
          source_url: datasetForm.source_url || null,
        }),
      })
      const json = await res.json()
      if (json.success) {
        setShowDatasetForm(false)
        setDatasetForm({
          name: '',
          category: 'occupation',
          survey_year: new Date().getFullYear().toString(),
          published_at: '',
          source_name: '厚生労働省',
          source_url: '',
        })
        await loadDatasets()
      } else {
        alert('登録失敗: ' + (json.message || ''))
      }
    } catch (e: any) {
      alert('エラー: ' + e.message)
    } finally {
      setDatasetSaving(false)
    }
  }

  // ---- データセット編集開始 ----
  function handleEditDataset(ds: Dataset) {
    setEditingDatasetId(ds.id)
    setEditForm({
      name: ds.name,
      category: ds.category,
      survey_year: ds.survey_year.toString(),
      published_at: ds.published_at?.slice(0, 10) ?? '',
      source_name: ds.source_name ?? '',
      source_url: ds.source_url ?? '',
    })
  }

  // ---- データセット更新保存 ----
  async function handleSaveDataset(e: React.FormEvent) {
    e.preventDefault()
    if (!editingDatasetId) return
    setEditSaving(true)
    try {
      const res = await fetch(`/api/admin/datasets/${editingDatasetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editForm,
          survey_year: parseInt(editForm.survey_year),
          published_at: editForm.published_at || null,
          source_url: editForm.source_url || null,
        }),
      })
      const json = await res.json()
      if (json.success) {
        setEditingDatasetId(null)
        await loadDatasets()
      } else {
        alert('更新失敗: ' + (json.message || ''))
      }
    } catch (e: any) {
      alert('エラー: ' + e.message)
    } finally {
      setEditSaving(false)
    }
  }

  // ---- データセット削除 ----
  async function handleDeleteDataset(id: number) {
    if (!confirm('このデータセットとすべての取込データを削除しますか？')) return
    try {
      await fetch(`/api/admin/datasets/${id}`, { method: 'DELETE' })
      await loadDatasets()
    } catch {}
  }

  // ---- ファイル選択 ----
  const handleFile = useCallback((file: File) => {
    setSelectedFile(file)
    setPreview(null)
    setImportResult(null)
  }, [])

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  // ---- CSVプレビュー ----
  async function handlePreview() {
    if (!selectedFile) return
    setPreviewing(true)
    setPreview(null)
    setImportResult(null)
    try {
      const fd = new FormData()
      fd.append('file', selectedFile)
      const res = await fetch('/api/admin/csv-preview', { method: 'POST', body: fd })
      const json = await res.json()
      if (json.success) {
        setPreview({ summary: json.summary, rows: json.preview, occupations: json.all_occupations })
        setPreviewPage(1)
      } else {
        alert('プレビュー失敗: ' + json.message)
      }
    } catch (e: any) {
      alert('エラー: ' + e.message)
    } finally {
      setPreviewing(false)
    }
  }

  // ---- CSV取込 ----
  async function handleImport() {
    if (!selectedFile || !selectedDatasetId) {
      alert('ファイルとデータセットを選択してください')
      return
    }
    if (!confirm(`「${preview?.summary.total_rows}件」のデータをデータベースに取り込みます。よろしいですか？`)) return
    setImporting(true)
    setImportResult(null)
    try {
      const fd = new FormData()
      fd.append('file', selectedFile)
      fd.append('dataset_id', selectedDatasetId)
      const res = await fetch('/api/admin/csv-import', { method: 'POST', body: fd })
      const json = await res.json()
      setImportResult({ success: json.success, message: json.message })
      if (json.success) {
        await loadDatasets()
      }
    } catch (e: any) {
      setImportResult({ success: false, message: e.message })
    } finally {
      setImporting(false)
    }
  }

  // ---- マウント時にデータセット一覧取得 ----
  if (!datasetsLoaded) loadDatasets()

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* ヘッダー */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center gap-3">
          <Database className="w-5 h-5 text-primary" />
          <h1 className="text-base font-bold text-foreground">AIリクルート 管理画面</h1>
          <span className="ml-auto text-xs text-muted-foreground">賃金統計データ管理</span>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8 flex flex-col gap-8">

        {/* ---- Step 1: DBスキーマ初期化 ---- */}
        <section className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">1</span>
            <h2 className="text-sm font-bold text-foreground">DBスキーマ初期化</h2>
            <span className="text-xs text-muted-foreground">（初回のみ実行）</span>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            <code className="bg-muted px-1.5 py-0.5 rounded text-xs">datasets</code> テーブルと
            <code className="bg-muted px-1.5 py-0.5 rounded text-xs">occupation_wages</code> テーブルを作成します。
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSetupSchema}
              disabled={schemaStatus === 'loading'}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {schemaStatus === 'loading' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
              テーブルを作成する
            </button>
            {schemaStatus === 'done' && (
              <span className="flex items-center gap-1.5 text-xs text-success">
                <CheckCircle2 className="w-3.5 h-3.5" />{schemaMessage}
              </span>
            )}
            {schemaStatus === 'error' && (
              <span className="flex items-center gap-1.5 text-xs text-destructive">
                <AlertCircle className="w-3.5 h-3.5" />{schemaMessage}
              </span>
            )}
          </div>
        </section>

        {/* ---- Step 2: データセット登録 ---- */}
        <section className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">2</span>
            <h2 className="text-sm font-bold text-foreground">データセット登録</h2>
          </div>

          {/* データセット一覧 */}
          {datasets.length > 0 && (
            <div className="mb-4 overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-4 text-muted-foreground font-medium">ID</th>
                    <th className="text-left py-2 pr-4 text-muted-foreground font-medium">データベース名</th>
                    <th className="text-left py-2 pr-4 text-muted-foreground font-medium">カテゴリ</th>
                    <th className="text-left py-2 pr-4 text-muted-foreground font-medium">調査年</th>
                    <th className="text-left py-2 pr-4 text-muted-foreground font-medium">公表日</th>
                    <th className="text-left py-2 pr-4 text-muted-foreground font-medium">データソース</th>
                    <th className="text-right py-2 pr-4 text-muted-foreground font-medium">取込件数</th>
                    <th className="text-right py-2 text-muted-foreground font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {datasets.map(ds => (
                    editingDatasetId === ds.id ? (
                      /* インライン編集行 */
                      <tr key={ds.id} className="border-b border-primary/30 bg-muted/10">
                        <td colSpan={8} className="py-3 px-2">
                          <form onSubmit={handleSaveDataset}>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                              <div className="sm:col-span-3">
                                <label className="block text-[10px] text-muted-foreground mb-0.5">データベース名 <span className="text-destructive">*</span></label>
                                <input
                                  required
                                  value={editForm.name}
                                  onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                                  className="w-full bg-background border border-border rounded-md px-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-muted-foreground mb-0.5">カテゴリ</label>
                                <select
                                  value={editForm.category}
                                  onChange={e => setEditForm(p => ({ ...p, category: e.target.value }))}
                                  className="w-full bg-background border border-border rounded-md px-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary"
                                >
                                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className="block text-[10px] text-muted-foreground mb-0.5">調査年</label>
                                <input
                                  required type="number" min="2000" max="2100"
                                  value={editForm.survey_year}
                                  onChange={e => setEditForm(p => ({ ...p, survey_year: e.target.value }))}
                                  className="w-full bg-background border border-border rounded-md px-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-muted-foreground mb-0.5">公表日</label>
                                <input
                                  type="date"
                                  value={editForm.published_at}
                                  onChange={e => setEditForm(p => ({ ...p, published_at: e.target.value }))}
                                  className="w-full bg-background border border-border rounded-md px-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-muted-foreground mb-0.5">データソース</label>
                                <input
                                  value={editForm.source_name}
                                  onChange={e => setEditForm(p => ({ ...p, source_name: e.target.value }))}
                                  className="w-full bg-background border border-border rounded-md px-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-muted-foreground mb-0.5">元ファイルURL</label>
                                <input
                                  type="url"
                                  value={editForm.source_url}
                                  onChange={e => setEditForm(p => ({ ...p, source_url: e.target.value }))}
                                  placeholder="https://..."
                                  className="w-full bg-background border border-border rounded-md px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                                />
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="submit"
                                disabled={editSaving}
                                className="flex items-center gap-1 bg-primary text-primary-foreground px-3 py-1 rounded-md text-xs font-semibold hover:opacity-90 disabled:opacity-50"
                              >
                                {editSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                                保存
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingDatasetId(null)}
                                className="flex items-center gap-1 border border-border text-muted-foreground px-3 py-1 rounded-md text-xs hover:text-foreground"
                              >
                                <X className="w-3 h-3" />
                                キャンセル
                              </button>
                            </div>
                          </form>
                        </td>
                      </tr>
                    ) : (
                      /* 通常行 */
                      <tr key={ds.id} className="border-b border-border/50 hover:bg-muted/20">
                        <td className="py-2 pr-4 text-muted-foreground">{ds.id}</td>
                        <td className="py-2 pr-4 text-foreground font-medium">{ds.name}</td>
                        <td className="py-2 pr-4">
                          <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-[10px]">
                            {CATEGORIES.find(c => c.value === ds.category)?.label ?? ds.category}
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">{ds.survey_year}年</td>
                        <td className="py-2 pr-4 text-muted-foreground">{ds.published_at?.slice(0, 10) ?? '-'}</td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {ds.source_url ? (
                            <a href={ds.source_url} target="_blank" rel="noopener noreferrer" className="text-primary underline truncate max-w-[120px] block">
                              {ds.source_name ?? ds.source_url}
                            </a>
                          ) : (ds.source_name ?? '-')}
                        </td>
                        <td className="py-2 pr-4 text-right text-foreground">{ds.record_count.toLocaleString()}件</td>
                        <td className="py-2 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleEditDataset(ds)}
                              className="text-muted-foreground hover:text-primary transition-colors"
                              title="編集"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteDataset(ds.id)}
                              className="text-muted-foreground hover:text-destructive transition-colors"
                              title="削除"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 登録フォーム */}
          {showDatasetForm ? (
            <form onSubmit={handleCreateDataset} className="border border-border rounded-lg p-4 bg-muted/20">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-semibold text-foreground">新規データセット登録</p>
                <button type="button" onClick={() => setShowDatasetForm(false)}>
                  <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs text-muted-foreground mb-1">データベース名 <span className="text-destructive">*</span></label>
                  <input
                    required
                    value={datasetForm.name}
                    onChange={e => setDatasetForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="例: 令和7年賃金構造基本統計調査 職種別"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">カテゴリ <span className="text-destructive">*</span></label>
                  <select
                    required
                    value={datasetForm.category}
                    onChange={e => setDatasetForm(p => ({ ...p, category: e.target.value }))}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                  >
                    {CATEGORIES.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">調査年 <span className="text-destructive">*</span></label>
                  <input
                    required
                    type="number"
                    min="2000"
                    max="2100"
                    value={datasetForm.survey_year}
                    onChange={e => setDatasetForm(p => ({ ...p, survey_year: e.target.value }))}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">公表日</label>
                  <input
                    type="date"
                    value={datasetForm.published_at}
                    onChange={e => setDatasetForm(p => ({ ...p, published_at: e.target.value }))}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">データソース</label>
                  <input
                    value={datasetForm.source_name}
                    onChange={e => setDatasetForm(p => ({ ...p, source_name: e.target.value }))}
                    placeholder="例: 厚生労働省"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs text-muted-foreground mb-1">元ファイルURL</label>
                  <input
                    type="url"
                    value={datasetForm.source_url}
                    onChange={e => setDatasetForm(p => ({ ...p, source_url: e.target.value }))}
                    placeholder="https://www.mhlw.go.jp/..."
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  type="submit"
                  disabled={datasetSaving}
                  className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-xs font-semibold hover:opacity-90 disabled:opacity-50"
                >
                  {datasetSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  登録する
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowDatasetForm(true)}
              className="flex items-center gap-1.5 border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-primary px-4 py-2 rounded-lg text-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              データセットを追加
            </button>
          )}
        </section>

        {/* ---- Step 3: CSVアップロード・プレビュー・取込 ---- */}
        <section className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">3</span>
            <h2 className="text-sm font-bold text-foreground">CSV取込</h2>
          </div>

          {/* 対象データセット選択 */}
          <div className="mb-4">
            <label className="block text-xs text-muted-foreground mb-1.5">取込先データセット</label>
            <select
              value={selectedDatasetId}
              onChange={e => setSelectedDatasetId(e.target.value)}
              className="bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary min-w-[280px]"
            >
              <option value="">-- データセットを選択 --</option>
              {datasets.map(ds => (
                <option key={ds.id} value={ds.id}>
                  [{ds.id}] {ds.name} ({ds.survey_year}年)
                </option>
              ))}
            </select>
            {datasets.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1.5">まずStep 2でデータセットを登録してください</p>
            )}
          </div>

          {/* ドラッグ&ドロップゾーン */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors mb-4
              ${dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/20'}`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }}
            />
            {selectedFile ? (
              <div className="flex flex-col items-center gap-2">
                <FileText className="w-8 h-8 text-primary" />
                <p className="text-sm font-semibold text-foreground">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">{fmtBytes(selectedFile.size)}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="w-8 h-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">CSVファイルをドラッグ&ドロップ</p>
                <p className="text-xs text-muted-foreground">または クリックして選択</p>
                <p className="text-[10px] text-muted-foreground mt-1">対応形式: 賃金構造基本統計調査（Shift-JIS / UTF-8）</p>
              </div>
            )}
          </div>

          {/* アクションボタン */}
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={handlePreview}
              disabled={!selectedFile || previewing}
              className="flex items-center gap-2 border border-border text-foreground px-4 py-2 rounded-lg text-xs font-semibold hover:bg-muted/30 transition-colors disabled:opacity-50"
            >
              {previewing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
              プレビュー確認
            </button>
            <button
              onClick={handleImport}
              disabled={!selectedFile || !selectedDatasetId || !preview || importing}
              className="flex items-center gap-2 bg-accent text-accent-foreground px-4 py-2 rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              DBに��り込む
            </button>
          </div>

          {/* 取込結果 */}
          {importResult && (
            <div className={`mt-4 flex items-center gap-2 text-xs px-4 py-3 rounded-lg border ${
              importResult.success
                ? 'bg-success/10 border-success/30 text-success'
                : 'bg-destructive/10 border-destructive/30 text-destructive'
            }`}>
              {importResult.success
                ? <CheckCircle2 className="w-4 h-4 shrink-0" />
                : <AlertCircle className="w-4 h-4 shrink-0" />}
              {importResult.message}
            </div>
          )}
        </section>

        {/* ---- プレビュー結果 ---- */}
        {preview && (
          <section className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <Eye className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-bold text-foreground">プレビュー結果</h2>
              <span className="ml-auto text-xs text-muted-foreground">
                全 {preview.rows.length.toLocaleString()} 件
              </span>
            </div>

            {/* サマリーカード */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              {[
                { label: '総レコード数', value: preview.summary.total_rows.toLocaleString() + '件' },
                { label: '職種数', value: preview.summary.occupation_count.toLocaleString() + '職種' },
                { label: 'ファイルサイズ', value: fmtBytes(preview.summary.file_size) },
                { label: '性別内訳（男女計）', value: preview.summary.sex_breakdown['計'].toLocaleString() + '件' },
              ].map(({ label, value }) => (
                <div key={label} className="bg-muted/30 rounded-lg px-4 py-3">
                  <p className="text-[10px] text-muted-foreground">{label}</p>
                  <p className="text-sm font-bold text-foreground mt-0.5">{value}</p>
                </div>
              ))}
            </div>

            {/* 職種一覧 */}
            {preview.occupations.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-muted-foreground mb-2">含まれる職種（上位{preview.occupations.length}件）:</p>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                  {preview.occupations.map(occ => (
                    <span key={occ} className="bg-muted text-foreground text-[10px] px-2 py-0.5 rounded">
                      {occ}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* データテーブル（ページネーション） */}
            {(() => {
              const totalPages = Math.ceil(preview.rows.length / PREVIEW_PAGE_SIZE)
              const pageRows = preview.rows.slice((previewPage - 1) * PREVIEW_PAGE_SIZE, previewPage * PREVIEW_PAGE_SIZE)
              return (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          {['#', '職種名', '性別', '企業規模', '年齢', '勤続年数', '月給(千円)', '所定内(千円)', '年間賞与(千円)', '推計年収(千円)', '労働者数(十人)'].map(h => (
                            <th key={h} className="text-left py-2 px-2 text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pageRows.map((row, i) => {
                          const absIdx = (previewPage - 1) * PREVIEW_PAGE_SIZE + i + 1
                          return (
                            <tr key={absIdx} className={`border-b border-border/40 hover:bg-muted/20 ${absIdx % 2 === 0 ? 'bg-muted/10' : ''}`}>
                              <td className="py-1.5 px-2 text-muted-foreground text-right">{absIdx}</td>
                              <td className="py-1.5 px-2 text-foreground max-w-[200px] truncate" title={row.occupation_name}>{row.occupation_name}</td>
                              <td className="py-1.5 px-2 text-muted-foreground whitespace-nowrap">{row.sex}</td>
                              <td className="py-1.5 px-2 text-muted-foreground whitespace-nowrap">{row.enterprise_size}</td>
                              <td className="py-1.5 px-2 text-right text-muted-foreground">{fmt(row.age)}</td>
                              <td className="py-1.5 px-2 text-right text-muted-foreground">{fmt(row.tenure_years)}</td>
                              <td className="py-1.5 px-2 text-right text-foreground">{fmt(row.monthly_wage)}</td>
                              <td className="py-1.5 px-2 text-right text-foreground">{fmt(row.scheduled_wage)}</td>
                              <td className="py-1.5 px-2 text-right text-foreground">{fmt(row.annual_bonus)}</td>
                              <td className="py-1.5 px-2 text-right font-semibold text-accent">{fmt(row.annual_income)}</td>
                              <td className="py-1.5 px-2 text-right text-muted-foreground">{fmt(row.workers)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* ページネーションコントロール */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
                      <p className="text-xs text-muted-foreground">
                        {((previewPage - 1) * PREVIEW_PAGE_SIZE + 1).toLocaleString()}〜{Math.min(previewPage * PREVIEW_PAGE_SIZE, preview.rows.length).toLocaleString()}件 / 全{preview.rows.length.toLocaleString()}件
                      </p>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setPreviewPage(1)}
                          disabled={previewPage === 1}
                          className="px-2 py-1 text-xs border border-border rounded text-muted-foreground hover:text-foreground hover:bg-muted/30 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          最初
                        </button>
                        <button
                          onClick={() => setPreviewPage(p => Math.max(1, p - 1))}
                          disabled={previewPage === 1}
                          className="p-1 border border-border rounded text-muted-foreground hover:text-foreground hover:bg-muted/30 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        {/* ページ番号ボタン（前後2ページ表示） */}
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          const start = Math.max(1, Math.min(previewPage - 2, totalPages - 4))
                          return start + i
                        }).map(p => (
                          <button
                            key={p}
                            onClick={() => setPreviewPage(p)}
                            className={`w-7 h-7 text-xs border rounded transition-colors ${
                              p === previewPage
                                ? 'border-primary bg-primary text-primary-foreground font-semibold'
                                : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted/30'
                            }`}
                          >
                            {p}
                          </button>
                        ))}
                        <button
                          onClick={() => setPreviewPage(p => Math.min(totalPages, p + 1))}
                          disabled={previewPage === totalPages}
                          className="p-1 border border-border rounded text-muted-foreground hover:text-foreground hover:bg-muted/30 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setPreviewPage(totalPages)}
                          disabled={previewPage === totalPages}
                          className="px-2 py-1 text-xs border border-border rounded text-muted-foreground hover:text-foreground hover:bg-muted/30 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          最後
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )
            })()}

            {/* 取込ボタン（プレビュー下） */}
            <div className="mt-5 pt-4 border-t border-border flex items-center gap-3">
              <p className="text-xs text-muted-foreground flex-1">
                上記内容を確認した上で、取込先データセットを選択してDBに取り込んでください。
              </p>
              <button
                onClick={handleImport}
                disabled={!selectedDatasetId || importing}
                className="flex items-center gap-2 bg-accent text-accent-foreground px-5 py-2 rounded-lg text-xs font-semibold hover:opacity-90 disabled:opacity-50"
              >
                {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                このデータをDBに取り込む
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
