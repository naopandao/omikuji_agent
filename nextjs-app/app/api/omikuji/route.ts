import { NextRequest, NextResponse } from 'next/server';

// AgentCore Runtime 設定
const AGENTCORE_RUNTIME_ARN = process.env.AGENTCORE_RUNTIME_ARN || 
  'arn:aws:bedrock-agentcore:ap-northeast-1:226484346947:runtime/omikuji_agent-JkUdnzGA2D';
const AWS_REGION = process.env.AWS_REGION || 'ap-northeast-1';

/**
 * AgentCore Runtime を呼び出し（Bedrock Agentsではなく新しいAgentCore）
 * 
 * SDK: @aws-sdk/client-bedrock-agentcore
 * API: InvokeAgentRuntimeCommand
 */
export async function POST(request: NextRequest) {
  let requestSessionId = `fallback-${Date.now()}`;
  
  try {
    const body = await request.json();
    const { prompt = 'おみくじを引いてください', sessionId, actorId = 'web_user' } = body;
    requestSessionId = sessionId || requestSessionId;

    // 動的importでAWS SDKを読み込み（SSR互換性のため）
    const { BedrockAgentCoreClient, InvokeAgentRuntimeCommand } = await import('@aws-sdk/client-bedrock-agentcore');

    // AWS Client作成
    const client = new BedrockAgentCoreClient({
      region: AWS_REGION,
    });

    // AgentCore Runtime を呼び出し
    const command = new InvokeAgentRuntimeCommand({
      agentRuntimeArn: AGENTCORE_RUNTIME_ARN,
      runtimeSessionId: requestSessionId,
      payload: new TextEncoder().encode(JSON.stringify({ 
        prompt,
        session_id: requestSessionId,
        actor_id: actorId,
        action: 'draw'  // 明示的におみくじを引くアクション
      })),
    });

    console.log('[Omikuji API] Invoking AgentCore Runtime:', {
      arn: AGENTCORE_RUNTIME_ARN,
      sessionId: requestSessionId,
      actorId,
      prompt: prompt.substring(0, 50),
    });

    const response = await client.send(command);

    // AgentCore Runtime のレスポンスを読み取り
    // response.response は StreamingBlobPayloadOutputTypes（Blob/Buffer/ReadableStream）
    let aiMessage = '';
    let fortuneData = null;
    
    if (response.response) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const responseBody = response.response as any;
      
      // レスポンスをテキストに変換
      let responseText = '';
      
      if (typeof responseBody === 'string') {
        responseText = responseBody;
      } else if (responseBody instanceof Uint8Array || Buffer.isBuffer(responseBody)) {
        responseText = new TextDecoder().decode(responseBody);
      } else if (typeof responseBody.transformToString === 'function') {
        // AWS SDK SdkStream type
        responseText = await responseBody.transformToString();
      } else if (typeof responseBody.text === 'function') {
        // Blob type
        responseText = await responseBody.text();
      } else if (responseBody[Symbol.asyncIterator]) {
        // Async iterable (ReadableStream)
        const chunks: Uint8Array[] = [];
        for await (const chunk of responseBody) {
          chunks.push(chunk as Uint8Array);
        }
        const combined = new Uint8Array(chunks.reduce((acc, c) => acc + c.length, 0));
        let offset = 0;
        for (const chunk of chunks) {
          combined.set(chunk, offset);
          offset += chunk.length;
        }
        responseText = new TextDecoder().decode(combined);
      }
      
      // JSONパース試行
      try {
        const parsed = JSON.parse(responseText);
        let result = parsed.result || parsed.text || parsed.message || responseText;
        
        if (parsed.fortune_data) {
          fortuneData = parsed.fortune_data;
        }
        
        // result が文字列の場合、内部のJSONをさらにパース
        if (typeof result === 'string') {
          try {
            // {'role': 'assistant', 'content': [{'text': '...'}]} 形式を処理
            const jsonStr = result.replace(/'/g, '"');
            const innerParsed = JSON.parse(jsonStr);
            
            if (innerParsed.content && Array.isArray(innerParsed.content)) {
              const textContent = innerParsed.content
                .filter((c: { text?: string }) => c.text)
                .map((c: { text: string }) => c.text)
                .join('\n');
              if (textContent) {
                aiMessage = textContent;
              } else {
                aiMessage = result;
              }
            } else if (innerParsed.text) {
              aiMessage = innerParsed.text;
            } else {
              aiMessage = result;
            }
          } catch {
            aiMessage = result;
          }
        } else {
          aiMessage = responseText;
        }
      } catch {
        aiMessage = responseText;
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

    console.log('[Omikuji API] Response:', { aiMessage: aiMessage.substring(0, 100), fortuneData });

    // フロントエンドが期待する形式で返す
    return NextResponse.json({
      result: aiMessage,
      fortune_data: fortuneData,
      sessionId: requestSessionId,
    });

  } catch (error) {
    console.error('AgentCore Runtime invocation error:', error);
    
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
