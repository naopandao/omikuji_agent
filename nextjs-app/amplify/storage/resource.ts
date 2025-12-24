import { defineStorage } from '@aws-amplify/backend';

/**
 * S3 Vector Store 設定
 * 
 * 用途:
 * - おみくじ履歴をEmbedding化して保存
 * - RAG検索で過去の履歴を参照
 * - 「過去に似た運勢の時どうだった？」に回答
 * 
 * TODO: 実装予定
 * 1. omikuji_agent.py で S3VectorSearchTool を追加
 * 2. おみくじ結果を Titan Embed でベクトル化
 * 3. S3 に保存してセマンティック検索
 */
export const storage = defineStorage({
  name: 'omikujiVectorStore',
  access: (allow) => ({
    // Embeddings データ（ベクトルインデックス）
    'embeddings/*': [
      allow.authenticated.to(['read', 'write']),
    ],
    // おみくじ履歴（メタデータ + ベクトル）
    'fortune-history/*': [
      allow.authenticated.to(['read', 'write']),
    ],
    // 統計データ（グラフ画像など）
    'statistics/*': [
      allow.authenticated.to(['read', 'write']),
      allow.guest.to(['read']),
    ],
  }),
});
