'use client';

/**
 * おみくじAPI - Next.js API Route → AgentCore Runtime
 * 
 * アーキテクチャ:
 * フロントエンド → /api/omikuji (Server Side) → AgentCore Runtime
 * 
 * TODO: Amplify Gen2 + AppSync への移行
 * 現在はSSR API Routeで実装、将来的にAppSync HTTP Data Sourceに移行予定
 */

export interface FortuneData {
  fortune: string;
  stars: string;
  luckyColor: string;
  luckyItem: string;
  luckySpot: string;
  timestamp: string;
}

export interface OmikujiResponse {
  result: string;
  fortune_data: FortuneData;
  sessionId: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ChatResponse {
  message: string;
  sessionId: string;
  timestamp: string;
}

/**
 * おみくじを引く - API Route → AgentCore Runtime
 */
export async function fetchOmikuji(): Promise<OmikujiResponse> {
  const sessionId = `omikuji-${Date.now()}`;

  try {
    const response = await fetch('/api/omikuji', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'おみくじを引いてください',
        sessionId,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    return {
      result: data.result || '',
      fortune_data: data.fortune_data || getFallbackFortuneData(),
      sessionId: data.sessionId || sessionId,
    };

  } catch (error) {
    console.error('Failed to fetch omikuji:', error);
    // フォールバック: モックデータを返す
    return getFallbackOmikuji(sessionId);
  }
}

/**
 * AIとチャット - API Route → AgentCore Runtime
 */
export async function sendChatMessage(
  message: string, 
  sessionId?: string,
  fortuneContext?: FortuneData
): Promise<ChatResponse> {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        sessionId: sessionId || `chat-${Date.now()}`,
        fortuneContext,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: ChatResponse = await response.json();
    return data;

  } catch (error) {
    console.error('Failed to send chat message:', error);
    return {
      message: 'ごめんね、今ちょっと調子悪いみたい...もう一回試してみて！💦',
      sessionId: sessionId || `chat-${Date.now()}`,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * フォールバック用FortuneData
 */
function getFallbackFortuneData(): FortuneData {
  const FORTUNES = ['大吉', '中吉', '小吉', '吉', '末吉', '凶'];
  const COLORS = ['ピンク', '水色', 'ラベンダー', 'ミントグリーン', 'コーラル', 'ゴールド'];
  const ITEMS = ['リップグロス', 'ミラー', 'お気に入りのアクセ', 'ハンドクリーム', '推しのグッズ'];
  const SPOTS = ['カフェ', 'ショッピングモール', '公園', '神社', '映画館'];

  return {
    fortune: FORTUNES[Math.floor(Math.random() * FORTUNES.length)],
    stars: '★'.repeat(Math.floor(Math.random() * 3) + 3) + '☆'.repeat(2),
    luckyColor: COLORS[Math.floor(Math.random() * COLORS.length)],
    luckyItem: ITEMS[Math.floor(Math.random() * ITEMS.length)],
    luckySpot: SPOTS[Math.floor(Math.random() * SPOTS.length)],
    timestamp: new Date().toISOString(),
  };
}

/**
 * フォールバック用モックデータ
 */
function getFallbackOmikuji(sessionId: string): OmikujiResponse {
  const FORTUNES = ['大吉', '中吉', '小吉', '吉', '末吉', '凶'];
  const COLORS = ['ピンク', '水色', 'ラベンダー', 'ミントグリーン', 'コーラル', 'ゴールド'];
  const ITEMS = ['リップグロス', 'ミラー', 'お気に入りのアクセ', 'ハンドクリーム', '推しのグッズ'];
  const SPOTS = ['カフェ', 'ショッピングモール', '公園', '神社', '映画館'];

  const fortune = FORTUNES[Math.floor(Math.random() * FORTUNES.length)];
  const stars = '★'.repeat(Math.floor(Math.random() * 3) + 3) + '☆'.repeat(2);

  const messages: Record<string, string> = {
    '大吉': '✨ やばい！めっちゃ最高の運勢じゃん！今日は何やってもうまくいくから、思い切ってチャレンジしちゃお！💕',
    '中吉': '💖 いい感じ～！ちょっと頑張れば素敵なことが起こりそう！推し活も捗るかも！',
    '小吉': '🌸 まあまあいい感じ！小さな幸せを見つけられる日だよ！',
    '吉': '🍀 普通にいい日！コツコツ頑張ってれば良いことあるよ！',
    '末吉': '🌿 ゆっくりだけど運気上昇中！焦らずいこ！',
    '凶': '☁️ 今日はおとなしくしてた方がいいかも...でも明日はきっといい日になるよ！',
  };

  return {
    result: messages[fortune] || 'おみくじの結果です！',
    fortune_data: {
      fortune,
      stars,
      luckyColor: COLORS[Math.floor(Math.random() * COLORS.length)],
      luckyItem: ITEMS[Math.floor(Math.random() * ITEMS.length)],
      luckySpot: SPOTS[Math.floor(Math.random() * SPOTS.length)],
      timestamp: new Date().toISOString(),
    },
    sessionId,
  };
}

/**
 * 履歴保存（ローカルストレージ）
 */
export async function saveFortuneResult(data: FortuneData): Promise<void> {
  try {
    const history = JSON.parse(localStorage.getItem('omikuji_history') || '[]');
    history.unshift(data);
    // 最新10件のみ保持
    localStorage.setItem('omikuji_history', JSON.stringify(history.slice(0, 10)));
  } catch (error) {
    console.error('Failed to save fortune result:', error);
  }
}

/**
 * 履歴取得（ローカルストレージ）
 */
export async function getFortuneHistory(): Promise<FortuneData[]> {
  try {
    return JSON.parse(localStorage.getItem('omikuji_history') || '[]');
  } catch (error) {
    console.error('Failed to get fortune history:', error);
    return [];
  }
}
