'use client';

import { useState } from 'react';
import { fetchOmikuji, saveFortuneResult, type FortuneData } from '@/lib/api';

export default function Home() {
  const [fortune, setFortune] = useState<FortuneData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const drawFortune = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await fetchOmikuji();
      setFortune(result.fortune_data);

      // 履歴に保存
      await saveFortuneResult(result.fortune_data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'おみくじの取得に失敗しました'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 p-4">
      <div className="max-w-2xl mx-auto py-12">
        {/* ヘッダー */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-purple-600 mb-2">
            ✨ おみくじエージェント ✨
          </h1>
          <p className="text-gray-600">
            AIがあなたの今日の運勢を占います！
          </p>
        </div>

        {/* おみくじボタン */}
        <div className="text-center mb-8">
          <button
            onClick={drawFortune}
            disabled={loading}
            className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-12 py-4 rounded-full text-xl font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="loading-spinner inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full"></span>
                占い中...
              </span>
            ) : (
              '🎴 おみくじを引く'
            )}
          </button>
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-8">
            {error}
          </div>
        )}

        {/* おみくじ結果 */}
        {fortune && (
          <div className="fortune-card bg-white rounded-2xl shadow-xl p-8 mb-8">
            <div className="text-center mb-6">
              <div className="text-6xl mb-4">{getFortuneEmoji(fortune.fortune)}</div>
              <h2 className="text-3xl font-bold text-purple-600 mb-2">
                {fortune.fortune}
              </h2>
              <div className="text-2xl text-yellow-500">{fortune.stars}</div>
            </div>

            <div className="space-y-4">
              <div className="bg-pink-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">ラッキーカラー</p>
                <p className="text-xl font-bold text-pink-600">
                  🎨 {fortune.luckyColor}
                </p>
              </div>

              <div className="bg-purple-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">ラッキーアイテム</p>
                <p className="text-xl font-bold text-purple-600">
                  ✨ {fortune.luckyItem}
                </p>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">ラッキースポット</p>
                <p className="text-xl font-bold text-blue-600">
                  📍 {fortune.luckySpot}
                </p>
              </div>
            </div>

            <div className="mt-6 text-center text-sm text-gray-500">
              {new Date(fortune.timestamp).toLocaleString('ja-JP')}
            </div>
          </div>
        )}

        {/* 説明 */}
        <div className="text-center text-sm text-gray-500 mt-12">
          <p>おみくじエージェント 💕</p>
          <p className="mt-1">
            Next.js + TypeScript
          </p>
        </div>
      </div>
    </main>
  );
}

function getFortuneEmoji(fortune: string): string {
  const emojiMap: Record<string, string> = {
    大吉: '🌟',
    中吉: '✨',
    小吉: '🌸',
    吉: '🍀',
    末吉: '🌿',
    凶: '☁️',
  };
  return emojiMap[fortune] || '🎴';
}
