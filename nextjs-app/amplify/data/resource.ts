import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

/**
 * Data Schema - おみくじエージェント
 * AppSync → HTTP Data Source → AgentCore Runtime 直接連携
 */
const schema = a.schema({
  // おみくじ結果データ型
  FortuneData: a.customType({
    fortune: a.string().required(),
    stars: a.string(),
    luckyColor: a.string(),
    luckyItem: a.string(),
    luckySpot: a.string(),
    timestamp: a.string(),
  }),

  // おみくじレスポンス型
  OmikujiResponse: a.customType({
    result: a.string().required(),
    fortuneData: a.ref('FortuneData'),
    sessionId: a.string(),
  }),

  // チャットレスポンス型
  ChatResponse: a.customType({
    response: a.string().required(),
    sessionId: a.string(),
  }),

  // おみくじ結果の履歴（永続化用）
  FortuneResult: a
    .model({
      userId: a.string(),
      fortune: a.string().required(),
      luckyColor: a.string(),
      luckyItem: a.string(),
      luckySpot: a.string(),
      message: a.string(),
      timestamp: a.datetime().required(),
      sessionId: a.string(),
    })
    .authorization((allow) => [
      allow.guest().to(['read', 'create']),
      allow.authenticated().to(['read', 'create', 'update', 'delete']),
    ]),

  // チャット履歴（永続化用）
  ChatMessage: a
    .model({
      userId: a.string(),
      message: a.string().required(),
      response: a.string().required(),
      sessionId: a.string().required(),
      timestamp: a.datetime().required(),
    })
    .authorization((allow) => [
      allow.guest().to(['read', 'create']),
      allow.authenticated().to(['read', 'create', 'update', 'delete']),
    ]),

  /**
   * おみくじを引く - AgentCore Runtime を直接呼び出し
   * Note: カスタムハンドラーはIAM認証のみサポート
   */
  drawOmikuji: a
    .query()
    .arguments({
      prompt: a.string().default('おみくじを引きたい'),
      sessionId: a.string(),
    })
    .returns(a.ref('OmikujiResponse'))
    .authorization((allow) => [
      allow.publicApiKey(),
    ])
    .handler(
      a.handler.custom({
        dataSource: 'AgentCoreHttpDataSource',
        entry: './resolvers/drawOmikuji.js',
      })
    ),

  /**
   * AIとチャット - AgentCore Runtime を直接呼び出し
   * Note: カスタムハンドラーはIAM認証のみサポート
   */
  chat: a
    .query()
    .arguments({
      message: a.string().required(),
      sessionId: a.string(),
    })
    .returns(a.ref('ChatResponse'))
    .authorization((allow) => [
      allow.publicApiKey(),
    ])
    .handler(
      a.handler.custom({
        dataSource: 'AgentCoreHttpDataSource',
        entry: './resolvers/chat.js',
      })
    ),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'apiKey',
    apiKeyAuthorizationMode: {
      expiresInDays: 365,
    },
  },
});
