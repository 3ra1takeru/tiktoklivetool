import { cloudClient, cloudOwnerId } from './cloudStorage'
export interface BroadcastCaption {
  id: string
  broadcaster: string
  roomId: string
  text: string
  language: string
  sourceTimestampMs: string
  capturedAt: number
  source: 'tiktok_caption'
}
export async function saveBroadcastCaption(caption: BroadcastCaption, expectedOwner?: string) {
  const owner = await cloudOwnerId()
  if (expectedOwner && owner !== expectedOwner) throw new Error('字幕を受信したアカウントでログインしてください。')
  const { error } = await cloudClient().from('broadcast_captions').upsert({ owner_id: owner, room_id: caption.roomId, caption_id: caption.id, broadcaster: caption.broadcaster, text: caption.text, language: caption.language, source_timestamp_ms: caption.sourceTimestampMs, captured_at: caption.capturedAt, source: caption.source }, { onConflict: 'owner_id,room_id,caption_id', ignoreDuplicates: true })
  if (error) throw error
}
export async function getBroadcastCaptions(broadcaster: string, limit = 200): Promise<BroadcastCaption[]> {
  const owner = await cloudOwnerId()
  let query = cloudClient().from('broadcast_captions').select('*').eq('owner_id', owner)
  if (broadcaster.trim()) query = query.eq('broadcaster', broadcaster.trim().replace(/^@/, ''))
  const { data, error } = await query.order('captured_at', { ascending: false }).order('room_id').order('caption_id').range(0, limit - 1)
  if (error) throw error
  return (data || []).map(row => ({ id: row.caption_id, broadcaster: row.broadcaster, roomId: row.room_id, text: row.text, language: row.language, sourceTimestampMs: row.source_timestamp_ms, capturedAt: row.captured_at, source: row.source }))
}
