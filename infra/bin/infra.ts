#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { InfraStack } from '../lib/infra-stack';

const app = new cdk.App();

new InfraStack(app, 'OmikujiAgentInfraStack', {
  stackName: 'omikuji-agent-infra',
  description: 'Omikuji Agent Infrastructure - CodeBuild for AgentCore Runtime',
  
  // 東京リージョンにデプロイ
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'ap-northeast-1',
  },
  
  tags: {
    Project: 'omikuji-agent',
    Environment: 'production',
    ManagedBy: 'CDK',
  },
});
