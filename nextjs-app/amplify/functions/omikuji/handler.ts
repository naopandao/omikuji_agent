import {
  BedrockAgentRuntimeClient,
  InvokeAgentCommand,
} from '@aws-sdk/client-bedrock-agent-runtime';
import type { Handler } from 'aws-lambda';

/**
 * おみくじ専用 Lambda Handler
 * AgentCore を使ってパーソナライズされたおみくじを生成
 */

const AGENT_ID = process.env.AGENT_ID || '';
const AGENT_ALIAS_ID = process.env.AGENT_ALIAS_ID || 'TSTALIASID';
const BEDROCK_REGION = process.env.BEDROCK_REGION || 'ap-northeast-1';

const bedrockClient = new BedrockAgentRuntimeClient({
  region: BEDROCK_REGION,
});

interface OmikujiRequest {
  userId?: string;
  sessionId?: string;
}

interface FortuneData {
  fortune: string;
  stars: string;
  luckyColor: string;
  luckyItem: string;
  luckySpot: string;
  timestamp: string;
}

interface OmikujiResponse {
  result: string;
  fortune_data: FortuneData;
  sessionId: string;
}

export const handler: Handler<OmikujiRequest, OmikujiResponse> = async (
  event
) => {
  console.log('[Omikuji] Event:', JSON.stringify(event, null, 2));

  const {
    userId = 'guest',
    sessionId = `omikuji-${Date.now()}`,
  } = event;

  try {
    console.log(
      `[Omikuji] Generating fortune for user ${userId}, session ${sessionId}`
    );

    // AgentCore にお願いする
    const prompt = `おみくじを引きたいです！今日の運勢を教えてください。ユーザーID: ${userId}`;

    const command = new InvokeAgentCommand({
      agentId: AGENT_ID,
      agentAliasId: AGENT_ALIAS_ID,
      sessionId: sessionId,
      inputText: prompt,
      enableTrace: true,
      endSession: false,
    });

    const response = await bedrockClient.send(command);
    const eventStream = response.completion;

    let fullResponse = '';

    if (eventStream) {
      for await (const event of eventStream) {
        if (event.chunk && event.chunk.bytes) {
          const chunkText = new TextDecoder().decode(event.chunk.bytes);
          fullResponse += chunkText;
        }
      }
    }

    console.log('[Omikuji] Agent response:', fullResponse);

    // レスポンスをパースして構造化データに変換
    let fortuneData: FortuneData;

    try {
      // AgentCore からの JSON レスポンスをパース
      const parsed = JSON.parse(fullResponse);
      fortuneData = parsed.fortune_data || generateFallbackFortune();
    } catch (parseError) {
      console.log('[Omikuji] Failed to parse response, using fallback');
      fortuneData = generateFallbackFortune();
    }

    return {
      result: JSON.stringify({
        role: 'assistant',
        content: [
          {
            text: formatFortuneMessage(fortuneData),
          },
        ],
      }),
      fortune_data: fortuneData,
      sessionId: sessionId,
    };
  } catch (error) {
    console.error('[Omikuji] Error:', error);

    // エラー時はフォールバック
    const fortuneData = generateFallbackFortune();
    return {
      result: JSON.stringify({
        role: 'assistant',
        content: [
          {
            text: formatFortuneMessage(fortuneData),
          },
        ],
      }),
      fortune_data: fortuneData,
      sessionId: sessionId,
    };
  }
};

/**
 * フォールバック用のランダムおみくじ生成
 */
function generateFallbackFortune(): FortuneData {
  const fortuneTypes = ['大吉', '中吉', '小吉', '吉', '末吉', '凶'];
  const colors = ['赤', '青', '黄色', '緑', '紫', 'ピンク', 'オレンジ', '白'];
  const items = [
    'スマホ',
    'ペン',
    '本',
    'お菓子',
    '音楽',
    'コーヒー',
    '友達',
    '鏡',
  ];
  const spots = [
    'カフェ',
    '公園',
    '書店',
    '映画館',
    '駅',
    '図書館',
    '美術館',
    'ショッピングモール',
  ];

  const fortune =
    fortuneTypes[Math.floor(Math.random() * fortuneTypes.length)];
  const luckyColor = colors[Math.floor(Math.random() * colors.length)];
  const luckyItem = items[Math.floor(Math.random() * items.length)];
  const luckySpot = spots[Math.floor(Math.random() * spots.length)];

  const scoreMap: Record<string, number> = {
    大吉: 5,
    中吉: 4,
    小吉: 3,
    吉: 3,
    末吉: 2,
    凶: 1,
  };
  const score = scoreMap[fortune] || 3;
  const stars = '★'.repeat(score) + '☆'.repeat(5 - score);

  return {
    fortune,
    stars,
    luckyColor,
    luckyItem,
    luckySpot,
    timestamp: new Date().toISOString(),
  };
}

/**
 * おみくじメッセージのフォーマット
 */
function formatFortuneMessage(data: FortuneData): string {
  const comments: Record<string, string> = {
    大吉: '超ラッキー！今日は最高の日になりそう！😍💕',
    中吉: 'いい感じじゃん！順調な1日になりそう！😊✨',
    小吉: 'まあまあいい感じだね～小さな幸せ見つけられそう🌸',
    吉: '普通にいい日だよ！安定感バッチリ✨',
    末吉: 'ちょっと地味だけど悪くないよ！🍀',
    凶: '今日は少し気をつけてね💦でも大丈夫！',
  };

  const comment = comments[data.fortune] || '';

  return `やば～！おみくじ出たよ～！✨

今日は【${data.fortune}】だって！${comment}

ラッキーカラーは${data.luckyColor}だよ～🎨
${data.luckyColor}系のもの身につけるといいかも💕

ラッキーアイテムは${data.luckyItem}！
${data.luckyItem}を大事にしてね✨

ラッキースポットは${data.luckySpot}！
${data.luckySpot}に行くといいことあるよ～📍💕`;
}
