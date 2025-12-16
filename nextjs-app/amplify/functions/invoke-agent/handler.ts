import {
  BedrockAgentRuntimeClient,
  InvokeAgentCommand,
} from '@aws-sdk/client-bedrock-agent-runtime';
import type { Handler } from 'aws-lambda';

/**
 * Bedrock AgentCore を呼び出す Lambda Handler
 */

const AGENT_ID = process.env.AGENT_ID || '';
const AGENT_ALIAS_ID = process.env.AGENT_ALIAS_ID || 'TSTALIASID';
const BEDROCK_REGION = process.env.BEDROCK_REGION || 'ap-northeast-1';

// Bedrock Client の初期化
const bedrockClient = new BedrockAgentRuntimeClient({
  region: BEDROCK_REGION,
});

interface InvokeAgentRequest {
  prompt: string;
  sessionId?: string;
}

interface InvokeAgentResponse {
  result: string;
  sessionId: string;
  traceId?: string;
}

export const handler: Handler<InvokeAgentRequest, InvokeAgentResponse> = async (
  event
) => {
  console.log('[InvokeAgent] Event:', JSON.stringify(event, null, 2));

  const { prompt, sessionId = `session-${Date.now()}` } = event;

  if (!prompt) {
    throw new Error('Prompt is required');
  }

  try {
    console.log(
      `[InvokeAgent] Invoking agent ${AGENT_ID} with session ${sessionId}`
    );

    // AgentCore Runtime API を呼び出し
    const command = new InvokeAgentCommand({
      agentId: AGENT_ID,
      agentAliasId: AGENT_ALIAS_ID,
      sessionId: sessionId,
      inputText: prompt,
      enableTrace: true, // トレース有効化
      endSession: false, // セッション継続
    });

    const response = await bedrockClient.send(command);

    // EventStream からレスポンスを読み取り
    const eventStream = response.completion;
    let fullResponse = '';
    let traceId = '';

    if (eventStream) {
      for await (const event of eventStream) {
        // チャンクイベント
        if (event.chunk && event.chunk.bytes) {
          const chunkText = new TextDecoder().decode(event.chunk.bytes);
          fullResponse += chunkText;
          console.log('[InvokeAgent] Chunk:', chunkText.substring(0, 100));
        }

        // トレースイベント
        if (event.trace && event.trace.trace) {
          // trace オブジェクトから情報を取得
          const trace = event.trace.trace;
          traceId = JSON.stringify(trace).substring(0, 100);
          console.log('[InvokeAgent] Trace received');
        }
      }
    }

    console.log('[InvokeAgent] Full response:', fullResponse.substring(0, 200));

    return {
      result: fullResponse,
      sessionId: sessionId,
      traceId: traceId,
    };
  } catch (error) {
    console.error('[InvokeAgent] Error:', error);
    throw error;
  }
};
