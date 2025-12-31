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
    const drawButton = page.getByRole('button', { name: /おみくじ|引く|draw/i });
    await expect(drawButton).toBeVisible();
  });

  test('should draw omikuji when button clicked', async ({ page }) => {
    // おみくじを引くボタンをクリック
    const drawButton = page.getByRole('button', { name: /おみくじ|引く|draw/i });
    await drawButton.click();

    // 結果が表示されるまで待機
    await expect(page.locator('text=大吉').or(page.locator('text=中吉')).or(page.locator('text=小吉')).or(page.locator('text=吉')).or(page.locator('text=末吉')).or(page.locator('text=凶'))).toBeVisible({ timeout: 30000 });
  });

  test('should display fortune details', async ({ page }) => {
    // おみくじを引く
    const drawButton = page.getByRole('button', { name: /おみくじ|引く|draw/i });
    await drawButton.click();

    // 結果を待機
    await page.waitForTimeout(5000);

    // ラッキーアイテムが表示される（フォールバックでも表示される）
    const hasLucky = await page.locator('text=/ラッキー|カラー|アイテム|スポット/').isVisible();
    expect(hasLucky).toBe(true);
  });
});

test.describe('Chat Feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    
    // まずおみくじを引く
    const drawButton = page.getByRole('button', { name: /おみくじ|引く|draw/i });
    await drawButton.click();
    await page.waitForTimeout(5000);
  });

  test('should have chat input after drawing omikuji', async ({ page }) => {
    // チャット入力欄が表示される
    const chatInput = page.getByPlaceholder(/メッセージ|質問|chat/i);
    await expect(chatInput).toBeVisible();
  });

  test('should send chat message', async ({ page }) => {
    // チャット入力欄にメッセージを入力
    const chatInput = page.getByPlaceholder(/メッセージ|質問|chat/i);
    await chatInput.fill('ラッキーカラーについて教えて');

    // 送信ボタンをクリック
    const sendButton = page.getByRole('button', { name: /送信|send/i });
    await sendButton.click();

    // 応答を待機
    await page.waitForTimeout(10000);

    // 何らかのメッセージが表示される
    const messages = page.locator('[class*="message"], [class*="chat"]');
    const count = await messages.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe('Responsive Design', () => {
  test('should work on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(BASE_URL);
    
    // メイン要素が表示される
    await expect(page.locator('h1')).toBeVisible();
    
    // おみくじボタンが表示される
    const drawButton = page.getByRole('button', { name: /おみくじ|引く|draw/i });
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

test.describe('Error Handling', () => {
  test('should show fallback message on error', async ({ page }) => {
    await page.goto(BASE_URL);
    
    // おみくじを引く（フォールバックでも結果は表示される）
    const drawButton = page.getByRole('button', { name: /おみくじ|引く|draw/i });
    await drawButton.click();
    
    await page.waitForTimeout(10000);
    
    // 何らかの結果が表示される（エラーでもフォールバック）
    const hasResult = await page.locator('text=/大吉|中吉|小吉|吉|末吉|凶|エラー|もう一回/').isVisible();
    expect(hasResult).toBe(true);
  });
});

test.describe('No Hardcoded URLs', () => {
  test('should not make requests to localhost in production', async ({ page, request }) => {
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
    
    // localhostへのリクエストがないことを確認
    const localhostRequests = responses.filter(url => 
      url.includes('localhost') || url.includes('127.0.0.1')
    );
    
    expect(localhostRequests).toHaveLength(0);
  });
});

