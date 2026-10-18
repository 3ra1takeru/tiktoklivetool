import { useEffect, useState } from 'react'
import { getBroadcastCaptions, type BroadcastCaption } from '../services/broadcastCaptions'
import { Button } from './ui/button'
import { Input } from './ui/input'
export function BroadcastCaptionPanel({ broadcaster, enabled, onEnabled, pending, onRetry, onClose }: { broadcaster: string; enabled: boolean; onEnabled: (value: boolean) => void; pending: number; onRetry: () => Promise<void>; onClose: () => void }) {
  const [filter, setFilter] = useState(broadcaster.replace(/^@/, ''))
  const [rows, setRows] = useState<BroadcastCaption[]>([])
  const [notice, setNotice] = useState('')
  const [limit, setLimit] = useState(200)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    setNotice('読み込み中…')
    void getBroadcastCaptions(filter, limit).then(data => { if (active) { setRows(data); setNotice('') } }).catch(() => { if (active) setNotice('字幕履歴を取得できません。クラウドへのログインと接続を確認してください。') })
    return () => { active = false }
  }, [filter, limit, revision])
  return <div role="dialog" aria-modal="true" aria-label="配信字幕の記録" className="fixed inset-0 z-50 bg-beige-50 overflow-y-auto"><div className="max-w-4xl mx-auto p-5 space-y-4">
    <header className="flex justify-between items-center gap-3"><h1 className="text-xl font-bold">配信字幕の記録</h1><Button variant="outline" onClick={onClose}>LIVE画面に戻る</Button></header>
    <p className="text-sm">TikTokから届く確定済みの字幕を記録します。外部AIのトークンは消費しません。字幕が送られない配信では記録できません。音声の直接文字起こしは行いません。</p>
    <p className="text-xs text-sage-600">サイトを開いてLIVE接続している間の字幕が対象です。話者は判別できないため、コラボ相手などの発言が含まれる可能性があります。顧客情報には自動反映しません。</p>
    <label className="flex items-center gap-2"><input type="checkbox" checked={enabled} onChange={e => onEnabled(e.target.checked)} />配信字幕をサーバーに記録する</label>
    <div className="flex gap-2"><Input aria-label="配信者IDで字幕を絞り込み" value={filter} onChange={e => { setFilter(e.target.value); setLimit(200) }} placeholder="@near.future.boy（空欄ですべて）" /><Button variant="outline" onClick={() => setRevision(n => n + 1)}>履歴を更新</Button></div>
    {pending > 0 && <div role="alert">未保存の字幕が{pending}件あります。画面を閉じる前に再保存してください。<Button variant="outline" onClick={() => void onRetry().then(() => setRevision(n => n + 1))}>未保存の字幕を再保存</Button></div>}
    {notice && <p role="status">{notice}</p>}
    <p className="text-sm">保存済み {rows.length}件を表示</p>
    {!rows.length && !notice && <p className="border rounded-lg bg-white p-5">保存済みの字幕はありません。LIVE接続後、TikTokの字幕データが届くと自動保存します。</p>}
    {rows.map(row => <article key={`${row.roomId}:${row.id}`} className="border rounded-lg bg-white p-4"><p className="text-xs text-sage-600">{new Date(row.capturedAt).toLocaleString()} · @{row.broadcaster} · TikTok字幕（話者未判定）</p><p className="whitespace-pre-wrap break-words">{row.text}</p></article>)}
    {rows.length >= limit && <Button onClick={() => setLimit(n => n + 200)}>さらに200件表示</Button>}
  </div></div>
}
