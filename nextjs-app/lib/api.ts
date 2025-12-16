'use client';

import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';

// GraphQL クライアント - AppSync → AgentCore 直接連携
export const client = generateClient<Schema>();

// おみくじ API
export interface FortuneData {
  fortune: string;
  stars: string;
  luckyColor: string;
  luckyItem: string;
  luckySpot: string;
  timestamp: string;
}

export interface OmikujiResponse {
  result: string;
  fortune_data: FortuneData;
  sessionId: string;
}

/**
 * おみくじを引く - AppSync カスタムクエリ → AgentCore Runtime 直接呼び出し
 * Lambda不要！
 */
export async function fetchOmikuji(
  prompt?: string
): Promise<OmikujiResponse> {
  try {
    // AppSync の drawOmikuji クエリを呼び出し
    // これが HTTP Data Source 経由で AgentCore Runtime を直接呼び出す
    const { data, errors } = await client.queries.drawOmikuji({
      prompt: prompt || 'おみくじを引きたい！今日の運勢を占って！',
    });

    if (errors) {
      console.error('GraphQL errors:', errors);
      throw new Error(errors[0]?.message || 'おみくじの取得に失敗しました');
    }

    if (!data) {
      throw new Error('おみくじの取得に失敗しました');
    }

    // レスポンスを変換
    return {
      result: data.result,
      fortune_data: {
        fortune: data.fortuneData?.fortune || '吉',
        stars: data.fortuneData?.stars || '★★★☆☆',
        luckyColor: data.fortuneData?.luckyColor || '青',
        luckyItem: data.fortuneData?.luckyItem || 'お守り',
        luckySpot: data.fortuneData?.luckySpot || '神社',
        timestamp: data.fortuneData?.timestamp || new Date().toISOString(),
      },
      sessionId: data.sessionId || '',
    };
  } catch (error) {
    console.error('fetchOmikuji error:', error);
    throw error;
  }
}

// チャット API
export interface ChatMessage {
  message: string;
  sessionId?: string;
}

export interface ChatResponse {
  response: string;
  sessionId: string;
}

/**
 * AIとチャット - AppSync カスタムクエリ → AgentCore Runtime 直接呼び出し
 * Lambda不要！
 */
export async function sendChatMessage(
  message: string,
  sessionId?: string
): Promise<ChatResponse> {
  try {
    // AppSync の chat クエリを呼び出し
    const { data, errors } = await client.queries.chat({
      message,
      sessionId,
    });

    if (errors) {
      console.error('GraphQL errors:', errors);
      throw new Error(errors[0]?.message || 'メッセージの送信に失敗しました');
    }

    if (!data) {
      throw new Error('メッセージの送信に失敗しました');
    }

    return {
      response: data.response,
      sessionId: data.sessionId || '',
    };
  } catch (error) {
    console.error('sendChatMessage error:', error);
    throw error;
  }
}

// おみくじ履歴を保存
export async function saveFortuneResult(data: FortuneData, userId?: string) {
  try {
    await client.models.FortuneResult.create({
      userId: userId || 'guest',
      fortune: data.fortune,
      luckyColor: data.luckyColor,
      luckyItem: data.luckyItem,
      luckySpot: data.luckySpot,
      message: '',
      timestamp: data.timestamp,
      sessionId: `omikuji-${Date.now()}`,
    });
  } catch (error) {
    console.error('Failed to save fortune result:', error);
  }
}

// おみくじ履歴を取得
export async function getFortuneHistory(userId?: string) {
  try {
    const { data } = await client.models.FortuneResult.list({
      filter: {
        userId: {
          eq: userId || 'guest',
        },
      },
    });
    return data;
  } catch (error) {
    console.error('Failed to get fortune history:', error);
    return [];
  }
}
