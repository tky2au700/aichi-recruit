'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Database, Upload, FileText, CheckCircle2, AlertCircle,
  Loader2, Eye, Trash2, Plus, X, Pencil, ChevronLeft,
  ChevronRight, Settings, FolderOpen, RefreshCw, BookOpen, ExternalLink,
} from 'lucide-react'

// ---- 型定義 ----
interface DataSource {
  id: number
  name: string
  url: string | null
  description: string | null
  created_at: string
}

interface DatasetGroup {
  id: number
  survey_group_name: string
  survey_table_name: string | null
  name: string
  category: string
  target_table: string
  publisher_id: number | null
  publisher_name: string | null
  publisher_url: string | null
  distributor_id: number | null
  distributor_name: string | null
  distributor_url: string | null
  sex_label_mode: 'cell_combined' | 'separate_row'
  data_start_row: number
  name_col_index: number
  size1_col_start: number
  size2_col_start: number
  size3_col_start: number
  size4_col_start: number
  parse_notes: string | null
  created_at: string
  dataset_count: number
  year_min: number | null
  year_max: number | null
  total_records: number | null
}

interface Dataset {
  id: number
  group_id: number
  group_name: string
  category: string
  survey_year: number
  published_at: string | null
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
  { value: 'occupation',  label: '職種別' },
  { value: 'industry',    label: '産業別' },
  { value: 'prefecture',  label: '都道府県別' },
  { value: 'education',   label: '学歴別' },
  { value: 'age',         label: '年齢別' },
]

const TARGET_TABLES = [
  { value: 'occupation_wages', label: 'occupation_wages（職種別）' },
  { value: 'industry_wages',   label: 'industry_wages（業種・年齢階級別）' },
]

function fmt(v: number | null): string {
  return v == null ? '-' : v.toLocaleString()
}

// ============================================================
// メインページ
// ============================================================
export default function AdminPage() {
  const [tab, setTab] = useState<'sources' | 'groups' | 'data' | 'schema'>('sources')

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 py-4 flex items-center gap-3">
          <Database className="w-5 h-5 text-primary" />
          <h1 className="text-base font-bold">年収データベース 管理画面</h1>
          <a href="/" className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors">
            サイトへ戻る
          </a>
        </div>
      </header>

      <div className="border-b border-border bg-card/60">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex">
            {([
              { key: 'sources', label: 'データソース管理', icon: BookOpen },
              { key: 'groups',  label: '調査グループ管理', icon: FolderOpen },
              { key: 'data',    label: 'データ登録・CSV取込', icon: Upload },
              { key: 'schema',  label: 'DB初期化', icon: Settings },
            ] as const).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex items-center gap-2 px-5 py-3 text-xs font-medium border-b-2 transition-colors ${
                  tab === key
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-8">
        {tab === 'sources' && <DataSourcesTab />}
        {tab === 'groups'  && <GroupsTab />}
        {tab === 'data'    && <DataTab />}
        {tab === 'schema'  && <SchemaTab />}
      </main>
    </div>
  )
}

// ============================================================
// タブ1: データソース管理
// ============================================================
function defaultSourceForm() {
  return { name: '', url: '', description: '' }
}

function DataSourcesTab() {
  const [sources, setSources]     = useState<DataSource[]>([])
  const [loading, setLoading]     = useState(true)
  const [editingId, setEditingId] = useState<number | 'new' | null>(null)
  const [form, setForm]           = useState(defaultSourceForm())
  const [saving, setSaving]       = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [dbWarning, setDbWarning]     = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/data-sources')
      const j   = await res.json()
      if (j.success) {
        setSources(j.data)
        setDbWarning(j.warning ?? null)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function openNew() {
    setForm(defaultSourceForm())
    setEditingId('new')
    setDeleteError(null)
  }

  function openEdit(s: DataSource) {
    setForm({ name: s.name, url: s.url ?? '', description: s.description ?? '' })
    setEditingId(s.id)
    setDeleteError(null)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { name: form.name, url: form.url || null, description: form.description || null }
      const url    = editingId === 'new' ? '/api/admin/data-sources' : `/api/admin/data-sources/${editingId}`
      const method = editingId === 'new' ? 'POST' : 'PATCH'
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const j      = await res.json()
      if (j.success) { setEditingId(null); await load() }
      else alert('保存失敗: ' + j.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('このデータソースを削除しますか？')) return
    setDeletingId(id)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/admin/data-sources/${id}`, { method: 'DELETE' })
      const j   = await res.json()
      if (j.success) { await load() }
      else setDeleteError(j.message)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold">データソース管理</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            提供元（例: 厚生労働省）と流通元（例: e-Stat）を登録します。調査グループから参照します。
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-xs font-semibold hover:opacity-90"
        >
          <Plus className="w-3.5 h-3.5" />新規ソース
        </button>
      </div>

      {dbWarning && (
        <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg px-3 py-2 text-xs">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {dbWarning}「DB初期化」タブからスキーマを実行してください。
        </div>
      )}
      {deleteError && (
        <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg px-3 py-2 text-xs">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {deleteError}
        </div>
      )}

      {editingId !== null && (
        <div className="bg-card border border-primary/30 rounded-xl p-5">
          <h3 className="text-xs font-bold mb-4">{editingId === 'new' ? '新規データソース作成' : 'データソース編集'}</h3>
          <form onSubmit={handleSave} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-muted-foreground mb-0.5">名前 <span className="text-destructive">*</span></label>
                <input
                  required value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="例: 厚生労働省、e-Stat"
                  className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-[10px] text-muted-foreground mb-0.5">公式URL（任意）</label>
                <input
                  type="url" value={form.url}
                  onChange={e => setForm(p => ({ ...p, url: e.target.value }))}
                  placeholder="https://..."
                  className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] text-muted-foreground mb-0.5">説明・備考（任意）</label>
              <textarea
                rows={2} value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="このデータソースについての補足情報"
                className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={saving}
                className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-1.5 rounded-md text-xs font-semibold hover:opacity-90 disabled:opacity-50">
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}保存
              </button>
              <button type="button" onClick={() => setEditingId(null)}
                className="flex items-center gap-1.5 border border-border text-muted-foreground px-4 py-1.5 rounded-md text-xs hover:text-foreground">
                <X className="w-3 h-3" />キャンセル
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : sources.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          データソースがまだありません。「新規ソース」から追加してください。
        </div>
      ) : (
        <div className="space-y-2">
          {sources.map(s => (
            <div key={s.id} className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{s.name}</span>
                  {s.url && (
                    <a href={s.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-0.5 text-[10px] text-primary hover:opacity-80">
                      <ExternalLink className="w-2.5 h-2.5" />
                      {s.url.replace(/^https?:\/\//, '').split('/')[0]}
                    </a>
                  )}
                </div>
                {s.description && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">{s.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => openEdit(s)} className="text-muted-foreground hover:text-primary transition-colors" title="編集">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(s.id)} disabled={deletingId === s.id}
                  className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50" title="削除">
                  {deletingId === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================
// タブ2: 調査グループ管理
// ============================================================
function defaultGroupForm() {
  return {
    survey_group_name: '', survey_table_name: '',
    category: 'occupation',
    target_table: 'occupation_wages',
    publisher_id: '', distributor_id: '',
    sex_label_mode: 'cell_combined',
    data_start_row: '10', name_col_index: '1',
    size1_col_start: '3', size2_col_start: '11',
    size3_col_start: '19', size4_col_start: '27',
    parse_notes: '',
  }
}

function GroupsTab() {
  const [groups, setGroups]         = useState<DatasetGroup[]>([])
  const [dataSources, setDataSources] = useState<DataSource[]>([])
  const [loading, setLoading]       = useState(true)
  const [editingId, setEditingId]   = useState<number | 'new' | null>(null)
  const [form, setForm]             = useState(defaultGroupForm())
  const [saving, setSaving]         = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [grRes, dsRes] = await Promise.all([
        fetch('/api/admin/dataset-groups'),
        fetch('/api/admin/data-sources'),
      ])
      const [grJ, dsJ] = await Promise.all([grRes.json(), dsRes.json()])
      if (grJ.success) setGroups(grJ.data)
      if (dsJ.success) setDataSources(dsJ.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function openNew() {
    setForm(defaultGroupForm())
    setEditingId('new')
  }

  function openEdit(g: DatasetGroup) {
    setForm({
      survey_group_name: g.survey_group_name ?? g.name,
      survey_table_name: g.survey_table_name ?? '',
      category: g.category,
      target_table: g.target_table ?? 'occupation_wages',
      publisher_id:   g.publisher_id   != null ? String(g.publisher_id)   : '',
      distributor_id: g.distributor_id != null ? String(g.distributor_id) : '',
      sex_label_mode: g.sex_label_mode ?? 'cell_combined',
      data_start_row:  String(g.data_start_row),
      name_col_index:  String(g.name_col_index),
      size1_col_start: String(g.size1_col_start),
      size2_col_start: String(g.size2_col_start),
      size3_col_start: String(g.size3_col_start),
      size4_col_start: String(g.size4_col_start),
      parse_notes: g.parse_notes ?? '',
    })
    setEditingId(g.id)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        survey_group_name: form.survey_group_name,
        survey_table_name: form.survey_table_name || null,
        category:          form.category,
        target_table:      form.target_table,
        sex_label_mode:    form.sex_label_mode,
        publisher_id:    form.publisher_id   ? Number(form.publisher_id)   : null,
        distributor_id:  form.distributor_id ? Number(form.distributor_id) : null,
        data_start_row:  Number(form.data_start_row),
        name_col_index:  Number(form.name_col_index),
        size1_col_start: Number(form.size1_col_start),
        size2_col_start: Number(form.size2_col_start),
        size3_col_start: Number(form.size3_col_start),
        size4_col_start: Number(form.size4_col_start),
        parse_notes: form.parse_notes || null,
      }
      const url    = editingId === 'new' ? '/api/admin/dataset-groups' : `/api/admin/dataset-groups/${editingId}`
      const method = editingId === 'new' ? 'POST' : 'PATCH'
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const j      = await res.json()
      if (j.success) { setEditingId(null); await load() }
      else alert('保存失敗: ' + j.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('このグループと関連する全データを削除しますか？')) return
    setDeletingId(id)
    try {
      await fetch(`/api/admin/dataset-groups/${id}`, { method: 'DELETE' })
      await load()
    } finally {
      setDeletingId(null)
    }
  }

  const ruleFields = [
    { key: 'data_start_row',  label: 'データ開始行' },
    { key: 'name_col_index',  label: '職種名列' },
    { key: 'size1_col_start', label: '規模計列' },
    { key: 'size2_col_start', label: '1000人+列' },
    { key: 'size3_col_start', label: '100-999人列' },
    { key: 'size4_col_start', label: '10-99人列' },
  ] as const

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold">調査グループ管理</h2>
          <p className="text-xs text-muted-foreground mt-0.5">調査名・カテゴリ・CSVパースルールをグループとして登録します</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-xs font-semibold hover:opacity-90"
        >
          <Plus className="w-3.5 h-3.5" />新規グループ
        </button>
      </div>

      {editingId !== null && (
        <div className="bg-card border border-primary/30 rounded-xl p-5">
          <h3 className="text-xs font-bold mb-4">{editingId === 'new' ? '新規グループ作成' : 'グループ編集'}</h3>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[10px] text-muted-foreground mb-0.5">
                  調査グループ名 <span className="text-destructive">*</span>
                </label>
                <input
                  required value={form.survey_group_name}
                  onChange={e => setForm(p => ({ ...p, survey_group_name: e.target.value }))}
                  placeholder="例: 賃金構造基本統計調査"
                  className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                />
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">統計調査の名称（共通の親グループ）</p>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[10px] text-muted-foreground mb-0.5">調査表名（任意）</label>
                <input
                  value={form.survey_table_name}
                  onChange={e => setForm(p => ({ ...p, survey_table_name: e.target.value }))}
                  placeholder="例: 職種（小分類）、性別きまって支給する現金給与額…（産業計）"
                  className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                />
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">表番号・集計軸など表ごとの固有名</p>
              </div>
              <div>
                <label className="block text-[10px] text-muted-foreground mb-0.5">カテゴリ</label>
                <select
                  value={form.category}
                  onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                  className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-xs focus:outline-none focus:border-primary"
                >
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-muted-foreground mb-0.5">
                  インポート先テーブル <span className="text-destructive">*</span>
                </label>
                <select
                  value={form.target_table}
                  onChange={e => setForm(p => ({ ...p, target_table: e.target.value }))}
                  className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-xs focus:outline-none focus:border-primary"
                >
                  {TARGET_TABLES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">CSVまたはXLSXのデータを書き込むテーブル</p>
              </div>
              <div>
                <label className="block text-[10px] text-muted-foreground mb-0.5">提供元（データの所有者）</label>
                <select
                  value={form.publisher_id}
                  onChange={e => setForm(p => ({ ...p, publisher_id: e.target.value }))}
                  className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-xs focus:outline-none focus:border-primary"
                >
                  <option value="">未設定</option>
                  {dataSources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">例: 厚生労働省</p>
              </div>
              <div>
                <label className="block text-[10px] text-muted-foreground mb-0.5">流通元（ファイル取得先）</label>
                <select
                  value={form.distributor_id}
                  onChange={e => setForm(p => ({ ...p, distributor_id: e.target.value }))}
                  className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-xs focus:outline-none focus:border-primary"
                >
                  <option value="">未設定</option>
                  {dataSources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">例: e-Stat（提供元と同じ場合は未設定可）</p>
              </div>
            </div>

            <div className="border border-border rounded-lg p-3">
              <p className="text-[10px] font-semibold text-muted-foreground mb-3">CSVパースルール（列インデックスは0始まり）</p>
              <div className="mb-3">
                <label className="block text-[10px] text-muted-foreground mb-0.5">性別ラベルの形式</label>
                <select
                  value={form.sex_label_mode}
                  onChange={e => setForm(p => ({ ...p, sex_label_mode: e.target.value }))}
                  className="w-full sm:w-auto bg-background border border-border rounded-md px-3 py-1.5 text-xs focus:outline-none focus:border-primary"
                >
                  <option value="cell_combined">同一セル内（"男女計\n職種名" 形式）</option>
                  <option value="separate_row">独立行（性別ラベルが別行に存在する形式）</option>
                </select>
                <p className="text-[10px] text-muted-foreground/60 mt-1">
                  {form.sex_label_mode === 'cell_combined'
                    ? '例: セル内容 "　男女計\\n\\n管理的職業従事者" → 性別=計、職種=管理的職業従事者'
                    : '例: 行N "男女計"（数値なし）→ 以降の行に職種名が続く形式（令和7年以降の新形式）'}
                </p>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {ruleFields.map(({ key, label }) => (
                  <div key={key}>
                    <label className="block text-[10px] text-muted-foreground mb-0.5">{label}</label>
                    <input
                      type="number" min="0" required
                      value={form[key]}
                      onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                      className="w-full bg-background border border-border rounded-md px-2 py-1 text-xs text-right focus:outline-none focus:border-primary"
                    />
                  </div>
                ))}
              </div>
              <div className="mt-2">
                <label className="block text-[10px] text-muted-foreground mb-0.5">メモ</label>
                <textarea
                  rows={2} value={form.parse_notes}
                  onChange={e => setForm(p => ({ ...p, parse_notes: e.target.value }))}
                  placeholder="パースルールや特記事項を自由記述"
                  className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button type="submit" disabled={saving}
                className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-1.5 rounded-md text-xs font-semibold hover:opacity-90 disabled:opacity-50">
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}保存
              </button>
              <button type="button" onClick={() => setEditingId(null)}
                className="flex items-center gap-1.5 border border-border text-muted-foreground px-4 py-1.5 rounded-md text-xs hover:text-foreground">
                <X className="w-3 h-3" />キャンセル
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          グループがまだありません。「新規グループ」から追加してください。
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(g => (
            <div key={g.id} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="mb-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">
                        {g.survey_group_name ?? g.name}
                      </span>
                      <span className="shrink-0 bg-primary/10 text-primary px-2 py-0.5 rounded text-[10px]">
                        {CATEGORIES.find(c => c.value === g.category)?.label ?? g.category}
                      </span>
                      <span className="shrink-0 bg-muted text-muted-foreground px-2 py-0.5 rounded text-[10px] font-mono">
                        {g.target_table ?? 'occupation_wages'}
                      </span>
                      {g.publisher_name && (
                        <span className="shrink-0 bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded text-[10px]">
                          {g.publisher_name}
                        </span>
                      )}
                      {g.distributor_name && g.distributor_name !== g.publisher_name && (
                        <span className="shrink-0 bg-green-500/10 text-green-400 px-2 py-0.5 rounded text-[10px]">
                          via {g.distributor_name}
                        </span>
                      )}
                    </div>
                    {g.survey_table_name && (
                      <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                        {g.survey_table_name}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                    <span>調査年: {g.year_min && g.year_max
                      ? g.year_min === g.year_max ? `${g.year_min}年` : `${g.year_min}〜${g.year_max}年`
                      : 'なし'}</span>
                    <span>{g.dataset_count}年分</span>
                    <span>総レコード: {(g.total_records ?? 0).toLocaleString()}件</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-3 text-[10px] text-muted-foreground/60 flex-wrap">
                    <span>開始行: {g.data_start_row}</span>
                    <span>職種列: {g.name_col_index}</span>
                    <span className={g.sex_label_mode === 'separate_row' ? 'text-accent/70' : ''}>
                      性別: {g.sex_label_mode === 'separate_row' ? '独立行形式' : '同一セル形式'}
                    </span>
                    <span>規模計: {g.size1_col_start}</span>
                    <span>1000人+: {g.size2_col_start}</span>
                    <span>100-999人: {g.size3_col_start}</span>
                    <span>10-99人: {g.size4_col_start}</span>
                  </div>
                  {g.parse_notes && (
                    <p className="mt-1 text-[10px] text-muted-foreground/60 italic">{g.parse_notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => openEdit(g)} className="text-muted-foreground hover:text-primary transition-colors" title="編集">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(g.id)} disabled={deletingId === g.id}
                    className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50" title="削除">
                    {deletingId === g.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================
// タブ2: データ登録・CSV取込
// ============================================================
function DataTab() {
  const [groups, setGroups]               = useState<DatasetGroup[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)
  const [datasets, setDatasets]           = useState<Dataset[]>([])
  const [loadingDs, setLoadingDs]         = useState(false)

  // 子データセット追加
  const [showAddDs, setShowAddDs]         = useState(false)
  const [dsForm, setDsForm]               = useState({ survey_year: '', published_at: '', source_url: '' })
  const [savingDs, setSavingDs]           = useState(false)

  // 子データセット編集
  const [editingDsId, setEditingDsId]     = useState<number | null>(null)
  const [editDsForm, setEditDsForm]       = useState({ survey_year: '', published_at: '', source_url: '' })
  const [savingEditDs, setSavingEditDs]   = useState(false)

  // CSV / XLSX 取込共通
  const [selectedDatasetId, setSelectedDatasetId] = useState<number | null>(null)
  const [csvFile, setCsvFile]             = useState<File | null>(null)
  const [isXlsx, setIsXlsx]               = useState(false)
  const [dragging, setDragging]           = useState(false)
  const [previewing, setPreviewing]       = useState(false)
  const [preview, setPreview]             = useState<{ summary: PreviewSummary; rows: PreviewRow[] } | null>(null)
  const [previewPage, setPreviewPage]     = useState(1)
  const PREVIEW_PAGE_SIZE = 50
  const [importing, setImporting]         = useState(false)
  const [importMsg, setImportMsg]         = useState<{ ok: boolean; text: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // XLSX 専用
  interface XlsxSheet {
    sheet_name:    string
    industry_name: string
    row_count:     number
    parseable:     boolean
  }
  interface XlsxImportResult {
    sheet_name:    string
    industry_name: string
    inserted:      number
    error?:        string
  }
  interface XlsxSheetDetail {
    sheet_name:    string
    industry_name: string
    preview:       Record<string, unknown>[]
  }
  interface XlsxProgress {
    current:       number   // 処理済みシート数
    total:         number   // 全シート数
    currentSheet:  string   // 処理中シート名
    totalInserted: number   // 挿入済み合計件数
  }
  const [xlsxSheets, setXlsxSheets]           = useState<XlsxSheet[] | null>(null)
  const [xlsxPreviewing, setXlsxPreviewing]   = useState(false)
  const [xlsxImporting, setXlsxImporting]     = useState(false)
  const [xlsxResults, setXlsxResults]         = useState<XlsxImportResult[] | null>(null)
  const [xlsxProgress, setXlsxProgress]       = useState<XlsxProgress | null>(null)
  const [sheetDetail, setSheetDetail]         = useState<XlsxSheetDetail | null>(null)
  const [sheetDetailLoading, setSheetDetailLoading] = useState(false)

  const selectedGroup = groups.find(g => g.id === selectedGroupId) ?? null

  useEffect(() => {
    fetch('/api/admin/dataset-groups')
      .then(r => r.json())
      .then(j => { if (j.success) setGroups(j.data) })
  }, [])

  const loadDatasets = useCallback(async (gid: number) => {
    setLoadingDs(true)
    try {
      const res = await fetch(`/api/admin/datasets?group_id=${gid}`)
      const j   = await res.json()
      if (j.success) setDatasets(j.data)
    } finally {
      setLoadingDs(false)
    }
  }, [])

  function selectGroup(gid: number) {
    setSelectedGroupId(gid)
    setSelectedDatasetId(null)
    setPreview(null)
    setImportMsg(null)
    setCsvFile(null)
    setIsXlsx(false)
    setXlsxSheets(null)
    setXlsxResults(null)
    setXlsxProgress(null)
    setSheetDetail(null)
    setShowAddDs(false)
    setEditingDsId(null)
    loadDatasets(gid)
  }

  async function handleAddDs(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedGroupId) return
    setSavingDs(true)
    try {
      const res = await fetch('/api/admin/datasets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          group_id: selectedGroupId,
          survey_year: Number(dsForm.survey_year),
          published_at: dsForm.published_at || null,
          source_url: dsForm.source_url || null,
        }),
      })
      const j = await res.json()
      if (j.success) {
        setShowAddDs(false)
        setDsForm({ survey_year: '', published_at: '', source_url: '' })
        await loadDatasets(selectedGroupId)
      } else {
        alert('追加失敗: ' + j.message)
      }
    } finally {
      setSavingDs(false)
    }
  }

  function openEditDs(ds: Dataset) {
    setEditingDsId(ds.id)
    setEditDsForm({
      survey_year:  String(ds.survey_year),
      published_at: ds.published_at?.slice(0, 10) ?? '',
      source_url:   ds.source_url ?? '',
    })
  }

  async function handleSaveEditDs(e: React.FormEvent) {
    e.preventDefault()
    if (!editingDsId || !selectedGroupId) return
    setSavingEditDs(true)
    try {
      const res = await fetch(`/api/admin/datasets/${editingDsId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          survey_year:  Number(editDsForm.survey_year),
          published_at: editDsForm.published_at || null,
          source_url:   editDsForm.source_url || null,
        }),
      })
      const j = await res.json()
      if (j.success) { setEditingDsId(null); await loadDatasets(selectedGroupId) }
      else alert('更新失敗: ' + j.message)
    } finally {
      setSavingEditDs(false)
    }
  }

  async function handleDeleteDs(id: number) {
    if (!confirm('このデータセットと取込済みデータを削除しますか？')) return
    if (!selectedGroupId) return
    await fetch(`/api/admin/datasets/${id}`, { method: 'DELETE' })
    if (selectedDatasetId === Number(id)) setSelectedDatasetId(null)
    await loadDatasets(selectedGroupId)
  }

  function setFile(f: File) {
    const xlsx = /\.(xlsx|xls)$/i.test(f.name)
    setCsvFile(f)
    setIsXlsx(xlsx)
    setPreview(null)
    setImportMsg(null)
    setXlsxSheets(null)
    setXlsxResults(null)
    setXlsxProgress(null)
    setSheetDetail(null)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f && /\.(csv|xlsx|xls)$/i.test(f.name)) setFile(f)
  }

  async function handleXlsxPreview() {
    if (!csvFile) return
    setXlsxPreviewing(true)
    setXlsxSheets(null)
    setXlsxResults(null)
    try {
      const fd = new FormData()
      fd.append('file', csvFile)
      const res  = await fetch('/api/admin/xlsx-preview', { method: 'POST', body: fd })
      const json = await res.json()
      if (json.success) {
        setXlsxSheets(json.sheets)
      } else {
        alert('プレビュー失敗: ' + json.message)
      }
    } finally {
      setXlsxPreviewing(false)
    }
  }

  async function handleSheetDetail(sheetName: string) {
    if (!csvFile) return
    // 同じシートを再クリックしたら閉じる
    if (sheetDetail?.sheet_name === sheetName) {
      setSheetDetail(null)
      return
    }
    setSheetDetailLoading(true)
    setSheetDetail(null)
    try {
      const fd = new FormData()
      fd.append('file', csvFile)
      fd.append('sheet_name', sheetName)
      const res  = await fetch('/api/admin/xlsx-preview', { method: 'POST', body: fd })
      const json = await res.json()
      if (json.success) {
        setSheetDetail(json)
      }
    } finally {
      setSheetDetailLoading(false)
    }
  }

  async function handleXlsxImport() {
    if (!csvFile || !selectedDatasetId) return
    setXlsxImporting(true)
    setXlsxResults(null)
    setXlsxProgress(null)
    try {
      const fd = new FormData()
      fd.append('file', csvFile)
      fd.append('dataset_id', String(selectedDatasetId))
      const res = await fetch('/api/admin/xlsx-import', { method: 'POST', body: fd })

      if (!res.body) throw new Error('ストリームが取得できません')

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })

        // SSEは "data: {...}\n\n" の形式なので行ごとに処理
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''   // 未完了行をバッファに残す

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue
          try {
            const event = JSON.parse(trimmed.slice(5).trim())

            if (event.type === 'start') {
              setXlsxProgress({ current: 0, total: event.total, currentSheet: '', totalInserted: 0 })
            } else if (event.type === 'processing') {
              setXlsxProgress(p => p ? {
                ...p, currentSheet: event.sheet_name,
              } : p)
            } else if (event.type === 'sheet') {
              setXlsxProgress(p => p ? {
                ...p,
                current:       event.index + 1,
                currentSheet:  event.sheet_name,
                totalInserted: event.total_so_far ?? p.totalInserted,
              } : p)
            } else if (event.type === 'done') {
              setXlsxResults(event.results)
              setImportMsg({ ok: true, text: event.message })
              setXlsxProgress(p => p ? { ...p, current: p.total, currentSheet: '' } : p)
              if (selectedGroupId) await loadDatasets(selectedGroupId)
            } else if (event.type === 'error') {
              setImportMsg({ ok: false, text: event.message })
            }
          } catch { /* JSON パース失敗は無視 */ }
        }
      }
    } catch (e) {
      setImportMsg({ ok: false, text: e instanceof Error ? e.message : 'インポート失敗' })
    } finally {
      setXlsxImporting(false)
    }
  }

  async function handlePreview() {
    if (!csvFile || !selectedGroupId) return
    setPreviewing(true)
    setPreview(null)
    try {
      const fd = new FormData()
      fd.append('file', csvFile)
      fd.append('group_id', String(selectedGroupId))
      const res  = await fetch('/api/admin/csv-preview', { method: 'POST', body: fd })
      const json = await res.json()
      if (json.success) {
        setPreview({ summary: json.summary, rows: json.preview })
        setPreviewPage(1)
        // 調査年が未選択かつ1件だけの場合は自動選択する
        if (!selectedDatasetId && datasets.length === 1) {
          setSelectedDatasetId(datasets[0].id)
        }
      } else {
        alert('プレビュー失敗: ' + json.message)
      }
    } finally {
      setPreviewing(false)
    }
  }

  async function handleImport() {
    if (!csvFile || !selectedDatasetId || !selectedGroupId) return
    setImporting(true)
    setImportMsg(null)
    try {
      const fd = new FormData()
      fd.append('file', csvFile)
      fd.append('dataset_id', String(selectedDatasetId))
      const res  = await fetch('/api/admin/csv-import', { method: 'POST', body: fd })
      const json = await res.json()
      setImportMsg({ ok: json.success, text: json.message })
      if (json.success) await loadDatasets(selectedGroupId)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-bold">データ登録・CSV取込</h2>
        <p className="text-xs text-muted-foreground mt-0.5">グループを選択して調査年データを管理し、CSVを取り込みます</p>
      </div>

      {/* Step 1: グループ選択 */}
      <div className="bg-card border border-border rounded-xl p-4">
        <label className="block text-xs font-semibold mb-2">1. 調査グループを選択</label>
        {groups.length === 0 ? (
          <p className="text-xs text-muted-foreground">グループがありません。「調査グループ管理」タブで先に作成してください。</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {groups.map(g => (
              <button
                key={g.id}
                onClick={() => selectGroup(g.id)}
                className={`text-left p-3 rounded-lg border text-xs transition-all ${
                  selectedGroupId === g.id
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/40 text-muted-foreground hover:text-foreground'
                }`}
              >
                <p className="font-semibold text-foreground text-[11px] leading-tight">{g.survey_group_name ?? g.name}</p>
                {g.survey_table_name && (
                  <p className="text-muted-foreground/70 text-[10px] leading-tight mt-0.5 line-clamp-2">{g.survey_table_name}</p>
                )}
                <p className="text-muted-foreground text-[10px] mt-0.5">
                  {CATEGORIES.find(c => c.value === g.category)?.label} ・ {g.dataset_count}年分 ・ {(g.total_records ?? 0).toLocaleString()}件
                </p>
                <p className="text-muted-foreground/50 text-[9px] font-mono mt-0.5">{g.target_table ?? 'occupation_wages'}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedGroup && (
        <>
          {/* CSVルール表示 */}
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs font-semibold mb-2">
              適用CSVパースルール:
              <span className="text-primary ml-1">{selectedGroup.survey_group_name ?? selectedGroup.name}</span>
              {selectedGroup.survey_table_name && (
                <span className="text-muted-foreground ml-1">／{selectedGroup.survey_table_name}</span>
              )}
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
              <span>
                インポート先:
                <strong className="text-foreground font-mono ml-1">{selectedGroup.target_table ?? 'occupation_wages'}</strong>
              </span>
              <span>開始行: <strong className="text-foreground">{selectedGroup.data_start_row}</strong></span>
              <span>職種名列: <strong className="text-foreground">{selectedGroup.name_col_index}</strong></span>
              <span>企業規模計: <strong className="text-foreground">{selectedGroup.size1_col_start}列〜</strong></span>
              <span>1000人以上: <strong className="text-foreground">{selectedGroup.size2_col_start}列〜</strong></span>
              <span>100〜999人: <strong className="text-foreground">{selectedGroup.size3_col_start}列〜</strong></span>
              <span>10〜99人: <strong className="text-foreground">{selectedGroup.size4_col_start}列〜</strong></span>
            </div>
            {selectedGroup.parse_notes && (
              <p className="mt-1.5 text-[10px] text-muted-foreground/70 italic">{selectedGroup.parse_notes}</p>
            )}
          </div>

          {/* Step 2: 調査年一覧 */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold">2. 調査年データ一覧（取込先を選択）</label>
              <button
                onClick={() => { setShowAddDs(p => !p); setEditingDsId(null) }}
                className="flex items-center gap-1 text-xs text-primary hover:opacity-80"
              >
                <Plus className="w-3.5 h-3.5" />調査年を追加
              </button>
            </div>

            {showAddDs && (
              <form onSubmit={handleAddDs} className="mb-3 p-3 bg-muted/20 border border-border/60 rounded-lg">
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-0.5">調査年 *</label>
                    <input required type="number" min="2000" max="2100"
                      value={dsForm.survey_year}
                      onChange={e => setDsForm(p => ({ ...p, survey_year: e.target.value }))}
                      placeholder="2024"
                      className="w-full bg-background border border-border rounded-md px-2 py-1 text-xs focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-0.5">公表日</label>
                    <input type="date"
                      value={dsForm.published_at}
                      onChange={e => setDsForm(p => ({ ...p, published_at: e.target.value }))}
                      className="w-full bg-background border border-border rounded-md px-2 py-1 text-xs focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-0.5">元ファイルURL</label>
                    <input type="url"
                      value={dsForm.source_url}
                      onChange={e => setDsForm(p => ({ ...p, source_url: e.target.value }))}
                      placeholder="https://..."
                      className="w-full bg-background border border-border rounded-md px-2 py-1 text-xs placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={savingDs}
                    className="flex items-center gap-1 bg-primary text-primary-foreground px-3 py-1 rounded text-xs font-semibold disabled:opacity-50">
                    {savingDs ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}追加
                  </button>
                  <button type="button" onClick={() => setShowAddDs(false)} className="text-muted-foreground text-xs hover:text-foreground">キャンセル</button>
                </div>
              </form>
            )}

            {loadingDs ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            ) : datasets.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">調査年データがありません</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-muted/20">
                      {['', '調査年', '公表日', '元ファイルURL', '取込件数', '最終取込', ''].map((h, i) => (
                        <th key={i} className="text-left py-2 px-2 text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {datasets.map(ds =>
                      editingDsId === ds.id ? (
                        <tr key={ds.id} className="border-b border-primary/30 bg-muted/10">
                          <td colSpan={7} className="py-2 px-2">
                            <form onSubmit={handleSaveEditDs}>
                              <div className="grid grid-cols-3 gap-2 mb-2">
                                <div>
                                  <label className="block text-[10px] text-muted-foreground mb-0.5">調査年 *</label>
                                  <input required type="number" min="2000" max="2100"
                                    value={editDsForm.survey_year}
                                    onChange={e => setEditDsForm(p => ({ ...p, survey_year: e.target.value }))}
                                    className="w-full bg-background border border-border rounded-md px-2 py-1 text-xs focus:outline-none focus:border-primary"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] text-muted-foreground mb-0.5">公表日</label>
                                  <input type="date"
                                    value={editDsForm.published_at}
                                    onChange={e => setEditDsForm(p => ({ ...p, published_at: e.target.value }))}
                                    className="w-full bg-background border border-border rounded-md px-2 py-1 text-xs focus:outline-none focus:border-primary"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] text-muted-foreground mb-0.5">元ファイルURL</label>
                                  <input type="url"
                                    value={editDsForm.source_url}
                                    onChange={e => setEditDsForm(p => ({ ...p, source_url: e.target.value }))}
                                    placeholder="https://..."
                                    className="w-full bg-background border border-border rounded-md px-2 py-1 text-xs placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary"
                                  />
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button type="submit" disabled={savingEditDs}
                                  className="flex items-center gap-1 bg-primary text-primary-foreground px-3 py-1 rounded text-xs font-semibold disabled:opacity-50">
                                  {savingEditDs ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}保存
                                </button>
                                <button type="button" onClick={() => setEditingDsId(null)} className="text-muted-foreground text-xs hover:text-foreground">キャンセル</button>
                              </div>
                            </form>
                          </td>
                        </tr>
                      ) : (
                        <tr
                          key={ds.id}
                          onClick={() => {
                            setSelectedDatasetId(Number(ds.id))
                            setImportMsg(null)
                          }}
                          className={`border-b border-border/40 cursor-pointer transition-colors ${
                            selectedDatasetId === Number(ds.id) ? 'bg-primary/10' : 'hover:bg-muted/20'
                          }`}
                        >
                          <td className="py-2 px-2">
                            <div className={`w-3 h-3 rounded-full border-2 ${
                              selectedDatasetId === Number(ds.id) ? 'border-primary bg-primary' : 'border-muted-foreground/30'
                            }`} />
                          </td>
                          <td className="py-2 px-2 font-semibold">{ds.survey_year}年</td>
                          <td className="py-2 px-2 text-muted-foreground">{ds.published_at?.slice(0, 10) ?? '-'}</td>
                          <td className="py-2 px-2 max-w-[180px]">
                            {ds.source_url ? (
                              <a href={ds.source_url} target="_blank" rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="text-primary underline truncate block hover:opacity-80">
                                {ds.source_url.replace(/^https?:\/\//, '').substring(0, 40)}...
                              </a>
                            ) : <span className="text-muted-foreground">-</span>}
                          </td>
                          <td className="py-2 px-2 text-right">{ds.record_count.toLocaleString()}件</td>
                          <td className="py-2 px-2 text-muted-foreground whitespace-nowrap">
                            {ds.imported_at ? ds.imported_at.slice(0, 16).replace('T', ' ') : '-'}
                          </td>
                          <td className="py-2 px-2">
                            <div className="flex items-center gap-2 justify-end">
                              <button onClick={e => { e.stopPropagation(); openEditDs(ds) }}
                                className="text-muted-foreground hover:text-primary transition-colors">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={e => { e.stopPropagation(); handleDeleteDs(Number(ds.id)) }}
                                className="text-muted-foreground hover:text-destructive transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Step 3: ファイル取込 */}
          <div className="bg-card border border-border rounded-xl p-4">
            <label className="block text-xs font-semibold mb-3">3. ファイルを取り込む</label>

            {!isXlsx && !selectedDatasetId && (
              <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-accent shrink-0" />
                CSV取込の場合は上の一覧から取込先の調査年を選択してください（XLSXは自動判定）
              </p>
            )}

            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
              }`}
            >
              <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) setFile(f)
                }}
              />
              {csvFile ? (
                <div className="flex flex-col items-center gap-2">
                  <FileText className="w-8 h-8 text-primary" />
                  <p className="text-sm font-semibold">{csvFile.name}</p>
                  <p className="text-xs text-muted-foreground">{(csvFile.size / 1024).toFixed(1)} KB</p>
                  {isXlsx && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded text-[10px] font-semibold">
                      XLSX — 全タブ一括取込モード
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Upload className="w-8 h-8" />
                  <p className="text-sm">CSV / XLSX をドロップ、またはクリックして選択</p>
                  <p className="text-[10px]">XLSXの場合は全タブを一括インポートできます</p>
                </div>
              )}
            </div>

            {importMsg && (
              <div className={`mt-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
                importMsg.ok
                  ? 'bg-success/10 text-success border border-success/20'
                  : 'bg-destructive/10 text-destructive border border-destructive/20'
              }`}>
                {importMsg.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                {importMsg.text}
              </div>
            )}

            {csvFile && !isXlsx && (
              <div className="mt-4 flex items-center gap-3 flex-wrap">
                <button onClick={handlePreview} disabled={previewing}
                  className="flex items-center gap-2 border border-border px-4 py-2 rounded-lg text-xs font-semibold hover:bg-muted/30 disabled:opacity-50">
                  {previewing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                  プレビュー確認
                </button>
                <button onClick={handleImport} disabled={importing || !selectedDatasetId || !preview}
                  className="flex items-center gap-2 bg-accent text-accent-foreground px-4 py-2 rounded-lg text-xs font-bold hover:opacity-90 disabled:opacity-40">
                  {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
                  DBに取り込む
                </button>
                {!selectedDatasetId && preview && (
                  <span className="text-[10px] text-muted-foreground">取込前に調査年を選択してください</span>
                )}
              </div>
            )}

            {csvFile && isXlsx && (
              <div className="mt-4 space-y-3">

                <div className="flex items-center gap-3 flex-wrap">
                  <button onClick={handleXlsxPreview} disabled={xlsxPreviewing}
                    className="flex items-center gap-2 border border-border px-4 py-2 rounded-lg text-xs font-semibold hover:bg-muted/30 disabled:opacity-50">
                    {xlsxPreviewing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                    シート一覧を確認
                  </button>
                  <button
                    onClick={handleXlsxImport}
                    disabled={xlsxImporting || !selectedDatasetId}
                    className="flex items-center gap-2 bg-accent text-accent-foreground px-4 py-2 rounded-lg text-xs font-bold hover:opacity-90 disabled:opacity-40">
                    {xlsxImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
                    全タブを一括インポート
                  </button>
                  {!selectedDatasetId && (
                    <span className="text-[10px] text-muted-foreground">取込前に調査年データ一覧から取込先を選択してください</span>
                  )}
                </div>

                {/* 進捗バー */}
                {xlsxProgress && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>
                        {xlsxProgress.current < xlsxProgress.total
                          ? <>処理中: <strong className="text-foreground">{xlsxProgress.currentSheet || '...'}</strong></>
                          : <strong className="text-success">完了</strong>
                        }
                      </span>
                      <span>
                        {xlsxProgress.current} / {xlsxProgress.total} タブ
                        {xlsxProgress.totalInserted > 0 && (
                          <> &nbsp;·&nbsp; {xlsxProgress.totalInserted.toLocaleString()} 件</>
                        )}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-300"
                        style={{ width: `${xlsxProgress.total > 0 ? Math.round((xlsxProgress.current / xlsxProgress.total) * 100) : 0}%` }}
                      />
                    </div>
                    {/* シートごとの状態をミニ表示（完了後） */}
                    {xlsxResults && xlsxProgress.current >= xlsxProgress.total && (
                      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 max-h-28 overflow-y-auto mt-1">
                        {xlsxResults.map((r, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-[10px]">
                            {r.error
                              ? <span className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0" />
                              : <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />
                            }
                            <span className="truncate text-muted-foreground">{r.sheet_name}</span>
                            <span className="shrink-0 ml-auto font-mono">
                              {r.error ? <span className="text-destructive">エラー</span> : `${r.inserted.toLocaleString()}件`}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* シートプレビュー */}
                {xlsxSheets && (
                  <div className="border border-border rounded-lg overflow-hidden">
                    <div className="px-3 py-2 bg-muted/20 border-b border-border flex items-center gap-2">
                      <Eye className="w-3.5 h-3.5 text-primary" />
                      <span className="text-xs font-semibold">シート一覧（{xlsxSheets.length}タブ）</span>
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        有効: {xlsxSheets.filter(s => s.parseable).length}タブ ・ 行クリックで中身を確認
                      </span>
                    </div>
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-border bg-muted/10">
                          {['シート名', '業種名', 'データ行数', '状態'].map(h => (
                            <th key={h} className="text-left py-2 px-3 text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {xlsxSheets.map((s, i) => {
                          const isSelected = sheetDetail?.sheet_name === s.sheet_name
                          const isLoading  = sheetDetailLoading && !sheetDetail && isSelected
                          return (
                            <tr
                              key={i}
                              onClick={() => s.parseable && handleSheetDetail(s.sheet_name)}
                              className={[
                                'border-b border-border/40 last:border-0 transition-colors',
                                s.parseable ? 'cursor-pointer hover:bg-primary/5' : 'opacity-50',
                                isSelected ? 'bg-primary/10' : '',
                              ].join(' ')}
                            >
                              <td className="py-2 px-3 font-semibold">{s.sheet_name}</td>
                              <td className="py-2 px-3 text-muted-foreground">{s.industry_name}</td>
                              <td className="py-2 px-3 text-right">{s.row_count.toLocaleString()}行</td>
                              <td className="py-2 px-3">
                                {isLoading
                                  ? <Loader2 className="w-3 h-3 animate-spin text-primary" />
                                  : s.parseable
                                    ? <span className={`text-[10px] font-semibold ${isSelected ? 'text-primary' : 'text-success'}`}>
                                        {isSelected ? '表示中' : 'OK'}
                                      </span>
                                    : <span className="text-muted-foreground text-[10px]">スキップ</span>
                                }
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>

                    {/* シート詳細パネル */}
                    {sheetDetail && (
                      <div className="border-t border-border bg-muted/5">
                        <div className="px-3 py-2 bg-primary/5 border-b border-border flex items-center gap-2">
                          <span className="text-xs font-semibold text-primary">{sheetDetail.sheet_name}</span>
                          <span className="text-[10px] text-muted-foreground">— {sheetDetail.industry_name}</span>
                          <span className="text-[10px] text-muted-foreground ml-auto">先頭{sheetDetail.preview.length}件</span>
                          <button
                            onClick={() => setSheetDetail(null)}
                            className="text-[10px] text-muted-foreground hover:text-foreground ml-2"
                          >
                            閉じる
                          </button>
                        </div>
                        <div className="overflow-x-auto max-h-72 overflow-y-auto">
                          <table className="w-full text-[10px] border-collapse whitespace-nowrap">
                            <thead className="sticky top-0 bg-background z-10">
                              <tr className="border-b border-border bg-muted/20">
                                {['性別', '学歴', '年齢階級', '企業規模', '年齢', '勤続', '所定内時間', '超過時間', '月給(千円)', '所定内給与', '賞与', '労働者数(人)'].map(h => (
                                  <th key={h} className="text-left py-1.5 px-2 text-muted-foreground font-medium">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {sheetDetail.preview.map((row, i) => (
                                <tr key={i} className="border-b border-border/30 last:border-0 hover:bg-muted/10">
                                  <td className="py-1 px-2 font-medium">{String(row.sex ?? '')}</td>
                                  <td className="py-1 px-2 text-muted-foreground">{String(row.education ?? '')}</td>
                                  <td className="py-1 px-2">{String(row.age_group ?? '')}</td>
                                  <td className="py-1 px-2 text-muted-foreground">{String(row.enterprise_size ?? '')}</td>
                                  <td className="py-1 px-2 text-right">{row.age != null ? String(row.age) : '-'}</td>
                                  <td className="py-1 px-2 text-right">{row.tenure_years != null ? String(row.tenure_years) : '-'}</td>
                                  <td className="py-1 px-2 text-right">{row.scheduled_hours != null ? String(row.scheduled_hours) : '-'}</td>
                                  <td className="py-1 px-2 text-right">{row.overtime_hours != null ? String(row.overtime_hours) : '-'}</td>
                                  <td className="py-1 px-2 text-right font-semibold">{row.monthly_wage != null ? Number(row.monthly_wage).toLocaleString() : '-'}</td>
                                  <td className="py-1 px-2 text-right">{row.scheduled_wage != null ? Number(row.scheduled_wage).toLocaleString() : '-'}</td>
                                  <td className="py-1 px-2 text-right">{row.annual_bonus != null ? Number(row.annual_bonus).toLocaleString() : '-'}</td>
                                  <td className="py-1 px-2 text-right">{row.workers != null ? Number(row.workers).toLocaleString() : '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* インポート結果 */}
                {xlsxResults && (
                  <div className="border border-border rounded-lg overflow-hidden">
                    <div className="px-3 py-2 bg-success/10 border-b border-border flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                      <span className="text-xs font-semibold text-success">インポート完了</span>
                    </div>
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-border bg-muted/10">
                          {['シート名', '業種名', '取込件数', '備考'].map(h => (
                            <th key={h} className="text-left py-2 px-3 text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {xlsxResults.map((r, i) => (
                          <tr key={i} className="border-b border-border/40 last:border-0">
                            <td className="py-2 px-3 font-semibold">{r.sheet_name}</td>
                            <td className="py-2 px-3 text-muted-foreground">{r.industry_name}</td>
                            <td className="py-2 px-3 text-right font-semibold">{r.inserted.toLocaleString()}件</td>
                            <td className="py-2 px-3 text-destructive text-[10px]">{r.error ?? ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          {preview && (
            <PreviewTable
              summary={preview.summary}
              rows={preview.rows}
              page={previewPage}
              setPage={setPreviewPage}
              pageSize={PREVIEW_PAGE_SIZE}
            />
          )}
        </>
      )}
    </div>
  )
}

// ============================================================
// プレビューテーブル
// ============================================================
function PreviewTable({
  summary, rows, page, setPage, pageSize,
}: {
  summary: PreviewSummary
  rows: PreviewRow[]
  page: number
  setPage: (p: number) => void
  pageSize: number
}) {
  const [sexFilter, setSexFilter]     = useState<'全て' | '計' | '男' | '女'>('全て')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredRows = rows.filter(r => {
    const matchSex    = sexFilter === '全て' || r.sex === sexFilter
    const matchSearch = searchQuery === '' || r.occupation_name.includes(searchQuery)
    return matchSex && matchSearch
  })
  const totalPages = Math.ceil(filteredRows.length / pageSize)
  const pageRows   = filteredRows.slice((page - 1) * pageSize, page * pageSize)

  function handleSexFilter(v: typeof sexFilter) {
    setSexFilter(v)
    setPage(1)
  }

  function handleSearch(v: string) {
    setSearchQuery(v)
    setPage(1)
  }

  const sexCounts = {
    全て: rows.length,
    計:   summary.sex_breakdown['計'],
    男:   summary.sex_breakdown['男'],
    女:   summary.sex_breakdown['女'],
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-3 mb-4">
        <Eye className="w-4 h-4 text-primary shrink-0" />
        <h3 className="text-sm font-bold">プレビュー結果</h3>
        <span className="ml-auto text-xs text-muted-foreground">全 {rows.length.toLocaleString()} 件</span>
      </div>

      {/* フィルター行: 性別タブ + 職種検索 */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-1 p-1 bg-muted/20 rounded-lg">
          {(['全て', '計', '男', '女'] as const).map(s => (
            <button
              key={s}
              onClick={() => handleSexFilter(s)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                sexFilter === s
                  ? s === '男' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : s === '女' ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30'
                  : 'bg-primary/20 text-primary border border-primary/30'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {s === '計' ? '男女計' : s}
              <span className="ml-1 text-[10px] opacity-70">({sexCounts[s].toLocaleString()})</span>
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <input
            type="text"
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            placeholder="職種名で絞り込み..."
            className="w-full bg-background border border-border rounded-md pl-8 pr-8 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:border-primary"
          />
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {searchQuery && (
            <button
              onClick={() => handleSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        {(searchQuery || sexFilter !== '全て') && (
          <span className="text-xs text-muted-foreground">
            {filteredRows.length.toLocaleString()} 件表示中
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {[
          { label: '総レコード数', value: `${summary.total_rows.toLocaleString()}件` },
          { label: '職種数', value: `${summary.occupation_count}職種` },
          { label: 'ファイルサイズ', value: `${(summary.file_size / 1024).toFixed(1)} KB` },
        ].map(({ label, value }) => (
          <div key={label} className="bg-muted/20 rounded-lg p-3">
            <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
            <p className="text-base font-bold">{value}</p>
          </div>
        ))}
        <div className="bg-muted/20 rounded-lg p-3">
          <p className="text-[10px] text-muted-foreground mb-1">性別内訳</p>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-base font-bold">{summary.sex_breakdown['計'].toLocaleString()}</span>
            <span className="text-[10px] text-muted-foreground">計</span>
            <span className="text-sm font-semibold text-blue-400">{summary.sex_breakdown['男'].toLocaleString()}</span>
            <span className="text-[10px] text-muted-foreground">男</span>
            <span className="text-sm font-semibold text-pink-400">{summary.sex_breakdown['女'].toLocaleString()}</span>
            <span className="text-[10px] text-muted-foreground">女</span>
          </div>
        </div>
      </div>

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
              const abs = (page - 1) * pageSize + i + 1
              return (
                <tr key={abs} className={`border-b border-border/40 hover:bg-muted/20 ${abs % 2 === 0 ? 'bg-muted/10' : ''}`}>
                  <td className="py-1.5 px-2 text-muted-foreground text-right">{abs}</td>
                  <td className="py-1.5 px-2 max-w-[200px] truncate" title={row.occupation_name}>{row.occupation_name}</td>
                  <td className="py-1.5 px-2 text-muted-foreground">{row.sex}</td>
                  <td className="py-1.5 px-2 text-muted-foreground whitespace-nowrap">{row.enterprise_size}</td>
                  <td className="py-1.5 px-2 text-right text-muted-foreground">{fmt(row.age)}</td>
                  <td className="py-1.5 px-2 text-right text-muted-foreground">{fmt(row.tenure_years)}</td>
                  <td className="py-1.5 px-2 text-right">{fmt(row.monthly_wage)}</td>
                  <td className="py-1.5 px-2 text-right">{fmt(row.scheduled_wage)}</td>
                  <td className="py-1.5 px-2 text-right">{fmt(row.annual_bonus)}</td>
                  <td className="py-1.5 px-2 text-right font-semibold text-accent">{fmt(row.annual_income)}</td>
                  <td className="py-1.5 px-2 text-right text-muted-foreground">{fmt(row.workers)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
          <p className="text-xs text-muted-foreground">
            {((page - 1) * pageSize + 1).toLocaleString()}〜{Math.min(page * pageSize, filteredRows.length).toLocaleString()} / {filteredRows.length.toLocaleString()}件
            {sexFilter !== '全て' && <span className="ml-1 text-primary">（{sexFilter === '計' ? '男女計' : sexFilter}でフィルター中）</span>}
          </p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(1)} disabled={page === 1}
              className="px-2 py-1 text-xs border border-border rounded text-muted-foreground hover:bg-muted/30 disabled:opacity-40 disabled:cursor-not-allowed">
              最初
            </button>
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
              className="p-1 border border-border rounded text-muted-foreground hover:bg-muted/30 disabled:opacity-40 disabled:cursor-not-allowed">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 2, totalPages - 4))
              return start + i
            }).map(p => (
              <button key={p} onClick={() => setPage(p)}
                className={`w-7 h-7 text-xs border rounded transition-colors ${
                  p === page
                    ? 'border-primary bg-primary text-primary-foreground font-semibold'
                    : 'border-border text-muted-foreground hover:bg-muted/30'
                }`}>
                {p}
              </button>
            ))}
            <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}
              className="p-1 border border-border rounded text-muted-foreground hover:bg-muted/30 disabled:opacity-40 disabled:cursor-not-allowed">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
              className="px-2 py-1 text-xs border border-border rounded text-muted-foreground hover:bg-muted/30 disabled:opacity-40 disabled:cursor-not-allowed">
              最後
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// タブ3: DB初期化
// ============================================================
function SchemaTab() {
  const [running, setRunning] = useState(false)
  const [result, setResult]   = useState<{ success: boolean; message: string; results?: string[] } | null>(null)

  async function handleSetup() {
    if (!confirm('スキーマを初期化します。既存テーブルは保護されます。続けますか？')) return
    setRunning(true)
    setResult(null)
    try {
      const res  = await fetch('/api/admin/setup-schema', { method: 'POST' })
      const json = await res.json()
      setResult({ success: json.success, message: json.message, results: json.results })
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h2 className="text-sm font-bold">DBスキーマ初期化</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          初回起動時に実行してください。既存テーブルは <code>CREATE TABLE IF NOT EXISTS</code> で保護されます。
          旧スキーマからの自動マイグレーションも行い���す。
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-3">
        <p className="text-xs font-medium">��成される��ーブル</p>
        <ul className="space-y-2 text-xs text-muted-foreground">
          <li className="flex items-start gap-2">
            <code className="text-primary font-mono shrink-0">dataset_groups</code>
            調査��ループ（調査名・カテゴリ・CSVパースルール）
          </li>
          <li className="flex items-start gap-2">
            <code className="text-primary font-mono shrink-0">datasets</code>
            調査年データ（group_idで親グループに紐付け）
          </li>
          <li className="flex items-start gap-2">
            <code className="text-primary font-mono shrink-0">occupation_wages</code>
            職種別賃金データ本体
          </li>
        </ul>
        <button
          onClick={handleSetup} disabled={running}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-xs font-semibold hover:opacity-90 disabled:opacity-50"
        >
          {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          スキーマを初期化する
        </button>
      </div>

      {result && (
        <div className={`rounded-xl border p-4 text-xs space-y-1.5 ${
          result.success
            ? 'bg-success/10 border-success/20 text-success'
            : 'bg-destructive/10 border-destructive/20 text-destructive'
        }`}>
          <div className="flex items-center gap-2 font-semibold">
            {result.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {result.message}
          </div>
          {result.results?.map((r, i) => (
            <p key={i} className="pl-6 opacity-80">{r}</p>
          ))}
        </div>
      )}
    </div>
  )
}
