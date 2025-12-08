import { defineFunction } from '@aws-amplify/backend';

/**
 * Bedrock AgentCore を呼び出す Lambda Function
 */
export const invokeAgentFunction = defineFunction({
  name: 'invoke-agent',
  entry: './handler.ts',
  environment: {
    AGENT_ID: 'my_agent-9NBXM54pmz',
    AGENT_ALIAS_ID: 'TSTALIASID',
    BEDROCK_REGION: 'ap-northeast-1',
  },
  timeoutSeconds: 60,
  memoryMB: 512,
});
