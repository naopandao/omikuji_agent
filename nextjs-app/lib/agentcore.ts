/**
 * AgentCore Runtime 共通ユーティリティ
 * 
 * omikuji と chat の API Route で共通使用
 */

// AgentCore Runtime 設定
export const AGENTCORE_RUNTIME_ARN = process.env.AGENTCORE_RUNTIME_ARN;
export const AWS_REGION = process.env.AWS_REGION || 'ap-northeast-1';

/**
 * AgentCore Runtime が設定されているかチェック
 */
export function isAgentCoreConfigured(): boolean {
  return !!AGENTCORE_RUNTIME_ARN;
}

/**
 * AgentCore Runtime のレスポンスボディをテキストに変換
 * 
 * @param responseBody - AgentCore Runtime のレスポンス（Blob/Buffer/ReadableStream）
 * @returns テキスト形式のレスポンス
 */
export async function convertResponseToText(responseBody: unknown): Promise<string> {
  if (typeof responseBody === 'string') {
    return responseBody;
  }
  
  if (responseBody instanceof Uint8Array || Buffer.isBuffer(responseBody)) {
    return new TextDecoder().decode(responseBody as Uint8Array);
  }
  
  // AWS SDK SdkStream type
  if (typeof (responseBody as { transformToString?: () => Promise<string> }).transformToString === 'function') {
    return await (responseBody as { transformToString: () => Promise<string> }).transformToString();
  }
  
  // Blob type
  if (typeof (responseBody as { text?: () => Promise<string> }).text === 'function') {
    return await (responseBody as { text: () => Promise<string> }).text();
  }
  
  // Async iterable (ReadableStream)
  if ((responseBody as AsyncIterable<Uint8Array>)[Symbol.asyncIterator]) {
    const chunks: Uint8Array[] = [];
    for await (const chunk of responseBody as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    const combined = new Uint8Array(chunks.reduce((acc, c) => acc + c.length, 0));
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    return new TextDecoder().decode(combined);
  }
  
  return '';
}

/**
 * AgentCore レスポンスの content 配列からテキストを抽出
 */
interface ContentItem {
  text?: string;
}

interface ParsedInner {
  content?: ContentItem[];
  text?: string;
}

/**
 * AgentCore レスポンスのJSONパース結果からメッセージを抽出
 * 
 * @param responseText - AgentCore からのレスポンステキスト
 * @returns 抽出されたメッセージ
 */
export function parseAgentCoreResponse(responseText: string): { message: string; parsed: Record<string, unknown> | null } {
  try {
    const parsed = JSON.parse(responseText) as Record<string, unknown>;
    const result = (parsed.result || parsed.text || parsed.message || responseText) as string | Record<string, unknown>;
    
    // result が文字列の場合、内部のJSONをさらにパース
    if (typeof result === 'string') {
      try {
        // {'role': 'assistant', 'content': [{'text': '...'}]} 形式を処理
        // Python の repr 形式を JSON に変換
        const jsonStr = result.replace(/'/g, '"');
        const innerParsed: ParsedInner = JSON.parse(jsonStr);
        
        if (innerParsed.content && Array.isArray(innerParsed.content)) {
          const textContent = innerParsed.content
            .filter((c: ContentItem) => c.text)
            .map((c: ContentItem) => c.text)
            .join('\n');
          if (textContent) {
            return { message: textContent, parsed };
          }
        }
        
        if (innerParsed.text) {
          return { message: innerParsed.text, parsed };
        }
        
        return { message: result, parsed };
      } catch {
        return { message: result, parsed };
      }
    }
    
    return { message: responseText, parsed };
  } catch {
    return { message: responseText, parsed: null };
  }
}

/**
 * FortuneData の型定義
 */
export interface FortuneData {
  fortune: string;
  stars: string;
  luckyColor: string;
  luckyItem: string;
  luckySpot: string;
  timestamp: string;
}

/**
 * FortuneData のキー名を正規化（snake_case → camelCase）
 */
export function normalizeFortuneData(data: Record<string, unknown>): FortuneData {
  return {
    fortune: (data.fortune as string) || '',
    stars: (data.stars as string) || '',
    luckyColor: (data.lucky_color || data.luckyColor) as string || '',
    luckyItem: (data.lucky_item || data.luckyItem) as string || '',
    luckySpot: (data.lucky_spot || data.luckySpot) as string || '',
    timestamp: (data.timestamp as string) || new Date().toISOString(),
  };
}

// フォールバック用定数
const FORTUNES = ['大吉', '中吉', '小吉', '吉', '末吉', '凶'];
const COLORS = ['ピンク', '水色', 'ラベンダー', 'ミントグリーン', 'コーラル', 'ゴールド'];
const ITEMS = ['リップグロス', 'ミラー', 'お気に入りのアクセ', 'ハンドクリーム', '推しのグッズ'];
const SPOTS = ['カフェ', 'ショッピングモール', '公園', '神社', '映画館'];

/**
 * フォールバック用おみくじメッセージ
 */
export function getFallbackFortuneMessage(): string {
  const fortune = FORTUNES[Math.floor(Math.random() * FORTUNES.length)];
  
  const messages: Record<string, string> = {
    '大吉': '✨ やばい！めっちゃ最高の運勢じゃん！今日は何やってもうまくいくから、思い切ってチャレンジしちゃお！💕',
    '中吉': '💖 いい感じ～！ちょっと頑張れば素敵なことが起こりそう！推し活も捗るかも！',
    '小吉': '🌸 まあまあいい感じ！小さな幸せを見つけられる日だよ！',
    '吉': '🍀 普通にいい日！コツコツ頑張ってれば良いことあるよ！',
    '末吉': '🌿 ゆっくりだけど運気上昇中！焦らずいこ！',
    '凶': '☁️ 今日はおとなしくしてた方がいいかも...でも明日はきっといい日になるよ！',
  };

  return messages[fortune] || 'おみくじの結果です！';
}

/**
 * フォールバック用運勢データ
 */
export function getFallbackFortuneData(): FortuneData {
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
 * フォールバック用チャットメッセージ
 */
export function getFallbackChatMessage(): string {
  return 'ごめんね、ちょっと上手く答えられなかった💦 もう一回聞いてみて！';
}

