import { defineFunction } from '@aws-amplify/backend';

/**
 * おみくじ専用 Lambda Function
 */
export const omikujiFunction = defineFunction({
  name: 'omikuji',
  entry: './handler.ts',
  environment: {
    AGENT_ID: 'my_agent-9NBXM54pmz',
    AGENT_ALIAS_ID: 'TSTALIASID',
    BEDROCK_REGION: 'ap-northeast-1',
  },
  timeoutSeconds: 60,
  memoryMB: 512,
});
