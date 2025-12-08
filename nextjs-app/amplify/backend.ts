import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { invokeAgentFunction } from './functions/invoke-agent/resource';
import { omikujiFunction } from './functions/omikuji/resource';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';

/**
 * Amplify Gen2 Backend Definition
 * おみくじエージェント - AWS Bedrock AgentCore 連携
 */
const backend = defineBackend({
  auth,
  data,
  invokeAgentFunction,
  omikujiFunction,
});

// Lambda Functions に Bedrock AgentCore の権限を付与
const bedrockPolicy = new PolicyStatement({
  actions: [
    'bedrock:InvokeAgent',
    'bedrock:InvokeFlow',
    'bedrock-agent-runtime:InvokeAgent',
    'bedrock-agent-runtime:InvokeFlow',
  ],
  resources: ['*'], // 本番環境では特定のAgentのARNを指定すること
});

backend.invokeAgentFunction.resources.lambda.addToRolePolicy(bedrockPolicy);
backend.omikujiFunction.resources.lambda.addToRolePolicy(bedrockPolicy);

export default backend;
