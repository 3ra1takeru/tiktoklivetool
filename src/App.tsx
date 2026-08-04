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
  Settings
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

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null)
  
  // 接続設定
  const [tiktokUsername, setTiktokUsername] = useState('')
  const [activeTiktokUser, setActiveTiktokUser] = useState('')
  const [serverConnected, setServerConnected] = useState(false)
  const [tiktokConnected, setTiktokConnected] = useState<'connected' | 'disconnected' | 'connecting' | 'error'>('disconnected')
  const [errorMessage, setErrorMessage] = useState('')
  const [systemAlert, setSystemAlert] = useState<string | null>(null)

  // ログ・リスト
  const [chatLogs, setChatLogs] = useState<ChatMessage[]>([])
  const [fortuneRequests, setFortuneRequests] = useState<FortuneRequest[]>([])
  
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

  // スクロール自動追従用の参照
  const chatEndRef = useRef<HTMLDivElement>(null)

  const handleSaveSettings = () => {
    // 末尾のスラッシュを取り除く
    const cleanUrl = tempApiUrl.trim().replace(/\/$/, '')
    localStorage.setItem('fortune_api_url', cleanUrl)
    setApiUrl(cleanUrl)
    setIsSettingsOpen(false)
  }

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
        setActiveTiktokUser(data.username || '')
        setErrorMessage('')
      } else if (data.status === 'error') {
        setTiktokConnected('error')
        setErrorMessage(data.error || 'TikTok Liveへの接続中にエラーが発生しました。')
      } else {
        setTiktokConnected('disconnected')
        setActiveTiktokUser('')
      }
    })

    // チャットメッセージ受信（全件）
    newSocket.on('chat-log', (msg: ChatMessage) => {
      setChatLogs(prev => {
        const next = [...prev, msg]
        // 最大150件に制限
        if (next.length > 150) next.shift()
        return next
      })
    })

    // 生年月日が検出された鑑定リクエスト受信
    newSocket.on('detected-fortune-request', (req: Omit<FortuneRequest, 'status'>) => {
      setFortuneRequests(prev => {
        // 重複チェック
        if (prev.some(item => item.id === req.id)) return prev
        return [...prev, { ...req, status: 'pending' }]
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
        setFortuneRequests(prev => 
          prev.map(item => item.id === data.id ? { ...item, status: 'completed' } : item)
        )
        setFortuneResults(prev => ({
          ...prev,
          [data.id]: data.result!
        }))
        // 自動で今完了した鑑定を選択して右側に表示する
        setSelectedRequestId(data.id)
      }
    })

    return () => {
      newSocket.disconnect()
    }
  }, [apiUrl])

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

  // 模擬チャットの送信（テスト用）
  const triggerMockChat = (type: 'valid' | 'invalid') => {
    if (!socket) return
    socket.emit('send-mock-chat', type)
  }

  // 現在選択されている鑑定結果
  const activeRequest = fortuneRequests.find(r => r.id === selectedRequestId)
  const activeResult = selectedRequestId ? fortuneResults[selectedRequestId] : null

  // 読み上げ用のテキスト作成
  const getSpeechScript = (req: FortuneRequest, res: FortuneResult) => {
    return `${req.username}さん、占わせていただきますね。
生年月日は${req.birthdate}ですね。
今回の鑑定のポイントは、「${res.summary}」です。
お人柄を見てみますと、${res.personality}
現在の運勢やアドバイスとしては、${res.fortune}
開運へのヒントですが、ラッキーカラーは「${res.luckyColor}」、ラッキーアイテムは「${res.luckyItem}」です。また、${res.luckyAction}を心がけるとさらに運気が高まりますよ。応援しています！`
  }

  return (
    <div className="min-h-screen flex flex-col p-4 md:p-6 bg-gradient-to-br from-beige-50 via-sage-50 to-gold-100">
      
      {/* ヘッダーセクション */}
      <header className="flex flex-col md:flex-row items-center justify-between gap-4 p-5 mb-6 rounded-2xl bg-white/70 backdrop-blur-md border border-beige-200/50 shadow-sm">
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

        {/* コネクションステータス＆コントロール */}
        <div className="flex flex-wrap items-center gap-3">
          {/* サーバー接続表示 */}
          <Badge variant={serverConnected ? 'sage' : 'destructive'} className="flex gap-1 items-center px-3 py-1">
            {serverConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {serverConnected ? 'サーバー接続中' : 'サーバー未接続'}
          </Badge>

          {/* TikTok接続表示 */}
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

          {/* テストデバッグツール */}
          <div className="flex items-center gap-1.5 bg-sage-50/50 p-1 rounded-lg border border-sage-200">
            <span className="text-[10px] text-sage-700 px-1.5 font-bold">テスト:</span>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-7 px-2 text-xs border-sage-200 hover:bg-sage-100 text-sage-800"
              onClick={() => triggerMockChat('valid')}
              disabled={!serverConnected}
            >
              生年月日チャット
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-7 px-2 text-xs border-sage-200 hover:bg-sage-100 text-sage-800"
              onClick={() => triggerMockChat('invalid')}
              disabled={!serverConnected}
            >
              通常チャット
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

      {/* エラーメッセージ表示 */}
      {errorMessage && (
        <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-center gap-3 animate-bounce">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <div>{errorMessage}</div>
        </div>
      )}

      {/* システム通知メッセージ */}
      {systemAlert && (
        <div className="mb-4 p-4 rounded-xl bg-gold-100 border border-gold-200 text-gold-800 text-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-gold-600 flex-shrink-0" />
            <div>{systemAlert}</div>
          </div>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-gold-800 hover:bg-gold-200" onClick={() => setSystemAlert(null)}>閉じる</Button>
        </div>
      )}

      {/* メイングリッドエリア (3カラム) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* 左カラム: LIVEチャット監視ログ (幅3/12) */}
        <Card className="lg:col-span-3 flex flex-col h-[calc(100vh-190px)] border-beige-200 bg-white/60">
          <CardHeader className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-beige-800">
                <MessageSquare className="w-5 h-5 text-gold-500" />
                <CardTitle className="text-sm font-bold">チャット監視ログ</CardTitle>
              </div>
              <Badge variant="outline" className="font-mono text-[10px] bg-white">
                {activeTiktokUser ? `@${activeTiktokUser}` : '未接続'}
              </Badge>
            </div>
            <CardDescription>リアルタイムに流れるコメントを表示します</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 p-4 pt-0 overflow-hidden flex flex-col">
            <ScrollArea maxHeight="100%" className="flex-1 border rounded-xl p-3 bg-beige-50/50">
              {chatLogs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-6 text-center">
                  <Clock className="w-8 h-8 text-sage-200 mb-2 animate-pulse" />
                  <p className="text-xs">チャット接続をお待ちしています</p>
                  <p className="text-[10px] text-sage-400 mt-1">「テスト」ボタンで模擬チャットを流せます</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {chatLogs.map((log) => {
                    const hasBirth = log.hasBirthdate;
                    return (
                      <div 
                        key={log.id} 
                        className={`p-2.5 rounded-lg text-xs transition-all duration-200 ${
                          hasBirth 
                            ? 'bg-gradient-to-r from-gold-100 to-beige-100 border border-gold-300/40 shadow-sm animate-pulse' 
                            : 'bg-white/80 border border-beige-100'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-1 justify-between">
                          <div className="flex items-center gap-1.5">
                            {log.profilePictureUrl ? (
                              <img src={log.profilePictureUrl} alt="" className="w-4 h-4 rounded-full" />
                            ) : (
                              <User className="w-3 h-3 text-muted-foreground" />
                            )}
                            <span className="font-semibold text-beige-800 max-w-[100px] truncate">{log.username}</span>
                          </div>
                          {hasBirth && (
                            <Badge variant="gold" className="text-[8px] px-1 py-0 scale-90">生年月日検出</Badge>
                          )}
                        </div>
                        <p className="text-foreground/90 break-words pl-5 leading-relaxed">{log.comment}</p>
                      </div>
                    )
                  })}
                  <div ref={chatEndRef} />
                </div>
              )}
            </ScrollArea>
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
            <CardDescription>生年月日が自動抽出されたリスナーです</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 p-4 pt-0 overflow-hidden flex flex-col">
            <ScrollArea maxHeight="100%" className="flex-1">
              {fortuneRequests.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 text-center border-2 border-dashed border-beige-200 rounded-xl">
                  <Calendar className="w-9 h-9 text-sage-200 mb-2" />
                  <p className="text-xs font-semibold">現在、鑑定待ちのリスナーはいません</p>
                  <p className="text-[10px] text-sage-400 mt-1 max-w-[200px]">
                    生年月日を含むチャット（例：1995/10/12）を受信すると、自動的にここに追加されます。
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
                              <span className="text-[10px] text-sage-500 block truncate">@{req.userId}</span>
                            </div>
                          </div>
                          <Badge variant="outline" className="bg-sage-50 text-[10px] text-sage-700 shrink-0">
                            {req.birthdate}
                          </Badge>
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

        {/* 右カラム: Gemini鑑定結果表示 (幅5/12) */}
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
                  左の「鑑定待ちリスト」からリスナーを選び、「鑑定開始」ボタンを押すと鑑定結果が生成されます。
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
                <p className="text-[10px] text-red-500 mt-1">
                  API設定を確認してください。
                </p>
              </div>
            ) : activeResult ? (
              <div className="space-y-5 animate-fade-in text-sm">
                
                {/* 鑑定中ユーザー情報 */}
                <div className="flex items-center justify-between pb-3 border-b border-beige-100">
                  <div className="flex items-center gap-2">
                    {activeRequest.profilePictureUrl ? (
                      <img src={activeRequest.profilePictureUrl} alt="" className="w-7 h-7 rounded-full" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-beige-100 flex items-center justify-center">
                        <User className="w-4 h-4 text-beige-600" />
                      </div>
                    )}
                    <div>
                      <h4 className="font-bold text-xs text-beige-800">{activeRequest.username}</h4>
                      <p className="text-[10px] text-sage-500">生年月日: {activeRequest.birthdate}</p>
                    </div>
                  </div>
                  <Badge variant="gold" className="text-[10px]">{activeRequest.birthdate}</Badge>
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
                サーバー設定
              </CardTitle>
              <CardDescription>
                無料サーバー（Render.comなど）にデプロイしたバックエンドサーバーのURLを入力します。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-sage-700 block">APIサーバーのURL</label>
                <Input 
                  value={tempApiUrl} 
                  onChange={(e) => setTempApiUrl(e.target.value)} 
                  placeholder="https://your-app.onrender.com"
                  className="text-xs"
                />
                <p className="text-[10px] text-muted-foreground">
                  ※ ローカル環境で実行する場合は、デフォルトの `http://localhost:5001` のままにしてください。変更を保存すると自動的に再接続されます。
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-2 pt-3">
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
