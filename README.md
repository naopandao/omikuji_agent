# AI おみくじエージェント 🎴✨

AWS Bedrock AgentCore Runtime を使ったAI占いアプリケーション

## 概要

ユーザーがおみくじを引くと、AIが運勢を占い、フレンドリーなギャル語風メッセージでラッキーアイテムやスポットをお知らせします。Memory機能により過去の履歴を記憶し、パーソナライズされたアドバイスを提供します。

## アーキテクチャ

### 推奨構成: Amplify Gen2 + AppSync + AgentCore Runtime（Lambda不要）

Amplify Gen2 の **HTTP Data Source** を使って、AppSync から AgentCore Runtime の `InvokeAgentRuntime` API を直接呼び出します。**Lambda不要**でシンプルかつ高速な構成です。

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AWS Cloud                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                          ap-northeast-1                                 │ │
│  │                                                                         │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │ │
│  │  │                    Amplify Gen2                                  │   │ │
│  │  │  ┌─────────────┐    ┌─────────────┐    ┌──────────────────────┐ │   │ │
│  │  │  │  Next.js    │    │  AppSync    │    │  HTTP Data Source    │ │   │ │
│  │  │  │  Frontend   │───▶│  GraphQL    │───▶│  (AgentCore Runtime) │ │   │ │
│  │  │  │             │    │  API        │    │                      │ │   │ │
│  │  │  └─────────────┘    └─────────────┘    └──────────┬───────────┘ │   │ │
│  │  │        │                   │                       │             │   │ │
│  │  │        │           ┌───────┴───────┐               │             │   │ │
│  │  │        │           │   DynamoDB    │               │             │   │ │
│  │  │        │           │  (履歴保存)   │  ┌────────────┘             │   │ │
│  │  │        │           └───────────────┘  │ InvokeAgentRuntime       │   │ │
│  │  └────────┼──────────────────────────────┼──────────────────────────┘   │ │
│  │           │                              ▼                              │ │
│  │  ┌────────┴───────┐        ┌────────────────────────────────────────┐   │ │
│  │  │  Cognito       │        │   Bedrock AgentCore Runtime            │   │ │
│  │  │  User Pool     │        │   ┌──────────────────────────────────┐ │   │ │
│  │  │  (認証)        │        │   │  omikuji_agent.py                │ │   │ │
│  │  └────────────────┘        │   │  (ECR Container / Direct Code)   │ │   │ │
│  │                            │   │  Python 3.10-3.13                │ │   │ │
│  │                            │   └──────────────────────────────────┘ │   │ │
│  │                            │              │                         │   │ │
│  │                            │   ┌──────────┴───────────┐             │   │ │
│  │                            │   │                      │             │   │ │
│  │                            │   ▼                      ▼             │   │ │
│  │                            │ ┌────────────┐ ┌─────────────────────┐ │   │ │
│  │                            │ │  Memory    │ │  Code Interpreter   │ │   │ │
│  │                            │ │ (会話履歴) │ │  (統計・グラフ)     │ │   │ │
│  │                            │ └────────────┘ └─────────────────────┘ │   │ │
│  │                            │              │                         │   │ │
│  │                            │              ▼                         │   │ │
│  │                            │   ┌──────────────────────┐             │   │ │
│  │                            │   │   Bedrock Claude     │             │   │ │
│  │                            │   │   (Haiku 3 / Sonnet) │             │   │ │
│  │                            │   └──────────────────────┘             │   │ │
│  │                            └────────────────────────────────────────┘   │ │
│  │                                                                         │ │
│  │  ┌─────────────────┐                         ┌─────────────────────┐   │ │
│  │  │  CloudWatch     │                         │  CloudWatch GenAI   │   │ │
│  │  │  Logs           │                         │  Dashboard          │   │ │
│  │  └─────────────────┘                         └─────────────────────┘   │ │
│  │                                                                         │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘

        ┌────────────┐
        │   Client   │
        │  (Browser) │
        └─────┬──────┘
              │ HTTPS
              ▼
```

### 構成の比較

| 構成 | Lambda | API Gateway | 複雑さ | レスポンス速度 |
|------|--------|-------------|--------|----------------|
| **Amplify Gen2 + AppSync + AgentCore（推奨）** | ❌ 不要 | ❌ 不要 | 🟢 シンプル | 🚀 高速 |
| API Gateway + AgentCore | ❌ 不要 | ✅ 必要 | 🟡 中程度 | 🚀 高速 |
| Lambda 経由（従来） | ✅ 必要 | ✅ 必要 | 🔴 複雑 | ⏱️ 遅い |

## AgentCore Runtime とは

**Amazon Bedrock AgentCore Runtime** は、AIエージェントをデプロイ・実行するためのフルマネージドサーバーレス環境です。

### 主な特徴

- **サーバーレス**: インフラ管理不要、コンテナを直接ホスト
- **低レイテンシ**: コールドスタートなし
- **直接HTTP呼び出し**: `InvokeAgentRuntime` APIでエンドポイントを直接叩ける
- **セッション分離**: ユーザーごとにマイクロVMで完全分離
- **最大8時間実行**: 長時間のエージェント処理に対応
- **100MBペイロード**: マルチモーダル（テキスト・画像・音声）対応
- **マルチフレームワーク対応**: Strands, LangChain, LangGraph, CrewAI など

### デプロイ方法

AgentCore Runtime には2つのデプロイ方法があります：

#### 1. Direct Code Deployment（推奨・軽量）

```bash
# AgentCore Starter Toolkit をインストール
pip install bedrock-agentcore-starter-toolkit

# エージェントを設定
agentcore configure --entrypoint omikuji_agent.py --name omikuji-agent

# デプロイ（zipファイルをS3にアップロード）
agentcore deploy
```

- Dockerファイル不要
- zipファイル（最大250MB）をS3にアップロード
- Python 3.10-3.13 対応
- 迅速なイテレーション向き

#### 2. Container Deployment（ECR）

```bash
# Dockerイメージをビルド（ARM64）
docker build --platform linux/arm64 -t omikuji-agent .

# ECRにプッシュ
aws ecr get-login-password | docker login --username AWS --password-stdin $ECR_URI
docker tag omikuji-agent:latest $ECR_URI/omikuji-agent:latest
docker push $ECR_URI/omikuji-agent:latest

# AgentCore Runtimeにデプロイ
agentcore configure --entrypoint main.py --name omikuji-agent --deployment-type container
agentcore deploy
```

- カスタム依存関係が必要な場合
- 最大2GBのパッケージサイズ
- 多言語対応（Python以外も可）

### InvokeAgentRuntime API

デプロイ後、以下のAPIでエージェントを直接呼び出せます（Lambda不要）：

```
POST /runtimes/{agentRuntimeArn}/invocations

Headers:
  Content-Type: application/json
  X-Amzn-Bedrock-AgentCore-Runtime-Session-Id: {sessionId}

Body:
  {
    "prompt": "おみくじを引きたい！"
  }
```

**Python (boto3) での呼び出し例：**

```python
import boto3
import json

client = boto3.client('bedrock-agentcore', region_name='ap-northeast-1')

response = client.invoke_agent_runtime(
    agentRuntimeArn='arn:aws:bedrock-agentcore:ap-northeast-1:123456789012:runtime/omikuji-agent',
    runtimeSessionId='user-session-123',
    payload=json.dumps({'prompt': 'おみくじを引いて！'}).encode('utf-8')
)

# ストリーミングレスポンス読み取り
for chunk in response['response']:
    print(chunk.decode('utf-8'))
```

## 技術スタック

### バックエンド（AgentCore Runtime）
| 技術 | 用途 | バージョン |
|------|------|-----------|
| Amazon Bedrock AgentCore Runtime | AIエージェント基盤 | 2025.12 |
| AWS AppSync | GraphQL API | Amplify Gen2 |
| Strands Agents SDK | エージェントフレームワーク | Latest |
| AWS Bedrock Claude | メッセージ生成 | Haiku 3 / Sonnet 4 |
| AgentCore Memory | 会話履歴保持 | Built-in |
| Python | ランタイム | 3.10-3.13 |

### フロントエンド
| 技術 | 用途 | バージョン |
|------|------|-----------|
| Next.js | フロントエンド | 14.x |
| AWS Amplify Gen2 | ホスティング・Backend | Latest |
| AWS Amplify Data | GraphQLクライアント | Gen2 |
| TailwindCSS | スタイリング | 3.x |
| TypeScript | 型安全 | 5.x |

### インフラストラクチャ
| 技術 | 用途 |
|------|------|
| AWS Amplify Gen2 | ホスティング・Backend・CI/CD |
| Amazon Cognito | 認証 |
| Amazon DynamoDB | データベース（履歴保存） |
| Amazon ECR | コンテナレジストリ |
| CloudWatch Logs | ログ監視 |
| CloudWatch GenAI Dashboard | エージェント監視 |

## プロジェクト構成

```
omikuji-agent/
├── README.md                     # このファイル
├── requirements.txt              # Python依存関係
├── amplify.yml                   # Amplifyビルド設定
│
├── omikuji_agent.py              # AgentCore Runtime用エージェント ⭐
│
├── nextjs-app/                   # Amplify Gen2 フロントエンド
│   ├── amplify/                  # Amplify Backend
│   │   ├── backend.ts            # Backend定義 + AgentCore連携
│   │   ├── auth/                 # Cognito認証
│   │   │   └── resource.ts
│   │   ├── data/                 # AppSync + HTTP Data Source
│   │   │   ├── resource.ts       # Schema定義
│   │   │   └── resolvers/        # AppSync JS Resolvers
│   │   │       ├── drawOmikuji.js
│   │   │       └── chat.js
│   │   └── storage/              # S3 Storage（オプション）
│   │       └── resource.ts
│   ├── app/                      # Next.js App Router
│   │   ├── page.tsx              # メインページ
│   │   └── layout.tsx            # レイアウト
│   ├── lib/
│   │   └── api.ts                # Amplify Dataクライアント
│   ├── next.config.js
│   └── package.json
│
└── docs/                         # ドキュメント（オプション）
```

## セットアップ

### 前提条件
- AWS アカウント（Bedrock Claude モデルアクセス有効化済み）
- AWS CLI v2 設定済み
- Node.js 18+
- Python 3.10+

### Step 1: AgentCore Runtime にエージェントをデプロイ

```bash
# 依存関係インストール
pip install bedrock-agentcore strands-agents bedrock-agentcore-starter-toolkit

# エージェント設定
agentcore configure --entrypoint omikuji_agent.py --name omikuji-agent

# デプロイ
agentcore deploy
```

デプロイ成功後、ARNが表示されます：
```
✅ AgentCore Runtime deployed!
ARN: arn:aws:bedrock-agentcore:ap-northeast-1:123456789012:runtime/omikuji-agent-xxxxx
```

### Step 2: 環境変数設定

`nextjs-app/amplify/.env.local` を作成：

```env
AWS_ACCOUNT_ID=123456789012
AWS_REGION=ap-northeast-1
AGENTCORE_RUNTIME_ID=omikuji-agent-xxxxx
AGENTCORE_RUNTIME_ARN=arn:aws:bedrock-agentcore:ap-northeast-1:123456789012:runtime/omikuji-agent-xxxxx
```

### Step 3: Amplify Gen2 デプロイ

#### 開発環境（Sandbox）

```bash
cd nextjs-app
npm install

# Sandbox起動（AWS に開発用リソース作成）
npx ampx sandbox --env-file amplify/.env.local
```

Sandbox が起動すると以下が自動作成されます：
- Cognito User Pool（認証）
- AppSync GraphQL API
- DynamoDB テーブル
- HTTP Data Source（AgentCore接続）

#### 本番デプロイ

```bash
# GitHubにプッシュ → Amplify Hosting が自動デプロイ
git push origin main
```

### Step 4: 動作確認

```bash
# ローカル開発
http://localhost:3000

# 本番
https://main.d41aq4729k4l7.amplifyapp.com
```

## HTTP Data Source 設定（実装詳細）

`amplify/backend.ts` で AppSync → AgentCore の接続を定義：

```typescript
import { CfnDataSource } from 'aws-cdk-lib/aws-appsync';

// HTTP Data Source を CDK で作成
const agentCoreHttpDataSource = new CfnDataSource(dataStack, 'AgentCoreHttpDataSource', {
  apiId: graphqlApi.apiId,
  name: 'AgentCoreHttpDataSource',
  type: 'HTTP',
  httpConfig: {
    endpoint: 'https://bedrock-agentcore-runtime.ap-northeast-1.amazonaws.com',
    authorizationConfig: {
      authorizationType: 'AWS_IAM',
      awsIamConfig: {
        signingServiceName: 'bedrock-agentcore',  // SigV4署名
        signingRegion: 'ap-northeast-1',
      },
    },
  },
  serviceRoleArn: agentCoreDataSourceRole.roleArn,
});
```

### AppSync Resolver（例）

`amplify/data/resolvers/drawOmikuji.js`:

```javascript
export function request(ctx) {
  const sessionId = ctx.args.sessionId || `session-${Date.now()}`;
  return {
    method: 'POST',
    resourcePath: `/runtimes/${ctx.env.AGENTCORE_RUNTIME_ARN}/invocations`,
    params: {
      headers: {
        'Content-Type': 'application/json',
        'X-Amzn-Bedrock-AgentCore-Runtime-Session-Id': sessionId,
      },
      body: JSON.stringify({
        prompt: ctx.args.prompt || 'おみくじを引いてください',
      }),
    },
  };
}

export function response(ctx) {
  return JSON.parse(ctx.result.body);
}
```

## 機能一覧

### コア機能
- 🎴 **おみくじ機能**: AIがランダムに運勢を占い、ギャル語風メッセージで結果を表示
- 💬 **チャット機能**: おみくじ結果についてAIと会話
- 📊 **統計機能**: 過去のおみくじ結果をCode Interpreterでグラフ化
- 📜 **履歴機能**: 過去のおみくじ結果をDynamoDBに保存・一覧表示

### AgentCore 機能
- 🧠 **Memory**: 会話履歴を保持し、パーソナライズされた応答
- 🐍 **Code Interpreter**: 統計分析やグラフ生成
- 🔍 **Observability**: CloudWatch GenAI Dashboard でリアルタイム監視
- 🔐 **Session Isolation**: マイクロVMで完全分離されたセッション

## 現在のステータス

### ✅ 完了
- [x] AgentCore Runtime デプロイ済み（my_agent-9NBXM54pmz）
- [x] ローカルでのAgentCore Runtime呼び出しテスト成功
- [x] フロントエンドUI完成
- [x] Amplify Hosting にデプロイ（SSR / WEB_COMPUTE）
- [x] Next.js API Route 実装（/api/omikuji）
- [x] フォールバック機能実装（AgentCore接続失敗時のモックデータ）

### 🟡 現在の状態
フロントエンドは動作中ですが、AgentCore との接続には追加のIAM設定が必要です：

| コンポーネント | 状態 | 備考 |
|--------------|------|------|
| フロントエンド | ✅ 稼働中 | https://main.d41aq4729k4l7.amplifyapp.com |
| API Route | ✅ 稼働中 | フォールバックモード |
| AgentCore Runtime | ✅ READY | 権限設定待ち |
| Amplify Compute Role | ⚠️ 要設定 | bedrock-agentcore:InvokeAgentRuntime 権限必要 |

### 🚧 TODO
- [ ] **Amplify SSR Compute Role** に AgentCore 呼び出し権限を追加
- [ ] Amplify Gen2 Backend（AppSync + HTTP Data Source）構築
- [ ] Cognito認証連携
- [ ] DynamoDB履歴保存
- [ ] 本番環境での完全AgentCore連携

### 現行アーキテクチャ（暫定）

```
Client → Amplify Hosting (Next.js SSR) → API Route → AgentCore Runtime
                                         ↓
                                    [フォールバック]
                                    モックデータ
```

### 目標アーキテクチャ（READMEに記載）

```
Client → Amplify Gen2 → AppSync → HTTP Data Source → AgentCore Runtime
```

### AgentCore Runtime 情報

- **Runtime ARN**: `arn:aws:bedrock-agentcore:ap-northeast-1:226484346947:runtime/my_agent-9NBXM54pmz`
- **エンドポイント**: DEFAULT (READY)
- **ステータス**: READY

## トラブルシューティング

### よくある問題

#### 1. AppSync から AgentCore への接続エラー

```
解決策: 
- IAM Policy に bedrock-agentcore:InvokeAgentRuntime 権限を追加
- HTTP Data Source の署名設定を確認（signingServiceName: 'bedrock-agentcore'）
```

#### 2. セッション管理エラー

```
解決策:
- X-Amzn-Bedrock-AgentCore-Runtime-Session-Id ヘッダーを必ず設定
- セッションIDは33文字以上の一意な値を使用（UUID推奨）
```

#### 3. Claude モデルアクセスエラー

```
解決策: 
AWS Console → Bedrock → Model access で
Claude 3 Haiku / Sonnet のアクセスを有効化
```

## 参考リンク

- [Amazon Bedrock AgentCore](https://aws.amazon.com/bedrock/agentcore/)
- [AgentCore Runtime ドキュメント](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/agents-tools-runtime.html)
- [InvokeAgentRuntime API](https://docs.aws.amazon.com/bedrock-agentcore/latest/APIReference/API_InvokeAgentRuntime.html)
- [Amplify Gen2 - HTTP Data Source](https://docs.amplify.aws/react/build-a-backend/data/custom-business-logic/connect-http-datasource/)
- [Strands Agents SDK](https://strandsagents.com/latest/)

## ライセンス

MIT License

## 作者

Made with 💕

---

**デプロイ済みフロントエンド**: https://main.d41aq4729k4l7.amplifyapp.com

**2025.12 対応版** - Lambda不要！AgentCore Runtime直接呼び出し
