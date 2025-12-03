#!/bin/bash

# CloudFormationスタックデプロイスクリプト
# Lambda + API Gateway 一括デプロイ（2025年最新版）

set -e

STACK_NAME="omikuji-agent-stack"
REGION="ap-northeast-1"
AGENT_ARN="arn:aws:bedrock-agentcore:ap-northeast-1:226484346947:runtime/my_agent-9NBXM54pmz"

echo "🚀 CloudFormationスタックのデプロイを開始します..."
echo ""
echo "📋 設定："
echo "  スタック名: ${STACK_NAME}"
echo "  リージョン: ${REGION}"
echo "  Agent ARN: ${AGENT_ARN}"
echo ""

# 作業ディレクトリ
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="${SCRIPT_DIR}/build"

# Lambda関数のパッケージング
echo "📦 Lambda関数をパッケージング..."
rm -rf "${BUILD_DIR}"
mkdir -p "${BUILD_DIR}"

cp "${SCRIPT_DIR}/lambda_function.py" "${BUILD_DIR}/"

cd "${BUILD_DIR}"
zip -r ../lambda_package.zip .
cd ..

echo "✅ パッケージング完了"

# S3バケットの確認（Lambda ZIPアップロード用）
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
BUCKET_NAME="omikuji-lambda-deployments-${ACCOUNT_ID}"

echo ""
echo "🪣 S3バケットを確認..."

if ! aws s3 ls "s3://${BUCKET_NAME}" > /dev/null 2>&1; then
    echo "📦 S3バケットを作成: ${BUCKET_NAME}"
    aws s3 mb "s3://${BUCKET_NAME}" --region "${REGION}"
else
    echo "✅ S3バケットが存在します: ${BUCKET_NAME}"
fi

# Lambda ZIPをS3にアップロード
echo ""
echo "⬆️  Lambda ZIPをS3にアップロード..."
aws s3 cp lambda_package.zip "s3://${BUCKET_NAME}/lambda_package.zip"

# CloudFormationテンプレートの更新（S3バケット参照）
echo ""
echo "📝 CloudFormationテンプレートを準備..."

cat > "${SCRIPT_DIR}/cf-deploy.yaml" <<EOF
AWSTemplateFormatVersion: '2010-09-09'
Description: 'Omikuji Agent - Lambda + API Gateway (2025最新版)'

Parameters:
  AgentArn:
    Type: String
    Default: '${AGENT_ARN}'
    Description: 'AWS Bedrock AgentCore ARN'
  
  LambdaS3Bucket:
    Type: String
    Default: '${BUCKET_NAME}'
    Description: 'S3 bucket containing Lambda deployment package'
  
  LambdaS3Key:
    Type: String
    Default: 'lambda_package.zip'
    Description: 'S3 key for Lambda deployment package'

Resources:
  # IAMロール
  LambdaExecutionRole:
    Type: AWS::IAM::Role
    Properties:
      RoleName: omikuji-lambda-execution-role-v2
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal:
              Service: lambda.amazonaws.com
            Action: sts:AssumeRole
      ManagedPolicyArns:
        - arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
        - arn:aws:iam::aws:policy/AmazonBedrockFullAccess
      Policies:
        - PolicyName: BedrockAgentCoreAccess
          PolicyDocument:
            Version: '2012-10-17'
            Statement:
              - Effect: Allow
                Action:
                  - bedrock:InvokeAgent
                  - bedrock-agent-runtime:InvokeAgent
                Resource: !Ref AgentArn

  # Lambda関数
  OmikujiLambdaFunction:
    Type: AWS::Lambda::Function
    Properties:
      FunctionName: omikuji-agent-lambda-v2
      Runtime: python3.12
      Handler: lambda_function.lambda_handler
      Role: !GetAtt LambdaExecutionRole.Arn
      Timeout: 30
      MemorySize: 512
      Environment:
        Variables:
          AGENT_ARN: !Ref AgentArn
          BEDROCK_REGION: !Ref AWS::Region
      Code:
        S3Bucket: !Ref LambdaS3Bucket
        S3Key: !Ref LambdaS3Key

  # CloudWatch Logs
  LambdaLogGroup:
    Type: AWS::Logs::LogGroup
    Properties:
      LogGroupName: !Sub '/aws/lambda/\${OmikujiLambdaFunction}'
      RetentionInDays: 7

  # HTTP API Gateway (最新版)
  HttpApi:
    Type: AWS::ApiGatewayV2::Api
    Properties:
      Name: omikuji-agent-api-v2
      Description: 'Omikuji Agent API Gateway'
      ProtocolType: HTTP
      CorsConfiguration:
        AllowOrigins:
          - '*'
        AllowMethods:
          - GET
          - POST
          - OPTIONS
        AllowHeaders:
          - Content-Type
          - Authorization
        MaxAge: 3600

  # Lambda統合
  LambdaIntegration:
    Type: AWS::ApiGatewayV2::Integration
    Properties:
      ApiId: !Ref HttpApi
      IntegrationType: AWS_PROXY
      IntegrationUri: !Sub 'arn:aws:apigateway:\${AWS::Region}:lambda:path/2015-03-31/functions/\${OmikujiLambdaFunction.Arn}/invocations'
      PayloadFormatVersion: '2.0'

  # ルート設定
  OmikujiRoute:
    Type: AWS::ApiGatewayV2::Route
    Properties:
      ApiId: !Ref HttpApi
      RouteKey: 'POST /api/omikuji'
      Target: !Sub 'integrations/\${LambdaIntegration}'

  ChatRoute:
    Type: AWS::ApiGatewayV2::Route
    Properties:
      ApiId: !Ref HttpApi
      RouteKey: 'POST /api/chat'
      Target: !Sub 'integrations/\${LambdaIntegration}'

  HealthRoute:
    Type: AWS::ApiGatewayV2::Route
    Properties:
      ApiId: !Ref HttpApi
      RouteKey: 'GET /api/health'
      Target: !Sub 'integrations/\${LambdaIntegration}'

  # デフォルトステージ
  DefaultStage:
    Type: AWS::ApiGatewayV2::Stage
    Properties:
      ApiId: !Ref HttpApi
      StageName: '\$default'
      AutoDeploy: true

  # Lambda権限
  LambdaInvokePermission:
    Type: AWS::Lambda::Permission
    Properties:
      FunctionName: !Ref OmikujiLambdaFunction
      Action: lambda:InvokeFunction
      Principal: apigateway.amazonaws.com
      SourceArn: !Sub 'arn:aws:execute-api:\${AWS::Region}:\${AWS::AccountId}:\${HttpApi}/*'

Outputs:
  ApiEndpoint:
    Description: 'API Gateway エンドポイントURL'
    Value: !Sub 'https://\${HttpApi}.execute-api.\${AWS::Region}.amazonaws.com'
    Export:
      Name: OmikujiApiEndpoint

  LambdaFunctionArn:
    Description: 'Lambda関数ARN'
    Value: !GetAtt OmikujiLambdaFunction.Arn

  ApiId:
    Description: 'API Gateway ID'
    Value: !Ref HttpApi
EOF

# CloudFormationスタックのデプロイ
echo ""
echo "☁️  CloudFormationスタックをデプロイ..."

aws cloudformation deploy \
    --template-file "${SCRIPT_DIR}/cf-deploy.yaml" \
    --stack-name "${STACK_NAME}" \
    --parameter-overrides \
        AgentArn="${AGENT_ARN}" \
        LambdaS3Bucket="${BUCKET_NAME}" \
        LambdaS3Key="lambda_package.zip" \
    --capabilities CAPABILITY_NAMED_IAM \
    --region "${REGION}"

# デプロイ結果の取得
echo ""
echo "📊 デプロイ結果を取得..."

API_ENDPOINT=$(aws cloudformation describe-stacks \
    --stack-name "${STACK_NAME}" \
    --region "${REGION}" \
    --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
    --output text)

LAMBDA_ARN=$(aws cloudformation describe-stacks \
    --stack-name "${STACK_NAME}" \
    --region "${REGION}" \
    --query 'Stacks[0].Outputs[?OutputKey==`LambdaFunctionArn`].OutputValue' \
    --output text)

echo ""
echo "✅ デプロイ完了！"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 デプロイ情報"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🌐 API Endpoint:"
echo "   ${API_ENDPOINT}"
echo ""
echo "🔗 エンドポイント URL："
echo "   おみくじ: ${API_ENDPOINT}/api/omikuji"
echo "   チャット: ${API_ENDPOINT}/api/chat"
echo "   ヘルス:   ${API_ENDPOINT}/api/health"
echo ""
echo "🔧 Lambda関数:"
echo "   ${LAMBDA_ARN}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 次のステップ："
echo "1. Hono APIのエンドポイントURLを更新"
echo "   src/index.tsx の API_ENDPOINT を ${API_ENDPOINT} に変更"
echo ""
echo "2. 動作確認:"
echo "   curl ${API_ENDPOINT}/api/health"
echo ""

# エンドポイント情報をファイルに保存
echo "${API_ENDPOINT}" > "${SCRIPT_DIR}/api-endpoint.txt"
echo "💾 API Endpoint URL を保存: api-endpoint.txt"
echo ""
