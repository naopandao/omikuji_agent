/**
 * AppSync JS Resolver - おみくじを引く
 * AgentCore Runtime を HTTP Data Source 経由で直接呼び出し
 */
import { util } from '@aws-appsync/utils';

// AgentCore Runtime の設定
const AGENT_RUNTIME_ID = 'my_agent-9NBXM54pmz';

/**
 * Request Handler - AgentCore Runtime API を呼び出す
 */
export function request(ctx) {
  const { prompt, sessionId } = ctx.args;
  
  // セッションIDが指定されていない場合は自動生成
  const runtimeSessionId = sessionId || `omikuji-${util.autoId()}`;
  
  // AgentCore Runtime のリクエストボディ
  const requestBody = {
    agentRuntimeId: AGENT_RUNTIME_ID,
    sessionId: runtimeSessionId,
    inputText: prompt || 'おみくじを引きたい！今日の運勢を教えて！',
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
  
  // AgentCore のレスポンスからおみくじ結果を抽出
  const agentResponse = body.outputText || body.completion || '';
  
  // おみくじ結果をパース（AIの応答から運勢情報を抽出）
  const fortuneData = parseFortuneFromResponse(agentResponse);
  
  return {
    result: agentResponse,
    fortuneData: fortuneData,
    sessionId: body.sessionId || ctx.args.sessionId,
  };
}

/**
 * AIの応答からおみくじデータを抽出するヘルパー関数
 */
function parseFortuneFromResponse(response) {
  // デフォルト値
  const fortuneData = {
    fortune: '吉',
    stars: '★★★☆☆',
    luckyColor: '青',
    luckyItem: 'お守り',
    luckySpot: '神社',
    timestamp: util.time.nowISO8601(),
  };
  
  // 運勢キーワードを検出
  const fortunePatterns = ['大吉', '中吉', '小吉', '吉', '末吉', '凶', '大凶'];
  for (const pattern of fortunePatterns) {
    if (response.includes(pattern)) {
      fortuneData.fortune = pattern;
      break;
    }
  }
  
  // ラッキーカラーを検出
  const colorMatch = response.match(/ラッキーカラー[：:は]?\s*([^\n,、]+)/);
  if (colorMatch) {
    fortuneData.luckyColor = colorMatch[1].trim();
  }
  
  // ラッキーアイテムを検出
  const itemMatch = response.match(/ラッキーアイテム[：:は]?\s*([^\n,、]+)/);
  if (itemMatch) {
    fortuneData.luckyItem = itemMatch[1].trim();
  }
  
  // ラッキースポットを検出
  const spotMatch = response.match(/ラッキースポット[：:は]?\s*([^\n,、]+)/);
  if (spotMatch) {
    fortuneData.luckySpot = spotMatch[1].trim();
  }
  
  return fortuneData;
}
