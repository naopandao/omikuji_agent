import { util } from '@aws-appsync/utils';

/**
 * チャット AppSync Resolver
 * 
 * 現在: NONE Data Source（プレースホルダー）
 * 
 * TODO: AgentCore HTTP Data Source に移行
 * 
 * 重要: sessionId を共有することで、AgentCore Runtime の Memory 機能が有効になる
 * - おみくじを引いた時の会話履歴を記憶
 * - チャットで「さっきの運勢について」と聞けば回答可能
 */

export function request(ctx) {
  const { message, sessionId, fortuneContext } = ctx.arguments;
  
  return {
    payload: {
      message,
      sessionId,
      fortuneContext,
    },
  };
}

export function response(ctx) {
  // NONE Data Source の場合、ここでモックレスポンスを返す
  // 実際の AgentCore 呼び出しは API Route (/api/chat) で行う
  
  const { message, sessionId, fortuneContext } = ctx.arguments;
  
  let responseMessage = '【プレースホルダー】AppSync経由のチャット応答です。';
  
  if (fortuneContext) {
    responseMessage += ` あなたの運勢は${fortuneContext.fortune}でしたね！`;
  }
  
  return {
    message: responseMessage,
    sessionId: sessionId || `session-${util.autoId()}`,
    timestamp: util.time.nowISO8601(),
  };
}
