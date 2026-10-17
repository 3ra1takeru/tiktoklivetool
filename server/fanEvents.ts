export function fanMembershipEvent(data: any, classified = false): { id: string } | null {
  const keys = [data.content?.key, data.commonBarrageContent?.key, data.common?.displayText?.key, data.displayType].filter(value => typeof value === 'string').map(value => value.toLowerCase())
  // A member arriving in the room is not a new fan-club subscription.
  if (keys.some(key => key.includes('ttlive_superfan_commentnotif_superfanjoined'))) return null
  if (!classified && !keys.some(key => key.includes('ttlive_superfan'))) return null
  const messageId = data.common?.msgId || data.msgId
  if (messageId && String(messageId) !== '0') return { id: String(messageId) }
  const user = data.user?.idStr || data.user?.id || data.user?.uniqueId
  const created = data.common?.createTime || data.createTime
  return user && created && String(created) !== '0' ? { id: `fan:${user}:${created}` } : null
}
