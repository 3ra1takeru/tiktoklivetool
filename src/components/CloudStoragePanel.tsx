import { useEffect, useRef, useState } from 'react'
import { configureCloud, cloudClient, cloudConfigured, cloudSettings } from '../services/cloudStorage'
import { cloudAuthError, passwordSetupError } from '../services/cloudAuth'
import { Button } from './ui/button'
import { Input } from './ui/input'

export function CloudStoragePanel({ onClose, onConfigured }: { onClose: () => void, onConfigured: () => void }) {
  const [url, setUrl] = useState(() => cloudSettings().url)
  const [key, setKey] = useState(() => cloudSettings().key)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [signedInEmail, setSignedInEmail] = useState('')
  const [code, setCode] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const running = useRef(false)
  const [mailWaitUntil, setMailWaitUntil] = useState(0)
  const [now, setNow] = useState(Date.now())
  const [generation, setGeneration] = useState(0)
  useEffect(() => {
    if (!cloudConfigured()) return
    let active = true
    const client = cloudClient()
    void client.auth.getSession().then(({ data }) => { if (active) setSignedInEmail(data.session?.user.email || '') })
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      if (active) { setSignedInEmail(session?.user.email || ''); setPassword(''); setConfirmation('') }
    })
    return () => { active = false; data.subscription.unsubscribe() }
  }, [generation])
  useEffect(() => {
    if (!mailWaitUntil) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [mailWaitUntil])
  const run = async (action: () => Promise<void>) => {
    if (running.current) return
    running.current = true
    setBusy(true); setNotice('')
    try { await action() }
    catch (error) { setNotice(cloudAuthError(error)) }
    finally { running.current = false; setBusy(false) }
  }
  const waitSeconds = Math.max(0, Math.ceil((mailWaitUntil - now) / 1000))
  return <div role="dialog" aria-modal="true" aria-label="クラウド保存" className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4"><div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto space-y-4">
    <h2 className="text-xl font-bold">クラウド保存</h2>
    <p className="text-sm">同じアカウントでログインすると、iPadとパソコンで同じリスナー情報・チャット履歴を使えます。</p>
    {signedInEmail ? <section className="space-y-3">
      <p className="text-sm">ログイン中：{signedInEmail}</p>
      <h3 className="font-bold">iPadでも使うためのパスワード設定</h3>
      <p className="text-sm">このアカウントにパスワードを設定します。設定後は、別の端末でもメールを待たずにログインできます。保存済みの顧客情報は引き継がれます。</p>
      <form className="space-y-3" onSubmit={event => { event.preventDefault(); void run(async () => {
        const invalid = passwordSetupError(password, confirmation)
        if (invalid) { setNotice(invalid); return }
        const { error } = await cloudClient().auth.updateUser({ password })
        if (error) throw error
        setPassword(''); setConfirmation('')
        setNotice('パスワードを設定しました。iPadで同じメールアドレスとこのパスワードを入力してログインしてください。')
      }) }}>
        <label className="block text-sm">新しいログイン用パスワード<Input type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={password} onChange={e => setPassword(e.target.value)} /></label>
        <label className="block text-sm">パスワードの確認<Input type="password" autoComplete="new-password" required value={confirmation} onChange={e => setConfirmation(e.target.value)} /></label>
        <Button type="submit" disabled={busy}>パスワードを設定</Button>
      </form>
      <Button variant="outline" disabled={busy} onClick={() => void run(async () => { const { error } = await cloudClient().auth.signOut(); if (error) throw error; onConfigured() })}>ログアウト</Button>
    </section> : <section className="space-y-3">
      <form className="space-y-3" onSubmit={event => { event.preventDefault(); void run(async () => {
        const { error } = await cloudClient().auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
        setPassword(''); onConfigured(); onClose()
      }) }}>
        <label className="block text-sm">ログイン用メールアドレス<Input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label className="block text-sm">ログイン用パスワード<Input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></label>
        <Button type="submit" disabled={busy || !cloudConfigured()}>パスワードでログイン</Button>
      </form>
      <p className="text-xs">まだパスワードがない場合は、ログイン済みのパソコンの「クラウド保存」で設定してください。</p>
      <details><summary className="cursor-pointer text-sm">メールでログインする</summary><div className="space-y-3 pt-3">
        <p className="text-xs">標準メール送信は1時間に2通までです。届かない時は連打せず、送信枠が回復するまで待ってください。メールのリンクはログインしたい端末で開きます。</p>
        <Button disabled={busy || waitSeconds > 0 || !email.trim() || !cloudConfigured()} onClick={() => void run(async () => {
          const { error } = await cloudClient().auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: `${window.location.origin}/`, shouldCreateUser: false } })
          setNow(Date.now()); setMailWaitUntil(Date.now() + (error?.code === 'over_email_send_rate_limit' ? 3600000 : 60000))
          if (error) throw error
          setNotice('ログインメールを送信リクエストしました。迷惑メールも確認し、リンクをこの端末で開いてください。')
        })}>{waitSeconds ? `再送まで ${waitSeconds}秒` : 'ログインメールを送る'}</Button>
        <label className="block text-sm">確認コード（届いた場合）<Input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={e => setCode(e.target.value)} /></label>
        <Button disabled={busy || !code || !email} onClick={() => void run(async () => { const { error } = await cloudClient().auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' }); if (error) throw error; onConfigured(); onClose() })}>コードでログイン</Button>
      </div></details>
    </section>}
    {notice && <p role="status" className="text-sm whitespace-pre-wrap">{notice}</p>}
    <details open={!cloudConfigured()}><summary className="text-xs cursor-pointer">保存先の接続設定</summary><div className="space-y-3 pt-3">
      <label className="block text-sm">Project URL<Input value={url} onChange={e => setUrl(e.target.value)} /></label>
      <label className="block text-sm">Publishable key / anon key<Input value={key} onChange={e => setKey(e.target.value)} /></label>
      <p className="text-xs">シークレットキー・service_roleキーは使用できません。</p>
      <Button disabled={busy} onClick={() => void run(async () => { configureCloud(url.trim(), key.trim()); setGeneration(n => n + 1); onConfigured(); setNotice('保存先の設定を保存しました。') })}>接続設定を保存</Button>
    </div></details>
    <Button variant="outline" disabled={busy} onClick={onClose}>閉じる</Button>
  </div></div>
}
