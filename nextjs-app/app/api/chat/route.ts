import { NextRequest, NextResponse } from 'next/server';
import {
  AGENTCORE_RUNTIME_ARN,
  AWS_REGION,
  isAgentCoreConfigured,
  convertResponseToText,
  parseAgentCoreResponse,
  getFallbackChatMessage,
  FortuneData,
} from '@/lib/agentcore';

// 環境変数未設定の警告（開発時のみログ出力）
if (!isAgentCoreConfigured() && process.env.NODE_ENV === 'development') {
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
    const { message, sessionId, actorId = 'web_user', fortuneContext } = body as {
      message?: string;
      sessionId?: string;
      actorId?: string;
      fortuneContext?: FortuneData;
    };
    
    if (!message) {
      return NextResponse.json(
        { error: 'メッセージが必要です' },
        { status: 400 }
      );
    }

    requestSessionId = sessionId || requestSessionId;

    // 環境変数が設定されていない場合はフォールバックを返す
    if (!isAgentCoreConfigured()) {
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
    let aiMessage = '';
    if (response.response) {
      const responseText = await convertResponseToText(response.response);
      const { message: parsedMessage } = parseAgentCoreResponse(responseText);
      aiMessage = parsedMessage;
    }

    // レスポンスが空の場合のフォールバック
    if (!aiMessage || aiMessage.trim() === '') {
      aiMessage = getFallbackChatMessage();
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
