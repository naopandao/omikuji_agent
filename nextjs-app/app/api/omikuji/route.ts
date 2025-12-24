import { NextRequest, NextResponse } from 'next/server';

// AgentCore Runtime設定
const AGENT_RUNTIME_ARN = process.env.AGENT_RUNTIME_ARN || 'arn:aws:bedrock-agentcore:ap-northeast-1:226484346947:runtime/my_agent-9NBXM54pmz';
const AWS_REGION = process.env.AGENTCORE_REGION || 'ap-northeast-1';

/**
 * AgentCore Runtime を boto3形式で呼び出し
 * @aws-sdk/client-bedrock-agentcore は新しすぎてAmplify SSR環境で問題があるため、
 * 直接HTTPリクエストで呼び出す
 */
export async function POST(request: NextRequest) {
  let requestSessionId = `fallback-${Date.now()}`;
  
  try {
    const body = await request.json();
    const { prompt = 'おみくじを引いてください', sessionId } = body;
    requestSessionId = sessionId || requestSessionId;

    // 動的importでAWS SDKを読み込み（SSR互換性のため）
    const { BedrockAgentRuntimeClient, InvokeAgentCommand } = await import('@aws-sdk/client-bedrock-agent-runtime');

    // AWS Client作成
    const client = new BedrockAgentRuntimeClient({
      region: AWS_REGION,
    });

    // Bedrock Agent を呼び出し
    const command = new InvokeAgentCommand({
      agentId: AGENT_RUNTIME_ARN.split('/').pop() || 'my_agent-9NBXM54pmz',
      agentAliasId: 'TSTALIASID',
      sessionId: requestSessionId,
      inputText: prompt,
    });

    const response = await client.send(command);

    // ストリーミングレスポンスを読み取り
    let aiMessage = '';
    let fortuneData = null;
    
    if (response.completion) {
      for await (const event of response.completion) {
        if (event.chunk && event.chunk.bytes) {
          const chunkText = new TextDecoder().decode(event.chunk.bytes);
          try {
            const parsed = JSON.parse(chunkText);
            if (parsed.bytes) {
              aiMessage += new TextDecoder().decode(parsed.bytes);
            } else if (parsed.text) {
              aiMessage += parsed.text;
            } else if (parsed.result) {
              aiMessage = parsed.result;
              if (parsed.fortune_data) {
                fortuneData = parsed.fortune_data;
              }
            } else {
              aiMessage += chunkText;
            }
          } catch {
            aiMessage += chunkText;
          }
        }
      }
    }

    // fortune_data のキー名を正規化（snake_case → camelCase）
    if (fortuneData) {
      fortuneData = {
        fortune: fortuneData.fortune,
        stars: fortuneData.stars,
        luckyColor: fortuneData.lucky_color || fortuneData.luckyColor,
        luckyItem: fortuneData.lucky_item || fortuneData.luckyItem,
        luckySpot: fortuneData.lucky_spot || fortuneData.luckySpot,
        timestamp: fortuneData.timestamp || new Date().toISOString(),
      };
    }

    // フロントエンドが期待する形式で返す
    return NextResponse.json({
      result: aiMessage,
      fortune_data: fortuneData,
      sessionId: requestSessionId,
    });

  } catch (error) {
    console.error('AgentCore invocation error:', error);
    
    // フォールバック: モックデータを返す
    return NextResponse.json({
      result: getFallbackMessage(),
      fortune_data: getFallbackFortuneData(),
      sessionId: requestSessionId,
      _fallback: true,
      _error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// フォールバック用関数
function getFallbackMessage(): string {
  const FORTUNES = ['大吉', '中吉', '小吉', '吉', '末吉', '凶'];
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

function getFallbackFortuneData() {
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
