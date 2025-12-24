import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

/**
 * AppSync GraphQL Schema
 * 
 * 現在: Next.js API Route で AgentCore Runtime を呼び出し
 * 将来: AppSync HTTP Data Source で直接 AgentCore Runtime を呼び出し予定
 * 
 * TODO: AppSync HTTP Data Source 統合
 * - Custom Resolver で AgentCore Runtime を直接呼び出し
 * - Lambda 不要のサーバーレス構成
 */
const schema = a.schema({
  // おみくじ結果の型定義
  FortuneData: a.customType({
    fortune: a.string().required(),
    stars: a.string().required(),
    luckyColor: a.string().required(),
    luckyItem: a.string().required(),
    luckySpot: a.string().required(),
    timestamp: a.string().required(),
  }),

  // おみくじレスポンスの型定義
  OmikujiResponse: a.customType({
    result: a.string().required(),
    fortuneData: a.ref('FortuneData'),
    sessionId: a.string().required(),
  }),

  // チャットレスポンスの型定義
  ChatResponse: a.customType({
    message: a.string().required(),
    sessionId: a.string().required(),
    timestamp: a.string().required(),
  }),

  /**
   * おみくじを引く - AgentCore Runtime 呼び出し
   * 
   * 現在: API Route (/api/omikuji) を使用
   * 将来: HTTP Data Source で直接 AgentCore Runtime を呼び出し
   */
  drawOmikuji: a
    .query()
    .arguments({
      prompt: a.string().default('おみくじを引きたい'),
      sessionId: a.string(),
    })
    .returns(a.ref('OmikujiResponse'))
    .authorization((allow) => [allow.authenticated()])
    .handler(
      a.handler.custom({
        entry: './resolvers/drawOmikuji.js',
        dataSource: 'NONE', // TODO: AgentCore HTTP Data Source に変更
      })
    ),

  /**
   * AIとチャット - AgentCore Runtime 呼び出し
   * 
   * セッションIDを共有することで、おみくじ結果を踏まえた会話が可能
   */
  chat: a
    .query()
    .arguments({
      message: a.string().required(),
      sessionId: a.string().required(),
      fortuneContext: a.json(),
    })
    .returns(a.ref('ChatResponse'))
    .authorization((allow) => [allow.authenticated()])
    .handler(
      a.handler.custom({
        entry: './resolvers/chat.js',
        dataSource: 'NONE', // TODO: AgentCore HTTP Data Source に変更
      })
    ),

  /**
   * おみくじ履歴（将来実装）
   * S3 Vector Store に保存してRAG検索
   */
  // FortuneHistory: a.model({
  //   sessionId: a.string().required(),
  //   fortune: a.string().required(),
  //   message: a.string(),
  //   luckyColor: a.string(),
  //   luckyItem: a.string(),
  //   luckySpot: a.string(),
  //   embedding: a.json(), // Vector Embedding
  //   createdAt: a.datetime(),
  // }).authorization((allow) => [allow.owner()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
    // API Key も許可（開発時）
    apiKeyAuthorizationMode: {
      expiresInDays: 30,
    },
  },
});
