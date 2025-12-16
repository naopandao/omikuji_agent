import { NextRequest, NextResponse } from 'next/server';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

/**
 * おみくじ API Route
 * Lambda Function を直接呼び出す
 */

const lambdaClient = new LambdaClient({
  region: process.env.AWS_REGION || 'ap-northeast-1',
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId = 'guest' } = body;

    console.log('[Omikuji API] Request:', { userId });

    // Lambda Function を直接呼び出す
    const functionName = process.env.OMIKUJI_FUNCTION_NAME || 'omikuji';

    const command = new InvokeCommand({
      FunctionName: functionName,
      Payload: JSON.stringify({
        userId,
        sessionId: `omikuji-${Date.now()}`,
      }),
    });

    const response = await lambdaClient.send(command);

    if (response.Payload) {
      const payload = JSON.parse(
        new TextDecoder().decode(response.Payload)
      );
      return NextResponse.json(payload);
    }

    throw new Error('No payload returned from Lambda');
  } catch (error) {
    console.error('[Omikuji API] Error:', error);
    return NextResponse.json(
      {
        error: 'おみくじの取得に失敗しました',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
