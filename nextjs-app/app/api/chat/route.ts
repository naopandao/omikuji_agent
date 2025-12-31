import { NextRequest, NextResponse } from 'next/server';

// AgentCore Runtime 設定
// 重要: AGENTCORE_RUNTIME_ARN は環境変数で設定してください
// Amplify Console > Environment Variables で設定
const AGENTCORE_RUNTIME_ARN = process.env.AGENTCORE_RUNTIME_ARN;
const AWS_REGION = process.env.AWS_REGION || 'ap-northeast-1';

// 環境変数未設定の警告（開発時のみログ出力）
if (!AGENTCORE_RUNTIME_ARN && process.env.NODE_ENV === 'development') {
  console.warn('[Chat API] AGENTCORE_RUNTIME_ARN is not set. Using fallback mode.');
}

/**
 * チャットAPI - AgentCore Runtime を呼び出し
 * 
 * 重要: おみくじと同じセッションIDを使うことで、AgentCore RuntimeのMemory機能が有効になる
 * 
 * SDK: @aws-sdk/client-bedrock-agentcore
 * API: InvokeAgentRuntimeCommand
 */
export async function POST(request: NextRequest) {
  let requestSessionId = `chat-${Date.now()}`;
  
  try {
    const body = await request.json();
    const { message, sessionId, actorId = 'web_user', fortuneContext } = body;
    
    if (!message) {
      return NextResponse.json(
        { error: 'メッセージが必要です' },
        { status: 400 }
      );
    }

    requestSessionId = sessionId || requestSessionId;

    // 環境変数が設定されていない場合はフォールバックを返す
    if (!AGENTCORE_RUNTIME_ARN) {
      console.log('[Chat API] AGENTCORE_RUNTIME_ARN not configured, returning fallback');
      return NextResponse.json({
        message: 'ごめんね、AIエージェントがまだ設定されてないみたい💦 管理者に連絡してね！',
        sessionId: requestSessionId,
        timestamp: new Date().toISOString(),
        _fallback: true,
        _reason: 'AGENTCORE_RUNTIME_ARN not configured',
      });
    }

    // 動的importでAWS SDKを読み込み（SSR互換性のため）
    const { BedrockAgentCoreClient, InvokeAgentRuntimeCommand } = await import('@aws-sdk/client-bedrock-agentcore');

    // AWS Client作成
    const client = new BedrockAgentCoreClient({
      region: AWS_REGION,
    });

    // プロンプト作成（おみくじコンテキストを明確に含める）
    let prompt = message;
    if (fortuneContext) {
      prompt = `【重要：今回のおみくじ結果（これが最新で唯一の結果です）】
運勢: ${fortuneContext.fortune}
ラッキーカラー: ${fortuneContext.luckyColor}
ラッキーアイテム: ${fortuneContext.luckyItem}
ラッキースポット: ${fortuneContext.luckySpot}

【ユーザーの質問】
${message}

【指示】
- 上記のおみくじ結果のみを参照して回答してください
- 過去の会話や他のおみくじ結果は無視してください
- フレンドリーなギャル語で、短く楽しく答えてね✨`;
    }

    console.log('[Chat API] Invoking AgentCore Runtime:', {
      arn: AGENTCORE_RUNTIME_ARN,
      sessionId: requestSessionId,
      actorId,
      hasFortuneContext: !!fortuneContext,
    });

    // AgentCore Runtime を呼び出し
    const command = new InvokeAgentRuntimeCommand({
      agentRuntimeArn: AGENTCORE_RUNTIME_ARN,
      runtimeSessionId: requestSessionId,
      payload: new TextEncoder().encode(JSON.stringify({ 
        prompt,
        session_id: requestSessionId,
        actor_id: actorId,
        action: 'chat'  // 明示的にチャットアクション
      })),
    });

    const response = await client.send(command);

    // AgentCore Runtime のレスポンスを読み取り
    // response.response は StreamingBlobPayloadOutputTypes（Blob/Buffer/ReadableStream）
    let aiMessage = '';
    if (response.response) {
      // Node.js環境: response.response は Readable Streamの可能性
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
        const result = parsed.result || parsed.text || parsed.message || responseText;
        
        // result が文字列の場合、内部のJSONをさらにパース
        if (typeof result === 'string') {
          try {
            // {'role': 'assistant', 'content': [{'text': '...'}]} 形式を処理
            // Python の repr 形式を JSON に変換
            const jsonStr = result.replace(/'/g, '"');
            const innerParsed = JSON.parse(jsonStr);
            
            if (innerParsed.content && Array.isArray(innerParsed.content)) {
              // content 配列から text を抽出
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
            // 内部パースに失敗した場合はそのまま使用
            aiMessage = result;
          }
        } else {
          aiMessage = responseText;
        }
      } catch {
        aiMessage = responseText;
      }
    }

    // レスポンスが空の場合のフォールバック
    if (!aiMessage || aiMessage.trim() === '') {
      aiMessage = 'ごめんね、ちょっと上手く答えられなかった💦 もう一回聞いてみて！';
    }

    console.log('[Chat API] Response:', { aiMessage: aiMessage.substring(0, 100) });

    return NextResponse.json({
      message: aiMessage,
      sessionId: requestSessionId,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Chat API error:', error);
    
    return NextResponse.json({
      message: '申し訳ないけど、ちょっとエラーが出ちゃった💦 もう一回試してみて！',
      sessionId: requestSessionId,
      timestamp: new Date().toISOString(),
      _error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
