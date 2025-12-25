'use client';

/**
 * おみくじAPI - Next.js API Route → AgentCore Runtime
 * 
 * アーキテクチャ:
 * フロントエンド → /api/omikuji (Server Side) → AgentCore Runtime
 * 
 * セッション管理設計:
 * - おみくじを引く → 新しい session_id を発行
 * - チャットする → 同じ session_id を使用
 * - 再度おみくじ → 新しい session_id を発行（新しい会話開始）
 * 
 * つまり: おみくじID = session_id = チャットID
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
 * 新しいセッションIDを生成
 * おみくじを引くたびに呼び出す
 * 
 * 形式: omikuji-{timestamp}-{random}
 * 例: omikuji-20251225143052-a1b2c3d4e5f6
 */
export function generateNewSessionId(): string {
  const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const random = crypto.randomUUID().split('-')[0];
  return `omikuji-${timestamp}-${random}`;
}

/**
 * 現在のセッションIDを取得
 * sessionStorageに保存されているIDを返す
 */
export function getCurrentSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem('current_omikuji_session_id');
}

/**
 * セッションIDを保存
 * おみくじを引いた後に呼び出す
 */
export function saveSessionId(sessionId: string): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem('current_omikuji_session_id', sessionId);
}

/**
 * セッションをクリア
 * 新しいおみくじを引く前に呼び出す
 */
export function clearSession(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem('current_omikuji_session_id');
}

/**
 * おみくじを引く - API Route → AgentCore Runtime
 * 
 * 重要: 毎回新しいセッションIDを発行する
 * これにより、おみくじごとに独立した会話セッションが作られる
 */
export async function fetchOmikuji(): Promise<OmikujiResponse> {
  // 新しいセッションIDを発行（おみくじごとに独立したセッション）
  const newSessionId = generateNewSessionId();
  
  try {
    const response = await fetch('/api/omikuji', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'おみくじを引いてください',
        sessionId: newSessionId,
        actorId: 'web_user',  // ユーザー識別子
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    // セッションIDを保存（チャットで使用）
    const effectiveSessionId = data.sessionId || newSessionId;
    saveSessionId(effectiveSessionId);

    return {
      result: data.result || '',
      fortune_data: data.fortune_data || getFallbackFortuneData(),
      sessionId: effectiveSessionId,
    };

  } catch (error) {
    console.error('Failed to fetch omikuji:', error);
    // フォールバック: モックデータを返す
    saveSessionId(newSessionId);
    return getFallbackOmikuji(newSessionId);
  }
}

/**
 * AIとチャット - API Route → AgentCore Runtime
 * 
 * 重要: おみくじで発行されたセッションIDを使用する
 * これにより、AgentCore Memoryがおみくじ結果を参照できる
 * 
 * @param message ユーザーメッセージ
 * @param fortuneContext おみくじ結果（バックアップ用）
 */
export async function sendChatMessage(
  message: string, 
  fortuneContext?: FortuneData
): Promise<ChatResponse> {
  // 現在のセッションIDを取得（おみくじで発行されたもの）
  const sessionId = getCurrentSessionId();
  
  if (!sessionId) {
    console.warn('No session ID found. Chat may not be linked to omikuji result.');
  }
  
  const effectiveSessionId = sessionId || generateNewSessionId();
  
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        sessionId: effectiveSessionId,
        actorId: 'web_user',
        fortuneContext,  // バックアップ用（Memory が使えない場合）
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
      sessionId: effectiveSessionId,
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
