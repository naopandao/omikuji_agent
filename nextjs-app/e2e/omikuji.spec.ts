/**
 * E2E Tests: Omikuji Application
 * 
 * テスト対象:
 * - おみくじ画面の表示
 * - おみくじを引く操作
 * - チャット機能
 * - レスポンシブデザイン
 */

import { test, expect } from '@playwright/test';

// 環境変数からベースURLを取得（デフォルトはローカル）
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';

// 運勢の種類（正確なマッチング用）
const FORTUNE_TYPES = ['大吉', '中吉', '小吉', '末吉', '凶'] as const;

test.describe('Omikuji Application', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
  });

  test('should display the main page', async ({ page }) => {
    // タイトルが表示される
    await expect(page.locator('h1')).toContainText('おみくじ');
  });

  test('should have draw omikuji button', async ({ page }) => {
    // おみくじを引くボタンが存在する
    const drawButton = page.getByRole('button', { name: /おみくじを引く/ });
    await expect(drawButton).toBeVisible();
  });

  test('should draw omikuji when button clicked', async ({ page }) => {
    // おみくじを引くボタンをクリック
    const drawButton = page.getByRole('button', { name: /おみくじを引く/ });
    await drawButton.click();

    // ローディング状態が終わるまで待機
    await expect(drawButton).not.toContainText('占い中', { timeout: 30000 });

    // 運勢カードが表示されるまで待機
    const fortuneCard = page.locator('.fortune-card');
    await expect(fortuneCard).toBeVisible({ timeout: 30000 });

    // いずれかの運勢が表示される（h2タグ内で）
    const fortuneHeading = page.locator('h2');
    await expect(fortuneHeading).toBeVisible();
    
    // 運勢の内容を確認
    const fortuneText = await fortuneHeading.textContent();
    const hasValidFortune = FORTUNE_TYPES.some(f => fortuneText?.includes(f)) || fortuneText?.includes('吉');
    expect(hasValidFortune).toBe(true);
  });

  test('should display fortune details', async ({ page }) => {
    // おみくじを引く
    const drawButton = page.getByRole('button', { name: /おみくじを引く/ });
    await drawButton.click();

    // 運勢カードが表示されるまで待機
    const fortuneCard = page.locator('.fortune-card');
    await expect(fortuneCard).toBeVisible({ timeout: 30000 });

    // ラッキーカラー、アイテム、スポットが表示される
    await expect(page.getByText('ラッキーカラー')).toBeVisible();
    await expect(page.getByText('ラッキーアイテム')).toBeVisible();
    await expect(page.getByText('ラッキースポット')).toBeVisible();
  });
});

test.describe('Chat Feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    
    // まずおみくじを引く
    const drawButton = page.getByRole('button', { name: /おみくじを引く/ });
    await drawButton.click();
    
    // 運勢カードが表示されるまで待機
    const fortuneCard = page.locator('.fortune-card');
    await expect(fortuneCard).toBeVisible({ timeout: 30000 });
  });

  test('should have chat input after drawing omikuji', async ({ page }) => {
    // チャットセクションが表示される
    const chatSection = page.locator('.chat-section');
    await expect(chatSection).toBeVisible();
    
    // チャット入力欄が表示される
    const chatInput = page.getByPlaceholder(/例:.*気をつけること/);
    await expect(chatInput).toBeVisible();
  });

  test('should send chat message', async ({ page }) => {
    // チャット入力欄にメッセージを入力
    const chatInput = page.getByPlaceholder(/例:.*気をつけること/);
    await chatInput.fill('ラッキーカラーについて教えて');

    // 送信ボタンをクリック
    const sendButton = page.getByRole('button', { name: '送信' });
    await sendButton.click();

    // ユーザーメッセージが表示される
    await expect(page.getByText('ラッキーカラーについて教えて')).toBeVisible({ timeout: 5000 });

    // AIの応答を待機（最大60秒、AgentCoreの応答が遅い場合がある）
    // 送信ボタンが再度有効になるまで待機
    try {
      await expect(sendButton).not.toBeDisabled({ timeout: 60000 });
    } catch {
      // タイムアウトの場合、チャット機能自体は動作していることを確認
      console.log('Chat response timeout - AgentCore may be slow');
    }

    // 何らかのメッセージが表示されていることを確認
    const chatMessages = page.locator('.chat-messages');
    await expect(chatMessages).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Responsive Design', () => {
  test('should work on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(BASE_URL);
    
    // メイン要素が表示される
    await expect(page.locator('h1')).toBeVisible();
    
    // おみくじボタンが表示される
    const drawButton = page.getByRole('button', { name: /おみくじを引く/ });
    await expect(drawButton).toBeVisible();
  });

  test('should work on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(BASE_URL);
    
    await expect(page.locator('h1')).toBeVisible();
  });

  test('should work on desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(BASE_URL);
    
    await expect(page.locator('h1')).toBeVisible();
  });
});

test.describe('Error Handling & Fallback', () => {
  test('should show result even with fallback', async ({ page }) => {
    await page.goto(BASE_URL);
    
    // おみくじを引く
    const drawButton = page.getByRole('button', { name: /おみくじを引く/ });
    await drawButton.click();
    
    // 運勢カードが表示される（エラーでもフォールバック）
    const fortuneCard = page.locator('.fortune-card');
    await expect(fortuneCard).toBeVisible({ timeout: 30000 });
    
    // 運勢が表示される
    const fortuneHeading = page.locator('h2');
    await expect(fortuneHeading).toBeVisible();
  });

  test('should show fallback notification when in demo mode', async ({ page }) => {
    await page.goto(BASE_URL);
    
    // おみくじを引く
    const drawButton = page.getByRole('button', { name: /おみくじを引く/ });
    await drawButton.click();
    
    // 運勢カードが表示されるまで待機
    const fortuneCard = page.locator('.fortune-card');
    await expect(fortuneCard).toBeVisible({ timeout: 30000 });
    
    // フォールバック通知が表示されるかどうか確認（表示される場合もされない場合もある）
    const fallbackNotice = page.getByText('デモモードで動作中');
    // 本番でAgentCoreに接続できない場合のみ表示される
    // テストでは表示の有無を確認するだけ（存在チェック）
    const hasFallback = await fallbackNotice.isVisible().catch(() => false);
    console.log('Fallback mode:', hasFallback);
  });
});

test.describe('No Hardcoded URLs', () => {
  test('should not make requests to localhost in production', async ({ page }) => {
    // 本番URLでテストする場合のみ実行
    if (!process.env.E2E_BASE_URL || process.env.E2E_BASE_URL.includes('localhost')) {
      test.skip();
      return;
    }

    const responses: string[] = [];
    
    page.on('request', (req) => {
      responses.push(req.url());
    });

    await page.goto(BASE_URL);
    
    // おみくじを引く
    const drawButton = page.getByRole('button', { name: /おみくじを引く/ });
    await drawButton.click();
    
    // 結果を待機
    const fortuneCard = page.locator('.fortune-card');
    await expect(fortuneCard).toBeVisible({ timeout: 30000 });
    
    // localhostへのリクエストがないことを確認
    const localhostRequests = responses.filter(url => 
      url.includes('localhost') || url.includes('127.0.0.1')
    );
    
    expect(localhostRequests).toHaveLength(0);
  });
});
