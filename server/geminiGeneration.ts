export const fortuneModels = ['gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-flash'];
export function aiErrorMessage(error: any): string {
  const status = error?.status;
  const message = String(error?.message || '');
  if (status === 429 || message.includes('429')) return 'Google AIの利用上限に達しました。無料枠の回復を待って再度お試しください。継続利用にはGoogle AI側の利用枠・料金設定の確認が必要です。';
  if (status === 401 || status === 403 || /API key not valid|API_KEY_INVALID/i.test(message)) return 'Google AIのAPIキーまたはアクセス権を確認してください。';
  if (status === 404) return '利用できるGoogle AIモデルが見つかりませんでした。モデル設定をご確認ください。';
  if (status === 503 || status === 500) return 'Google AIが一時的に混雑しています。少し待って再度お試しください。';
  return 'Google AIで鑑定を生成できませんでした。時間をおいて再度お試しください。';
}
export async function generateFortuneText(
  generate: (model: string) => Promise<string>,
  wait: (milliseconds: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms))
): Promise<string> {
  let failure: any;
  for (const model of fortuneModels) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try { const text = await generate(model); if (!text.trim()) throw new Error('Empty AI response'); return text; }
      catch (error: any) {
        // Preserve the quota cause when a later model is unavailable.
        if (!failure || error.status !== 404) failure = error;
        if (error.status === 401 || error.status === 403 || /API key not valid|API_KEY_INVALID/i.test(error.message || '')) throw new Error(aiErrorMessage(error));
        // Quota exhaustion is not fixed by retrying one second later.
        if ((error.status === 500 || error.status === 503) && attempt < 2) { await wait(1000 * 2 ** attempt); continue; }
        break;
      }
    }
  }
  throw new Error(aiErrorMessage(failure));
}
