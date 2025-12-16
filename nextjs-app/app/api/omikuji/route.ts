import { NextRequest, NextResponse } from 'next/server';
import { BedrockAgentCoreClient, InvokeAgentRuntimeCommand } from '@aws-sdk/client-bedrock-agentcore';

// AgentCore Runtime設定
const AGENT_RUNTIME_ARN = process.env.AGENT_RUNTIME_ARN || 'arn:aws:bedrock-agentcore:ap-northeast-1:226484346947:runtime/my_agent-9NBXM54pmz';
const AWS_REGION = process.env.AWS_REGION || 'ap-northeast-1';

// AWS Client作成
const client = new BedrockAgentCoreClient({
  region: AWS_REGION,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt = 'おみくじを引いてください', sessionId } = body;

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
    let result = '';
    if (response.response) {
      const chunks: Buffer[] = [];
      for await (const chunk of response.response as AsyncIterable<Uint8Array>) {
        chunks.push(Buffer.from(chunk));
      }
      result = Buffer.concat(chunks).toString('utf-8');
    }

    // JSONパース
    let parsedResult;
    try {
      parsedResult = JSON.parse(result);
    } catch {
      parsedResult = { result };
    }

    return NextResponse.json({
      success: true,
      data: parsedResult,
    });

  } catch (error) {
    console.error('AgentCore invocation error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
