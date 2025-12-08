import { NextRequest, NextResponse } from 'next/server';
import { runWithAmplifyServerContext } from '@/lib/amplify-server';
import { Lambda } from '@aws-sdk/client-lambda';

/**
 * おみくじ API Route
 * Amplify の Lambda Function を呼び出す
 */

const lambda = new Lambda({
  region: process.env.AWS_REGION || 'ap-northeast-1',
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId = 'guest' } = body;

    console.log('[Omikuji API] Request:', { userId });

    // Amplify の Lambda Function を呼び出し
    const result = await runWithAmplifyServerContext({
      nextServerContext: { request },
      operation: async (contextSpec) => {
        // Lambda Function 名は Amplify が自動生成
        // 実際の Function 名に置き換える必要あり
        const functionName = process.env.OMIKUJI_FUNCTION_NAME || 'omikuji';

        const response = await lambda.invoke({
          FunctionName: functionName,
          Payload: JSON.stringify({
            userId,
            sessionId: `omikuji-${Date.now()}`,
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
