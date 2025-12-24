import { defineAuth } from '@aws-amplify/backend';

/**
 * Cognito 認証設定
 * 
 * TODO: 本番環境では以下を検討
 * - ソーシャルログイン（Google, Apple）
 * - MFA設定
 * - パスワードポリシーのカスタマイズ
 */
export const auth = defineAuth({
  loginWith: {
    email: true,
  },
  // ユーザー属性（オプション）
  userAttributes: {
    preferredUsername: {
      required: false,
      mutable: true,
    },
  },
});
