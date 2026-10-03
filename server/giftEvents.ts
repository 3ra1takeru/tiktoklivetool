export function completedGift(data: any): { id: string; count: number } | null {
  const giftType = Number(data.giftDetails?.giftType ?? data.extendedGiftInfo?.giftType ?? data.gift?.gift_type);
  if (giftType === 1 && !data.repeatEnd) return null;
  const group = String(data.groupId || '');
  const user = data.user?.idStr || data.user?.uniqueId || data.user?.displayId || '';
  const id = giftType === 1 && group !== '0' && group
    ? `${user}:${data.giftId}:${group}`
    : String(data.common?.msgId || crypto.randomUUID());
  return { id, count: Math.max(1, Number(data.repeatCount) || 1) };
}
