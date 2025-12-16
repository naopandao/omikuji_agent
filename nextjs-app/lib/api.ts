'use client';

/**
 * おみくじAPI - シンプルなモック実装
 * 後でAgentCore連携を追加予定
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

// おみくじの運勢データ
const FORTUNES = ['大吉', '中吉', '小吉', '吉', '末吉', '凶'];
const COLORS = ['ピンク', '水色', 'ラベンダー', 'ミントグリーン', 'コーラル', 'ゴールド', 'シルバー'];
const ITEMS = ['リップグロス', 'ミラー', 'お気に入りのアクセ', 'ハンドクリーム', '推しのグッズ', 'パワーストーン'];
const SPOTS = ['カフェ', 'ショッピングモール', '公園', '神社', '映画館', '図書館', 'おしゃれなレストラン'];

/**
 * おみくじを引く - ローカルでランダム生成
 */
export async function fetchOmikuji(): Promise<OmikujiResponse> {
  // 少し待つ（演出用）
  await new Promise(resolve => setTimeout(resolve, 1000));

  const fortune = FORTUNES[Math.floor(Math.random() * FORTUNES.length)];
  const stars = '★'.repeat(Math.floor(Math.random() * 3) + 3) + '☆'.repeat(2);
  
  const fortuneData: FortuneData = {
    fortune,
    stars,
    luckyColor: COLORS[Math.floor(Math.random() * COLORS.length)],
    luckyItem: ITEMS[Math.floor(Math.random() * ITEMS.length)],
    luckySpot: SPOTS[Math.floor(Math.random() * SPOTS.length)],
    timestamp: new Date().toISOString(),
  };

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
    fortune_data: fortuneData,
    sessionId: `omikuji-${Date.now()}`,
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
