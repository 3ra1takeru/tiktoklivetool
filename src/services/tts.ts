// Emoji sequences, flags and keycaps are removed without removing ordinary digits.
export function removeEmoji(text: string): string {
  return text
    .replace(/[0-9#*]\uFE0F?\u20E3/gu, '')
    .replace(/\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Emoji_Modifier}|\u200D|\uFE0E|\uFE0F|[\u{E0020}-\u{E007F}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}
