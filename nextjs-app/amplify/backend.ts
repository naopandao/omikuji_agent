import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource.js';
import { data } from './data/resource.js';
import { Stack } from 'aws-cdk-lib';
import { Policy, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { HttpDataSource, AuthorizationType } from 'aws-cdk-lib/aws-appsync';

/**
 * Amplify Gen2 Backend Definition
 * おみくじエージェント - AWS Bedrock AgentCore 直接連携（Lambda不要）
 * 
 * Architecture:
 * Next.js Frontend → AppSync GraphQL → HTTP Data Source → AgentCore Runtime
 */
const backend = defineBackend({
  auth,
  data,
});

// AgentCore Runtime の設定
const AGENTCORE_RUNTIME_ID = 'my_agent-9NBXM54pmz';
const AWS_REGION = 'ap-northeast-1';
const AWS_ACCOUNT_ID = '226484346947';
const AGENTCORE_RUNTIME_ARN = `arn:aws:bedrock-agentcore:${AWS_REGION}:${AWS_ACCOUNT_ID}:runtime/${AGENTCORE_RUNTIME_ID}`;
const AGENTCORE_ENDPOINT = `https://bedrock-agentcore.${AWS_REGION}.amazonaws.com`;

// AppSync API と Data Stack を取得
const dataStack = backend.data.resources.cfnResources.cfnGraphqlApi.stack as Stack;
const graphqlApi = backend.data.resources.graphqlApi;

// AgentCore Runtime 用の HTTP Data Source を追加
const agentCoreDataSource = new HttpDataSource(dataStack, 'AgentCoreHttpDataSource', {
  api: graphqlApi,
  name: 'AgentCoreHttpDataSource',
  endpoint: AGENTCORE_ENDPOINT,
  authorizationConfig: {
    signingRegion: AWS_REGION,
    signingServiceName: 'bedrock-agentcore',
  },
});

// AgentCore を呼び出す IAM Policy を Data Source のロールに付与
const agentCorePolicy = new PolicyStatement({
  actions: [
    'bedrock-agentcore:InvokeAgentRuntime',
    'bedrock-agentcore:InvokeAgent',
  ],
  resources: [
    AGENTCORE_RUNTIME_ARN,
    `${AGENTCORE_RUNTIME_ARN}/*`,
  ],
});

agentCoreDataSource.grantPrincipal.addToPrincipalPolicy(agentCorePolicy);

// Export for use in resolvers
export const agentCoreConfig = {
  runtimeId: AGENTCORE_RUNTIME_ID,
  region: AWS_REGION,
  accountId: AWS_ACCOUNT_ID,
  runtimeArn: AGENTCORE_RUNTIME_ARN,
  endpoint: AGENTCORE_ENDPOINT,
};

export default backend;
