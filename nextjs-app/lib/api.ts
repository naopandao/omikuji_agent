'use client';

import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';

// GraphQL クライアント
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

export async function fetchOmikuji(
  userId?: string
): Promise<OmikujiResponse> {
  // Lambda Function を呼び出す（Amplify Gen2 の invoke API を使用）
  const response = await fetch('/api/omikuji', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userId: userId || 'guest',
    }),
  });

  if (!response.ok) {
    throw new Error('おみくじの取得に失敗しました');
  }

  return response.json();
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

export async function sendChatMessage(
  message: string,
  sessionId?: string
): Promise<ChatResponse> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      sessionId,
    }),
  });

  if (!response.ok) {
    throw new Error('メッセージの送信に失敗しました');
  }

  return response.json();
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
