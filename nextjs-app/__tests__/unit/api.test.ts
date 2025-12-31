/**
 * Unit Tests: lib/api.ts
 * 
 * テスト対象:
 * - セッションID生成
 * - セッション管理関数
 * - フォールバック動作
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  generateNewSessionId, 
  getCurrentSessionId, 
  saveSessionId, 
  clearSession 
} from '@/lib/api';

// Mock sessionStorage
const sessionStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(global, 'sessionStorage', {
  value: sessionStorageMock,
});

// Mock crypto.randomUUID
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: vi.fn(() => 'a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6'),
  },
});

describe('Session ID Generation', () => {
  it('generates session ID with correct format', () => {
    const sessionId = generateNewSessionId();
    
    // セッションIDは omikuji- で始まる
    expect(sessionId).toMatch(/^omikuji-/);
    
    // 最低33文字（AgentCore Runtime要件）
    expect(sessionId.length).toBeGreaterThanOrEqual(33);
  });

  it('generates unique session IDs', () => {
    const ids = new Set<string>();
    
    // 異なるタイムスタンプをシミュレート
    for (let i = 0; i < 10; i++) {
      vi.spyOn(Date.prototype, 'toISOString').mockReturnValue(
        `2025-01-0${i}T12:00:00.000Z`
      );
      ids.add(generateNewSessionId());
    }
    
    // 全て異なるIDが生成される
    expect(ids.size).toBe(10);
  });
});

describe('Session Storage Management', () => {
  beforeEach(() => {
    sessionStorageMock.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('saves and retrieves session ID', () => {
    const testSessionId = 'test-session-12345678901234567890';
    
    saveSessionId(testSessionId);
    expect(sessionStorageMock.setItem).toHaveBeenCalledWith(
      'current_omikuji_session_id',
      testSessionId
    );
    
    sessionStorageMock.getItem.mockReturnValue(testSessionId);
    const retrieved = getCurrentSessionId();
    expect(retrieved).toBe(testSessionId);
  });

  it('clears session correctly', () => {
    saveSessionId('some-session-id-123456789012345');
    clearSession();
    
    expect(sessionStorageMock.removeItem).toHaveBeenCalledWith(
      'current_omikuji_session_id'
    );
  });

  it('returns null when no session exists', () => {
    sessionStorageMock.getItem.mockReturnValue(null);
    const sessionId = getCurrentSessionId();
    expect(sessionId).toBeNull();
  });
});

describe('Environment Variables', () => {
  it('uses environment variables for configuration', () => {
    // vitest.setup.ts で設定されている
    expect(process.env.AGENTCORE_RUNTIME_ARN).toBeDefined();
    expect(process.env.AWS_REGION).toBe('ap-northeast-1');
  });

  it('ARN follows correct format', () => {
    const arn = process.env.AGENTCORE_RUNTIME_ARN!;
    // ARNの形式: arn:aws:bedrock-agentcore:region:account:runtime/name
    expect(arn).toMatch(/^arn:aws:bedrock-agentcore:[a-z0-9-]+:\d+:runtime\/.+$/);
  });
});

