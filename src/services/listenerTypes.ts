export interface FortuneHistoryItem {
  timestamp: number
  birthdate: string
  comment: string
  summary: string
}

export interface BirthdateRecord {
  id: string
  birthdate: string
  name: string
  relationship: string
  gender?: 'male' | 'female' | 'unspecified'
}

export interface RegularUser {
  userId: string
  username: string
  profilePictureUrl?: string
  birthdate: string
  birthdates?: BirthdateRecord[]
  lastFortuneAt?: number
  history: FortuneHistoryItem[]
  totalDiamonds: number
  totalPayPay: number
}

