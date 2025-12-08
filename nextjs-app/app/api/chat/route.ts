import { NextRequest, NextResponse } from 'next/server';
import { runWithAmplifyServerContext } from '@/lib/amplify-server';
import { Lambda } from '@aws-sdk/client-lambda';

/**
 * チャット API Route
 * Amplify の Lambda Function (invoke-agent) を呼び出す
 */

const lambda = new Lambda({
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

    // Amplify の Lambda Function を呼び出し
    const result = await runWithAmplifyServerContext({
      nextServerContext: { request },
      operation: async (contextSpec) => {
        const functionName =
          process.env.INVOKE_AGENT_FUNCTION_NAME || 'invoke-agent';

        const response = await lambda.invoke({
          FunctionName: functionName,
          Payload: JSON.stringify({
            prompt: message,
            sessionId: sessionId || `chat-${Date.now()}`,
          }),
        });

        if (response.Payload) {
          const payload = JSON.parse(
            new TextDecoder().decode(response.Payload)
          );
          return payload;
        }

        throw new Error('No payload returned from Lambda');
      },
    });

    return NextResponse.json(result);
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
