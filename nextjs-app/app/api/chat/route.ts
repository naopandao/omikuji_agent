import { NextRequest, NextResponse } from 'next/server';

// AgentCore Runtime設定
const AGENT_RUNTIME_ARN = process.env.AGENT_RUNTIME_ARN || 'arn:aws:bedrock-agentcore:ap-northeast-1:226484346947:runtime/my_agent-9NBXM54pmz';
const AWS_REGION = process.env.AGENTCORE_REGION || 'ap-northeast-1';

/**
 * チャットAPI - AgentCore Runtime を呼び出し
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

    // プロンプト作成（おみくじコンテキストを含める）
    let prompt = message;
    if (fortuneContext) {
      prompt = `
ユーザーが引いたおみくじの結果:
- 運勢: ${fortuneContext.fortune}
- ラッキーカラー: ${fortuneContext.luckyColor}
- ラッキーアイテム: ${fortuneContext.luckyItem}
- ラッキースポット: ${fortuneContext.luckySpot}

ユーザーからの質問: ${message}

フレンドリーなギャル語で、おみくじ結果を踏まえて回答してください。
過去の会話履歴があれば、それも参考にしてください。
`;
    }

    // AgentCore Runtimeを呼び出し
    const command = new InvokeAgentRuntimeCommand({
      agentRuntimeArn: AGENT_RUNTIME_ARN,
      payload: Buffer.from(JSON.stringify({ 
        prompt,
        session_id: sessionId 
      }), 'utf-8'),
    });

    const response = await client.send(command);

    // ストリーミングレスポンスを読み取り
    let resultStr = '';
    if (response.response) {
      const chunks: Buffer[] = [];
      for await (const chunk of response.response as AsyncIterable<Uint8Array>) {
        chunks.push(Buffer.from(chunk));
      }
      resultStr = Buffer.concat(chunks).toString('utf-8');
    }

    // JSONパース
    let parsedResult;
    try {
      parsedResult = JSON.parse(resultStr);
    } catch {
      parsedResult = { result: resultStr };
    }

    // AgentCoreのレスポンス形式を解析
    let aiMessage = '';
    
    if (parsedResult.result && typeof parsedResult.result === 'string') {
      try {
        // 文字列化されたJSONをパース
        const resultObj = JSON.parse(parsedResult.result.replace(/'/g, '"'));
        if (resultObj.content && Array.isArray(resultObj.content)) {
          aiMessage = resultObj.content.map((c: { text?: string }) => c.text || '').join('\n');
        } else {
          aiMessage = parsedResult.result;
        }
      } catch {
        // パース失敗時はそのまま使用
        aiMessage = parsedResult.result;
      }
    } else if (parsedResult.result?.content) {
      // 直接オブジェクトの場合
      aiMessage = parsedResult.result.content.map((c: { text?: string }) => c.text || '').join('\n');
    } else {
      aiMessage = resultStr;
    }

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

