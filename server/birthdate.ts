/** Normalize chat dates once for both the browser and LIVE server. */
export function extractBirthDate(input: string): string | null {
  const text = input.normalize('NFKC')
  const eras: Record<string, { offset: number; first: string; last: string }> = {
    明治: { offset: 1867, first: '1868-01-25', last: '1912-07-29' },
    大正: { offset: 1911, first: '1912-07-30', last: '1926-12-24' },
    昭和: { offset: 1925, first: '1926-12-25', last: '1989-01-07' },
    平成: { offset: 1988, first: '1989-01-08', last: '2019-04-30' },
    令和: { offset: 2018, first: '2019-05-01', last: '9999-12-31' }
  }
  const separator = '(?:\\s*[年/月日.・-]\\s*|\\s+)'
  const patterns = [
    new RegExp(`(?<![0-9])(明治|大正|昭和|平成|令和)\\s*(元|[0-9]{1,2})${separator}([0-9]{1,2})${separator}([0-9]{1,2})(?:\\s*日)?(?![0-9])`, 'g'),
    new RegExp(`(?<![0-9])((?:18|19|20)[0-9]{2})${separator}([0-9]{1,2})${separator}([0-9]{1,2})(?:\\s*日)?(?![0-9])`, 'g'),
    /(?<![0-9])((?:18|19|20)[0-9]{2})([0-9]{2})([0-9]{2})(?![0-9])/g,
    /(?<![0-9])([0-9]{2})([0-9]{2})([0-9]{2})(?![0-9])/g
  ]
  for (let index = 0; index < patterns.length; index++) {
    for (const match of text.matchAll(patterns[index])) {
      const era = index === 0 ? eras[match[1]] : undefined
      const year = era ? era.offset + (match[2] === '元' ? 1 : Number(match[2])) : index === 3 ? (Number(match[1]) >= 40 ? 1900 : 2000) + Number(match[1]) : Number(match[1])
      const month = Number(match[era ? 3 : 2])
      const day = Number(match[era ? 4 : 3])
      const date = new Date(Date.UTC(year, month - 1, day))
      if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) continue
      const iso = date.toISOString().slice(0, 10)
      if (era && (iso < era.first || iso > era.last || match[2] === '0')) continue
      if (date.getTime() > Date.now()) continue
      return `${year}年${month}月${day}日`
    }
  }
  return null
}
