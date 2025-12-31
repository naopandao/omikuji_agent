import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}));

// Mock environment variables for tests
process.env.AGENTCORE_RUNTIME_ARN = 'arn:aws:bedrock-agentcore:ap-northeast-1:123456789012:runtime/test-runtime';
process.env.AWS_REGION = 'ap-northeast-1';

