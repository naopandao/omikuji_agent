import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

/**
 * Data Schema - おみくじの履歴を保存
 */
const schema = a.schema({
  // おみくじ結果
  FortuneResult: a
    .model({
      userId: a.string(),
      fortune: a.string().required(), // 大吉、中吉など
      luckyColor: a.string(),
      luckyItem: a.string(),
      luckySpot: a.string(),
      message: a.string(),
      timestamp: a.datetime().required(),
      sessionId: a.string(),
    })
    .authorization((allow) => [
      allow.guest().to(['read', 'create']), // ゲストは読み書きOK
      allow.authenticated().to(['read', 'create', 'update', 'delete']), // ログインユーザーは全権限
    ]),

  // チャット履歴
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
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'iam', // IAM認証をデフォルトに
  },
});
