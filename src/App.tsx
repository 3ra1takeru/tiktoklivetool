import { useEffect, useState, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { 
  Sparkles, 
  MessageSquare, 
  UserCheck, 
  Clock, 
  BookOpen, 
  Wifi, 
  WifiOff, 
  Copy, 
  Check, 
  RefreshCw, 
  AlertCircle,
  Settings,
  Coins,
  Volume2,
  VolumeX,
  Trash2,
  Flame,
  Send,
  Cpu
} from 'lucide-react'
import { Button } from './components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './components/ui/card'
import { Input } from './components/ui/input'
import { Badge } from './components/ui/badge'
import { ScrollArea } from './components/ui/scroll-area'
import { 
  runFortuneTellingClient, 
  extractBirthDate, 
  type FortuneResult 
} from './services/fortuneService'

// 型定義
interface ChatMessage {
  id: string
  username: string
  userId: string
  comment: string
  profilePictureUrl?: string
  hasBirthdate?: boolean
  timestamp: number
}

interface FortuneRequest {
  id: string
  username: string
  userId: string
  profilePictureUrl?: string
  birthdate: string
  gender?: 'male' | 'female' | 'unspecified'
  comment: string
  fortuneQuestion?: string
  timestamp: number
  status: 'pending' | 'loading' | 'completed' | 'error'
  isRegularMatch?: boolean
}

interface FortuneHistoryItem {
  timestamp: number
  birthdate: string
  comment: string
  summary: string
}

interface BirthdateRecord {
  id: string
  birthdate: string
  name: string
  relationship: string
  gender?: 'male' | 'female' | 'unspecified'
}

interface RegularUser {
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

interface TransactionItem {
  id: string
  userId: string
  username: string
  profilePictureUrl?: string
  type: 'gift' | 'paypay'
  amount: number
  description: string
  timestamp: number
}

interface TtsSpeechItem {
  username: string
  comment: string
  hasBirth: boolean
  isRegular: boolean
  isGift: boolean
  giftName?: string
  timestamp: number
}

const detectGender = (comment: string): 'male' | 'female' | 'unspecified' => {
  const text = comment.toLowerCase()
  if (text.includes('女性') || text.includes('女です') || text.includes('女の') || text.includes('私(女)') || text.includes('彼女') || text.includes('嫁') || text.includes('妻') || text.includes('母') || text.includes('娘') || text.includes('姉') || text.includes('妹') || text.includes('女子')) {
    return 'female'
  }
  if (text.includes('男性') || text.includes('男です') || text.includes('男の') || text.includes('僕') || text.includes('俺') || text.includes('私(男)') || text.includes('彼氏') || text.includes('旦那') || text.includes('夫') || text.includes('父') || text.includes('息子') || text.includes('兄') || text.includes('弟') || text.includes('男子')) {
    return 'male'
  }
  return 'unspecified'
}

interface PredictedQuestion {
  label: string
  text: string
  color: string
}

const suggestFortuneQuestion = (comment: string): PredictedQuestion => {
  const text = comment.toLowerCase()
  
  if (text.includes('仕事') || text.includes('転職') || text.includes('就職') || text.includes('キャリア') || text.includes('会社') || text.includes('退職') || text.includes('上司') || text.includes('同僚')) {
    return {
      label: '💼 仕事の相談',
      text: '現在の仕事運と、今後の適職や転職すべき最適なタイミングについて',
      color: 'border-amber-200 bg-amber-50/50 text-amber-800 hover:bg-amber-100'
    }
  }
  if (text.includes('相性') || text.includes('彼') || text.includes('旦那') || text.includes('夫') || text.includes('彼女') || text.includes('好きな人') || text.includes('片思い') || text.includes('恋')) {
    return {
      label: '👩‍❤️‍👨 相性の相談',
      text: 'お相手との宿命的な相性と、今後の関係性の発展・対策について',
      color: 'border-rose-200 bg-rose-50/50 text-rose-800 hover:bg-rose-100'
    }
  }
  if (text.includes('結婚') || text.includes('出会い') || text.includes('婚活') || text.includes('恋愛') || text.includes('恋人') || text.includes('パートナー')) {
    return {
      label: '❤️ 恋愛・結婚の相談',
      text: 'これからの恋愛運・結婚運と、素敵な出会いが訪れる時期について',
      color: 'border-pink-200 bg-pink-50/50 text-pink-800 hover:bg-pink-100'
    }
  }
  if (text.includes('金運') || text.includes('お金') || text.includes('投資') || text.includes('財産') || text.includes('貯金') || text.includes('副業')) {
    return {
      label: '💸 金運・財運の相談',
      text: 'これからの金運・財運の流れと、お金を引き寄せるヒントについて',
      color: 'border-yellow-200 bg-yellow-50/50 text-yellow-800 hover:bg-yellow-100'
    }
  }
  if (text.includes('家族') || text.includes('子供') || text.includes('娘') || text.includes('息子') || text.includes('親') || text.includes('家庭') || text.includes('パパ') || text.includes('ママ')) {
    return {
      label: '🏠 家族の相談',
      text: 'ご家族の運勢の流れと、家庭内の関係性を良くするためのアドバイスについて',
      color: 'border-blue-200 bg-blue-50/50 text-blue-800 hover:bg-blue-100'
    }
  }
  if (text.includes('健康') || text.includes('病気') || text.includes('体調') || text.includes('ストレス') || text.includes('メンタル') || text.includes('疲')) {
    return {
      label: '🏥 健康の相談',
      text: '今後の健康運と、心身のバランスを保ち健やかに生きるためのアドバイスについて',
      color: 'border-green-200 bg-green-50/50 text-green-800 hover:bg-green-100'
    }
  }
  if (text.includes('対人') || text.includes('人間関係') || text.includes('友人') || text.includes('友達') || text.includes('悩み')) {
    return {
      label: '👥 人間関係の相談',
      text: '周囲との人間関係の悩みと、円滑なコミュニケーションを築くためのヒントについて',
      color: 'border-purple-200 bg-purple-50/50 text-purple-800 hover:bg-purple-100'
    }
  }
  
  return {
    label: '🔮 全体運の相談',
    text: '今年の全体的な運勢の流れと、今後の開運アクションについて',
    color: 'border-gold-200 bg-gold-50/50 text-gold-800 hover:bg-gold-100'
  }
}

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null)
  
  // 動作モード（ブラウザ単体AIモード / ローカルサーバー接続モード）
  const [useStandaloneMode, setUseStandaloneMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('fortune_standalone_mode')
    return saved !== null ? saved === 'true' : true // デフォルトはサーバー不要モード
  })

  // Gemini APIキー（ブラウザ直接生成用）
  const [geminiApiKey, setGeminiApiKey] = useState<string>(() => {
    return localStorage.getItem('fortune_gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY || ''
  })
  const [tempGeminiApiKey, setTempGeminiApiKey] = useState(geminiApiKey)

  // 接続設定
  const [tiktokUsername, setTiktokUsername] = useState('')
  const [serverConnected, setServerConnected] = useState(false)
  const [tiktokConnected, setTiktokConnected] = useState<'connected' | 'disconnected' | 'connecting' | 'error'>('disconnected')
  const [errorMessage, setErrorMessage] = useState('')
  const [systemAlert, setSystemAlert] = useState<string | null>(null)

  // 手動チャット入力（スタンドアロン・テスト用）
  const [manualUsername, setManualUsername] = useState('')
  const [manualComment, setManualComment] = useState('')

  // ログ・リスト
  const [chatLogs, setChatLogs] = useState<ChatMessage[]>([])
  const [fortuneRequests, setFortuneRequests] = useState<FortuneRequest[]>([])
  const [transactions, setTransactions] = useState<TransactionItem[]>([])
  
  // 常連データ（LocalStorage）
  const [regulars, setRegulars] = useState<Record<string, RegularUser>>(() => {
    const saved = localStorage.getItem('star_campe_regulars')
    return saved ? JSON.parse(saved) : {}
  })

  // PayPay手動追加用
  const [paypayUser, setPaypayUser] = useState('')
  const [paypayAmount, setPaypayAmount] = useState('1000')

  // 左カラムのタブ切り替え ('chat' | 'history')
  const [leftTab, setLeftTab] = useState<'chat' | 'history'>('chat')
  
  // 鑑定結果と選択状態
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null)
  const [fortuneResults, setFortuneResults] = useState<Record<string, FortuneResult>>({})
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({})

  // サーバー接続設定
  const [apiUrl, setApiUrl] = useState(() => {
    return localStorage.getItem('fortune_api_url') || import.meta.env.VITE_API_URL || 'http://localhost:5001'
  })
  const [tempApiUrl, setTempApiUrl] = useState(apiUrl)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  // 読み上げ機能（TTS）の設定状態
  const [isTtsEnabled, setIsTtsEnabled] = useState(() => {
    const saved = localStorage.getItem('fortune_tts_enabled')
    return saved !== null ? saved === 'true' : true
  })
  const [ttsMode, setTtsMode] = useState<'all' | 'fortune'>(() => {
    return (localStorage.getItem('fortune_tts_mode') as 'all' | 'fortune') || 'all'
  })
  const [ttsRate, setTtsRate] = useState(() => {
    return parseFloat(localStorage.getItem('fortune_tts_rate') || '1.0')
  })
  const [ttsVolume] = useState(() => {
    return parseFloat(localStorage.getItem('fortune_tts_volume') || '1.0')
  })

  // 読み上げ用の音声トリガーキュー
  const [ttsSpeechTrigger, setTtsSpeechTrigger] = useState<TtsSpeechItem | null>(null)

  // スクロール自動追従用の参照
  const chatEndRef = useRef<HTMLDivElement>(null)

  const handleSaveSettings = () => {
    const cleanUrl = tempApiUrl.trim().replace(/\/$/, '')
    localStorage.setItem('fortune_api_url', cleanUrl)
    setApiUrl(cleanUrl)

    const cleanKey = tempGeminiApiKey.trim()
    localStorage.setItem('fortune_gemini_api_key', cleanKey)
    setGeminiApiKey(cleanKey)

    localStorage.setItem('fortune_standalone_mode', String(useStandaloneMode))

    setIsSettingsOpen(false)
    setSystemAlert('設定を保存しました。')
  }

  // 読み上げ設定の保存
  useEffect(() => {
    localStorage.setItem('fortune_tts_enabled', String(isTtsEnabled))
  }, [isTtsEnabled])

  useEffect(() => {
    localStorage.setItem('fortune_tts_mode', ttsMode)
  }, [ttsMode])

  useEffect(() => {
    localStorage.setItem('fortune_tts_rate', String(ttsRate))
  }, [ttsRate])

  // 音声読み上げ用絵文字クリーンアップ ＆ 12文字トリミング
  const cleanTtsName = (name: string): string => {
    return name
      .replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '')
      .replace(/\p{Emoji}/gu, '')
      .replace(/\p{Extended_Pictographic}/gu, '')
      .replace(/\s+/g, '')
      .trim()
  }

  // 音声読み上げコア処理
  const speakText = (text: string) => {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'ja-JP'
    utterance.rate = ttsRate
    utterance.volume = ttsVolume

    window.speechSynthesis.speak(utterance)
  }

  // 読み上げトリガーキューの監視
  useEffect(() => {
    if (!ttsSpeechTrigger || !isTtsEnabled) return

    const { username, comment, hasBirth, isRegular, isGift, giftName } = ttsSpeechTrigger
    const displayName = cleanTtsName(username).slice(0, 12) || 'ゲスト'
    
    let text = ''
    if (isGift) {
      text = `${displayName}さんから、ギフト「${giftName}」を頂きました！`
    } else {
      if (ttsMode === 'all') {
        text = `${displayName}さん。「${comment}」`
      } else if (ttsMode === 'fortune' && (hasBirth || isRegular)) {
        const regularText = isRegular ? '常連の' : ''
        text = `${regularText}${displayName}さんから、占い依頼が入りました。「${comment}」`
      }
    }

    if (text) {
      speakText(text)
    }
  }, [ttsSpeechTrigger])

  // 共通のチャット受信処理（Socket.io受信、手動入力、模擬データの統一処理）
  const processIncomingChat = (msg: {
    id: string
    username: string
    userId: string
    comment: string
    profilePictureUrl?: string
    timestamp: number
  }) => {
    const extractedBirth = extractBirthDate(msg.comment)
    const hasBirth = !!extractedBirth

    const chatMsg: ChatMessage = {
      ...msg,
      hasBirthdate: hasBirth
    }

    setChatLogs(prev => {
      const next = [...prev, chatMsg]
      if (next.length > 150) next.shift()
      return next
    })

    let isRegularMatch = false

    // 生年月日が含まれていない場合、常連データベースから自動引き当て
    if (!hasBirth) {
      setRegulars(prevRegs => {
        const regular = prevRegs[msg.userId]
        if (regular && regular.birthdate) {
          isRegularMatch = true

          let combinedBirth = regular.birthdate
          if (regular.birthdates && regular.birthdates.length > 0) {
            combinedBirth = regular.birthdates
              .map(b => {
                const genderStr = b.gender === 'male' ? '男性' : b.gender === 'female' ? '女性' : '未指定'
                return `${b.relationship}${b.name ? `(${b.name})` : ''}[${genderStr}]: ${b.birthdate}`
              })
              .join(', ')
          }

          setFortuneRequests(prevReqs => {
            if (prevReqs.some(r => r.userId === msg.userId && r.status === 'pending')) {
              return prevReqs
            }
            const selfGender = regular.birthdates?.find(b => b.relationship === '本人')?.gender || detectGender(msg.comment)
            return [...prevReqs, {
              id: msg.id,
              username: msg.username,
              userId: msg.userId,
              profilePictureUrl: msg.profilePictureUrl,
              birthdate: combinedBirth,
              gender: selfGender,
              comment: msg.comment,
              fortuneQuestion: suggestFortuneQuestion(msg.comment).text,
              timestamp: Date.now(),
              status: 'pending',
              isRegularMatch: true
            }]
          })
        }
        return prevRegs
      })
    } else {
      // 生年月日が含まれている場合、鑑定待ちリストに新規追加
      const detectedGender = detectGender(msg.comment)
      setFortuneRequests(prev => {
        if (prev.some(item => item.id === msg.id)) return prev
        return [...prev, {
          id: msg.id,
          username: msg.username,
          userId: msg.userId,
          profilePictureUrl: msg.profilePictureUrl,
          birthdate: extractedBirth!,
          gender: detectedGender,
          comment: msg.comment,
          fortuneQuestion: suggestFortuneQuestion(msg.comment).text,
          timestamp: Date.now(),
          status: 'pending'
        }]
      })

      // 常連データの自動更新
      setRegulars(prevRegs => {
        const user = prevRegs[msg.userId]
        if (!user) {
          const next = {
            ...prevRegs,
            [msg.userId]: {
              userId: msg.userId,
              username: msg.username,
              profilePictureUrl: msg.profilePictureUrl,
              birthdate: extractedBirth!,
              birthdates: [
                { id: '1', birthdate: extractedBirth!, name: '', relationship: '本人', gender: detectedGender }
              ],
              history: [],
              totalDiamonds: 0,
              totalPayPay: 0
            }
          }
          localStorage.setItem('star_campe_regulars', JSON.stringify(next))
          return next
        } else {
          const birthdatesList = user.birthdates || [
            { id: '1', birthdate: user.birthdate, name: '', relationship: '本人', gender: 'unspecified' }
          ]
          const isAlreadyRegistered = birthdatesList.some(b => b.birthdate === extractedBirth)
          if (!isAlreadyRegistered) {
            const newRecord: BirthdateRecord = {
              id: Math.random().toString(),
              birthdate: extractedBirth!,
              name: '',
              relationship: birthdatesList.length === 0 ? '本人' : `追加分${birthdatesList.length}`,
              gender: detectedGender
            }
            user.birthdates = [...birthdatesList, newRecord]
            const nextRegs = { ...prevRegs, [msg.userId]: user }
            localStorage.setItem('star_campe_regulars', JSON.stringify(nextRegs))
            return nextRegs
          }
        }
        return prevRegs
      })
    }

    // 読み上げトリガーキューに登録
    setTtsSpeechTrigger({
      username: msg.username,
      comment: msg.comment,
      hasBirth,
      isRegular: isRegularMatch,
      isGift: false,
      timestamp: Date.now()
    })
  }

  // Socket.io サーバーとの通信ライフサイクル
  useEffect(() => {
    if (useStandaloneMode) {
      setServerConnected(false)
      return
    }

    const newSocket = io(apiUrl, {
      reconnectionAttempts: 2,
      timeout: 3000,
      autoConnect: true
    })
    setSocket(newSocket)

    newSocket.on('connect', () => {
      setServerConnected(true)
      setErrorMessage('')
    })

    newSocket.on('connect_error', () => {
      setServerConnected(false)
      setErrorMessage('ローカルサーバーへの接続に失敗しました。画面右上の設定から「サーバー不要（ブラウザAI）モード」をお試しください。')
    })

    newSocket.on('disconnect', () => {
      setServerConnected(false)
      setTiktokConnected('disconnected')
    })

    newSocket.on('tiktok-status', (data: { status: 'connected' | 'disconnected' | 'error', username?: string, error?: string }) => {
      if (data.status === 'connected') {
        setTiktokConnected('connected')
        setErrorMessage('')
      } else if (data.status === 'error') {
        setTiktokConnected('error')
        setErrorMessage(data.error || 'TikTok Liveへの接続中にエラーが発生しました。')
      } else {
        setTiktokConnected('disconnected')
      }
    })

    newSocket.on('chat-log', (msg: ChatMessage) => {
      processIncomingChat(msg)
    })

    newSocket.on('gift-log', (gift: { id: string; username: string; userId: string; profilePictureUrl?: string; giftName: string; diamonds: number; count: number; timestamp: number }) => {
      setTransactions(prev => [
        {
          id: gift.id,
          userId: gift.userId,
          username: gift.username,
          profilePictureUrl: gift.profilePictureUrl,
          type: 'gift',
          amount: gift.diamonds,
          description: `${gift.giftName} x${gift.count} (${gift.diamonds}ダイヤ)`,
          timestamp: gift.timestamp
        },
        ...prev
      ])

      let isRegularMatch = false
      setRegulars(prevRegs => {
        const user = prevRegs[gift.userId] || {
          userId: gift.userId,
          username: gift.username,
          profilePictureUrl: gift.profilePictureUrl,
          birthdate: '', 
          birthdates: [],
          history: [],
          totalDiamonds: 0,
          totalPayPay: 0
        }

        user.totalDiamonds += gift.diamonds
        user.username = gift.username 
        user.profilePictureUrl = gift.profilePictureUrl 

        const nextRegs = { ...prevRegs, [gift.userId]: user }
        localStorage.setItem('star_campe_regulars', JSON.stringify(nextRegs))

        if (user.birthdate) {
          isRegularMatch = true
          let combinedBirth = user.birthdate
          if (user.birthdates && user.birthdates.length > 0) {
            combinedBirth = user.birthdates
              .map(b => `${b.relationship}${b.name ? `(${b.name})` : ''}: ${b.birthdate}`)
              .join(', ')
          }

          setFortuneRequests(prevReqs => {
            if (prevReqs.some(r => r.userId === gift.userId && r.status === 'pending')) return prevReqs
            return [...prevReqs, {
              id: gift.id,
              username: gift.username,
              userId: gift.userId,
              profilePictureUrl: gift.profilePictureUrl,
              birthdate: combinedBirth,
              comment: `ギフト「${gift.giftName}」を頂きました`,
              fortuneQuestion: `ギフト「${gift.giftName}」を頂きました`,
              timestamp: Date.now(),
              status: 'pending',
              isRegularMatch: true
            }]
          })
        }
        return nextRegs
      })

      setTtsSpeechTrigger({
        username: gift.username,
        comment: `ギフト「${gift.giftName}」送信`,
        hasBirth: false,
        isRegular: isRegularMatch,
        isGift: true,
        giftName: gift.giftName,
        timestamp: Date.now()
      })
    })

    newSocket.on('fortune-progress', (data: { id: string, status: 'loading' }) => {
      setFortuneRequests(prev => 
        prev.map(item => item.id === data.id ? { ...item, status: 'loading' } : item)
      )
    })

    newSocket.on('fortune-result', (data: { id: string, username: string, birthdate: string, result?: FortuneResult, error?: string }) => {
      if (data.error) {
        setFortuneRequests(prev => 
          prev.map(item => item.id === data.id ? { ...item, status: 'error' } : item)
        )
        setSystemAlert(data.error)
      } else if (data.result) {
        setFortuneRequests(prev => {
          const req = prev.find(r => r.id === data.id)
          if (req) {
            saveFortuneHistoryToRegulars(req, data.birthdate, data.result!)
          }
          return prev.map(item => item.id === data.id ? { ...item, status: 'completed' } : item)
        })

        setFortuneResults(prev => ({
          ...prev,
          [data.id]: data.result!
        }))
        setSelectedRequestId(data.id)
      }
    })

    return () => {
      newSocket.disconnect()
    }
  }, [apiUrl, useStandaloneMode])

  // チャットログ更新時の自動スクロール
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatLogs])

  // TikTok Liveへの接続処理
  const handleConnectTiktok = () => {
    if (!socket || !tiktokUsername.trim()) return
    setTiktokConnected('connecting')
    setErrorMessage('')
    socket.emit('join-tiktok', tiktokUsername.trim())
  }

  // TikTok Liveからの切断処理
  const handleDisconnectTiktok = () => {
    if (!socket) return
    socket.emit('leave-tiktok')
  }

  // 占い質問の更新
  const handleUpdateQuestion = (id: string, value: string) => {
    setFortuneRequests(prev => 
      prev.map(item => item.id === id ? { ...item, fortuneQuestion: value } : item)
    )
  }

  // 占い性別の更新
  const handleUpdateGender = (id: string, gender: 'male' | 'female' | 'unspecified') => {
    setFortuneRequests(prev =>
      prev.map(item => item.id === id ? { ...item, gender } : item)
    )
  }

  // 常連履歴への鑑定データ保存処理の共通化
  const saveFortuneHistoryToRegulars = (req: FortuneRequest, birthdate: string, result: FortuneResult) => {
    setRegulars(prevRegs => {
      const user = prevRegs[req.userId] || {
        userId: req.userId,
        username: req.username,
        profilePictureUrl: req.profilePictureUrl,
        birthdate: birthdate,
        birthdates: [
          { id: '1', birthdate: birthdate, name: '', relationship: '本人' }
        ],
        history: [],
        totalDiamonds: 0,
        totalPayPay: 0
      }

      const isDuplicate = user.history.some(h => h.timestamp === req.timestamp)
      if (!isDuplicate) {
        user.history.unshift({
          timestamp: req.timestamp,
          birthdate: birthdate,
          comment: req.comment,
          summary: result.summary
        })
        if (user.history.length > 5) user.history.pop()
      }

      if (!user.birthdate) {
        user.birthdate = birthdate
      }
      user.lastFortuneAt = Date.now()
      user.username = req.username
      user.profilePictureUrl = req.profilePictureUrl

      const nextRegs = { ...prevRegs, [req.userId]: user }
      localStorage.setItem('star_campe_regulars', JSON.stringify(nextRegs))
      return nextRegs
    })
  }

  // 鑑定開始処理（サーバー接続 / クライアント直接AI の両対応）
  const handleStartFortune = async (req: FortuneRequest) => {
    const chatHistory = chatLogs
      .filter(log => log.userId === req.userId)
      .map(log => log.comment)
      .slice(-5)

    let birthdateParam = req.birthdate
    if (!birthdateParam.includes('[')) {
      const genderStr = req.gender === 'male' ? '男性' : req.gender === 'female' ? '女性' : '未指定'
      birthdateParam = `本人[${genderStr}]: ${req.birthdate}`
    }

    // サーバー接続中でスタンドアロンモードでない場合は Socket.io 経由
    if (serverConnected && socket && !useStandaloneMode) {
      socket.emit('start-fortune', {
        id: req.id,
        username: req.username,
        birthdate: birthdateParam,
        comment: req.fortuneQuestion || req.comment || '全体運について',
        chatHistory
      })
      return
    }

    // スタンドアロンモード（またはサーバー未接続時）：ブラウザ直呼び出しで Gemini AI 鑑定を実行
    setFortuneRequests(prev =>
      prev.map(item => item.id === req.id ? { ...item, status: 'loading' } : item)
    )

    try {
      const result = await runFortuneTellingClient(
        geminiApiKey,
        birthdateParam,
        req.fortuneQuestion || req.comment || '全体運について',
        chatHistory
      )

      saveFortuneHistoryToRegulars(req, birthdateParam, result)

      setFortuneRequests(prev =>
        prev.map(item => item.id === req.id ? { ...item, status: 'completed' } : item)
      )

      setFortuneResults(prev => ({
        ...prev,
        [req.id]: result
      }))
      setSelectedRequestId(req.id)

    } catch (error: any) {
      console.error('Client-side fortune error:', error)
      setFortuneRequests(prev =>
        prev.map(item => item.id === req.id ? { ...item, status: 'error' } : item)
      )
      setSystemAlert('鑑定の生成中にエラーが発生しました。')
    }
  }

  // 手動コメント送信処理（スタンドアロン時・ライバーの手動入力用）
  const handleSendManualComment = () => {
    if (!manualComment.trim()) return
    const name = manualUsername.trim() || 'リスナー'
    const userId = `manual_${name.replace(/\s+/g, '_')}`
    
    processIncomingChat({
      id: Math.random().toString(),
      username: name,
      userId,
      comment: manualComment.trim(),
      timestamp: Date.now()
    })

    setManualComment('')
  }

  // リクエストの削除
  const handleDeleteRequest = (id: string) => {
    setFortuneRequests(prev => prev.filter(item => item.id !== id))
    if (selectedRequestId === id) {
      setSelectedRequestId(null)
    }
  }

  // コピペ機能
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedStates(prev => ({ ...prev, [id]: true }))
      setTimeout(() => {
        setCopiedStates(prev => ({ ...prev, [id]: false }))
      }, 2000)
    })
  }

  // PayPay手動入金登録
  const handleAddPaypay = () => {
    if (!paypayUser.trim() || !paypayAmount.trim()) return
    const amountNum = parseInt(paypayAmount)
    if (isNaN(amountNum)) return

    const userId = `paypay_${paypayUser.trim()}`
    const id = Math.random().toString()
    const timestamp = Date.now()

    setTransactions(prev => [
      {
        id,
        userId,
        username: paypayUser.trim(),
        type: 'paypay',
        amount: amountNum,
        description: `PayPay ${amountNum}円`,
        timestamp
      },
      ...prev
    ])

    let isRegularMatch = false
    setRegulars(prevRegs => {
      let matchedUserId = ''
      for (const uid in prevRegs) {
        if (prevRegs[uid].username.toLowerCase() === paypayUser.trim().toLowerCase()) {
          matchedUserId = uid
          break
        }
      }

      if (matchedUserId) {
        isRegularMatch = true
        const user = prevRegs[matchedUserId]
        user.totalPayPay += amountNum

        let combinedBirth = user.birthdate
        if (user.birthdates && user.birthdates.length > 0) {
          combinedBirth = user.birthdates
            .map(b => `${b.relationship}${b.name ? `(${b.name})` : ''}: ${b.birthdate}`)
            .join(', ')
        }
        
        setFortuneRequests(prevReqs => {
          if (prevReqs.some(r => r.userId === matchedUserId && r.status === 'pending')) return prevReqs
          return [...prevReqs, {
            id,
            username: user.username,
            userId: matchedUserId,
            profilePictureUrl: user.profilePictureUrl,
            birthdate: combinedBirth,
            comment: `PayPay ${amountNum}円の着金を確認しました`,
            fortuneQuestion: `PayPay ${amountNum}円の着金を確認しました`,
            timestamp,
            status: 'pending',
            isRegularMatch: true
          }]
        })

        const nextRegs = { ...prevRegs, [matchedUserId]: user }
        localStorage.setItem('star_campe_regulars', JSON.stringify(nextRegs))
        return nextRegs
      } else {
        const nextRegs = {
          ...prevRegs,
          [userId]: {
            userId,
            username: paypayUser.trim(),
            birthdate: '',
            birthdates: [],
            history: [],
            totalDiamonds: 0,
            totalPayPay: amountNum
          }
        }
        localStorage.setItem('star_campe_regulars', JSON.stringify(nextRegs))
        return nextRegs
      }
    })

    setTtsSpeechTrigger({
      username: paypayUser.trim(),
      comment: `PayPay入金 ${amountNum}円`,
      hasBirth: false,
      isRegular: isRegularMatch,
      isGift: true,
      giftName: `PayPay ${amountNum}円`,
      timestamp: Date.now()
    })

    setPaypayUser('')
    setSystemAlert(`PayPay入金（${paypayUser.trim()}様、${amountNum}円）を登録しました。`)
  }

  // ギフト・決済履歴から鑑定待ちに追加
  const handleAddRequestFromTx = (tx: TransactionItem) => {
    const regular = regulars[tx.userId]
    if (regular && regular.birthdate) {
      let combinedBirth = regular.birthdate
      if (regular.birthdates && regular.birthdates.length > 0) {
        combinedBirth = regular.birthdates
          .map(b => `${b.relationship}${b.name ? `(${b.name})` : ''}: ${b.birthdate}`)
          .join(', ')
      }

      setFortuneRequests(prev => {
        if (prev.some(r => r.userId === tx.userId && r.status === 'pending')) return prev
        return [...prev, {
          id: Math.random().toString(),
          username: tx.username,
          userId: tx.userId,
          profilePictureUrl: tx.profilePictureUrl,
          birthdate: combinedBirth,
          comment: `${tx.description}から鑑定開始`,
          fortuneQuestion: `${tx.description}から鑑定開始`,
          timestamp: Date.now(),
          status: 'pending',
          isRegularMatch: true
        }]
      })
      setSystemAlert(`${tx.username}様（常連）を鑑定待ちに追加しました。`)
    } else {
      const birth = prompt(`${tx.username} 様の生年月日を入力してください（例: 1995/10/12）`)
      if (birth && birth.trim()) {
        const id = Math.random().toString()
        setFortuneRequests(prev => [
          ...prev,
          {
            id,
            username: tx.username,
            userId: tx.userId,
            profilePictureUrl: tx.profilePictureUrl,
            birthdate: birth.trim(),
            comment: `${tx.description}から手動追加`,
            fortuneQuestion: `${tx.description}から手動追加`,
            timestamp: Date.now(),
            status: 'pending'
          }
        ])

        setRegulars(prevRegs => {
          const user = prevRegs[tx.userId] || {
            userId: tx.userId,
            username: tx.username,
            profilePictureUrl: tx.profilePictureUrl,
            birthdate: birth.trim(),
            birthdates: [
              { id: '1', birthdate: birth.trim(), name: '', relationship: '本人' }
            ],
            history: [],
            totalDiamonds: 0,
            totalPayPay: 0
          }
          user.birthdate = birth.trim()
          if (!user.birthdates || user.birthdates.length === 0) {
            user.birthdates = [{ id: '1', birthdate: birth.trim(), name: '', relationship: '本人' }]
          }
          if (tx.type === 'gift') user.totalDiamonds += tx.amount
          if (tx.type === 'paypay') user.totalPayPay += tx.amount

          const next = { ...prevRegs, [tx.userId]: user }
          localStorage.setItem('star_campe_regulars', JSON.stringify(next))
          return next
        })
        setSystemAlert(`${tx.username}様を鑑定待ちに追加しました。`)
      }
    }
  }

  // 複数生年月日レコードの削除
  const handleDeleteBirthdateRecord = (userId: string, recordId: string) => {
    setRegulars(prevRegs => {
      const user = prevRegs[userId]
      if (!user || !user.birthdates) return prevRegs

      const nextBirthdates = user.birthdates.filter(b => b.id !== recordId)
      const mainBirth = nextBirthdates.find(b => b.relationship === '本人')?.birthdate || (nextBirthdates[0]?.birthdate || '')

      const updatedUser = {
        ...user,
        birthdate: mainBirth,
        birthdates: nextBirthdates
      }

      const nextRegs = { ...prevRegs, [userId]: updatedUser }
      localStorage.setItem('star_campe_regulars', JSON.stringify(nextRegs))
      return nextRegs
    })
  }

  // 模擬チャット・ギフトの送信
  const triggerMockChat = (type: 'valid' | 'invalid') => {
    const mockUsers = [
      { name: 'さくら🌸', id: 'sakura_live', pic: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&fit=crop&q=80' },
      { name: 'ゆうき✨', id: 'yuki_travel', pic: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&fit=crop&q=80' },
      { name: 'みく🍀', id: 'miku_deco', pic: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&fit=crop&q=80' },
      { name: 'たくみ⚽', id: 'takumi_sport', pic: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&fit=crop&q=80' }
    ]

    const randomUser = mockUsers[Math.floor(Math.random() * mockUsers.length)]
    const id = Math.random().toString()
    const timestamp = Date.now()

    if (type === 'valid') {
      const birthdates = [
        '1995/10/12にお願いします！仕事について占ってほしいです',
        '私の誕生日は平成8年3月4日です！恋愛運知りたいです',
        '1989-05-20です。今年の金運はどうでしょうか？',
        '2001.07.15 結婚時期について気になります！',
        '970822 おねがいします！',
        '昭和58年11月30日生まれです。転職を考えています。'
      ]
      const comment = birthdates[Math.floor(Math.random() * birthdates.length)]

      processIncomingChat({
        id,
        username: randomUser.name,
        userId: randomUser.id,
        comment,
        profilePictureUrl: randomUser.pic,
        timestamp
      })
    } else {
      const generalComments = [
        'こんにちは！いつも見てます！',
        'PayPay送りました！確認お願いします！',
        '今日の配信も楽しいですね〜',
        'そのアイテム可愛い！',
        '鑑定おねがいします！'
      ]
      const comment = generalComments[Math.floor(Math.random() * generalComments.length)]

      processIncomingChat({
        id,
        username: randomUser.name,
        userId: randomUser.id,
        comment,
        profilePictureUrl: randomUser.pic,
        timestamp
      })
    }
  }

  const triggerMockGift = () => {
    const mockUsers = [
      { name: 'さくら🌸', id: 'sakura_live', pic: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&fit=crop&q=80' },
      { name: 'ゆうき✨', id: 'yuki_travel', pic: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&fit=crop&q=80' },
      { name: 'みく🍀', id: 'miku_deco', pic: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&fit=crop&q=80' }
    ]
    const randomUser = mockUsers[Math.floor(Math.random() * mockUsers.length)]
    const gifts = [
      { name: '薔薇', diamonds: 1 },
      { name: 'いいね', diamonds: 5 },
      { name: 'ハート', diamonds: 10 },
      { name: 'TikTok', diamonds: 100 },
      { name: '手作りの愛', diamonds: 500 }
    ]
    const randomGift = gifts[Math.floor(Math.random() * gifts.length)]
    const count = Math.floor(Math.random() * 5) + 1
    const diamonds = randomGift.diamonds * count

    setTransactions(prev => [
      {
        id: Math.random().toString(),
        userId: randomUser.id,
        username: randomUser.name,
        profilePictureUrl: randomUser.pic,
        type: 'gift',
        amount: diamonds,
        description: `${randomGift.name} x${count} (${diamonds}ダイヤ)`,
        timestamp: Date.now()
      },
      ...prev
    ])
  }

  // 現在選択されている鑑定
  const activeRequest = fortuneRequests.find(r => r.id === selectedRequestId)
  const activeResult = selectedRequestId ? fortuneResults[selectedRequestId] : null
  const activeRegular = activeRequest ? regulars[activeRequest.userId] : null

  // 読み上げ用のテキスト作成
  const getSpeechScript = (req: FortuneRequest, res: FortuneResult) => {
    return `${req.username}さん、あんたを占ってあげるわ。
生年月日は【${req.birthdate}】ね。
いい？今回の総評をズバッと言うわよ。
「${res.summary}」

まず、あんたの宿命と本質だけど、
${res.destiny}

次に、あんたの性格の怖いほど当たる特徴ね。
${res.personality}

恋愛と結婚についてはね、
${res.love}

仕事とお金に関してだけど、
${res.workMoney}

今後3〜5年の運気の流れは、
${res.fortune3to5}

そして、人生で絶対に気をつけるべき警告よ。
${res.warning}

最後にあんたの相談に対してのアドバイスよ。
${res.advice}

ラッキーカラーは「${res.luckyColor || 'なし'}」、アイテムは「${res.luckyItem || 'なし'}」、アクションは「${res.luckyAction || 'なし'}」よ。しっかり心に留めておきなさい！`
  }

  return (
    <div className="min-h-screen flex flex-col p-4 md:p-6 bg-gradient-to-br from-beige-50 via-sage-50 to-gold-100 font-sans">
      
      {/* ヘッダー */}
      <header className="flex flex-col md:flex-row items-center justify-between gap-4 p-5 mb-6 rounded-2xl bg-white/70 backdrop-blur-md border border-beige-200/50 shadow-sm animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl border border-beige-200 shadow-sm bg-gradient-to-tr from-gold-300 to-amber-100 flex items-center justify-center text-xl">
            🔮
          </div>
          <div>
            <h1 className="pearl-title text-2xl md:text-3xl text-stone-800">星のカンペ</h1>
            <p className="text-xs text-sage-700 font-medium">LIVE Fortune Teller Assistant for Livers</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* 動作モード・接続状態表示 */}
          {useStandaloneMode ? (
            <Badge variant="outline" className="flex gap-1.5 items-center px-3 py-1 text-xs border-purple-300 bg-purple-50 text-purple-800 font-semibold shadow-xs">
              <Cpu className="w-3.5 h-3.5 text-purple-600" />
              ブラウザ直接AI（サーバー不要）
            </Badge>
          ) : (
            <Badge variant={serverConnected ? 'sage' : 'destructive'} className="flex gap-1 items-center px-3 py-1 text-xs">
              {serverConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              {serverConnected ? 'サーバー接続中' : 'サーバー未接続'}
            </Badge>
          )}

          {!useStandaloneMode && (
            <div className="flex items-center gap-2 bg-white/80 p-1.5 rounded-lg border border-beige-200 shadow-inner">
              <Input 
                placeholder="TikTokユーザー名" 
                value={tiktokUsername} 
                onChange={(e) => setTiktokUsername(e.target.value)}
                className="h-8 w-40 text-xs border-0 bg-transparent focus-visible:ring-0"
                disabled={tiktokConnected === 'connected' || tiktokConnected === 'connecting'}
              />
              {tiktokConnected === 'connected' ? (
                <Button 
                  variant="destructive" 
                  size="sm" 
                  className="h-7 text-xs font-semibold"
                  onClick={handleDisconnectTiktok}
                >
                  切断する
                </Button>
              ) : (
                <Button 
                  variant="gold" 
                  size="sm" 
                  className="h-7 text-xs font-semibold"
                  onClick={handleConnectTiktok}
                  disabled={!tiktokUsername.trim() || tiktokConnected === 'connecting' || !serverConnected}
                >
                  {tiktokConnected === 'connecting' ? (
                    <RefreshCw className="w-3 h-3 animate-spin mr-1" />
                  ) : null}
                  接続
                </Button>
              )}
            </div>
          )}

          <Button
            variant="outline"
            size="icon"
            className={`h-9 w-9 border-beige-200 ${isTtsEnabled ? 'bg-sage-100 text-sage-800' : 'hover:bg-beige-100 text-muted-foreground'}`}
            onClick={() => setIsTtsEnabled(!isTtsEnabled)}
            title={isTtsEnabled ? "読み上げを無効にする" : "読み上げを有効にする"}
          >
            {isTtsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </Button>

          <div className="flex items-center gap-1.5 bg-sage-50/50 p-1 rounded-lg border border-sage-200">
            <span className="text-[10px] text-sage-700 px-1.5 font-bold">テスト:</span>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-7 px-2 text-[10px] border-sage-200 hover:bg-sage-100 text-sage-800"
              onClick={() => triggerMockChat('valid')}
            >
              模擬チャット(誕生日有)
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-7 px-2 text-[10px] border-sage-200 hover:bg-sage-100 text-sage-800"
              onClick={triggerMockGift}
            >
              模擬ギフト
            </Button>
          </div>

          <Button 
            variant="outline" 
            size="icon" 
            className="h-9 w-9 border-beige-200 hover:bg-beige-100 shrink-0" 
            onClick={() => setIsSettingsOpen(true)}
            title="設定 (AI・接続・読み上げ)"
          >
            <Settings className="w-4 h-4 text-sage-700" />
          </Button>
        </div>
      </header>

      {errorMessage && (
        <div className="mb-4 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-amber-600" />
            <div>{errorMessage}</div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-8 text-xs border-amber-300 bg-white text-amber-800 hover:bg-amber-100 shrink-0"
            onClick={() => {
              setUseStandaloneMode(true)
              localStorage.setItem('fortune_standalone_mode', 'true')
              setErrorMessage('')
              setSystemAlert('「ブラウザ直接AIモード（サーバー不要）」に切り替えました。パソコンでサーバーを立ち上げなくても完全に動作します！')
            }}
          >
            サーバー不要モードに切替
          </Button>
        </div>
      )}

      {systemAlert && (
        <div className="mb-4 p-4 rounded-xl bg-gold-100 border border-gold-200 text-gold-800 text-sm flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-gold-600 flex-shrink-0" />
            <div>{systemAlert}</div>
          </div>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-gold-800 hover:bg-gold-200" onClick={() => setSystemAlert(null)}>閉じる</Button>
        </div>
      )}

      {/* 3カラムグリッドレイアウト */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* 左カラム: コメント監視 / 入金ギフト履歴 タブ (幅3/12) */}
        <Card className="lg:col-span-3 flex flex-col h-[calc(100vh-190px)] border-beige-200 bg-white/60">
          <CardHeader className="py-3 pb-0">
            <div className="flex border-b border-beige-200">
              <button 
                onClick={() => setLeftTab('chat')} 
                className={`flex-1 py-2 text-xs font-bold text-center border-b-2 transition-all flex justify-center items-center gap-1.5 ${
                  leftTab === 'chat' 
                    ? 'border-gold-500 text-gold-800' 
                    : 'border-transparent text-sage-500 hover:text-sage-800'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                LIVEチャット
              </button>
              <button 
                onClick={() => setLeftTab('history')} 
                className={`flex-1 py-2 text-xs font-bold text-center border-b-2 transition-all flex justify-center items-center gap-1.5 ${
                  leftTab === 'history' 
                    ? 'border-gold-500 text-gold-800' 
                    : 'border-transparent text-sage-500 hover:text-sage-800'
                }`}
              >
                <Coins className="w-3.5 h-3.5" />
                ギフト/決済
              </button>
            </div>
          </CardHeader>

          <CardContent className="flex-1 p-3 overflow-hidden flex flex-col pt-3">
            
            {leftTab === 'chat' && (
              <div className="flex-1 flex flex-col gap-2 min-h-0">
                {/* 手動コメント投稿フォーム */}
                <div className="flex flex-col gap-1.5 p-2 rounded-xl bg-white border border-beige-200 shadow-xs">
                  <div className="flex gap-1.5">
                    <Input
                      placeholder="リスナー名 (例: さくら)"
                      value={manualUsername}
                      onChange={(e) => setManualUsername(e.target.value)}
                      className="h-7 text-xs flex-1 bg-beige-50/50"
                    />
                  </div>
                  <div className="flex gap-1.5">
                    <Input
                      placeholder="コメント (例: 1995/10/12 恋愛運)"
                      value={manualComment}
                      onChange={(e) => setManualComment(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendManualComment()}
                      className="h-7 text-xs flex-1 bg-beige-50/50"
                    />
                    <Button 
                      size="sm" 
                      onClick={handleSendManualComment}
                      className="h-7 px-2 bg-amber-500 hover:bg-amber-600 text-white shrink-0"
                      title="コメント送信・自動生年月日判定"
                    >
                      <Send className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                <ScrollArea maxHeight="100%" className="flex-1 border border-beige-200 rounded-xl p-2.5 bg-beige-50/50">
                  {chatLogs.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-6 text-center">
                      <Clock className="w-8 h-8 text-sage-300 mb-2 animate-pulse" />
                      <p className="text-xs">チャット監視をお待ちしています</p>
                      <p className="text-[10px] text-sage-500 mt-1">上の入力欄からコメントを追加するか、「テスト」ボタンを押してください</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {chatLogs.map((log) => (
                        <div 
                          key={log.id} 
                          className={`p-2.5 rounded-lg text-xs transition-all duration-200 ${
                            log.hasBirthdate 
                              ? 'bg-gradient-to-r from-gold-50 to-amber-50 border border-gold-200 shadow-xs' 
                              : 'bg-white border border-beige-100'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="font-bold text-sage-900 truncate flex items-center gap-1">
                              {log.username}
                              {regulars[log.userId] && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 border-gold-400 bg-gold-50 text-gold-800">
                                  常連
                                </Badge>
                              )}
                            </span>
                            <span className="text-[10px] text-sage-400 font-mono">
                              {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-sage-800 break-words">{log.comment}</p>
                        </div>
                      ))}
                      <div ref={chatEndRef} />
                    </div>
                  )}
                </ScrollArea>
              </div>
            )}

            {leftTab === 'history' && (
              <div className="flex flex-col h-full gap-3">
                {/* PayPay手動入金登録エリア */}
                <div className="p-3 rounded-xl bg-gold-50/60 border border-gold-200 space-y-2">
                  <div className="text-xs font-bold text-gold-900 flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5 text-gold-600" />
                    PayPay手動入金の追加
                  </div>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="ユーザー名" 
                      value={paypayUser} 
                      onChange={(e) => setPaypayUser(e.target.value)}
                      className="h-7 text-xs bg-white border-gold-200"
                    />
                    <Input 
                      placeholder="金額" 
                      type="number" 
                      value={paypayAmount} 
                      onChange={(e) => setPaypayAmount(e.target.value)}
                      className="h-7 w-20 text-xs bg-white border-gold-200"
                    />
                    <Button 
                      variant="gold" 
                      size="sm" 
                      className="h-7 text-xs px-2 shrink-0 font-semibold"
                      onClick={handleAddPaypay}
                    >
                      追加
                    </Button>
                  </div>
                </div>

                {/* 決済・ギフトタイムライン */}
                <ScrollArea maxHeight="100%" className="flex-1 border rounded-xl p-2 bg-beige-50/50">
                  {transactions.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-6 text-center">
                      <Coins className="w-8 h-8 text-sage-200 mb-2" />
                      <p className="text-xs">ギフトやPayPay入金履歴がここに表示されます</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {transactions.map((tx) => (
                        <div key={tx.id} className="p-2.5 rounded-lg bg-white border border-beige-200 shadow-xs flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-xs text-sage-900 truncate">{tx.username}</span>
                              <Badge variant={tx.type === 'gift' ? 'secondary' : 'gold'} className="text-[9px] px-1 py-0">
                                {tx.type === 'gift' ? 'ギフト' : 'PayPay'}
                              </Badge>
                            </div>
                            <p className="text-[11px] text-sage-600 truncate mt-0.5">{tx.description}</p>
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-6 text-[10px] px-1.5 border-beige-300 hover:bg-beige-100 shrink-0"
                            onClick={() => handleAddRequestFromTx(tx)}
                          >
                            鑑定待ちへ
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            )}

          </CardContent>
        </Card>

        {/* 中央カラム: 鑑定待ちキュー (幅4/12) */}
        <Card className="lg:col-span-4 flex flex-col h-[calc(100vh-190px)] border-beige-200 bg-white/60">
          <CardHeader className="py-3 border-b border-beige-200">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold text-sage-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-gold-500" />
                鑑定待ちキュー
                <Badge variant="gold" className="ml-1 text-xs">
                  {fortuneRequests.length}件
                </Badge>
              </CardTitle>
            </div>
          </CardHeader>

          <CardContent className="flex-1 p-3 overflow-hidden">
            <ScrollArea maxHeight="100%" className="h-full pr-1">
              {fortuneRequests.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-muted-foreground p-6 text-center">
                  <UserCheck className="w-10 h-10 text-sage-200 mb-3" />
                  <p className="text-sm font-medium text-sage-600">現在、鑑定待ちのリクエストはありません</p>
                  <p className="text-xs text-sage-400 mt-1">コメントから生年月日が検出されると、自動的にここに並びます</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {fortuneRequests.map((req) => {
                    const regular = regulars[req.userId]
                    const predicted = suggestFortuneQuestion(req.comment)
                    
                    return (
                      <Card 
                        key={req.id} 
                        className={`transition-all duration-200 border ${
                          selectedRequestId === req.id 
                            ? 'border-gold-400 ring-2 ring-gold-200/50 bg-white shadow-md' 
                            : 'border-beige-200 hover:border-gold-300 bg-white/80'
                        }`}
                      >
                        <CardContent className="p-3.5 space-y-2.5">
                          {/* ユーザー情報ヘッダー */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-8 h-8 rounded-full bg-sage-100 flex items-center justify-center font-bold text-sage-700 text-xs shrink-0 border border-sage-200">
                                {req.username.slice(0, 1)}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-xs text-sage-900 truncate">{req.username}</span>
                                  {req.isRegularMatch && (
                                    <Badge variant="outline" className="text-[9px] px-1 py-0 border-gold-400 bg-gold-50 text-gold-800">
                                      常連自動
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-sage-600 font-mono">
                                  <span className="font-semibold text-amber-800 bg-amber-50 px-1 rounded border border-amber-200/50">
                                    🎂 {req.birthdate}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-6 w-6 text-sage-400 hover:text-red-600 shrink-0"
                              onClick={() => handleDeleteRequest(req.id)}
                              title="リクエスト削除"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>

                          {/* リスナーコメント */}
                          <div className="text-xs p-2 rounded-lg bg-beige-50/70 border border-beige-100 text-sage-800 italic">
                            「{req.comment}」
                          </div>

                          {/* 占い性別の選択ボタン */}
                          <div className="flex items-center justify-between text-xs pt-1">
                            <span className="text-[10px] text-sage-500 font-bold">性別判定:</span>
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleUpdateGender(req.id, 'female')}
                                className={`px-2 py-0.5 rounded text-[10px] border transition-all ${
                                  req.gender === 'female'
                                    ? 'bg-pink-100 border-pink-300 text-pink-800 font-bold'
                                    : 'bg-white border-beige-200 text-sage-600 hover:bg-beige-50'
                                }`}
                              >
                                👩 女性
                              </button>
                              <button
                                onClick={() => handleUpdateGender(req.id, 'male')}
                                className={`px-2 py-0.5 rounded text-[10px] border transition-all ${
                                  req.gender === 'male'
                                    ? 'bg-blue-100 border-blue-300 text-blue-800 font-bold'
                                    : 'bg-white border-beige-200 text-sage-600 hover:bg-beige-50'
                                }`}
                              >
                                👨 男性
                              </button>
                              <button
                                onClick={() => handleUpdateGender(req.id, 'unspecified')}
                                className={`px-2 py-0.5 rounded text-[10px] border transition-all ${
                                  req.gender === 'unspecified' || !req.gender
                                    ? 'bg-gray-100 border-gray-300 text-gray-800 font-bold'
                                    : 'bg-white border-beige-200 text-sage-600 hover:bg-beige-50'
                                }`}
                              >
                                未指定
                              </button>
                            </div>
                          </div>

                          {/* 相談内容予測・変更フィールド */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="text-sage-500 font-bold">推定相談テーマ:</span>
                              <span className={`px-1.5 py-0.5 rounded border text-[10px] ${predicted.color}`}>
                                {predicted.label}
                              </span>
                            </div>
                            <Input 
                              value={req.fortuneQuestion || ''}
                              onChange={(e) => handleUpdateQuestion(req.id, e.target.value)}
                              placeholder="鑑定で占いたいテーマを入力"
                              className="h-7 text-xs bg-white border-beige-200"
                            />
                          </div>

                          {/* 鑑定ボタン & 常連履歴アコーディオン */}
                          <div className="flex items-center justify-between pt-1 gap-2">
                            {regular && regular.history.length > 0 ? (
                              <Badge variant="outline" className="text-[10px] border-sage-300 text-sage-700">
                                過去鑑定 {regular.history.length}回
                              </Badge>
                            ) : <div />}

                            <Button 
                              variant={req.status === 'completed' ? 'outline' : 'gold'} 
                              size="sm" 
                              className="h-7 text-xs px-3 font-semibold shrink-0"
                              onClick={() => {
                                if (req.status === 'completed') {
                                  setSelectedRequestId(req.id)
                                } else {
                                  handleStartFortune(req)
                                }
                              }}
                              disabled={req.status === 'loading'}
                            >
                              {req.status === 'loading' ? (
                                <>
                                  <RefreshCw className="w-3 h-3 animate-spin mr-1.5" />
                                  鑑定中...
                                </>
                              ) : req.status === 'completed' ? (
                                '結果を見る'
                              ) : (
                                <>
                                  <Sparkles className="w-3 h-3 mr-1" />
                                  鑑定を開始
                                </>
                              )}
                            </Button>
                          </div>

                          {/* 常連生年月日レコードの管理 */}
                          {regular && (
                            <div className="mt-2 pt-2 border-t border-dashed border-beige-200 text-[11px] space-y-1">
                              <div className="font-bold text-sage-700 flex items-center justify-between">
                                <span>登録済みの生年月日リスト:</span>
                              </div>
                              {regular.birthdates && regular.birthdates.length > 0 ? (
                                <div className="space-y-1">
                                  {regular.birthdates.map((b) => (
                                    <div key={b.id} className="flex items-center justify-between bg-beige-50/80 px-2 py-1 rounded text-[10px]">
                                      <span>
                                        <strong>{b.relationship}</strong>{b.name ? `(${b.name})` : ''}: {b.birthdate} [{b.gender === 'male' ? '男性' : b.gender === 'female' ? '女性' : '未指定'}]
                                      </span>
                                      <button 
                                        onClick={() => handleDeleteBirthdateRecord(req.userId, b.id)}
                                        className="text-red-500 hover:text-red-700 ml-1"
                                      >
                                        ×
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-sage-400 italic">メイン: {regular.birthdate}</div>
                              )}
                            </div>
                          )}

                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* 右カラム: 鑑定カンペ & 姐御スクリプト (幅5/12) */}
        <Card className="lg:col-span-5 flex flex-col h-[calc(100vh-190px)] border-gold-200/80 bg-white shadow-sm">
          <CardHeader className="py-3 border-b border-beige-200 bg-gradient-to-r from-gold-50/50 to-amber-50/50">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-amber-900 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-gold-600" />
                  ライバー専用 鑑定カンペ
                </CardTitle>
                <CardDescription className="text-[11px] text-sage-600">
                  {activeRequest ? `${activeRequest.username} 様の鑑定結果` : '鑑定待ちキューから「鑑定を開始」または「結果を見る」を選択してください'}
                </CardDescription>
              </div>

              {activeResult && activeRequest && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-7 text-xs border-gold-300 hover:bg-gold-100 text-gold-900"
                  onClick={() => handleCopy(getSpeechScript(activeRequest, activeResult), 'full_script')}
                >
                  {copiedStates['full_script'] ? <Check className="w-3 h-3 mr-1 text-green-600" /> : <Copy className="w-3 h-3 mr-1" />}
                  {copiedStates['full_script'] ? 'コピー完了' : 'トーク原稿コピー'}
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="flex-1 p-4 overflow-hidden">
            <ScrollArea maxHeight="100%" className="h-full pr-2">
              {!activeResult || !activeRequest ? (
                <div className="h-96 flex flex-col items-center justify-center text-muted-foreground p-6 text-center">
                  <Sparkles className="w-12 h-12 text-gold-300 mb-3 animate-pulse" />
                  <p className="text-base font-semibold text-sage-800">鑑定結果がここに表示されます</p>
                  <p className="text-xs text-sage-500 max-w-xs mt-1">
                    AIが断言型の四柱推命・宿命分析を行い、ライバーがLIVE配信で喋りやすいカンペをリアルタイム生成します。
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* リスナー情報バナー */}
                  <div className="p-3 rounded-xl bg-gradient-to-r from-gold-100 to-amber-100 border border-gold-300 text-amber-900 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-sm">{activeRequest.username} 様</span>
                      <div className="text-xs font-mono text-amber-800 mt-0.5">
                        🎂 {activeRequest.birthdate}
                      </div>
                    </div>
                    {activeRegular && (
                      <div className="text-right text-[11px] font-medium text-amber-800">
                        <div>ダイヤモンド: {activeRegular.totalDiamonds} 💎</div>
                        <div>PayPay累計: {activeRegular.totalPayPay} 円</div>
                      </div>
                    )}
                  </div>

                  {/* 1. 総評（ズバッとキャッチ） */}
                  <div className="p-3.5 rounded-xl bg-rose-50/80 border border-rose-200 text-rose-950 space-y-1 shadow-xs">
                    <div className="text-xs font-bold text-rose-800 flex items-center justify-between">
                      <span className="flex items-center gap-1.5"><Flame className="w-4 h-4 text-rose-600" /> ズバッと総評</span>
                      <Button variant="ghost" size="icon" className="h-5 w-5 text-rose-500" onClick={() => handleCopy(activeResult.summary, 'summary')}>
                        {copiedStates['summary'] ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                      </Button>
                    </div>
                    <p className="text-sm font-bold leading-relaxed">「{activeResult.summary}」</p>
                  </div>

                  {/* 8項目詳細グリッド */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    
                    {/* 宿命・本質 */}
                    <div className="p-3 rounded-xl bg-amber-50/50 border border-amber-200 space-y-1">
                      <div className="font-bold text-amber-900 flex items-center justify-between">
                        <span>🌟 宿命・本質</span>
                        <Button variant="ghost" size="icon" className="h-4 w-4" onClick={() => handleCopy(activeResult.destiny, 'destiny')}>
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                      <p className="text-sage-800 leading-relaxed">{activeResult.destiny}</p>
                    </div>

                    {/* 性格分析 */}
                    <div className="p-3 rounded-xl bg-purple-50/50 border border-purple-200 space-y-1">
                      <div className="font-bold text-purple-900 flex items-center justify-between">
                        <span>⚡ 性格の特徴</span>
                        <Button variant="ghost" size="icon" className="h-4 w-4" onClick={() => handleCopy(activeResult.personality, 'personality')}>
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                      <p className="text-sage-800 leading-relaxed">{activeResult.personality}</p>
                    </div>

                    {/* 恋愛・結婚 */}
                    <div className="p-3 rounded-xl bg-pink-50/50 border border-pink-200 space-y-1">
                      <div className="font-bold text-pink-900 flex items-center justify-between">
                        <span>❤️ 恋愛・結婚</span>
                        <Button variant="ghost" size="icon" className="h-4 w-4" onClick={() => handleCopy(activeResult.love, 'love')}>
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                      <p className="text-sage-800 leading-relaxed">{activeResult.love}</p>
                    </div>

                    {/* 仕事・お金 */}
                    <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-200 space-y-1">
                      <div className="font-bold text-emerald-900 flex items-center justify-between">
                        <span>💼 仕事・金運</span>
                        <Button variant="ghost" size="icon" className="h-4 w-4" onClick={() => handleCopy(activeResult.workMoney, 'workMoney')}>
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                      <p className="text-sage-800 leading-relaxed">{activeResult.workMoney}</p>
                    </div>

                    {/* 今後3〜5年の運気 */}
                    <div className="p-3 rounded-xl bg-blue-50/50 border border-blue-200 space-y-1">
                      <div className="font-bold text-blue-900 flex items-center justify-between">
                        <span>📈 今後3〜5年</span>
                        <Button variant="ghost" size="icon" className="h-4 w-4" onClick={() => handleCopy(activeResult.fortune3to5, 'fortune3to5')}>
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                      <p className="text-sage-800 leading-relaxed">{activeResult.fortune3to5}</p>
                    </div>

                    {/* 人生の警告 */}
                    <div className="p-3 rounded-xl bg-red-50/50 border border-red-200 space-y-1">
                      <div className="font-bold text-red-900 flex items-center justify-between">
                        <span>⚠️ 人生の警告</span>
                        <Button variant="ghost" size="icon" className="h-4 w-4" onClick={() => handleCopy(activeResult.warning, 'warning')}>
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                      <p className="text-sage-800 leading-relaxed">{activeResult.warning}</p>
                    </div>

                  </div>

                  {/* 相談回答アドバイス */}
                  <div className="p-3.5 rounded-xl bg-gold-50 border border-gold-300 space-y-1">
                    <div className="text-xs font-bold text-gold-900 flex items-center justify-between">
                      <span>🎯 ご相談へのズバッと回答</span>
                      <Button variant="ghost" size="icon" className="h-5 w-5 text-gold-700" onClick={() => handleCopy(activeResult.advice, 'advice')}>
                        {copiedStates['advice'] ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                      </Button>
                    </div>
                    <p className="text-xs font-medium text-sage-900 leading-relaxed">{activeResult.advice}</p>
                  </div>

                  {/* 開運アイテム・アクション */}
                  <div className="flex flex-wrap gap-2 text-xs pt-1">
                    {activeResult.luckyColor && (
                      <span className="px-2.5 py-1 rounded-lg bg-stone-100 border border-stone-200 text-stone-800 font-medium">
                        🎨 カラー: {activeResult.luckyColor}
                      </span>
                    )}
                    {activeResult.luckyItem && (
                      <span className="px-2.5 py-1 rounded-lg bg-stone-100 border border-stone-200 text-stone-800 font-medium">
                        🎁 アイテム: {activeResult.luckyItem}
                      </span>
                    )}
                    {activeResult.luckyAction && (
                      <span className="px-2.5 py-1 rounded-lg bg-stone-100 border border-stone-200 text-stone-800 font-medium">
                        ✨ アクション: {activeResult.luckyAction}
                      </span>
                    )}
                  </div>

                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

      </div>

      {/* 設定ダイアログモーダル */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <Card className="w-full max-w-md bg-white border-beige-300 shadow-xl">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-sage-900 flex items-center gap-2">
                <Settings className="w-5 h-5 text-gold-600" />
                システム設定
              </CardTitle>
              <CardDescription className="text-xs">
                動作モード、Gemini AI APIキー、読み上げの設定を変更できます。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">

              {/* 動作モードの設定 */}
              <div className="space-y-2 p-3 rounded-xl bg-purple-50/60 border border-purple-200">
                <label className="font-bold text-purple-900 flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-purple-600" />
                  動作モード設定
                </label>
                <div className="flex items-center gap-3 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="mode"
                      checked={useStandaloneMode}
                      onChange={() => setUseStandaloneMode(true)}
                      className="accent-purple-600"
                    />
                    <span className="font-semibold text-purple-900">ブラウザ直接AIモード（サーバー不要）</span>
                  </label>
                </div>
                <div className="flex items-center gap-3 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="mode"
                      checked={!useStandaloneMode}
                      onChange={() => setUseStandaloneMode(false)}
                      className="accent-purple-600"
                    />
                    <span className="text-sage-700">ローカルサーバー連携モード (Socket.io)</span>
                  </label>
                </div>
                <p className="text-[10px] text-purple-700 leading-tight pt-1">
                  ※「ブラウザ直接AIモード」を選べば、自分のPCでバックエンドサーバーを起動しなくても即座にAI鑑定が利用できます。
                </p>
              </div>

              {/* Gemini APIキー設定 */}
              <div className="space-y-1.5">
                <label className="font-bold text-sage-800 flex items-center justify-between">
                  <span>Gemini APIキー (任意)</span>
                </label>
                <Input 
                  type="password"
                  value={tempGeminiApiKey}
                  onChange={(e) => setTempGeminiApiKey(e.target.value)}
                  placeholder="AIZASy..."
                  className="h-8 text-xs bg-beige-50/50"
                />
                <p className="text-[10px] text-sage-500">
                  ※APIキーが未入力の場合はサンプル毒舌鑑定結果が自動生成されます。APIキーを設定するとGoogle AIによる完全オリジナルの高精度鑑定が動きます。
                </p>
              </div>

              {!useStandaloneMode && (
                <div className="space-y-1.5">
                  <label className="font-bold text-sage-800">サーバー接続URL (Socket.io)</label>
                  <Input 
                    value={tempApiUrl}
                    onChange={(e) => setTempApiUrl(e.target.value)}
                    placeholder="http://localhost:5001"
                    className="h-8 text-xs bg-beige-50/50"
                  />
                </div>
              )}

              {/* 読み上げ設定 */}
              <div className="space-y-3 pt-2 border-t border-beige-200">
                <div className="font-bold text-sage-800">音声読み上げ設定 (TTS)</div>
                <div className="flex items-center justify-between">
                  <span>読み上げ対象</span>
                  <select 
                    value={ttsMode}
                    onChange={(e) => setTtsMode(e.target.value as 'all' | 'fortune')}
                    className="h-7 text-xs rounded border border-beige-300 bg-white px-2"
                  >
                    <option value="all">すべてのチャット</option>
                    <option value="fortune">生年月日あり / 常連のみ</option>
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <span>読み上げ速度: {ttsRate.toFixed(1)}x</span>
                  <input 
                    type="range" 
                    min="0.5" 
                    max="2.0" 
                    step="0.1"
                    value={ttsRate}
                    onChange={(e) => setTtsRate(parseFloat(e.target.value))}
                    className="w-32"
                  />
                </div>
              </div>

            </CardContent>
            <CardFooter className="flex justify-end gap-2 border-t border-beige-200 py-3">
              <Button variant="ghost" size="sm" onClick={() => setIsSettingsOpen(false)}>
                キャンセル
              </Button>
              <Button variant="gold" size="sm" onClick={handleSaveSettings}>
                設定を保存
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

    </div>
  )
}
