export function cloudAuthError(error: unknown): string {
  const e = error as { code?: string; status?: number; message?: string }
  const message = e?.message || ''
  if (e?.code === 'over_email_send_rate_limit' || /email rate limit/i.test(message)) return 'ログインメールの送信上限に達しました。標準送信枠は1時間に2通です。パスワード設定済みの場合は、メールを待たずにパスワードでログインできます。'
  if (e?.status === 429 || e?.code === 'over_request_rate_limit') return '短時間の操作回数が上限に達しました。しばらく待ってから再試行してください。'
  if (e?.code === 'invalid_credentials') return 'メールアドレスまたはパスワードを確認してください。未設定の場合は、ログイン済みのパソコンからパスワードを設定してください。'
  if (e?.code === 'email_not_confirmed') return 'メールアドレスの本人確認が必要です。確認メール内のリンクを開いてください。'
  if (e?.code === 'reauthentication_needed' || e?.code === 'reauthentication_not_valid') return 'パスワード設定には再ログインが必要です。メールの送信枠回復後にログインし直してください。'
  return message || 'クラウド接続に失敗しました。通信状態を確認してください。'
}
export function passwordSetupError(password: string, confirmation: string): string | null {
  if (password.length < 12) return 'パスワードは12文字以上で入力してください。'
  if (password.length > 128) return 'パスワードは128文字以内で入力してください。'
  if (password !== confirmation) return '確認用パスワードが一致しません。'
  return null
}
