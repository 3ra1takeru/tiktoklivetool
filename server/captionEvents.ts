interface CaptionMessage {
  definite?: boolean
  sentenceId?: string
  timestampMs?: string
  common?: { msgId?: string }
  content?: { lang?: string; content?: string }[]
}
export function completedCaption(data: CaptionMessage, broadcaster: string, roomId: string, capturedAt = Date.now()) {
  if (data.definite !== true || !Array.isArray(data.content)) return null
  const lines = data.content.filter(c => typeof c.content === 'string' && c.content.trim())
  // Select one language rather than recording every translated version as speech.
  const line = lines.find(c => /^ja(?:[-_]|$)/i.test(c.lang || '')) || lines[0]
  if (!line) return null
  const language = (line.lang || 'und').slice(0, 24)
  const positiveId = (value?: string) => value && /^[1-9]\d*$/.test(String(value)) ? String(value) : ''
  const sentence = positiveId(data.sentenceId) || positiveId(data.common?.msgId) || positiveId(data.timestampMs)
  if (!sentence) return null
  return { id: `${sentence}:${language}`, broadcaster, roomId, text: line.content!.trim().slice(0, 10000), language, sourceTimestampMs: String(data.timestampMs || '0'), capturedAt, source: 'tiktok_caption' as const }
}
