import type { RegularUser } from '../App'

export function mergeListener(existing: RegularUser | undefined, incoming: RegularUser): RegularUser {
  const records = [...(existing?.birthdates || []), ...(incoming.birthdates || [])]
  for (const user of [existing, incoming]) {
    if (user?.birthdate && !records.some(record => record.birthdate === user.birthdate)) {
      records.push({ id: crypto.randomUUID(), name: '', relationship: '本人', birthdate: user.birthdate })
    }
  }
  const birthdates = records.filter((record, index) => records.findIndex(other => other.birthdate === record.birthdate && other.relationship === record.relationship && other.name === record.name) === index).map(record => ({ ...record, id: crypto.randomUUID() }))
  const history = [...(existing?.history || []), ...incoming.history].filter((item, index, all) => all.findIndex(other => other.timestamp === item.timestamp && other.birthdate === item.birthdate) === index).sort((a, b) => b.timestamp - a.timestamp)
  return {
    ...incoming, ...existing,
    birthdate: existing?.birthdate || incoming.birthdate,
    birthdates, history,
    totalDiamonds: Math.max(existing?.totalDiamonds || 0, incoming.totalDiamonds),
    totalPayPay: Math.max(existing?.totalPayPay || 0, incoming.totalPayPay)
  }
}
