/**
 * AppSync JS Resolver - AIとチャット
 * AgentCore Runtime を HTTP Data Source 経由で直接呼び出し
 */
import { util } from '@aws-appsync/utils';

// AgentCore Runtime の設定
const AGENT_RUNTIME_ID = 'my_agent-9NBXM54pmz';

/**
 * Request Handler - AgentCore Runtime API を呼び出す
 */
export function request(ctx) {
  const { message, sessionId } = ctx.args;
  
  // セッションIDが指定されていない場合は自動生成
  const runtimeSessionId = sessionId || `chat-${util.autoId()}`;
  
  // AgentCore Runtime のリクエストボディ
  const requestBody = {
    agentRuntimeId: AGENT_RUNTIME_ID,
    sessionId: runtimeSessionId,
    inputText: message,
  };

  return {
    method: 'POST',
    resourcePath: `/agents/${AGENT_RUNTIME_ID}/sessions/${runtimeSessionId}/text`,
    params: {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(requestBody),
    },
  };
}

/**
 * Response Handler - AgentCore からのレスポンスを処理
 */
export function response(ctx) {
  const { error, result } = ctx;
  
  if (error) {
    return util.error(error.message, error.type);
  }
  
  // レスポンスボディをパース
  const statusCode = result.statusCode;
  const body = result.body ? JSON.parse(result.body) : {};
  
  if (statusCode !== 200) {
    return util.error(`AgentCore error: ${statusCode}`, 'AgentCoreError');
  }
  
  // AgentCore のレスポンスからチャット応答を抽出
  const agentResponse = body.outputText || body.completion || '';
  
  return {
    response: agentResponse,
    sessionId: body.sessionId || ctx.args.sessionId,
  };
}
