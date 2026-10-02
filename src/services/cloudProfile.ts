import type { RegularUser } from './listenerTypes'

// Apply only this device's edits to the latest cloud revision.
export function rebaseCloudProfile(current: RegularUser | undefined, before: RegularUser | undefined, desired: RegularUser): RegularUser {
  const keys = Object.keys(desired) as (keyof RegularUser)[]
  const patch = Object.fromEntries(keys.filter(key => JSON.stringify(before?.[key]) !== JSON.stringify(desired[key])).map(key => [key, desired[key]]))
  if (current && !before) {
    // An incoming comment must not erase a profile another device just registered.
    for (const key of ['birthdate', 'birthdates', 'history', 'totalDiamonds', 'totalPayPay'] as const) {
      if (!desired[key] || (Array.isArray(desired[key]) && !desired[key].length)) delete patch[key]
    }
  }
  const next = { ...(current || {}), ...patch } as RegularUser
  if (current && patch.birthdates) {
    const old = before?.birthdates || []
    const desiredRecords = desired.birthdates || []
    const removed = new Set(old.filter(record => !desiredRecords.some(wanted => wanted.id === record.id)).map(record => record.id))
    const changed = desiredRecords.filter(record => JSON.stringify(old.find(previous => previous.id === record.id)) !== JSON.stringify(record))
    const merged = (current.birthdates || []).filter(record => !removed.has(record.id) && !changed.some(edit => edit.id === record.id)).concat(changed)
    next.birthdates = merged.filter((record, index) => merged.findIndex(other => other.birthdate === record.birthdate && other.relationship === record.relationship && other.name === record.name) === index)
  }
  if (current && patch.history) {
    next.history = [...current.history, ...desired.history].filter((item, index, all) => all.findIndex(other => other.timestamp === item.timestamp && other.birthdate === item.birthdate) === index).sort((a, b) => b.timestamp - a.timestamp)
  }
  for (const key of ['totalDiamonds', 'totalPayPay'] as const) if (current && patch[key] !== undefined) next[key] = Math.max(current[key], desired[key])
  return next
}
