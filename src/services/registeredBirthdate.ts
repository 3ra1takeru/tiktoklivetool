interface BirthdayProfile {
  birthdate?: string
  birthdates?: { birthdate: string; relationship?: string }[]
}
export function registeredBirthdate(user?: BirthdayProfile): string {
  const records = user?.birthdates?.filter(record => record.birthdate?.trim()) || []
  return records.find(record => record.relationship === '本人')?.birthdate.trim()
    || user?.birthdate?.trim()
    || records[0]?.birthdate.trim()
    || ''
}
