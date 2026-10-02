import { cloudConfigured } from '../services/cloudStorage'
import { mergeListener } from '../services/listenerBackup'
import { useEffect, useState } from 'react'
import type { RegularUser, BirthdateRecord } from '../services/listenerTypes'
import { getListenerChats, saveListenerChat, type ListenerChat } from '../services/listenerHistory'
import { Button } from './ui/button'
import { Input } from './ui/input'

interface Props {
  users: Record<string, RegularUser>
  onSave: (user: RegularUser) => Promise<void>
  onClose: () => void
}

export function ListenerManager({ users, onSave, onClose }: Props) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [draft, setDraft] = useState<RegularUser | null>(null)
  const [messages, setMessages] = useState<ListenerChat[]>([])
  const [limit, setLimit] = useState(50)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [newId, setNewId] = useState('')
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [dirty, setDirty] = useState(false)
  const list = Object.values(users).filter(user => `${user.username} ${user.userId}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => a.username.localeCompare(b.username, 'ja'))

  useEffect(() => {
    let current = true
    setMessages([])
    setLimit(50)
    if (selected) void getListenerChats(selected).then(chats => {
      if (current) setMessages(chats)
    }).catch(() => { if (current) setNotice('チャット履歴を読み込めませんでした。') })
    return () => { current = false }
  }, [selected])

  const selectUser = (user: RegularUser) => {
    if (dirty && !window.confirm('編集内容を保存せずに移動しますか？')) return
    setSelected(user.userId)
    setDraft({ ...user, birthdates: (user.birthdates?.length ? user.birthdates : user.birthdate ? [{ id: '1', name: '', relationship: '本人', birthdate: user.birthdate, gender: 'unspecified' as const }] : []).map(record => ({ ...record })) })
    setDirty(false)
    setNotice('')
  }
  const editRecord = (id: string, patch: Partial<BirthdateRecord>) => {
    setDraft(previous => previous ? { ...previous, birthdates: previous.birthdates?.map(record => record.id === id ? { ...record, ...patch } : record) } : null)
    setDirty(true)
  }
  const save = async () => {
    if (!draft || !draft.username.trim()) { setNotice('表示名を入力してください。'); return }
    if (draft.birthdates?.some(record => !record.birthdate.trim())) { setNotice('追加した生年月日を入力してください。'); return }
    const birthdates = draft.birthdates || []
    const user = { ...users[draft.userId], ...draft, username: draft.username.trim(), birthdates, birthdate: (birthdates.find(record => record.relationship === '本人') || birthdates[0])?.birthdate || '' }
    try { await onSave(user); setDirty(false); setNotice('リスナー情報を保存しました。') }
    catch { setNotice('保存できませんでした。保存先の接続状態・容量を確認してください。') }
  }
  const addUser = async () => {
    const userId = newId.trim().replace(/^@/, '').toLowerCase()
    if (!/^[a-z0-9._]{1,64}$/.test(userId)) { setNotice('ユーザーIDは英数字・ピリオド・アンダースコアで入力してください。'); return }
    if (users[userId]) { selectUser(users[userId]); setAdding(false); return }
    const user: RegularUser = { userId, username: newName.trim() || userId, birthdate: '', birthdates: [], history: [], totalDiamonds: 0, totalPayPay: 0 }
    try { await onSave(user); selectUser(user); setAdding(false); setNewId(''); setNewName('') }
    catch { setNotice('保存できませんでした。') }
  }
  const backup = async () => {
    setBusy(true)
    try {
      const chatGroups = await Promise.all(Object.keys(users).map(getListenerChats))
      const content = { version: 1, exportedAt: new Date().toISOString(), users, chats: chatGroups.flat() }
      const url = URL.createObjectURL(new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `listeners-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setNotice('リスナー情報とチャット履歴のバックアップを作成しました。')
    } catch { setNotice('バックアップに失敗しました。') }
    finally { setBusy(false) }
  }
  const restore = async (file: File) => {
    setBusy(true)
    try {
      const data = JSON.parse(await file.text())
      if (data.version !== 1 || !data.users || typeof data.users !== 'object' || !Array.isArray(data.chats)) throw new Error('format')
      const entries = Object.entries(data.users) as [string, RegularUser][]
      if (entries.some(([id, user]) => !user || id !== user.userId || !/^[a-zA-Z0-9._-]{1,128}$/.test(id) || typeof user.username !== 'string' || typeof user.birthdate !== 'string' || !Array.isArray(user.history) || user.history.some(item => !item || !Number.isFinite(item.timestamp) || typeof item.birthdate !== 'string' || typeof item.comment !== 'string' || typeof item.summary !== 'string') || !Number.isFinite(user.totalDiamonds) || !Number.isFinite(user.totalPayPay) || (user.birthdates && (!Array.isArray(user.birthdates) || user.birthdates.some(r => !r || typeof r.id !== 'string' || typeof r.birthdate !== 'string' || typeof r.name !== 'string' || typeof r.relationship !== 'string'))))) throw new Error('users')
      if (data.chats.some((chat: ListenerChat) => !chat || typeof chat.id !== 'string' || typeof chat.userId !== 'string' || !data.users[chat.userId] || typeof chat.username !== 'string' || typeof chat.comment !== 'string' || !Number.isFinite(chat.timestamp))) throw new Error('chats')
      for (const [, incoming] of entries) {
        const existing = users[incoming.userId]
        await onSave(mergeListener(existing, incoming))
      }
      for (const chat of data.chats) await saveListenerChat(chat)
      setNotice(`${entries.length}人の情報を取り込みました。既存の情報は保持しています。`)
      setSelected(null); setDraft(null); setDirty(false)
    } catch { setNotice('復元できませんでした。この画面で作成したバックアップファイルを選択してください。') }
    finally { setBusy(false) }
  }

  return <div className="fixed inset-0 z-50 bg-beige-50 overflow-y-auto" role="dialog" aria-modal="true" aria-label="リスナー管理">
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold text-sage-900">リスナー管理</h1><p className="text-sm text-sage-600">登録 {Object.keys(users).length}人 · 生年月日登録 {Object.values(users).filter(u => u.birthdate || u.birthdates?.length).length}人</p></div><Button variant="outline" onClick={() => { if (!dirty || window.confirm('編集内容を保存せずに閉じますか？')) onClose() }}>LIVE画面に戻る</Button></header>
      <div className="bg-white border rounded-xl p-4 space-y-3"><p className="text-sm text-sage-700">{cloudConfigured() ? 'リスナー情報とチャットはクラウドに保存されます。同じメールでログインした端末から利用できます。iCloudに保存したバックアップはここで復元してください。' : '現在はブラウザー保存です。クラウド保存を設定すると端末を変えても情報を利用できます。既存のバックアップを復元して移行できます。'}</p><div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => setAdding(!adding)}>リスナーを追加</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => void backup()}>バックアップを保存</Button><label className="border rounded-lg px-3 py-2 text-sm cursor-pointer">バックアップを復元<input className="block text-xs mt-1" aria-label="バックアップファイル" type="file" accept=".json,application/json" disabled={busy} onChange={event => { const file = event.target.files?.[0]; if (file && (!dirty || window.confirm('編集内容を保存せずにバックアップを復元しますか？'))) void restore(file); event.target.value = '' }} /></label></div>
        {adding && <div className="flex flex-wrap gap-2"><Input aria-label="追加するユーザーID" placeholder="@ユーザーID" value={newId} onChange={e => setNewId(e.target.value)} /><Input aria-label="追加する表示名" placeholder="表示名" value={newName} onChange={e => setNewName(e.target.value)} /><Button onClick={() => void addUser()}>登録する</Button></div>}
        {notice && <p role="status" className="text-sm text-sage-800">{notice}</p>}
      </div>
      <div className="grid md:grid-cols-[280px_1fr] gap-4">
        <aside className="bg-white border rounded-xl p-4 space-y-3"><Input aria-label="リスナー検索" placeholder="名前・ユーザーIDで検索" value={search} onChange={e => setSearch(e.target.value)} /><p className="text-xs text-sage-500">{list.length}人を表示</p><div className="max-h-[65vh] overflow-y-auto space-y-2">{list.map(user => <button key={user.userId} onClick={() => selectUser(user)} className={`w-full text-left rounded-lg border p-3 ${selected === user.userId ? 'bg-gold-50 border-gold-400' : 'hover:bg-beige-50'}`}><strong className="block break-words">{user.username}</strong><span className="block text-xs text-sage-500 break-all">@{user.userId}</span><span className="text-xs">{user.birthdate || '生年月日未登録'} · 鑑定 {user.history.length}件</span></button>)}{!list.length && <p className="text-sm text-sage-500">該当するリスナーはいません。</p>}</div></aside>
        <main className="bg-white border rounded-xl p-5 space-y-5">{draft ? <>
          <div className="space-y-2"><h2 className="font-bold text-lg">プロフィール</h2><p className="text-sm">@{draft.userId}</p><label className="text-sm block">表示名<Input value={draft.username} onChange={e => { setDraft({ ...draft, username: e.target.value }); setDirty(true) }} /></label></div>
          <section className="space-y-3"><h2 className="font-bold">生年月日</h2>{draft.birthdates?.map((record, index) => <div key={record.id} className="bg-beige-50 rounded-lg p-3 grid sm:grid-cols-2 gap-2"><label className="text-xs">関係<Input aria-label={`関係${index + 1}`} value={record.relationship} onChange={e => editRecord(record.id, { relationship: e.target.value })} /></label><label className="text-xs">名前<Input aria-label={`生年月日の名前${index + 1}`} value={record.name} onChange={e => editRecord(record.id, { name: e.target.value })} /></label><label className="text-xs">生年月日<Input aria-label={`生年月日${index + 1}`} placeholder="1990年1月1日" value={record.birthdate} onChange={e => editRecord(record.id, { birthdate: e.target.value })} /></label><label className="text-xs">性別<select className="block border rounded p-2 w-full" value={record.gender || 'unspecified'} onChange={e => editRecord(record.id, { gender: e.target.value as BirthdateRecord['gender'] })}><option value="unspecified">未指定</option><option value="male">男性</option><option value="female">女性</option></select></label></div>)}<Button size="sm" variant="outline" onClick={() => { setDraft({ ...draft, birthdates: [...(draft.birthdates || []), { id: crypto.randomUUID(), birthdate: '', name: '', relationship: draft.birthdates?.length ? '家族' : '本人', gender: 'unspecified' }] }); setDirty(true) }}>生年月日を追加</Button><Button size="sm" className="ml-2" onClick={() => void save()}>変更を保存</Button>{dirty && <span className="ml-2 text-xs">未保存の変更があります</span>}</section>
          <section><h2 className="font-bold mb-2">鑑定履歴 {users[draft.userId]?.history.length || 0}件</h2>{users[draft.userId]?.history.map((item, index) => <article key={`${item.timestamp}:${index}`} className="border-b py-3 text-sm"><time className="text-xs text-sage-500">{new Date(item.timestamp).toLocaleString()}</time><p>{item.birthdate}</p><p className="whitespace-pre-wrap break-words">{item.summary}</p></article>)}</section>
          <section><h2 className="font-bold mb-2">チャット履歴 {messages.length}件</h2>{!messages.length && <p className="text-sm text-sage-500">保存済みのチャットはありません。保存機能の追加前のコメントは記録されていません。</p>}{messages.slice(-limit).reverse().map(message => <article key={message.id} className="border-b py-3 text-sm"><time className="text-xs text-sage-500">{new Date(message.timestamp).toLocaleString()}</time><p className="whitespace-pre-wrap break-words">{message.comment}</p></article>)}{messages.length > limit && <Button size="sm" onClick={() => setLimit(n => n + 50)}>さらに50件表示</Button>}</section>
        </> : <p className="text-sage-500 py-12 text-center">一覧からリスナーを選ぶと情報と履歴を確認・編集できます。</p>}</main>
      </div>
    </div>
  </div>
}
