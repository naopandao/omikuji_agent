import * as cdk from 'aws-cdk-lib/core';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

/**
 * CodeBuild プロジェクト設定
 */
interface CodeBuildConfig {
  /** GitHub リポジトリ URL */
  githubRepo: string;
  /** ビルド対象ブランチ */
  branch: string;
  /** ECR リポジトリ名 */
  ecrRepoName: string;
  /** CodeBuild サービスロール ARN（既存ロールを使用する場合） */
  serviceRoleArn?: string;
}

/**
 * おみくじエージェント インフラストラクチャスタック
 * 
 * - CodeBuild プロジェクト（GitHub → ECR）
 * - ARM64 ビルド環境
 * - CloudWatch Logs
 */
export class InfraStack extends cdk.Stack {
  public readonly codeBuildProject: codebuild.Project;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 設定
    const config: CodeBuildConfig = {
      githubRepo: 'https://github.com/naopandao/omikuji_agent.git',
      branch: 'main',
      ecrRepoName: 'bedrock-agentcore-my_agent',
      // 既存のロールを使用（AgentCore SDK が作成したロール）
      serviceRoleArn: `arn:aws:iam::${this.account}:role/AmazonBedrockAgentCoreSDKCodeBuild-${this.region}-e72c1a7c7a`,
    };

    // CloudWatch Logs グループ
    const logGroup = new logs.LogGroup(this, 'CodeBuildLogGroup', {
      logGroupName: '/aws/codebuild/omikuji-agent-builder',
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // 既存の IAM ロールを参照
    const serviceRole = iam.Role.fromRoleArn(
      this,
      'CodeBuildServiceRole',
      config.serviceRoleArn!,
      { mutable: false }
    );

    // CodeBuild プロジェクト
    this.codeBuildProject = new codebuild.Project(this, 'OmikujiAgentBuilder', {
      projectName: 'omikuji-agent-builder',
      description: 'Build ARM64 container for AgentCore Runtime from GitHub',

      // GitHub ソース設定
      source: codebuild.Source.gitHub({
        owner: 'naopandao',
        repo: 'omikuji_agent',
        branchOrRef: config.branch,
        webhook: false, // 手動トリガー
      }),

      // ARM64 ビルド環境
      environment: {
        buildImage: codebuild.LinuxArmBuildImage.AMAZON_LINUX_2_STANDARD_3_0,
        computeType: codebuild.ComputeType.MEDIUM,
        privileged: true, // Docker ビルドに必要
        environmentVariables: {
          AWS_ACCOUNT_ID: {
            value: this.account,
          },
          AWS_DEFAULT_REGION: {
            value: this.region,
          },
          ECR_REPOSITORY_NAME: {
            value: config.ecrRepoName,
          },
        },
      },

      // buildspec.yml を使用
      buildSpec: codebuild.BuildSpec.fromSourceFilename('buildspec.yml'),

      // IAM ロール
      role: serviceRole,

      // ログ設定
      logging: {
        cloudWatch: {
          logGroup: logGroup,
          enabled: true,
        },
      },

      // タイムアウト
      timeout: cdk.Duration.minutes(60),
      queuedTimeout: cdk.Duration.minutes(480),
    });

    // タグを追加
    cdk.Tags.of(this.codeBuildProject).add('Project', 'omikuji-agent');
    cdk.Tags.of(this.codeBuildProject).add('ManagedBy', 'CDK');

    // Outputs
    new cdk.CfnOutput(this, 'CodeBuildProjectName', {
      value: this.codeBuildProject.projectName,
      description: 'CodeBuild project name',
      exportName: 'OmikujiAgentCodeBuildProjectName',
    });

    new cdk.CfnOutput(this, 'CodeBuildProjectArn', {
      value: this.codeBuildProject.projectArn,
      description: 'CodeBuild project ARN',
      exportName: 'OmikujiAgentCodeBuildProjectArn',
    });

    new cdk.CfnOutput(this, 'BuildCommand', {
      value: `aws codebuild start-build --project-name ${this.codeBuildProject.projectName}`,
      description: 'Command to start a build',
    });

    new cdk.CfnOutput(this, 'LogGroupName', {
      value: logGroup.logGroupName,
      description: 'CloudWatch Log Group for build logs',
    });
  }
}
