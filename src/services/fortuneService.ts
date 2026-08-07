import { GoogleGenerativeAI } from '@google/generative-ai';

export interface FortuneResult {
  summary: string;      // 総評
  destiny: string;      // 宿命・本質
  personality: string;  // 性格
  love: string;         // 恋愛
  workMoney: string;    // 仕事・お金
  fortune3to5: string;  // 3〜5年
  warning: string;      // 注意点
  advice: string;       // 指定回答またはライバーカンペ
  luckyColor?: string;
  luckyItem?: string;
  luckyAction?: string;
}

// 生年月日抽出ロジック
export function extractBirthDate(text: string): string | null {
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

// フォールバック（API未設定・オフライン時などのサンプル鑑定データ）
function generateFallbackFortune(birthdate: string, question: string): FortuneResult {
  const luckyColors = ['ゴールド', 'ローズピンク', 'ラベンダー', 'ロイヤルブルー', 'エメラルドグリーン', 'ワインレッド'];
  const luckyItems = ['ローズクォーツのパワーストーン', 'アロマディフューザー', '高級な手帳', '本革のキーケース', 'シルクのハンカチ'];
  const luckyActions = ['朝一番に窓を開けて深呼吸する', '鏡に向かって笑顔で「今日も最高」と呟く', '感謝の気持ちをメモに書く', 'お気に入りのカフェで1人の時間を作る'];

  const randomColor = luckyColors[Math.floor(Math.random() * luckyColors.length)];
  const randomItem = luckyItems[Math.floor(Math.random() * luckyItems.length)];
  const randomAction = luckyActions[Math.floor(Math.random() * luckyActions.length)];

  return {
    summary: "いい？あんたの人生、これからが本当の勝負どころよ！",
    destiny: `【生年月日 ${birthdate}】直感力と華やかさを備え、自分の理想に向かって突き進む強運の星のもとに生まれているわ。`,
    personality: "気配り上手で周囲から愛される反面、実はかなりの頑固者。人の意見を聞くフリをして流す癖、しっかり見抜かれてるからね！",
    love: "情に厚くて相手に尽くしがちだけど、自分を安売りしちゃダメよ。対等でリスペクトし合える関係を築くのが開運の秘訣。",
    workMoney: "独自の感性やアイデアを生かせる分野で大化けするわ。無駄遣いには注意して、自己投資にお金を使うとさらに運気が上がるわよ。",
    fortune3to5: "これからの3年間で大きな転機が訪れるわ！準備期間を経て、2年後・3年後に一気に飛躍するバイオリズムに乗っているわよ。",
    warning: "「どうせ自分なんて」とネガティブな言葉を口にすること。運気が一気に逃げていくから、言葉選びには注意しなさい！",
    advice: `ご相談の「${question || '全体運'}」について：迷うくらいなら一歩踏み出しなさい！あんたの選択は間違っていないから、自分の直感を信じて前を向きなさい！`,
    luckyColor: randomColor,
    luckyItem: randomItem,
    luckyAction: randomAction
  };
}

// Gemini APIを使ったクライアント側鑑定生成関数
export async function runFortuneTellingClient(
  apiKey: string,
  birthdate: string,
  question: string,
  chatHistory: string[] = []
): Promise<FortuneResult> {
  const trimmedKey = apiKey?.trim();

  // キーが未設定の場合はフォールバック
  if (!trimmedKey) {
    console.warn('[FortuneClient] Gemini API Key is empty. Using smart fallback fortune.');
    // 擬似的な読み込みディレイ
    await new Promise((res) => setTimeout(res, 1200));
    return generateFallbackFortune(birthdate, question);
  }

  try {
    const genAI = new GoogleGenerativeAI(trimmedKey);
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
・相手の強みと弱点を容容容赦なく言語化する
・運気が落ちる行動もハッキリ指摘する
・各生年月日レコードの性別（男性／女性／未指定）をもとに、四柱推命や大運（運勢の順逆バイオリズム）を的確に判断して鑑定結果に反映させること。
・最後に「どう生きるべきか」を断言する

【リスナー情報】
生年月日・性別・関係性: ${birthdate}
確定した相談内容・質問: ${question || '全体運・今後の運勢について'}

【相談者のチャット全体の流れ（複数コメントの履歴）】
${historyText}

【重要指示】
・上記「相談者のチャット全体の流れ」を踏まえ、相談者が複数コメントに分けて送信した内容（お悩み、追加の生年月日、家族・相手との関係性やそれぞれの性別など）を的確に解釈して占いに反映させてください。

【出力フォーマット】
必ず以下のキーを持つJSONオブジェクトのみを出力してください。他の余計な説明文やマークダウンタグ（\`\`\`json等）は一切含めず、純粋なJSON文字列として出力してください。

JSON構造：
{
  "summary": "最後にズバッと総評する（姐御口調で、今後の指針やどう生きるべきかを断言する一言キャッチコピー）",
  "destiny": "宿命・本質（どのような宿命を持って生まれたのかを、性別や星回りからハッキリと断言）",
  "personality": "性格の怖いほど当たる特徴（強みと弱点を容容容赦なく、愛のある毒舌交じりで言語化）",
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

    // モデルの試行
    const modelsToTry = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-2.0-flash'];
    let responseText = '';
    let lastErr: any = null;

    for (const modelName of modelsToTry) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            responseMimeType: 'application/json'
          }
        });
        const result = await model.generateContent(prompt);
        responseText = result.response.text();
        if (responseText) break;
      } catch (err: any) {
        console.warn(`[FortuneClient] Model ${modelName} error:`, err);
        lastErr = err;
      }
    }

    if (!responseText) {
      console.warn('[FortuneClient] Gemini API failed, fallback to simulated fortune.', lastErr);
      return generateFallbackFortune(birthdate, question);
    }

    const cleanText = responseText.trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim();
    return JSON.parse(cleanText) as FortuneResult;

  } catch (error) {
    console.error('[FortuneClient] Exception during Gemini generation:', error);
    return generateFallbackFortune(birthdate, question);
  }
}
