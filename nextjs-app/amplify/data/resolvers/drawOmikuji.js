import { util } from '@aws-appsync/utils';

/**
 * おみくじ AppSync Resolver
 * 
 * 現在: NONE Data Source（プレースホルダー）
 * 
 * TODO: AgentCore HTTP Data Source に移行
 * - InvokeAgentRuntime API を直接呼び出し
 * - Lambda 不要
 * 
 * 移行後のイメージ:
 * ```
 * export function request(ctx) {
 *   return {
 *     method: 'POST',
 *     resourcePath: `/runtimes/${AGENTCORE_ARN}/invocations`,
 *     params: {
 *       headers: {
 *         'Content-Type': 'application/json',
 *         'X-Amzn-Bedrock-AgentCore-Runtime-Session-Id': ctx.args.sessionId,
 *       },
 *       body: JSON.stringify({ prompt: ctx.args.prompt }),
 *     },
 *   };
 * }
 * ```
 */

export function request(ctx) {
  const { prompt, sessionId } = ctx.arguments;
  
  // 現在は NONE Data Source なので、リクエスト情報を返すのみ
  return {
    payload: {
      prompt: prompt || 'おみくじを引きたい',
      sessionId: sessionId || `session-${util.autoId()}`,
    },
  };
}

export function response(ctx) {
  // NONE Data Source の場合、ここでモックレスポンスを返す
  // 実際の AgentCore 呼び出しは API Route (/api/omikuji) で行う
  
  const fortunes = ['大吉', '中吉', '小吉', '吉', '末吉', '凶'];
  const colors = ['ピンク', '水色', 'ラベンダー', 'ミントグリーン'];
  const items = ['リップグロス', 'ミラー', 'お気に入りのアクセ', 'ハンドクリーム'];
  const spots = ['カフェ', 'ショッピングモール', '公園', '神社'];
  
  const fortune = fortunes[Math.floor(Math.random() * fortunes.length)];
  
  return {
    result: `【プレースホルダー】AppSync経由のおみくじ結果: ${fortune}`,
    fortuneData: {
      fortune,
      stars: '★★★★☆',
      luckyColor: colors[Math.floor(Math.random() * colors.length)],
      luckyItem: items[Math.floor(Math.random() * items.length)],
      luckySpot: spots[Math.floor(Math.random() * spots.length)],
      timestamp: util.time.nowISO8601(),
    },
    sessionId: ctx.arguments.sessionId || `session-${util.autoId()}`,
  };
}
