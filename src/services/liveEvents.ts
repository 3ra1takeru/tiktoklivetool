// Keep recently replayed IDs across reconnects, without storing listener data on disk.
export class EventDeduplicator {
  private ids = new Set<string>()
  private readonly limit: number
  constructor(limit = 20000) { this.limit = limit }
  accept(id: string): boolean {
    const duplicate = this.ids.delete(id)
    this.ids.add(id)
    if (this.ids.size > this.limit) this.ids.delete(this.ids.values().next().value!)
    return !duplicate
  }
}

export function giftSpeech(username: string, giftName: string, count?: number): string {
  return count === undefined
    ? `${username}さんから、${giftName}をいただきました。`
    : `${username}さんから、${giftName}のギフトを${count}個いただきました。`
}
