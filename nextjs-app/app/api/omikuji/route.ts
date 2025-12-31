import { NextRequest, NextResponse } from 'next/server';
import {
  AGENTCORE_RUNTIME_ARN,
  AWS_REGION,
  isAgentCoreConfigured,
  convertResponseToText,
  parseAgentCoreResponse,
  normalizeFortuneData,
  getFallbackFortuneMessage,
  getFallbackFortuneData,
  FortuneData,
} from '@/lib/agentcore';

// 環境変数未設定の警告（開発時のみログ出力）
if (!isAgentCoreConfigured() && process.env.NODE_ENV === 'development') {
  console.warn('[Omikuji API] AGENTCORE_RUNTIME_ARN is not set. Using fallback mode.');
}

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

    // 環境変数が設定されていない場合はフォールバックを返す
    if (!isAgentCoreConfigured()) {
      console.log('[Omikuji API] AGENTCORE_RUNTIME_ARN not configured, returning fallback');
      return NextResponse.json({
        result: getFallbackFortuneMessage(),
        fortune_data: getFallbackFortuneData(),
        sessionId: requestSessionId,
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
    let aiMessage = '';
    let fortuneData: FortuneData | null = null;
    
    if (response.response) {
      const responseText = await convertResponseToText(response.response);
      const { message, parsed } = parseAgentCoreResponse(responseText);
      aiMessage = message;
      
      // fortune_data を抽出
      if (parsed?.fortune_data) {
        fortuneData = normalizeFortuneData(parsed.fortune_data as Record<string, unknown>);
      }
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
      result: getFallbackFortuneMessage(),
      fortune_data: getFallbackFortuneData(),
      sessionId: requestSessionId,
      _fallback: true,
      _error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
