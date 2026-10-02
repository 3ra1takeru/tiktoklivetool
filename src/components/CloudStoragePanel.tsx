import { useState } from 'react'
import { configureCloud, cloudClient, cloudConfigured, cloudSettings } from '../services/cloudStorage'
import { Button } from './ui/button'
import { Input } from './ui/input'

export function CloudStoragePanel({ onClose, onConfigured }: { onClose: () => void, onConfigured: () => void }) {
  const [url, setUrl] = useState(() => cloudSettings().url)
  const [key, setKey] = useState(() => cloudSettings().key)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    try { await action() }
    catch (error) { setNotice(error instanceof Error ? error.message : 'クラウド接続に失敗しました。') }
    finally { setBusy(false) }
  }
  return <div role="dialog" aria-modal="true" aria-label="クラウド保存" className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4"><div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto space-y-4">
    <h2 className="text-xl font-bold">クラウド保存</h2><p className="text-sm">Supabaseにリスナー情報を保存します。同じメールでログインするとiPadとパソコンで同じデータを使えます。</p>
    <label className="block text-sm">Project URL<Input value={url} onChange={event => setUrl(event.target.value)} placeholder="https://xxxx.supabase.co" /></label>
    <label className="block text-sm">Publishable key / anon key<Input value={key} onChange={event => setKey(event.target.value)} placeholder="sb_publishable_..." /></label>
    <p className="text-xs text-sage-500">シークレットキー・service_roleキーは入力しないでください。初回はDBの作成とアクセス制限の設定が必要です。</p>
    <Button disabled={busy} onClick={() => void run(async () => { configureCloud(url.trim(), key.trim()); onConfigured(); setNotice('接続設定を保存しました。メールでログインしてください。') })}>接続設定を保存</Button>
    <label className="block text-sm">ログイン用メールアドレス<Input type="email" value={email} onChange={event => setEmail(event.target.value)} /></label>
    <Button disabled={busy || !email || !cloudConfigured()} onClick={() => void run(async () => {
      const { error } = await cloudClient().auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: `${window.location.origin}/` } })
      if (error) throw error
      setNotice('ログインメールを送りました。メールのリンクをこの端末で開いてください。コードが届いた場合は下に入力できます。')
    })}>ログインメールを送る</Button>
    <label className="block text-sm">確認コード（届いた場合）<Input inputMode="numeric" value={code} onChange={event => setCode(event.target.value)} /></label>
    <Button disabled={busy || !code || !email} onClick={() => void run(async () => { const { error } = await cloudClient().auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' }); if (error) throw error; onConfigured(); onClose() })}>コードでログイン</Button>
    {notice && <p role="status" className="text-sm whitespace-pre-wrap">{notice}</p>}
    {cloudConfigured() && <Button variant="outline" disabled={busy} onClick={() => void run(async () => { const { error } = await cloudClient().auth.signOut(); if (error) throw error; setNotice('ログアウトしました。'); onConfigured() })}>ログアウト</Button>}
    <Button variant="outline" onClick={onClose}>閉じる</Button>
  </div></div>
}
