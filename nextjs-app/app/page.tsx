'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { fetchOmikuji, saveFortuneResult, type FortuneData, type OmikujiResponse } from '@/lib/api';

export default function Home() {
  const [fortune, setFortune] = useState<FortuneData | null>(null);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const drawFortune = async () => {
    setLoading(true);
    setError(null);

    try {
      const result: OmikujiResponse = await fetchOmikuji();
      setFortune(result.fortune_data);
      setAiMessage(result.result); // AIからのメッセージを保存

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

            {/* AIからのメッセージ（Markdownレンダリング） */}
            {aiMessage && (
              <div className="bg-gradient-to-r from-pink-50 to-purple-50 p-6 rounded-xl mb-6 border-2 border-pink-200 shadow-inner">
                <div className="prose prose-pink max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      // 見出しスタイル
                      h1: ({ children }) => (
                        <h1 className="text-2xl font-bold text-purple-600 mb-3 pb-2 border-b-2 border-purple-200">
                          {children}
                        </h1>
                      ),
                      h2: ({ children }) => (
                        <h2 className="text-xl font-bold text-pink-600 mb-2 mt-4">
                          {children}
                        </h2>
                      ),
                      h3: ({ children }) => (
                        <h3 className="text-lg font-semibold text-purple-500 mb-2 mt-3">
                          {children}
                        </h3>
                      ),
                      // 段落スタイル
                      p: ({ children }) => (
                        <p className="text-gray-700 leading-relaxed mb-3 text-base">
                          {children}
                        </p>
                      ),
                      // 強調スタイル
                      strong: ({ children }) => (
                        <strong className="font-bold text-purple-600 bg-purple-100 px-1 rounded">
                          {children}
                        </strong>
                      ),
                      em: ({ children }) => (
                        <em className="text-pink-600 not-italic font-medium">
                          {children}
                        </em>
                      ),
                      // リストスタイル
                      ul: ({ children }) => (
                        <ul className="list-none space-y-2 my-3 pl-2">
                          {children}
                        </ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="list-decimal list-inside space-y-2 my-3 pl-2 text-gray-700">
                          {children}
                        </ol>
                      ),
                      li: ({ children }) => (
                        <li className="flex items-start gap-2 text-gray-700">
                          <span className="text-pink-400 mt-1">💫</span>
                          <span>{children}</span>
                        </li>
                      ),
                      // コードブロックスタイル
                      code: ({ children }) => (
                        <code className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-sm font-mono">
                          {children}
                        </code>
                      ),
                      // 引用スタイル
                      blockquote: ({ children }) => (
                        <blockquote className="border-l-4 border-pink-300 pl-4 my-3 italic text-gray-600 bg-pink-50 py-2 rounded-r">
                          {children}
                        </blockquote>
                      ),
                      // 水平線
                      hr: () => (
                        <hr className="my-4 border-t-2 border-purple-200" />
                      ),
                    }}
                  >
                    {aiMessage}
                  </ReactMarkdown>
                </div>
              </div>
            )}

            {/* ラッキー情報カード */}
            <div className="grid grid-cols-3 gap-3 mt-6">
              <div className="lucky-card bg-gradient-to-br from-pink-100 to-pink-50 p-4 rounded-xl text-center border border-pink-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-3xl mb-2">🎨</div>
                <p className="text-xs text-gray-500 mb-1">カラー</p>
                <p className="text-sm font-bold text-pink-600">
                  {fortune.luckyColor}
                </p>
              </div>

              <div className="lucky-card bg-gradient-to-br from-purple-100 to-purple-50 p-4 rounded-xl text-center border border-purple-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-3xl mb-2">✨</div>
                <p className="text-xs text-gray-500 mb-1">アイテム</p>
                <p className="text-sm font-bold text-purple-600">
                  {fortune.luckyItem}
                </p>
              </div>

              <div className="lucky-card bg-gradient-to-br from-blue-100 to-blue-50 p-4 rounded-xl text-center border border-blue-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-3xl mb-2">📍</div>
                <p className="text-xs text-gray-500 mb-1">スポット</p>
                <p className="text-sm font-bold text-blue-600">
                  {fortune.luckySpot}
                </p>
              </div>
            </div>

            <div className="mt-6 text-center text-xs text-gray-400">
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
