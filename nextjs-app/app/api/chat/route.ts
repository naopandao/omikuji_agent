import { NextRequest, NextResponse } from 'next/server';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

/**
 * チャット API Route
 * Amplify の Lambda Function (invoke-agent) を呼び出す
 */

const lambda = new LambdaClient({
  region: process.env.AWS_REGION || 'ap-northeast-1',
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, sessionId } = body;

    if (!message) {
      return NextResponse.json(
        { error: 'メッセージが必要です' },
        { status: 400 }
      );
    }

    console.log('[Chat API] Request:', { message, sessionId });

    // Lambda Function を直接呼び出し
    const functionName =
      process.env.INVOKE_AGENT_FUNCTION_NAME || 'invoke-agent';

    const command = new InvokeCommand({
      FunctionName: functionName,
      Payload: JSON.stringify({
        prompt: message,
        sessionId: sessionId || `chat-${Date.now()}`,
      }),
    });

    const response = await lambda.send(command);

    if (response.Payload) {
      const payload = JSON.parse(
        new TextDecoder().decode(response.Payload)
      );
      return NextResponse.json(payload);
    }

    throw new Error('No payload returned from Lambda');
  } catch (error) {
    console.error('[Chat API] Error:', error);
    return NextResponse.json(
      {
        error: 'メッセージの送信に失敗しました',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
