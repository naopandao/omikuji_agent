import { defineAuth } from '@aws-amplify/backend';

/**
 * Authentication Configuration
 * ゲストアクセスを許可（おみくじは誰でも引ける）
 */
export const auth = defineAuth({
  loginWith: {
    email: true, // メールアドレスでログイン可能
  },
  // ゲストアクセスを許可
  groups: ['guests'],
});
