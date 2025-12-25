'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  fetchOmikuji, 
  saveFortuneResult, 
  sendChatMessage, 
  getCurrentSessionId,
  type FortuneData, 
  type OmikujiResponse, 
  type ChatMessage 
} from '@/lib/api';

/**
 * おみくじアプリのメインページ
 * 
 * セッション管理設計:
 * - おみくじを引く → 新しい session_id を発行
 * - チャットする → 同じ session_id を使用（おみくじ結果を参照）
 * - 再度おみくじ → 新しい session_id を発行（新しい会話開始）
 */
export default function Home() {
  const [fortune, setFortune] = useState<FortuneData | null>(null);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  
  // 現在のセッションID（おみくじを引くと新しいIDが発行される）
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  /**
   * おみくじを引く
   * 毎回新しいセッションIDが発行される
   */
  const drawFortune = async () => {
    setLoading(true);
    setError(null);
    setChatMessages([]); // チャット履歴をリセット（新しいおみくじ = 新しい会話）

    try {
      // fetchOmikuji() が新しいセッションIDを発行・保存する
      const result: OmikujiResponse = await fetchOmikuji();
      
      setFortune(result.fortune_data);
      setAiMessage(result.result);
      setCurrentSessionId(result.sessionId);

      // ローカル履歴に保存
      await saveFortuneResult(result.fortune_data);
      
      console.log('[Page] New omikuji session:', result.sessionId);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'おみくじの取得に失敗しました'
      );
    } finally {
      setLoading(false);
    }
  };

  /**
   * チャットを送信
   * 現在のおみくじセッションIDを使用
   */
  const sendChat = async () => {
    if (!chatInput.trim() || !fortune) return;
    
    // セッションIDを確認
    const sessionId = currentSessionId || getCurrentSessionId();
    if (!sessionId) {
      console.warn('[Page] No session ID available for chat');
    }

    const userMessage: ChatMessage = {
      role: 'user',
      content: chatInput,
      timestamp: new Date().toISOString(),
    };

    // ユーザーメッセージを追加
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setChatLoading(true);

    try {
      // AIにメッセージ送信（同じセッションIDを使用）
      const response = await sendChatMessage(chatInput, fortune);
      
      const aiResponse: ChatMessage = {
        role: 'assistant',
        content: response.message,
        timestamp: response.timestamp,
      };

      // AIメッセージを追加
      setChatMessages(prev => [...prev, aiResponse]);
      
      console.log('[Page] Chat response received, session:', response.sessionId);
    } catch (err) {
      console.error('Failed to send chat:', err);
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'ごめんね、今ちょっと調子悪いみたい...もう一回試してみて！💦',
        timestamp: new Date().toISOString(),
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setChatLoading(false);
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

        {/* チャット機能 */}
        {fortune && (
          <div className="chat-section bg-white rounded-2xl shadow-xl p-6 mb-8">
            <h3 className="text-xl font-bold text-purple-600 mb-4 flex items-center gap-2">
              💬 AIと話してみる
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              おみくじの結果について、AIに質問してみよう！このおみくじの結果を覚えているよ✨
            </p>

            {/* チャット履歴 */}
            {chatMessages.length > 0 && (
              <div className="chat-messages space-y-3 mb-4 max-h-96 overflow-y-auto">
                {chatMessages.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                        msg.role === 'user'
                          ? 'bg-purple-500 text-white'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      <div className="prose prose-sm max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                      <div className={`text-xs mt-1 ${
                        msg.role === 'user' ? 'text-purple-200' : 'text-gray-500'
                      }`}>
                        {new Date(msg.timestamp).toLocaleTimeString('ja-JP')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* チャット入力 */}
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendChat();
                  }
                }}
                placeholder="例: この運勢で気をつけることは？"
                disabled={chatLoading}
                className="flex-1 px-4 py-3 border-2 border-purple-200 rounded-xl focus:outline-none focus:border-purple-400 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              <button
                onClick={sendChat}
                disabled={chatLoading || !chatInput.trim()}
                className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {chatLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="loading-spinner inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                  </span>
                ) : (
                  '送信'
                )}
              </button>
            </div>
          </div>
        )}

        {/* 説明 */}
        <div className="text-center text-sm text-gray-500 mt-12">
          <p>おみくじエージェント 💕</p>
          <p className="mt-1">
            Powered by Strands Agents + AgentCore Memory
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
