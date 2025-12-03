#!/bin/bash

# Lambda関数デプロイスクリプト
# 2025年最新版

set -e

FUNCTION_NAME="omikuji-agent-lambda"
REGION="ap-northeast-1"
AGENT_ARN="arn:aws:bedrock-agentcore:ap-northeast-1:226484346947:runtime/my_agent-9NBXM54pmz"

echo "🚀 Lambda関数のデプロイを開始します..."

# 作業ディレクトリ
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="${SCRIPT_DIR}/build"

# クリーンアップ
echo "🧹 既存のビルドをクリーンアップ..."
rm -rf "${BUILD_DIR}"
mkdir -p "${BUILD_DIR}"

# Lambda関数コードをコピー
echo "📦 Lambda関数をパッケージング..."
cp "${SCRIPT_DIR}/lambda_function.py" "${BUILD_DIR}/"

# ZIPファイル作成
cd "${BUILD_DIR}"
zip -r ../lambda_package.zip .
cd ..

echo "✅ パッケージング完了: lambda_package.zip"

# Lambda関数の存在確認
echo "🔍 Lambda関数の存在を確認..."
if aws lambda get-function --function-name "${FUNCTION_NAME}" --region "${REGION}" > /dev/null 2>&1; then
    echo "📝 既存のLambda関数を更新します..."
    aws lambda update-function-code \
        --function-name "${FUNCTION_NAME}" \
        --zip-file fileb://lambda_package.zip \
        --region "${REGION}"
    
    # 環境変数の更新
    echo "🔧 環境変数を更新..."
    aws lambda update-function-configuration \
        --function-name "${FUNCTION_NAME}" \
        --environment "Variables={AGENT_ARN=${AGENT_ARN},AWS_REGION=${REGION}}" \
        --region "${REGION}"
else
    echo "🆕 新しいLambda関数を作成します..."
    
    # IAMロールの確認
    ROLE_ARN=$(aws iam get-role --role-name lambda-bedrock-execution-role --query 'Role.Arn' --output text 2>/dev/null || echo "")
    
    if [ -z "$ROLE_ARN" ]; then
        echo "⚠️  IAMロール 'lambda-bedrock-execution-role' が見つかりません"
        echo "以下のコマンドで作成してください："
        echo ""
        echo "aws iam create-role --role-name lambda-bedrock-execution-role \\"
        echo "  --assume-role-policy-document file://trust-policy.json"
        echo ""
        echo "aws iam attach-role-policy --role-name lambda-bedrock-execution-role \\"
        echo "  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
        echo ""
        echo "aws iam attach-role-policy --role-name lambda-bedrock-execution-role \\"
        echo "  --policy-arn arn:aws:iam::aws:policy/AmazonBedrockFullAccess"
        exit 1
    fi
    
    # Lambda関数作成
    aws lambda create-function \
        --function-name "${FUNCTION_NAME}" \
        --runtime python3.12 \
        --role "${ROLE_ARN}" \
        --handler lambda_function.lambda_handler \
        --zip-file fileb://lambda_package.zip \
        --timeout 30 \
        --memory-size 512 \
        --environment "Variables={AGENT_ARN=${AGENT_ARN},AWS_REGION=${REGION}}" \
        --region "${REGION}"
fi

echo ""
echo "✅ Lambda関数のデプロイが完了しました！"
echo ""
echo "📋 次のステップ："
echo "1. API Gatewayを作成"
echo "2. Lambda関数をAPI Gatewayに統合"
echo "3. CORSを設定"
echo "4. エンドポイントURLをHono APIに設定"
echo ""
