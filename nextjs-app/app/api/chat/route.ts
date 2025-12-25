import { NextRequest, NextResponse } from 'next/server';

// AgentCore Runtime 設定
const AGENTCORE_RUNTIME_ARN = process.env.AGENTCORE_RUNTIME_ARN || 
  'arn:aws:bedrock-agentcore:ap-northeast-1:226484346947:runtime/my_agent-ocF0JfFaVa';
const AWS_REGION = process.env.AWS_REGION || 'ap-northeast-1';

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
    const { message, sessionId, fortuneContext } = body;
    
    if (!message) {
      return NextResponse.json(
        { error: 'メッセージが必要です' },
        { status: 400 }
      );
    }

    requestSessionId = sessionId || requestSessionId;

    // 動的importでAWS SDKを読み込み（SSR互換性のため）
    const { BedrockAgentCoreClient, InvokeAgentRuntimeCommand } = await import('@aws-sdk/client-bedrock-agentcore');

    // AWS Client作成
    const client = new BedrockAgentCoreClient({
      region: AWS_REGION,
    });

    // プロンプト作成（おみくじコンテキストを含める - バックアップ用）
    // ※ 同一セッションIDならAgentCore RuntimeのMemory機能で自動的に会話履歴を参照
    let prompt = message;
    if (fortuneContext) {
      prompt = `【参考情報】今日のおみくじ結果: ${fortuneContext.fortune}（ラッキーカラー:${fortuneContext.luckyColor}、ラッキーアイテム:${fortuneContext.luckyItem}、ラッキースポット:${fortuneContext.luckySpot}）

ユーザーの質問: ${message}`;
    }

    console.log('[Chat API] Invoking AgentCore Runtime:', {
      arn: AGENTCORE_RUNTIME_ARN,
      sessionId: requestSessionId,
      hasFortuneContext: !!fortuneContext,
    });

    // AgentCore Runtime を呼び出し
    const command = new InvokeAgentRuntimeCommand({
      agentRuntimeArn: AGENTCORE_RUNTIME_ARN,
      runtimeSessionId: requestSessionId,
      payload: new TextEncoder().encode(JSON.stringify({ prompt })),
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
        if (parsed.result) {
          aiMessage = parsed.result;
        } else if (parsed.text) {
          aiMessage = parsed.text;
        } else if (parsed.message) {
          aiMessage = parsed.message;
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
