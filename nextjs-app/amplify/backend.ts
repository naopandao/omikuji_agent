import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { Policy, PolicyStatement } from 'aws-cdk-lib/aws-iam';

/**
 * Amplify Gen2 Backend 定義
 * 
 * アーキテクチャ:
 * - AppSync GraphQL API → AgentCore Runtime
 * - Cognito 認証
 * - S3 Vector Store（RAG用）
 */
const backend = defineBackend({
  auth,
  data,
  storage,
});

// AgentCore Runtime ARN（環境変数から取得）
const AGENTCORE_RUNTIME_ARN = process.env.AGENTCORE_RUNTIME_ARN || 
  'arn:aws:bedrock-agentcore:ap-northeast-1:226484346947:runtime/my_agent-9NBXM54pmz';
const AWS_REGION = process.env.AWS_REGION || 'ap-northeast-1';

// AgentCore Runtime 呼び出し権限をAppSync Data Roleに追加
const dataStack = backend.data.stack;

const agentCorePolicy = new Policy(dataStack, 'AgentCoreInvokePolicy', {
  statements: [
    new PolicyStatement({
      actions: [
        'bedrock-agentcore:InvokeAgentRuntime',
      ],
      resources: [
        AGENTCORE_RUNTIME_ARN,
        // ワイルドカードも許可（別のRuntimeを追加した場合のため）
        `arn:aws:bedrock-agentcore:${AWS_REGION}:*:runtime/*`,
      ],
    }),
    // Bedrock Claude モデル呼び出し権限（AgentCore Runtimeが使用）
    new PolicyStatement({
      actions: [
        'bedrock:InvokeModel',
        'bedrock:InvokeModelWithResponseStream',
      ],
      resources: [
        `arn:aws:bedrock:${AWS_REGION}::foundation-model/*`,
      ],
    }),
  ],
});

// AppSync の実行ロールにポリシーをアタッチ
// ※ 将来的にAppSync HTTP Data Sourceを使う場合に必要
// backend.data.resources.graphqlApi.grantPrincipal.addToPrincipalPolicy(agentCorePolicy);

// カスタム出力（フロントエンドで使用）
backend.addOutput({
  custom: {
    agentCoreRuntimeArn: AGENTCORE_RUNTIME_ARN,
    awsRegion: AWS_REGION,
  },
});

export { backend };
