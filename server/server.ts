import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
// @ts-ignore
import { WebcastPushConnection } from 'tiktok-live-connector';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 5001;

// Gemini APIの初期化
const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = apiKey && apiKey !== 'YOUR_GEMINI_API_KEY_HERE' ? new GoogleGenerativeAI(apiKey) : null;

// アクティブなTikTok接続の管理
const activeConnections = new Map<string, WebcastPushConnection>();

// 生年月日抽出ロジック
function extractBirthDate(text: string): string | null {
  // パターン1: 1995/10/12, 1995-10-12, 1995.10.12
  const pattern1 = /(19\d{2}|20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/;
  // パターン2: 1995年10月12日
  const pattern2 = /(19\d{2}|20\d{2})年(\d{1,2})月(\d{1,2})日/;
  // パターン3: 平成7年10月12日, 令和元年5月1日, 昭和60年
  const pattern3 = /(昭和|平成|令和)(元|\d{1,2})年(\d{1,2})月(\d{1,2})日/;
  // パターン4: 8桁の数字 19951012
  const pattern4 = /\b(19\d{2}|20\d{2})(\d{2})(\d{2})\b/;
  // パターン5: 6桁の数字 951012
  const pattern5 = /\b(\d{2})(\d{2})(\d{2})\b/;

  let match;
  if ((match = text.match(pattern1))) {
    return `${match[1]}年${match[2]}月${match[3]}日`;
  }
  if ((match = text.match(pattern2))) {
    return `${match[1]}年${match[2]}月${match[3]}日`;
  }
  if ((match = text.match(pattern3))) {
    return `${match[1]}${match[2]}年${match[3]}月${match[4]}日`;
  }
  if ((match = text.match(pattern4))) {
    return `${match[1]}年${parseInt(match[2])}月${parseInt(match[3])}日`;
  }
  if ((match = text.match(pattern5))) {
    const yy = parseInt(match[1]);
    const year = yy >= 40 ? `19${yy}` : `20${yy}`;
    return `${year}年${parseInt(match[2])}月${parseInt(match[3])}日`;
  }
  return null;
}

// 占い師向けのGeminiプロンプト生成（一時的な503エラー対策のリトライとフォールバック機能付き）
async function runFortuneTelling(birthdate: string, question: string, chatHistory: string[] = []) {
  if (!genAI) {
    throw new Error('Gemini API key is not configured. Please set GEMINI_API_KEY in server/.env file.');
  }

  // チャットの文脈履歴をフォーマット
  const historyText = chatHistory && chatHistory.length > 0 
    ? chatHistory.map((c, i) => `[発言 ${i + 1}]: ${c}`).join('\n')
    : '直近の履歴なし';

  const prompt = `
ズバズバ断言型の占術家です。口調は厳しめ、でも本質的には愛情があり、相手の人生を立て直すような視点で話してください。
以下の特徴を再現してください。

【話し方の特徴】
・「いい？」「あんたね」「〜なのよ」など断定的
・曖昧に言わない
・少し怖いくらいハッキリ言う
・人生経験豊富な姐御感
・時々笑える毒舌
・悪いことも包み隠さず言う
・ただし最後は前向きに締める
・相手を突き放さず「導く」感じ

【占いスタイル】
以下を組み合わせて占うこと
・四柱推命
・六星占術風の運命周期
・宿命
・性格分析
・人間関係
・仕事運
・恋愛・結婚運
・お金の流れ
・今後3〜5年の運気
・人生で注意すべきこと
・向いている生き方

【重要】
・単なる一般論ではなく、「この人はこういう人生になりやすい」と大胆に決めつける
・少し偏見が入るくらいでOK
・でも読んでいて妙に納得感があること
・相手の強みと弱点を容赦なく言語化する
・運気が落ちる行動もハッキリ指摘する
・各生年月日レコードの性別（男性／女性／未指定）をもとに、四柱推命や大運（運勢の順逆バイオリズム）を的確に判断して鑑定結果に反映させること。男性と女性で大運周期の流れが変わるため、指定された性別にあわせた判定を行うこと。
・最後に「どう生きるべきか」を断言する

【リスナー情報】
生年月日・性別・関係性: ${birthdate}
確定した相談内容・質問: ${question || '全体運・今後の運勢について'}

【相談者のチャット全体の流れ（複数コメントの履歴）】
${historyText}

【重要指示】
・上記「相談者のチャット全体の流れ」を踏まえ、相談者が複数コメントに分けて送信した内容（お悩み、追加の生年月日、家族・相手との関係性やそれぞれの性別など）を的確に解釈して占いに反映させてください。
・もし文脈から別の人物（夫, 子供, 恋人など）との相性や家族関係について言及されている場合は、その関係性や性別を的確に判断して占いの対象に含めてください。

【出力フォーマット】
必ず以下のキーを持つJSONオブジェクトのみを出力してください。他の余計な説明文やマークダウンタグ（\`\`\`json等）は一切含めず、純粋なJSON文字列として出力してください。

JSON構造：
{
  "summary": "最後にズバッと総評する（姐御口調で、今後の指針やどう生きるべきかを断言する一言キャッチコピー）",
  "destiny": "宿命・本質（どのような宿命を持って生まれたのかを、性別や星回りからハッキリと断言）",
  "personality": "性格の怖いほど当たる特徴（強みと弱点を容赦なく、愛のある毒舌交じりで言語化）",
  "love": "恋愛・結婚（恋愛傾向や相性、こういう人生になりやすいという大胆な決めつけ）",
  "workMoney": "仕事・お金（向いている仕事や生き方、お金の流れ）",
  "fortune3to5": "今後3〜5年の運気（運命周期をベースにした今後の浮き沈み）",
  "warning": "人生で気をつけること（運気が落ちる行動の指摘、警告）",
  "advice": "指定の占ってほしい内容（相談内容・質問）に対する重点的な回答（またはアドバイス）",
  "luckyColor": "ラッキーカラー",
  "luckyItem": "ラッキーアイテム",
  "luckyAction": "開運アクション"
}
`;

  // 一時的なエラー時にリトライおよび代替モデルへのフォールバックを行う
  const modelsToTry = ['gemini-3.5-flash', 'gemini-1.5-flash'];
  let lastError: any = null;
  let responseText = '';

  for (const modelName of modelsToTry) {
    try {
      console.log(`[Gemini API] Trying model: ${modelName}`);
      const model = genAI.getGenerativeModel({ 
        model: modelName,
        generationConfig: {
          responseMimeType: 'application/json'
        }
      });

      const retries = 3;
      let delay = 1000;

      for (let attempt = 0; attempt < retries; attempt++) {
        try {
          const result = await model.generateContent(prompt);
          responseText = result.response.text();
          break; // 成功したらループを抜ける
        } catch (error: any) {
          lastError = error;
          const errorMsg = error.message || '';
          
          // 503 Service Unavailable や 429 Rate Limit やその他の一時的エラーの場合にリトライ
          const isTemporary = error.status === 503 || error.status === 429 ||
                              errorMsg.includes('503') || errorMsg.includes('429') ||
                              errorMsg.includes('Service Unavailable') || errorMsg.includes('Resource has been exhausted') ||
                              errorMsg.includes('overloaded') || errorMsg.includes('temporary');
          
          if (isTemporary && attempt < retries - 1) {
            console.warn(`[Gemini API] Temporary error on model ${modelName} (Attempt ${attempt + 1}/${retries}): ${errorMsg}. Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2; // 指数バックオフ
          } else {
            throw error; // リトライ上限に達した、あるいは致命的エラー
          }
        }
      }
      
      // ここに到達したということは、このモデルで成功したということ
      if (responseText) {
        console.log(`[Gemini API] Successfully generated content using model: ${modelName}`);
        break; 
      }
    } catch (modelError: any) {
      console.warn(`[Gemini API] Model ${modelName} failed: ${modelError.message || modelError}`);
      // 次のモデルを試すためにループを継続
    }
  }

  if (!responseText) {
    throw lastError || new Error('鑑定の生成中にエラーが発生しました。Gemini APIが一時的に利用できないか、制限に達しています。');
  }

  // JSONをパースして返す
  try {
    const cleanText = responseText.trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim();
    return JSON.parse(cleanText);
  } catch (error) {
    console.error('Failed to parse Gemini response as JSON. Raw response:', responseText);
    return {
      summary: "いい？あんたの人生、ここからが本当の勝負なのよ！",
      destiny: "生まれつき強い直感力と人を惹きつける華を持っているけれど、自分に甘くなりやすい宿命ね。",
      personality: "優しくて気配り上手だけど、実はかなりの頑固者。人の意見を聞くフリをして聞き流す癖、見抜かれてるわよ。",
      love: "尽くしすぎて都合のいい関係になりやすいから、自分を安売りするんじゃないわよ。",
      workMoney: "感受性を活かした芸術・企画系が向いているわ。無駄遣いが多いから、お財布の紐はしっかり締めなさい！",
      fortune3to5: "今年は停滞期だけど、来年からは一気の飛躍期に入るわ。今は焦らず牙を研ぐことね。",
      warning: "愚痴ばかり言って行動しないこと。運気が一気に逃げていくわよ。",
      advice: "相談に対して：今は迷う時期だけど、自分の直感を信じて進みなさい。あんたなら絶対できるから！",
      luckyColor: "ゴールド",
      luckyItem: "クリスタルグラス",
      luckyAction: "朝一番に鏡に向かって笑顔を作る"
    };
  }
}

io.on('connection', (socket: any) => {
  console.log(`Client connected: ${socket.id}`);

  // TikTok Live接続要求
  socket.on('join-tiktok', async (username: string) => {
    console.log(`Request to connect to TikTok Live: ${username}`);
    
    // 既存の接続があれば切断
    if (activeConnections.has(socket.id)) {
      try {
        activeConnections.get(socket.id)?.disconnect();
        activeConnections.delete(socket.id);
      } catch (err) {
        console.error('Error disconnecting existing connection:', err);
      }
    }

    try {
      const tiktokConnect = new WebcastPushConnection(username);
      
      tiktokConnect.connect().then((state: any) => {
        console.log(`Successfully connected to TikTok Live for ${username}. Room ID: ${state.roomId}`);
        socket.emit('tiktok-status', { status: 'connected', username, roomId: state.roomId });
      }).catch((err: any) => {
        console.error(`Failed to connect to TikTok Live for ${username}:`, err);
        socket.emit('tiktok-status', { status: 'error', error: err.message || '接続に失敗しました。配信中であることを確認してください。' });
      });

      // チャットイベントの監視
      tiktokConnect.on('chat', (data: any) => {
        const comment = data.comment;
        const nickname = data.nickname || data.uniqueId;
        const uniqueId = data.uniqueId;
        const profilePictureUrl = data.profilePictureUrl;

        // 全コメントをログとして流す
        const birthdate = extractBirthDate(comment);
        socket.emit('chat-log', {
          id: data.msgId || Math.random().toString(),
          username: nickname,
          userId: uniqueId,
          comment,
          profilePictureUrl,
          hasBirthdate: !!birthdate,
          timestamp: Date.now()
        });

        // 生年月日の抽出テスト
        if (birthdate) {
          console.log(`Detected birthdate: ${birthdate} from user: ${nickname}`);
          socket.emit('detected-fortune-request', {
            id: data.msgId || Math.random().toString(),
            username: nickname,
            userId: uniqueId,
            profilePictureUrl,
            birthdate,
            comment,
            timestamp: Date.now()
          });
        }
      });

      // ギフトイベントの監視
      tiktokConnect.on('gift', (data: any) => {
        const nickname = data.nickname || data.uniqueId;
        const uniqueId = data.uniqueId;
        const profilePictureUrl = data.profilePictureUrl;
        const giftName = data.giftName;
        const diamondCount = data.diamondCount || 0;
        const repeatCount = data.repeatCount || 1;

        console.log(`Received gift: ${giftName} x${repeatCount} from ${nickname} (Diamonds: ${diamondCount})`);

        socket.emit('gift-log', {
          id: data.msgId || Math.random().toString(),
          username: nickname,
          userId: uniqueId,
          profilePictureUrl,
          giftName,
          diamonds: diamondCount * repeatCount,
          count: repeatCount,
          timestamp: Date.now()
        });
      });

      // エラーイベントの監視
      tiktokConnect.on('error', (err: any) => {
        console.error(`TikTok Live error for ${username}:`, err);
        socket.emit('tiktok-status', { status: 'error', error: err.toString() });
      });

      // 配信終了イベントの監視
      tiktokConnect.on('streamEnd', () => {
        console.log(`Stream ended for ${username}`);
        socket.emit('tiktok-status', { status: 'disconnected', message: '配信が終了しました。' });
      });

      activeConnections.set(socket.id, tiktokConnect);

    } catch (error: any) {
      console.error(`Error initializing TikTok Live connection for ${username}:`, error);
      socket.emit('tiktok-status', { status: 'error', error: error.message || '接続初期化エラー' });
    }
  });

  // TikTok Live切断要求
  socket.on('leave-tiktok', () => {
    if (activeConnections.has(socket.id)) {
      console.log(`Disconnecting TikTok Live for socket ${socket.id}`);
      try {
        activeConnections.get(socket.id)?.disconnect();
        activeConnections.delete(socket.id);
        socket.emit('tiktok-status', { status: 'disconnected' });
      } catch (err) {
        console.error('Error disconnecting:', err);
      }
    }
  });

  // 占い開始要求
  socket.on('start-fortune', async (data: { id: string; username: string; birthdate: string; comment: string; chatHistory?: string[] }) => {
    console.log(`Starting fortune telling for: ${data.username}, Birthdate: ${data.birthdate}`);
    socket.emit('fortune-progress', { id: data.id, status: 'loading' });

    try {
      if (!genAI) {
        throw new Error('Gemini APIキーが設定されていません。server/.env ファイルに GEMINI_API_KEY を設定してください。');
      }
      const result = await runFortuneTelling(data.birthdate, data.comment, data.chatHistory || []);
      socket.emit('fortune-result', {
        id: data.id,
        username: data.username,
        birthdate: data.birthdate,
        result
      });
    } catch (error: any) {
      console.error(`Error running fortune telling:`, error);
      socket.emit('fortune-result', {
        id: data.id,
        username: data.username,
        birthdate: data.birthdate,
        error: error.message || '鑑定の生成中にエラーが発生しました。'
      });
    }
  });

  // テスト用：デミチャット模擬送信
  socket.on('send-mock-chat', (mockType: 'valid' | 'invalid') => {
    const mockUsers = [
      { name: 'さくら🌸', id: 'sakura_live', pic: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&fit=crop&q=80' },
      { name: 'ゆうき✨', id: 'yuki_travel', pic: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&fit=crop&q=80' },
      { name: 'みく🍀', id: 'miku_deco', pic: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&fit=crop&q=80' },
      { name: 'たくみ⚽', id: 'takumi_sport', pic: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&fit=crop&q=80' }
    ];

    const randomUser = mockUsers[Math.floor(Math.random() * mockUsers.length)];
    const id = Math.random().toString();
    const timestamp = Date.now();

    if (mockType === 'valid') {
      const birthdates = [
        '1995/10/12にお願いします！仕事について占ってほしいです',
        '私の誕生日は平成8年3月4日です！恋愛運知りたいです',
        '1989-05-20です。今年の金運はどうでしょうか？',
        '2001.07.15 結婚時期について気になります！',
        '970822 おねがいします！',
        '昭和58年11月30日生まれです。転職を考えています。'
      ];
      const comment = birthdates[Math.floor(Math.random() * birthdates.length)];
      const birthdate = extractBirthDate(comment);

      // 通常ログと抽出の両方を送信
      socket.emit('chat-log', {
        id,
        username: randomUser.name,
        userId: randomUser.id,
        comment,
        profilePictureUrl: randomUser.pic,
        hasBirthdate: !!birthdate,
        timestamp
      });

      if (birthdate) {
        socket.emit('detected-fortune-request', {
          id,
          username: randomUser.name,
          userId: randomUser.id,
          profilePictureUrl: randomUser.pic,
          birthdate,
          comment,
          timestamp
        });
      }
    } else {
      const generalComments = [
        'こんにちは！いつも見てます！',
        'PayPay送りました！確認お願いします！',
        '今日の配信も楽しいですね〜',
        'そのアイテム可愛い！',
        'ギフト投げました！鑑定おねがいします！'
      ];
      const comment = generalComments[Math.floor(Math.random() * generalComments.length)];

      socket.emit('chat-log', {
        id,
        username: randomUser.name,
        userId: randomUser.id,
        comment,
        profilePictureUrl: randomUser.pic,
        hasBirthdate: false,
        timestamp
      });
    }
  });

  // テスト用：模擬ギフト送信
  socket.on('send-mock-gift', () => {
    const mockUsers = [
      { name: 'さくら🌸', id: 'sakura_live', pic: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&fit=crop&q=80' },
      { name: 'ゆうき✨', id: 'yuki_travel', pic: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&fit=crop&q=80' },
      { name: 'みく🍀', id: 'miku_deco', pic: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&fit=crop&q=80' }
    ];
    const randomUser = mockUsers[Math.floor(Math.random() * mockUsers.length)];
    const id = Math.random().toString();
    const gifts = [
      { name: '薔薇', diamonds: 1 },
      { name: 'いいね', diamonds: 5 },
      { name: 'ハート', diamonds: 10 },
      { name: 'TikTok', diamonds: 100 },
      { name: '手作りの愛', diamonds: 500 }
    ];
    const randomGift = gifts[Math.floor(Math.random() * gifts.length)];
    const count = Math.floor(Math.random() * 5) + 1;

    socket.emit('gift-log', {
      id,
      username: randomUser.name,
      userId: randomUser.id,
      profilePictureUrl: randomUser.pic,
      giftName: randomGift.name,
      diamonds: randomGift.diamonds * count,
      count,
      timestamp: Date.now()
    });
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    if (activeConnections.has(socket.id)) {
      try {
        activeConnections.get(socket.id)?.disconnect();
        activeConnections.delete(socket.id);
      } catch (err) {
        console.error('Error disconnecting on socket connection loss:', err);
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  if (!genAI) {
    console.warn('WARNING: Gemini API key is missing. Fortune telling functionality will not work until you configure GEMINI_API_KEY in server/.env');
  } else {
    console.log('Gemini API is successfully initialized.');
  }
});
