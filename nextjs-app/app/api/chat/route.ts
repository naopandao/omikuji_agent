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
    const { BedrockAgentRuntimeClient, InvokeAgentCommand } = await import('@aws-sdk/client-bedrock-agent-runtime');

    // AWS Client作成
    const client = new BedrockAgentRuntimeClient({
      region: AWS_REGION,
    });

    // プロンプト作成（おみくじコンテキストを含める）
    let prompt = message;
    if (fortuneContext) {
      // システムメッセージ形式でコンテキストを提供
      prompt = `【重要】今日のおみくじ結果: ${fortuneContext.fortune}（ラッキーカラー:${fortuneContext.luckyColor}、ラッキーアイテム:${fortuneContext.luckyItem}、ラッキースポット:${fortuneContext.luckySpot}）

${message}`;
      console.log('[Chat API] Prompt with fortune context:', prompt);
    } else {
      console.log('[Chat API] Prompt without fortune context:', prompt);
    }

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
            } else {
              aiMessage += chunkText;
            }
          } catch {
            aiMessage += chunkText;
          }
        }
      }
    }

    // レスポンスが空の場合のフォールバック
    if (!aiMessage || aiMessage.trim() === '') {
      aiMessage = 'ごめんね、ちょっと上手く答えられなかった💦 もう一回聞いてみて！';
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

