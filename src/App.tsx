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
  User, 
  Calendar, 
  HelpCircle,
  AlertCircle,
  Coffee,
  Settings,
  Coins,
  Volume2,
  VolumeX
} from 'lucide-react'
import { Button } from './components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './components/ui/card'
import { Input } from './components/ui/input'
import { Badge } from './components/ui/badge'
import { ScrollArea } from './components/ui/scroll-area'

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
  comment: string
  timestamp: number
  status: 'pending' | 'loading' | 'completed' | 'error'
  isRegularMatch?: boolean // 常連による自動引き当てフラグ
}

interface FortuneHistoryItem {
  timestamp: number
  birthdate: string
  comment: string
  summary: string
}

interface RegularUser {
  userId: string
  username: string
  profilePictureUrl?: string
  birthdate: string
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
  amount: number // ダイヤ数または円
  description: string
  timestamp: number
}

interface FortuneResult {
  summary: string
  personality: string
  fortune: string
  advice: string
  luckyColor: string
  luckyItem: string
  luckyAction: string
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

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null)
  
  // 接続設定
  const [tiktokUsername, setTiktokUsername] = useState('')
  const [serverConnected, setServerConnected] = useState(false)
  const [tiktokConnected, setTiktokConnected] = useState<'connected' | 'disconnected' | 'connecting' | 'error'>('disconnected')
  const [errorMessage, setErrorMessage] = useState('')
  const [systemAlert, setSystemAlert] = useState<string | null>(null)

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
    return localStorage.getItem('fortune_api_url') || 'http://localhost:5001'
  })
  const [tempApiUrl, setTempApiUrl] = useState(apiUrl)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  // 読み上げ機能（TTS）の設定状態
  const [isTtsEnabled, setIsTtsEnabled] = useState(() => {
    return localStorage.getItem('fortune_tts_enabled') === 'true'
  })
  const [ttsMode, setTtsMode] = useState<'all' | 'fortune'>(() => {
    return (localStorage.getItem('fortune_tts_mode') as 'all' | 'fortune') || 'fortune'
  })
  const [ttsRate, setTtsRate] = useState(() => {
    return parseFloat(localStorage.getItem('fortune_tts_rate') || '1.0')
  })
  const [ttsVolume, setTtsVolume] = useState(() => {
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
    setIsSettingsOpen(false)
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

  useEffect(() => {
    localStorage.setItem('fortune_tts_volume', String(ttsVolume))
  }, [ttsVolume])

  // 音声読み上げコア処理
  const speakText = (text: string) => {
    if (!('speechSynthesis' in window)) return
    
    // 連投時のバグや声の重なりを防ぐため、再生中の音声を一度キャンセル
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
    
    let text = ''
    if (isGift) {
      text = `${username}さんから、ギフト「${giftName}」を頂きました！`
    } else {
      if (ttsMode === 'all') {
        text = `${username}さん。「${comment}」`
      } else if (ttsMode === 'fortune' && (hasBirth || isRegular)) {
        const regularText = isRegular ? '常連の' : ''
        text = `${regularText}${username}さんから、占い依頼が入りました。「${comment}」`
      }
    }

    if (text) {
      speakText(text)
    }
  }, [ttsSpeechTrigger])

  useEffect(() => {
    // Socket.ioサーバーに接続
    const newSocket = io(apiUrl)
    setSocket(newSocket)

    newSocket.on('connect', () => {
      setServerConnected(true)
      setErrorMessage('')
    })

    newSocket.on('disconnect', () => {
      setServerConnected(false)
      setTiktokConnected('disconnected')
    })

    // TikTok Live 接続ステータス通知
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

    // チャットメッセージ受信
    newSocket.on('chat-log', (msg: ChatMessage) => {
      setChatLogs(prev => {
        const next = [...prev, msg]
        if (next.length > 150) next.shift()
        return next
      })

      // 常連の自動引き当て処理
      let isRegularMatch = false
      setRegulars(prevRegs => {
        const regular = prevRegs[msg.userId]
        if (regular && regular.birthdate) {
          isRegularMatch = true
          // すでに鑑定待ちリストに保留中の同じユーザーがいない場合のみ追加
          setFortuneRequests(prevReqs => {
            if (prevReqs.some(r => r.userId === msg.userId && r.status === 'pending')) {
              return prevReqs
            }
            return [...prevReqs, {
              id: msg.id || Math.random().toString(),
              username: msg.username,
              userId: msg.userId,
              profilePictureUrl: msg.profilePictureUrl,
              birthdate: regular.birthdate,
              comment: msg.comment,
              timestamp: Date.now(),
              status: 'pending',
              isRegularMatch: true
            }]
          })
        }
        return prevRegs
      })

      // 読み上げ用のキューに追加 (Stale Closureを回避するため最新状態をトリガーとして設定)
      setTtsSpeechTrigger({
        username: msg.username,
        comment: msg.comment,
        hasBirth: !!msg.hasBirthdate,
        isRegular: isRegularMatch,
        isGift: false,
        timestamp: Date.now()
      })
    })

    // 生年月日が自動抽出されたリクエスト受信
    newSocket.on('detected-fortune-request', (req: Omit<FortuneRequest, 'status'>) => {
      setFortuneRequests(prev => {
        if (prev.some(item => item.id === req.id)) return prev
        return [...prev, { ...req, status: 'pending' }]
      })

      // 初回検知時または未登録ユーザーの場合に常連データを一時保存（生年月日紐付けのため）
      setRegulars(prevRegs => {
        if (!prevRegs[req.userId]) {
          const next = {
            ...prevRegs,
            [req.userId]: {
              userId: req.userId,
              username: req.username,
              profilePictureUrl: req.profilePictureUrl,
              birthdate: req.birthdate,
              history: [],
              totalDiamonds: 0,
              totalPayPay: 0
            }
          }
          localStorage.setItem('star_campe_regulars', JSON.stringify(next))
          return next
        }
        return prevRegs
      })
    })

    // ギフト受信イベント
    newSocket.on('gift-log', (gift: { id: string; username: string; userId: string; profilePictureUrl?: string; giftName: string; diamonds: number; count: number; timestamp: number }) => {
      // 履歴に追加
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

      // 常連のギフト累積を更新 ＆ 自動引き当て
      let isRegularMatch = false
      setRegulars(prevRegs => {
        const user = prevRegs[gift.userId] || {
          userId: gift.userId,
          username: gift.username,
          profilePictureUrl: gift.profilePictureUrl,
          birthdate: '', 
          history: [],
          totalDiamonds: 0,
          totalPayPay: 0
        }

        user.totalDiamonds += gift.diamonds
        user.username = gift.username 
        user.profilePictureUrl = gift.profilePictureUrl 

        const nextRegs = { ...prevRegs, [gift.userId]: user }
        localStorage.setItem('star_campe_regulars', JSON.stringify(nextRegs))

        // もし生年月日が登録済み（常連）であれば自動で鑑定待ちへ
        if (user.birthdate) {
          isRegularMatch = true
          setFortuneRequests(prevReqs => {
            if (prevReqs.some(r => r.userId === gift.userId && r.status === 'pending')) return prevReqs
            return [...prevReqs, {
              id: gift.id,
              username: gift.username,
              userId: gift.userId,
              profilePictureUrl: gift.profilePictureUrl,
              birthdate: user.birthdate,
              comment: `ギフト「${gift.giftName}」を頂きました`,
              timestamp: Date.now(),
              status: 'pending',
              isRegularMatch: true
            }]
          })
        }
        return nextRegs
      })

      // 読み上げ用のキューにギフトを追加
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

    // 占い生成の進行状態
    newSocket.on('fortune-progress', (data: { id: string, status: 'loading' }) => {
      setFortuneRequests(prev => 
        prev.map(item => item.id === data.id ? { ...item, status: 'loading' } : item)
      )
    })

    // 占い完了結果受信
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
            // 常連カルテの更新
            setRegulars(prevRegs => {
              const user = prevRegs[req.userId] || {
                userId: req.userId,
                username: req.username,
                profilePictureUrl: req.profilePictureUrl,
                birthdate: data.birthdate,
                history: [],
                totalDiamonds: 0,
                totalPayPay: 0
              }

              // 鑑定履歴の追加
              const isDuplicate = user.history.some(h => h.timestamp === req.timestamp)
              if (!isDuplicate) {
                user.history.unshift({
                  timestamp: req.timestamp,
                  birthdate: data.birthdate,
                  comment: req.comment,
                  summary: data.result!.summary
                })
                if (user.history.length > 5) user.history.pop()
              }

              user.birthdate = data.birthdate 
              user.lastFortuneAt = Date.now()
              user.username = req.username
              user.profilePictureUrl = req.profilePictureUrl

              const nextRegs = { ...prevRegs, [req.userId]: user }
              localStorage.setItem('star_campe_regulars', JSON.stringify(nextRegs))
              return nextRegs
            })
          }
          return prev.map(item => item.id === data.id ? { ...item, status: 'completed' } : item)
        })

        setFortuneResults(prev => ({
          ...prev,
          [data.id]: data.result!
        }))
        setSelectedRequestId(data.id)

        // 鑑定完了時、占い要点を読み上げる演出（オプション）
        if (isTtsEnabled) {
          speakText(`${data.username}さんの鑑定が完了しました。要点、「${data.result.summary}」`)
        }
      }
    })

    return () => {
      newSocket.disconnect()
    }
  }, [apiUrl, isTtsEnabled, ttsRate, ttsVolume, ttsMode])

  // チャットログが更新されたら一番下にスクロール
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

  // 鑑定開始処理（ライバーの手動承認）
  const handleStartFortune = (req: FortuneRequest) => {
    if (!socket) return
    socket.emit('start-fortune', {
      id: req.id,
      username: req.username,
      birthdate: req.birthdate,
      comment: req.comment
    })
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

    // 履歴に追加
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

    // 常連登録済みか名前で検索して紐付け
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
        
        // 鑑定待ちへ自動追加
        setFortuneRequests(prevReqs => {
          if (prevReqs.some(r => r.userId === matchedUserId && r.status === 'pending')) return prevReqs
          return [...prevReqs, {
            id,
            username: user.username,
            userId: matchedUserId,
            profilePictureUrl: user.profilePictureUrl,
            birthdate: user.birthdate,
            comment: `PayPay ${amountNum}円の着金を確認しました`,
            timestamp,
            status: 'pending',
            isRegularMatch: true
          }]
        })

        const nextRegs = { ...prevRegs, [matchedUserId]: user }
        localStorage.setItem('star_campe_regulars', JSON.stringify(nextRegs))
        return nextRegs
      } else {
        // 新規仮登録
        const nextRegs = {
          ...prevRegs,
          [userId]: {
            userId,
            username: paypayUser.trim(),
            birthdate: '',
            history: [],
            totalDiamonds: 0,
            totalPayPay: amountNum
          }
        }
        localStorage.setItem('star_campe_regulars', JSON.stringify(nextRegs))
        return nextRegs
      }
    })

    // 読み上げキューにPayPay追加をトリガー
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
      setFortuneRequests(prev => {
        if (prev.some(r => r.userId === tx.userId && r.status === 'pending')) return prev
        return [...prev, {
          id: Math.random().toString(),
          username: tx.username,
          userId: tx.userId,
          profilePictureUrl: tx.profilePictureUrl,
          birthdate: regular.birthdate,
          comment: `${tx.description}から鑑定開始`,
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
            history: [],
            totalDiamonds: 0,
            totalPayPay: 0
          }
          user.birthdate = birth.trim()
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

  // 模擬チャットの送信
  const triggerMockChat = (type: 'valid' | 'invalid') => {
    if (!socket) return
    socket.emit('send-mock-chat', type)
  }

  // 模擬ギフトの送信
  const triggerMockGift = () => {
    if (!socket) return
    socket.emit('send-mock-gift')
  }

  // 現在選択されている鑑定
  const activeRequest = fortuneRequests.find(r => r.id === selectedRequestId)
  const activeResult = selectedRequestId ? fortuneResults[selectedRequestId] : null
  const activeRegular = activeRequest ? regulars[activeRequest.userId] : null

  // 読み上げ用のテキスト作成
  const getSpeechScript = (req: FortuneRequest, res: FortuneResult) => {
    return `${req.username}さん、占わせていただきますね。
生年月日は${req.birthdate}ですね。
今回の鑑定のポイントは、「${res.summary}」です。
お人柄を見てみますと、${res.personality}
現在お悩みの運勢やアドバイスですが、${res.fortune}
開運へのヒントとして、ラッキーカラーは「${res.luckyColor}」、ラッキーアイテムは「${res.luckyItem}」です。また、${res.luckyAction}を心がけるとさらに運気が高まりますよ。応援しています！`
  }

  return (
    <div className="min-h-screen flex flex-col p-4 md:p-6 bg-gradient-to-br from-beige-50 via-sage-50 to-gold-100">
      
      {/* ヘッダー */}
      <header className="flex flex-col md:flex-row items-center justify-between gap-4 p-5 mb-6 rounded-2xl bg-white/70 backdrop-blur-md border border-beige-200/50 shadow-sm animate-fade-in">
        <div className="flex items-center gap-3">
          <img 
            src="/logo.png" 
            alt="星のカンペ Logo" 
            className="w-12 h-12 rounded-xl border border-beige-200 shadow-sm"
          />
          <div>
            <h1 className="pearl-title text-2xl md:text-3xl">星のカンペ</h1>
            <p className="text-xs text-sage-700 font-medium">LIVE Fortune Teller Assistant for Livers</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* サーバー接続状態 */}
          <Badge variant={serverConnected ? 'sage' : 'destructive'} className="flex gap-1 items-center px-3 py-1 text-xs">
            {serverConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {serverConnected ? 'サーバー接続中' : 'サーバー未接続'}
          </Badge>

          {/* TikTok接続 */}
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

          {/* 読み上げ クイック切り替え */}
          <Button
            variant="outline"
            size="icon"
            className={`h-9 w-9 border-beige-200 ${isTtsEnabled ? 'bg-sage-100 text-sage-800' : 'hover:bg-beige-100 text-muted-foreground'}`}
            onClick={() => setIsTtsEnabled(!isTtsEnabled)}
            title={isTtsEnabled ? "読み上げを無効にする" : "読み上げを有効にする"}
          >
            {isTtsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </Button>

          {/* テストシミュレータ */}
          <div className="flex items-center gap-1.5 bg-sage-50/50 p-1 rounded-lg border border-sage-200">
            <span className="text-[10px] text-sage-700 px-1.5 font-bold">テスト:</span>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-7 px-2 text-[10px] border-sage-200 hover:bg-sage-100 text-sage-800"
              onClick={() => triggerMockChat('valid')}
              disabled={!serverConnected}
            >
              チャット(誕生日有)
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-7 px-2 text-[10px] border-sage-200 hover:bg-sage-100 text-sage-800"
              onClick={triggerMockGift}
              disabled={!serverConnected}
            >
              ギフト送信
            </Button>
          </div>

          {/* 設定ボタン */}
          <Button 
            variant="outline" 
            size="icon" 
            className="h-9 w-9 border-beige-200 hover:bg-beige-100 shrink-0" 
            onClick={() => setIsSettingsOpen(true)}
            title="サーバー設定"
          >
            <Settings className="w-4 h-4 text-sage-700" />
          </Button>
        </div>
      </header>

      {/* エラー表示 */}
      {errorMessage && (
        <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-center gap-3 animate-bounce">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <div>{errorMessage}</div>
        </div>
      )}

      {/* システムアラート */}
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
        
        {/* 左カラム: コメント監視 / 入金ギフト履歴 タブ (幅3.5/12) */}
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
            
            {/* LIVEチャットタブ */}
            {leftTab === 'chat' && (
              <ScrollArea maxHeight="100%" className="flex-1 border rounded-xl p-2.5 bg-beige-50/50">
                {chatLogs.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-6 text-center">
                    <Clock className="w-8 h-8 text-sage-200 mb-2 animate-pulse" />
                    <p className="text-xs">チャット監視をお待ちしています</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {chatLogs.map((log) => (
                      <div 
                        key={log.id} 
                        className={`p-2.5 rounded-lg text-xs transition-all duration-200 ${
                          log.hasBirthdate 
                            ? 'bg-gradient-to-r from-gold-100/70 to-beige-100/50 border border-gold-300/40 shadow-sm animate-pulse' 
                            : regulars[log.userId]?.birthdate
                            ? 'bg-gradient-to-r from-sage-100/70 to-beige-50/50 border border-sage-200/50 shadow-sm'
                            : 'bg-white/80 border border-beige-100'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-1 justify-between">
                          <div className="flex items-center gap-1">
                            {log.profilePictureUrl ? (
                              <img src={log.profilePictureUrl} alt="" className="w-4 h-4 rounded-full" />
                            ) : (
                              <User className="w-3 h-3 text-muted-foreground" />
                            )}
                            <span className="font-semibold text-beige-800 max-w-[90px] truncate">{log.username}</span>
                          </div>
                          {log.hasBirthdate && (
                            <Badge variant="gold" className="text-[8px] px-1 py-0 scale-90 shrink-0">生年月日</Badge>
                          )}
                          {!log.hasBirthdate && regulars[log.userId]?.birthdate && (
                            <Badge variant="sage" className="text-[8px] px-1 py-0 scale-90 shrink-0">常連引き当て</Badge>
                          )}
                        </div>
                        <p className="text-foreground/90 break-words pl-5 leading-relaxed">{log.comment}</p>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>
                )}
              </ScrollArea>
            )}

            {/* ギフト・決済タブ */}
            {leftTab === 'history' && (
              <div className="flex-1 flex flex-col overflow-hidden space-y-3">
                {/* 手動PayPay追加フォーム */}
                <div className="p-2.5 bg-beige-50/70 border border-beige-200 rounded-xl space-y-2">
                  <span className="text-[9px] font-bold text-beige-700 uppercase block">PayPay入金の手動登録</span>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="ユーザー名"
                      value={paypayUser}
                      onChange={(e) => setPaypayUser(e.target.value)}
                      className="h-8 text-xs flex-1 bg-white"
                    />
                    <Input 
                      placeholder="金額(円)"
                      value={paypayAmount}
                      onChange={(e) => setPaypayAmount(e.target.value)}
                      className="h-8 text-xs w-20 bg-white"
                    />
                    <Button 
                      variant="gold" 
                      className="h-8 text-[10px] font-bold"
                      onClick={handleAddPaypay}
                    >
                      追加
                    </Button>
                  </div>
                </div>

                {/* 履歴スクロール */}
                <ScrollArea maxHeight="100%" className="flex-1 border rounded-xl p-2 bg-beige-50/30">
                  {transactions.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-6 text-center">
                      <Coins className="w-8 h-8 text-sage-200 mb-2" />
                      <p className="text-xs">ギフトやPayPayの入金が<br/>こちらに表示されます</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {transactions.map((tx) => {
                        const isRegular = !!regulars[tx.userId]?.birthdate
                        return (
                          <div 
                            key={tx.id} 
                            className="p-2.5 rounded-lg text-xs bg-white border border-beige-200 shadow-sm flex items-center justify-between gap-1.5"
                          >
                            <div className="min-w-0 flex items-center gap-1.5">
                              {tx.profilePictureUrl ? (
                                <img src={tx.profilePictureUrl} alt="" className="w-5 h-5 rounded-full" />
                              ) : (
                                <div className="w-5 h-5 rounded-full bg-beige-100 flex items-center justify-center">
                                  <User className="w-3 h-3 text-beige-600" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="flex items-center gap-1">
                                  <span className="font-semibold text-beige-800 truncate max-w-[80px]">{tx.username}</span>
                                  {isRegular && <Badge variant="outline" className="text-[7px] px-1 py-0 border-sage-400 text-sage-700 bg-sage-50 scale-90">常連</Badge>}
                                </div>
                                <span className="text-[9px] text-muted-foreground block">{tx.description}</span>
                              </div>
                            </div>

                            <Button 
                              variant={isRegular ? "gold" : "outline"} 
                              size="sm" 
                              className="h-7 text-[9px] px-2 font-bold flex-shrink-0"
                              onClick={() => handleAddRequestFromTx(tx)}
                            >
                              {isRegular ? '占う' : '+ 生年月日'}
                            </Button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </ScrollArea>
              </div>
            )}

          </CardContent>
        </Card>

        {/* 中央カラム: 鑑定待ちリスト (幅4/12) */}
        <Card className="lg:col-span-4 flex flex-col h-[calc(100vh-190px)] border-beige-200 bg-white/70">
          <CardHeader className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-beige-800">
                <UserCheck className="w-5 h-5 text-gold-500" />
                <CardTitle className="text-sm font-bold">鑑定待ちリスト</CardTitle>
              </div>
              <Badge variant="sage" className="text-[10px]">
                {fortuneRequests.length}件
              </Badge>
            </div>
            <CardDescription>手動または常連から自動引き当てされたリスナーです</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 p-4 pt-0 overflow-hidden flex flex-col">
            <ScrollArea maxHeight="100%" className="flex-1">
              {fortuneRequests.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 text-center border-2 border-dashed border-beige-200 rounded-xl">
                  <Calendar className="w-9 h-9 text-sage-200 mb-2" />
                  <p className="text-xs font-semibold">現在、鑑定待ちのリスナーはいません</p>
                  <p className="text-[10px] text-sage-400 mt-1 max-w-[200px]">
                    生年月日を含むチャットを受信、または常連リスナーがチャット・ギフトを送信するとここに追加されます。
                  </p>
                </div>
              ) : (
                <div className="space-y-3 pr-1">
                  {fortuneRequests.map((req) => {
                    const isSelected = selectedRequestId === req.id
                    return (
                      <div 
                        key={req.id} 
                        className={`p-3.5 rounded-xl border transition-all duration-300 ${
                          isSelected 
                            ? 'border-gold-500 bg-gradient-to-br from-gold-50/50 to-beige-50/50 shadow-md ring-1 ring-gold-200' 
                            : 'border-beige-200 bg-white hover:border-beige-300 hover:shadow-sm'
                        }`}
                        onClick={() => setSelectedRequestId(req.id)}
                      >
                        <div className="flex items-start gap-2.5 justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            {req.profilePictureUrl ? (
                              <img src={req.profilePictureUrl} alt="" className="w-6 h-6 rounded-full border border-beige-100" />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-beige-100 flex items-center justify-center">
                                <User className="w-3 h-3 text-beige-600" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <span className="font-semibold text-xs text-beige-800 block truncate">{req.username}</span>
                              <span className="text-[9px] text-sage-500 block truncate">@{req.userId}</span>
                            </div>
                          </div>
                          
                          <div className="flex flex-col items-end gap-1">
                            <Badge variant="outline" className="bg-sage-50 text-[10px] text-sage-700 shrink-0">
                              {req.birthdate}
                            </Badge>
                            {req.isRegularMatch && (
                              <Badge variant="sage" className="text-[7px] scale-90 px-1 py-0 shrink-0">常連自動マッチ</Badge>
                            )}
                          </div>
                        </div>

                        <div className="my-2.5 p-2 bg-beige-50 rounded-lg text-[11px] text-muted-foreground break-words border border-beige-100/50">
                          <span className="font-bold text-[9px] text-beige-700 block uppercase mb-0.5">コメント</span>
                          「{req.comment}」
                        </div>

                        <div className="flex items-center justify-between mt-3 gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-[10px] text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteRequest(req.id)
                            }}
                          >
                            削除
                          </Button>
                          
                          <div className="flex gap-1.5 ml-auto">
                            {req.status === 'completed' ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2.5 text-[10px] border-gold-300 text-gold-800 hover:bg-gold-50"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedRequestId(req.id)
                                }}
                              >
                                結果を表示
                              </Button>
                            ) : (
                              <Button
                                variant="gold"
                                size="sm"
                                className="h-7 px-3 text-[10px] flex items-center gap-1 shadow-sm"
                                disabled={req.status === 'loading'}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleStartFortune(req)
                                }}
                              >
                                {req.status === 'loading' ? (
                                  <>
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                    鑑定中
                                  </>
                                ) : (
                                  <>
                                    <Sparkles className="w-3 h-3 text-gold-200" />
                                    PayPay確認 / 鑑定開始
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* 右カラム: Gemini鑑定結果表示 / 常連カルテ (幅5/12) */}
        <Card className="lg:col-span-5 flex flex-col h-[calc(100vh-190px)] border-beige-200 bg-white">
          <CardHeader className="py-4 border-b border-beige-100 flex-shrink-0">
            <div className="flex items-center gap-2 text-beige-800">
              <BookOpen className="w-5 h-5 text-gold-500" />
              <CardTitle className="text-sm font-bold">Gemini 鑑定カンペ</CardTitle>
            </div>
            <CardDescription>ライバー用の口頭トーク用のカンペが表示されます</CardDescription>
          </CardHeader>
          
          <CardContent className="flex-1 p-5 overflow-y-auto bg-gradient-to-b from-white to-beige-50/20">
            {!activeRequest ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
                <HelpCircle className="w-10 h-10 text-sage-200 mb-2" />
                <p className="text-xs font-semibold">リスナーを選択してください</p>
                <p className="text-[10px] text-sage-400 mt-1 max-w-[240px]">
                  「鑑定待ちリスト」からリスナーを選び、「鑑定開始」ボタンを押すと鑑定結果が生成されます。
                </p>
              </div>
            ) : activeRequest.status === 'loading' ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                <div className="relative mb-4 flex items-center justify-center">
                  <div className="w-14 h-14 rounded-full border-4 border-gold-100 border-t-gold-500 animate-spin"></div>
                  <Sparkles className="w-6 h-6 text-gold-500 absolute animate-pulse" />
                </div>
                <p className="text-sm font-bold text-beige-800 animate-pulse">Gemini 鑑定中...</p>
                <p className="text-xs text-sage-500 mt-1">生年月日をもとに最適なアドバイスを生成しています（1〜2秒）</p>
              </div>
            ) : activeRequest.status === 'error' ? (
              <div className="h-full flex flex-col items-center justify-center text-red-800 p-8 text-center">
                <AlertCircle className="w-10 h-10 text-red-400 mb-2" />
                <p className="text-xs font-semibold">鑑定エラーが発生しました</p>
                <p className="text-[10px] text-red-500 mt-1">API設定やインターネット接続を確認してください。</p>
              </div>
            ) : activeResult ? (
              <div className="space-y-5 animate-fade-in text-sm">
                
                {/* 鑑定中ユーザー情報と常連ステータス */}
                <div className="pb-4 border-b border-beige-100 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {activeRequest.profilePictureUrl ? (
                        <img src={activeRequest.profilePictureUrl} alt="" className="w-8 h-8 rounded-full" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-beige-100 flex items-center justify-center">
                          <User className="w-4 h-4 text-beige-600" />
                        </div>
                      )}
                      <div>
                        <h4 className="font-bold text-xs text-beige-800">{activeRequest.username}</h4>
                        <p className="text-[9px] text-sage-500">ID: @{activeRequest.userId}</p>
                      </div>
                    </div>
                    <Badge variant="gold" className="text-[10px]">{activeRequest.birthdate}</Badge>
                  </div>

                  {/* 常連カルテ情報 */}
                  {activeRegular && (
                    <div className="bg-sage-50/70 border border-sage-200/50 rounded-lg p-2 text-[10px] text-sage-800 space-y-1">
                      <div className="flex items-center justify-between font-semibold border-b border-sage-200 pb-1 mb-1">
                        <span className="flex items-center gap-1">👤 常連カルテ</span>
                        <div className="flex gap-2">
                          <span className="flex items-center text-amber-600"><Coins className="w-3 h-3 mr-0.5" />{activeRegular.totalDiamonds}ダイヤ</span>
                          <span className="flex items-center text-blue-600">💸 PayPay: {activeRegular.totalPayPay}円</span>
                        </div>
                      </div>
                      
                      {/* 過去の相談履歴リスト */}
                      {activeRegular.history && activeRegular.history.length > 0 ? (
                        <div className="space-y-1">
                          <span className="font-bold text-[8px] text-sage-500 uppercase">過去の鑑定記録:</span>
                          <div className="space-y-1 max-h-[60px] overflow-y-auto pr-1">
                            {activeRegular.history.map((hist, idx) => (
                              <div key={idx} className="bg-white/80 p-1.5 rounded border border-sage-100 text-[9px] leading-relaxed">
                                <div className="flex justify-between text-[8px] text-muted-foreground mb-0.5">
                                  <span>{new Date(hist.timestamp).toLocaleDateString()}の相談</span>
                                  <span>{hist.birthdate}</span>
                                </div>
                                <div className="text-foreground/90 font-medium">相談: 「{hist.comment}」</div>
                                <div className="text-gold-700 italic">結果: {hist.summary}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-sage-500 italic text-[9px]">過去の鑑定記録はありません</p>
                      )}
                    </div>
                  )}
                </div>

                {/* 鑑定の要点 (キャッチコピー) */}
                <div className="p-4 bg-gradient-to-r from-gold-100/50 to-beige-100/30 border border-gold-200/60 rounded-xl">
                  <span className="text-[9px] font-bold text-gold-600 block mb-1 uppercase tracking-wider">💎 鑑定の要点 (キャッチコピー)</span>
                  <p className="font-serif text-sm font-semibold text-beige-900 leading-snug">{activeResult.summary}</p>
                </div>

                {/* 基本性格 */}
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-sage-500 block uppercase tracking-wider">🌸 基本性格と本質的な魅力</span>
                  <div className="bg-sage-50/50 p-3.5 rounded-xl border border-sage-100 text-xs leading-relaxed text-foreground/90 whitespace-pre-line">
                    {activeResult.personality}
                  </div>
                </div>

                {/* 運勢アドバイス */}
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-gold-600 block uppercase tracking-wider">🌟 運勢の流れ・お悩みアドバイス</span>
                  <div className="bg-beige-50/30 p-3.5 rounded-xl border border-beige-200 text-xs leading-relaxed text-foreground/90 whitespace-pre-line">
                    {activeResult.fortune}
                  </div>
                </div>

                {/* ライバー向け トークのアドバイス */}
                <div className="p-4 bg-sage-100/50 border border-sage-200/50 rounded-xl relative overflow-hidden">
                  <div className="absolute right-2 top-2 text-sage-200/80"><Coffee className="w-12 h-12 rotate-12" /></div>
                  <span className="text-[9px] font-bold text-sage-700 block mb-1 uppercase tracking-wider">🎙️ リスナーへの伝え方・トークのコツ（カンペ）</span>
                  <p className="text-xs leading-relaxed text-sage-900 font-medium whitespace-pre-line relative z-10">{activeResult.advice}</p>
                </div>

                {/* 開運キーワード (3アイテム) */}
                <div className="grid grid-cols-3 gap-2 pt-2 text-center text-xs">
                  <div className="p-2.5 bg-white border border-beige-100 rounded-lg shadow-sm">
                    <span className="text-[9px] font-bold text-gold-500 block mb-0.5">ラッキーカラー</span>
                    <span className="font-semibold text-[11px] text-beige-800">{activeResult.luckyColor}</span>
                  </div>
                  <div className="p-2.5 bg-white border border-beige-100 rounded-lg shadow-sm">
                    <span className="text-[9px] font-bold text-gold-500 block mb-0.5">ラッキーアイテム</span>
                    <span className="font-semibold text-[11px] text-beige-800">{activeResult.luckyItem}</span>
                  </div>
                  <div className="p-2.5 bg-white border border-beige-100 rounded-lg shadow-sm">
                    <span className="text-[9px] font-bold text-gold-500 block mb-0.5">開運アクション</span>
                    <span className="font-semibold text-[11px] text-beige-800">{activeResult.luckyAction}</span>
                  </div>
                </div>

                {/* 読み上げテキスト一括コピー用エリア */}
                <div className="mt-4 pt-3 border-t border-beige-100">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[10px] font-bold text-sage-600">トークテキストのプレビュー</span>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-7 text-xs flex gap-1 border-beige-200"
                      onClick={() => handleCopy(getSpeechScript(activeRequest, activeResult), activeRequest.id)}
                    >
                      {copiedStates[activeRequest.id] ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-green-600" />
                          コピー完了
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          一括コピー
                        </>
                      )}
                    </Button>
                  </div>
                  <textarea
                    readOnly
                    value={getSpeechScript(activeRequest, activeResult)}
                    className="w-full h-24 p-2 text-[10px] text-muted-foreground bg-beige-50/50 rounded-lg border border-beige-200 outline-none resize-none font-mono"
                  />
                </div>

              </div>
            ) : null}
          </CardContent>
        </Card>

      </div>

      {/* フッター */}
      <footer className="mt-6 text-center text-[10px] text-sage-500 font-medium">
        © 2026 星のカンペ. All Rights Reserved. Powered by Gemini API & TikTok Live Connector.
      </footer>

      {/* 設定モーダル */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md bg-white border border-beige-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Settings className="w-4 h-4 text-gold-500 animate-spin-slow" />
                ダッシュボード設定
              </CardTitle>
              <CardDescription>
                API接続先や読み上げに関する設定を行います。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* APIサーバーURL設定 */}
              <div className="space-y-1.5 pb-3 border-b border-beige-100">
                <label className="text-[11px] font-bold text-sage-700 block">APIサーバーのURL</label>
                <Input 
                  value={tempApiUrl} 
                  onChange={(e) => setTempApiUrl(e.target.value)} 
                  placeholder="https://your-app.onrender.com"
                  className="text-xs"
                />
                <p className="text-[9px] text-muted-foreground">
                  ※ ローカル実行時は `http://localhost:5001` のままにしてください。
                </p>
              </div>

              {/* チャット読み上げ設定 */}
              <div className="space-y-3 pt-1">
                <span className="text-[11px] font-bold text-sage-700 block">🗣️ チャット読み上げ設定 (無料)</span>
                
                {/* 読み上げ有効スイッチ */}
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground/80">読み上げ機能を有効化</span>
                  <input 
                    type="checkbox" 
                    checked={isTtsEnabled} 
                    onChange={(e) => setIsTtsEnabled(e.target.checked)}
                    className="accent-gold-500 w-4 h-4 cursor-pointer"
                  />
                </div>

                {/* 読み上げモード */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground block">読み上げ対象</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setTtsMode('fortune')}
                      className={`flex-1 py-1.5 text-2xs font-semibold rounded-lg border transition-all ${
                        ttsMode === 'fortune'
                          ? 'border-gold-500 bg-gold-50 text-gold-800'
                          : 'border-beige-200 hover:bg-beige-50 text-muted-foreground'
                      }`}
                    >
                      占い依頼・常連のみ
                    </button>
                    <button
                      onClick={() => setTtsMode('all')}
                      className={`flex-1 py-1.5 text-2xs font-semibold rounded-lg border transition-all ${
                        ttsMode === 'all'
                          ? 'border-gold-500 bg-gold-50 text-gold-800'
                          : 'border-beige-200 hover:bg-beige-50 text-muted-foreground'
                      }`}
                    >
                      すべてのチャット
                    </button>
                  </div>
                </div>

                {/* 速度調整スライダー */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold text-muted-foreground">
                    <span>読み上げ速度</span>
                    <span>{ttsRate.toFixed(1)}x</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.5" 
                    max="2.0" 
                    step="0.1"
                    value={ttsRate}
                    onChange={(e) => setTtsRate(parseFloat(e.target.value))}
                    className="w-full accent-gold-500 cursor-pointer h-1.5 bg-beige-100 rounded-lgappearance-none"
                  />
                </div>

                {/* 音量調整スライダー */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold text-muted-foreground">
                    <span>読み上げ音量</span>
                    <span>{Math.round(ttsVolume * 100)}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.0" 
                    max="1.0" 
                    step="0.1"
                    value={ttsVolume}
                    onChange={(e) => setTtsVolume(parseFloat(e.target.value))}
                    className="w-full accent-gold-500 cursor-pointer h-1.5 bg-beige-100 rounded-lgappearance-none"
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-2 pt-3 border-t border-beige-100">
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => {
                setTempApiUrl(apiUrl)
                setIsSettingsOpen(false)
              }}>
                キャンセル
              </Button>
              <Button variant="gold" size="sm" className="h-8 text-xs font-semibold" onClick={handleSaveSettings}>
                設定を保存
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  )
}
