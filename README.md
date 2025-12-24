# AI おみくじエージェント 🎴✨

AWS Bedrock AgentCore Runtime を使ったAI占いアプリケーション

## 概要

ユーザーがおみくじを引くと、AIが運勢を占い、フレンドリーなギャル語風メッセージでラッキーアイテムやスポットをお知らせします。Memory機能により過去の履歴を記憶し、パーソナライズされたアドバイスを提供します。

## アーキテクチャ

### 目標構成: Amplify Gen2 + AgentCore Runtime + S3 Vector Store（RAG）

Amplify Gen2から**AgentCore Runtime（ECR）**を直接呼び出し、おみくじ履歴を**S3 Vector Store**に保存してRAG検索を行います。**Lambda不要**でシンプルかつ高速な構成です。

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AWS Cloud                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                          ap-northeast-1                                 │ │
│  │                                                                         │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │ │
│  │  │                    Amplify Gen2                                  │   │ │
│  │  │  ┌─────────────┐    ┌─────────────┐                             │   │ │
│  │  │  │  Next.js    │    │  AppSync    │                             │   │ │
│  │  │  │  Frontend   │───▶│  GraphQL    │───────┐                     │   │ │
│  │  │  │             │    │  API        │       │ Custom Resolver     │   │ │
│  │  │  └─────────────┘    └─────────────┘       │                     │   │ │
│  │  │        │                   │               │                     │   │ │
│  │  │        │           ┌───────┴───────┐       │                     │   │ │
│  │  │        │           │   Cognito     │       │                     │   │ │
│  │  │        │           │  User Pool    │       │                     │   │ │
│  │  │        │           │  (認証)       │       │                     │   │ │
│  │  │        │           └───────────────┘       │                     │   │ │
│  │  └────────┼─────────────────────────────────┬─┘                     │   │ │
│  │           │                                 │                       │   │ │
│  │           │                                 ▼                       │   │ │
│  │           │                  ┌────────────────────────────────────┐ │   │ │
│  │           │                  │   Bedrock AgentCore Runtime        │ │   │ │
│  │           │                  │   ┌──────────────────────────────┐ │ │   │ │
│  │           │                  │   │  omikuji_agent.py            │ │ │   │ │
│  │           │                  │   │  (ECR Container)             │ │ │   │ │
│  │           │                  │   │  Python 3.10-3.13            │ │ │   │ │
│  │           │                  │   └──────────────────────────────┘ │ │   │ │
│  │           │                  │              │                     │ │   │ │
│  │           │                  │   ┌──────────┴───────────┐         │ │   │ │
│  │           │                  │   │                      │         │ │   │ │
│  │           │                  │   ▼                      ▼         │ │   │ │
│  │           │                  │ ┌────────────┐ ┌─────────────────┐ │ │   │ │
│  │           │                  │ │  Memory    │ │ Code Interpreter│ │ │   │ │
│  │           │                  │ │ (会話履歴) │ │ (統計・グラフ)  │ │ │   │ │
│  │           │                  │ └────────────┘ └─────────────────┘ │ │   │ │
│  │           │                  │              │                     │ │   │ │
│  │           │                  │              ▼                     │ │   │ │
│  │           │                  │   ┌──────────────────────┐         │ │   │ │
│  │           │                  │   │   Bedrock Claude     │         │ │   │ │
│  │           │                  │   │   (Haiku 3 / Sonnet) │         │ │   │ │
│  │           │                  │   └──────────────────────┘         │ │   │ │
│  │           │                  │              │                     │ │   │ │
│  │           │                  │              ▼                     │ │   │ │
│  │           │                  │   ┌──────────────────────┐         │ │   │ │
│  │           │                  │   │   RAG Tool           │         │ │   │ │
│  │           │                  │   │   (S3 Vector Search) │         │ │   │ │
│  │           │                  │   └──────────┬───────────┘         │ │   │ │
│  │           │                  └──────────────┼─────────────────────┘ │   │ │
│  │           │                                 │                       │   │ │
│  │           │                                 ▼                       │   │ │
│  │           │                  ┌────────────────────────────────────┐ │   │ │
│  │           │                  │   S3 Vector Store                  │ │   │ │
│  │           │                  │   - おみくじ履歴（Embeddings）     │ │   │ │
│  │           │                  │   - セマンティック検索             │ │   │ │
│  │           │                  │   - パーソナライズ応答             │ │   │ │
│  │           │                  └────────────────────────────────────┘ │   │ │
│  │           │                                                         │   │ │
│  │  ┌────────┴───────┐                         ┌─────────────────────┐ │   │ │
│  │  │  CloudWatch    │                         │  CloudWatch GenAI   │ │   │ │
│  │  │  Logs          │                         │  Dashboard          │ │   │ │
│  │  └────────────────┘                         └─────────────────────┘ │   │ │
│  │                                                                       │   │ │
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

| 構成 | Lambda | DynamoDB | データストア | セマンティック検索 | 複雑さ |
|------|--------|----------|-------------|-------------------|--------|
| **Amplify Gen2 + AgentCore + S3 Vector（目標）** | ❌ 不要 | ❌ 不要 | S3 Vector Store | ✅ 可能 | 🟢 シンプル |
| Next.js API Route + AgentCore（現行） | ❌ 不要 | ❌ 未使用 | なし | ❌ 不可 | 🟡 暫定 |
| AppSync + DynamoDB（非推奨） | ❌ 不要 | ✅ 必要 | DynamoDB | ❌ 不可 | 🔴 不適切 |
| Lambda 経由（従来） | ✅ 必要 | ✅ 必要 | DynamoDB | ❌ 不可 | 🔴 複雑 |

**重要:** おみくじ履歴は「過去に似た運勢の時どうだった？」というセマンティック検索が必要なため、**S3 Vector Store + RAG**が最適です。DynamoDBでの単純なCRUD操作は不要です。

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
| S3 Vector Store | おみくじ履歴（RAG） | AWS S3 + Embeddings |
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
| Amazon S3 | Vector Store（Embeddings + メタデータ） |
| Amazon ECR | コンテナレジストリ |
| CloudWatch Logs | ログ監視 |
| CloudWatch GenAI Dashboard | エージェント監視 |

**注意:** ~~DynamoDB は不要~~（セマンティック検索ができないため）

## プロジェクト構成

```
omikuji-agent/
├── README.md                     # このファイル
├── requirements.txt              # Python依存関係
├── amplify.yml                   # Amplifyビルド設定
├── ARCHITECTURE_AUDIT_REPORT.md  # アーキテクチャ監査レポート
│
├── omikuji_agent.py              # AgentCore Runtime用エージェント ⭐
├── my_agent.py                   # AgentCore Runtime用エージェント（別バージョン）
│
└── nextjs-app/                   # Amplify Gen2 フロントエンド
    ├── amplify/                  # ⚠️ 未作成（TODO）
    │   ├── backend.ts            # Backend定義 + AgentCore連携
    │   ├── auth/                 # Cognito認証
    │   │   └── resource.ts
    │   ├── data/                 # AppSync Custom Resolver
    │   │   └── resource.ts       # Schema定義
    │   └── storage/              # S3 Vector Store
    │       └── resource.ts
    ├── app/                      # Next.js App Router
    │   ├── api/                  # API Routes（暫定実装）
    │   │   └── omikuji/
    │   │       └── route.ts      # AgentCore直接呼び出し
    │   ├── page.tsx              # メインページ
    │   ├── layout.tsx            # レイアウト
    │   └── globals.css           # グローバルスタイル
    ├── lib/
    │   └── api.ts                # API呼び出しクライアント
    ├── next.config.js
    ├── package.json
    ├── tsconfig.json
    └── tailwind.config.ts
```

**現状:** 
- `nextjs-app/amplify/` ディレクトリが未作成のため、Amplify Gen2 Backendが定義されていません
- 現在はNext.js API Routeで暫定的にAgentCoreを呼び出しています
- ~~Lambda関連ファイルは削除済み~~（Lambda不要のため）

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

### Step 3: Amplify Gen2 Backend作成

#### 1. Backendファイル作成

```bash
cd nextjs-app
mkdir -p amplify/{auth,data,storage}

# Backend定義ファイルを作成（上記の実装例を参照）
touch amplify/backend.ts
touch amplify/auth/resource.ts
touch amplify/data/resource.ts
touch amplify/storage/resource.ts
```

#### 2. 開発環境（Sandbox）

```bash
npm install

# Sandbox起動（AWS に開発用リソース作成）
npx ampx sandbox --env-file amplify/.env.local
```

Sandbox が起動すると以下が自動作成されます：
- ✅ Cognito User Pool（認証）
- ✅ AppSync GraphQL API
- ✅ S3 Bucket（Vector Store）
- ✅ IAM Role（AgentCore呼び出し権限）

#### 3. 本番デプロイ

```bash
# GitHubにプッシュ → Amplify Hosting が自動デプロイ
git push origin main
```

#### 4. 既存DynamoDBテーブルの削除

```bash
# 未使用のDynamoDBテーブルを削除（コスト削減）
aws dynamodb delete-table --table-name ChatMessage-2vlq6e2jnvadxjsogoxuzt4ikm-NONE
aws dynamodb delete-table --table-name FortuneResult-2vlq6e2jnvadxjsogoxuzt4ikm-NONE
```

### Step 4: 動作確認

```bash
# ローカル開発
http://localhost:3000

# 本番
https://main.d41aq4729k4l7.amplifyapp.com
```

## Amplify Gen2 Backend 実装ガイド

### Step 1: Backend定義作成

`nextjs-app/amplify/backend.ts`:

```typescript
import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';

export const backend = defineBackend({
  auth,
  data,
  storage,
});

// AgentCore Runtime ARNを環境変数から取得
const agentCoreRuntimeArn = process.env.AGENTCORE_RUNTIME_ARN || 
  'arn:aws:bedrock-agentcore:ap-northeast-1:226484346947:runtime/my_agent-9NBXM54pmz';

// Backend Stack に AgentCore 連携を追加
backend.addOutput({
  custom: {
    agentCoreRuntimeArn,
  },
});
```

### Step 2: AppSync Custom Resolver

`nextjs-app/amplify/data/resource.ts`:

```typescript
import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

const schema = a.schema({
  drawOmikuji: a
    .query()
    .arguments({
      prompt: a.string(),
      sessionId: a.string(),
    })
    .returns(a.customType({
      result: a.string().required(),
      fortune_data: a.json(),
      sessionId: a.string().required(),
    }))
    .authorization((allow) => [allow.authenticated()])
    .handler(
      a.handler.custom({
        entry: './resolvers/drawOmikuji.js',
        dataSource: 'AgentCoreDataSource',
      })
    ),
});

export type Schema = ClientSchema<typeof schema>;
export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});
```

### Step 3: S3 Vector Store設定

`nextjs-app/amplify/storage/resource.ts`:

```typescript
import { defineStorage } from '@aws-amplify/backend';

export const storage = defineStorage({
  name: 'omikujiVectorStore',
  access: (allow) => ({
    'embeddings/*': [
      allow.authenticated.to(['read', 'write']),
      allow.guest.to(['read']),
    ],
    'fortune-history/*': [
      allow.authenticated.to(['read', 'write']),
    ],
  }),
});
```

### Step 4: AgentCore Runtime にRAG Tool追加

`omikuji_agent.py`:

```python
from bedrock_agentcore.tools import S3VectorSearchTool

# S3 Vector Search Tool作成
vector_search = S3VectorSearchTool(
    bucket_name=os.environ.get("S3_VECTOR_BUCKET", "omikuji-vector-store"),
    index_name="fortune_history",
    embedding_model="amazon.titan-embed-text-v1"
)

# エージェント作成
agent = Agent(
    tools=[vector_search, code_interpreter],
    session_manager=session_manager
)

# おみくじ結果をVector Storeに保存
def save_to_vector_store(result: dict, session_id: str):
    """おみくじ結果をEmbedding化してS3に保存"""
    text = f"{result['fortune']}: {result['message']}"
    metadata = {
        "session_id": session_id,
        "fortune": result["fortune"],
        "timestamp": result["timestamp"],
        "lucky_color": result["lucky_color"],
        "lucky_item": result["lucky_item"],
    }
    vector_search.add_document(text=text, metadata=metadata)
```

## 機能一覧

### コア機能
- 🎴 **おみくじ機能**: AIがランダムに運勢を占い、ギャル語風メッセージで結果を表示
- 💬 **チャット機能**: おみくじ結果についてAIと会話
- 📊 **統計機能**: 過去のおみくじ結果をCode Interpreterでグラフ化
- 📜 **履歴機能（RAG）**: 過去のおみくじ結果をS3 Vector Storeに保存し、セマンティック検索
  - 「過去に似た運勢の時、どうだった？」に回答
  - パーソナライズされたアドバイス生成

### AgentCore 機能
- 🧠 **Memory**: 会話履歴を保持し、パーソナライズされた応答
- 🐍 **Code Interpreter**: 統計分析やグラフ生成
- 🔍 **RAG Tool**: S3 Vector Storeを使ったセマンティック検索
- 🔍 **Observability**: CloudWatch GenAI Dashboard でリアルタイム監視
- 🔐 **Session Isolation**: マイクロVMで完全分離されたセッション

## 現在のステータス

### ✅ 完了（暫定実装）
- [x] AgentCore Runtime デプロイ済み（my_agent-9NBXM54pmz）
- [x] ローカルでのAgentCore Runtime呼び出しテスト成功
- [x] フロントエンドUI完成
- [x] Amplify Hosting にデプロイ（SSR / WEB_COMPUTE）
- [x] **Next.js API Route 実装（/api/omikuji）** - 暫定実装
- [x] フォールバック機能実装（AgentCore接続失敗時のモックデータ）
- [x] **AmplifySSRComputeRole 設定完了** - AgentCore連携動作中！
- [x] **ギャル語AIメッセージ表示** - 本番稼働中！

### 🟢 現在の状態（暫定実装で稼働中）

| コンポーネント | 状態 | 実装方式 |
|--------------|------|---------|
| フロントエンド | ✅ 稼働中 | https://main.d41aq4729k4l7.amplifyapp.com |
| API Route | ✅ 稼働中 | **暫定実装**（Amplify Gen2 Backend未作成） |
| AgentCore Runtime | ✅ READY | ギャル語AI生成中 |
| Amplify Compute Role | ✅ 設定済み | AmplifySSRComputeRole |
| Amplify Gen2 Backend | ❌ 未作成 | `amplify/` ディレクトリなし |
| S3 Vector Store | ❌ 未実装 | RAG検索なし |
| Memory | ❌ 未使用 | 会話履歴保持なし |

### 🚧 TODO（正しいアーキテクチャへの移行）

#### 優先度: 高 🔴
- [ ] **Amplify Gen2 Backend作成**
  - `amplify/backend.ts` でAgentCore連携定義
  - AppSync Custom Resolverで直接AgentCore呼び出し
  - API Route → AppSync移行

- [ ] **S3 Vector Store + RAG実装**
  - おみくじ履歴をEmbedding化
  - S3にベクトルデータ保存
  - RAG Toolで過去履歴を検索
  - ~~DynamoDB削除~~（不要）

#### 優先度: 中 🟡
- [ ] Cognito認証連携
- [ ] Memory機能の有効化
- [ ] Code Interpreter統計機能

#### 優先度: 低 🟢
- [ ] CloudWatch GenAI Dashboard設定
- [ ] マルチユーザー対応

### 現行アーキテクチャ（暫定実装）

```
┌────────────┐     ┌─────────────────────────────────────┐     ┌─────────────────────┐
│            │     │        Amplify Hosting              │     │                     │
│  ブラウザ   │────▶│  Next.js SSR + API Route           │────▶│  AgentCore Runtime  │
│  (React)   │     │  /api/omikuji (暫定実装)            │     │  (omikuji_agent.py) │
│            │     │                                     │     │                     │
└────────────┘     └─────────────────────────────────────┘     └──────────┬──────────┘
                              │                                           │
                              │ AmplifySSRComputeRole                     │
                              │ (IAM認証)                                 ▼
                              │                                 ┌─────────────────────┐
                              │                                 │   Bedrock Claude    │
                              │                                 │   (ギャル語生成)    │
                              └─────────────────────────────────└─────────────────────┘
```

**問題点:**
- Amplify Gen2 Backendが未定義（IaCなし）
- 履歴保存なし
- RAG検索なし

---

### 目標アーキテクチャ（正しい構成）

```
┌────────────┐     ┌──────────────────────────────────────────────┐
│            │     │           Amplify Gen2                       │
│  ブラウザ   │────▶│  Next.js → AppSync (Custom Resolver)        │
│  (React)   │     │                    │                         │
└────────────┘     └────────────────────┼─────────────────────────┘
                                        │
                                        ▼
                          ┌──────────────────────────────┐
                          │   AgentCore Runtime (ECR)    │
                          │   ┌──────────────────────┐   │
                          │   │  omikuji_agent.py    │   │
                          │   │  + RAG Tool          │   │
                          │   └──────────────────────┘   │
                          └───────────┬──────────────────┘
                                      │
                      ┌───────────────┼───────────────┐
                      ▼               ▼               ▼
             ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐
             │   Memory    │  │   Claude    │  │  S3 Vector Store │
             │ (会話履歴)  │  │   (AI生成)  │  │  (RAG検索)       │
             └─────────────┘  └─────────────┘  └──────────────────┘
```

**メリット:**
- ✅ Amplify Gen2 Backend（IaC）
- ✅ S3 Vector Storeでセマンティック検索
- ✅ 過去履歴からパーソナライズ応答
- ✅ AppSync経由で統一されたAPI

### AgentCore Runtime 情報

- **Runtime ARN**: `arn:aws:bedrock-agentcore:ap-northeast-1:226484346947:runtime/my_agent-9NBXM54pmz`
- **エンドポイント**: DEFAULT (READY)
- **ステータス**: READY

## デプロイシーケンス図

おみくじを引く際の処理フローです。

```
┌──────────┐     ┌─────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌───────────────┐
│ ブラウザ  │     │  Amplify    │     │  API Route      │     │  AgentCore      │     │  Bedrock      │
│ (React)  │     │  Hosting    │     │  /api/omikuji   │     │  Runtime        │     │  Claude       │
└────┬─────┘     └──────┬──────┘     └───────┬─────────┘     └───────┬─────────┘     └───────┬───────┘
     │                  │                    │                       │                       │
     │  1. ページアクセス │                    │                       │                       │
     │ ─────────────────>│                    │                       │                       │
     │                  │                    │                       │                       │
     │  2. Next.js SSR  │                    │                       │                       │
     │ <─────────────────│                    │                       │                       │
     │    (HTML/JS)     │                    │                       │                       │
     │                  │                    │                       │                       │
     │  3. 「おみくじを引く」ボタンクリック      │                       │                       │
     │ ──────────────────────────────────────>│                       │                       │
     │    POST /api/omikuji                  │                       │                       │
     │    {prompt, sessionId}                │                       │                       │
     │                  │                    │                       │                       │
     │                  │                    │  4. InvokeAgentRuntime│                       │
     │                  │                    │ ─────────────────────>│                       │
     │                  │                    │   (AWS SDK v3)        │                       │
     │                  │                    │   AmplifySSRComputeRole│                      │
     │                  │                    │                       │                       │
     │                  │                    │                       │  5. omikuji_agent.py │
     │                  │                    │                       │ ─────────────────────>│
     │                  │                    │                       │    Agent(prompt)     │
     │                  │                    │                       │                       │
     │                  │                    │                       │  6. AI生成（ギャル語）│
     │                  │                    │                       │ <─────────────────────│
     │                  │                    │                       │    {result, fortune} │
     │                  │                    │                       │                       │
     │                  │                    │  7. Streaming Response│                       │
     │                  │                    │ <─────────────────────│                       │
     │                  │                    │    JSON chunks        │                       │
     │                  │                    │                       │                       │
     │  8. JSONレスポンス │                    │                       │                       │
     │ <──────────────────────────────────────│                       │                       │
     │    {result, fortune_data, sessionId}  │                       │                       │
     │                  │                    │                       │                       │
     │  9. UI更新       │                    │                       │                       │
     │    - 運勢表示    │                    │                       │                       │
     │    - AIメッセージ │                    │                       │                       │
     │    - ラッキー情報 │                    │                       │                       │
     │                  │                    │                       │                       │
```

### 各ステップの詳細

| Step | 処理 | ファイル | 説明 |
|------|------|----------|------|
| 1-2 | ページ表示 | `page.tsx` | Next.js SSRでHTMLを生成 |
| 3 | ボタンクリック | `lib/api.ts` | `fetchOmikuji()` で API呼び出し |
| 4 | AgentCore呼び出し | `route.ts` | AWS SDK v3 で `InvokeAgentRuntimeCommand` |
| 5-6 | AI生成 | `omikuji_agent.py` | Strands Agent + Bedrock Claude |
| 7-8 | レスポンス | `route.ts` | JSONパース・正規化 |
| 9 | UI更新 | `page.tsx` | React state更新・表示 |

### IAM認証フロー

```
Amplify SSR 実行環境
        │
        │ AssumeRole
        ▼
┌─────────────────────────┐
│ AmplifySSRComputeRole   │
│                         │
│ Policy:                 │
│ bedrock-agentcore:      │
│   InvokeAgentRuntime    │
│                         │
│ Resource:               │
│ arn:aws:bedrock-agentcore:ap-northeast-1:226484346947:runtime/*
└───────────┬─────────────┘
            │
            ▼
    AgentCore Runtime
    (my_agent-9NBXM54pmz)
```

## トラブルシューティング

### よくある問題

#### 1. Amplify Gen2 Backend が未作成

**症状:** `amplify/` ディレクトリが存在しない

**解決策:**
```bash
cd nextjs-app
npx ampx generate backend
# 上記の実装例を参考に backend.ts を作成
```

#### 2. AgentCore への接続エラー

**症状:** `InvokeAgentRuntime` が失敗する

**解決策:** 
- IAM Role に `bedrock-agentcore:InvokeAgentRuntime` 権限を追加
- AgentCore Runtime ARN が正しいか確認
- リージョンが `ap-northeast-1` か確認

#### 3. S3 Vector Store が動作しない

**症状:** RAG検索ができない

**解決策:**
- S3 Bucket が作成されているか確認
- IAM Role に S3 アクセス権限があるか確認
- Embedding モデル（Titan Embed）が有効か確認

#### 4. セッション管理エラー

**解決策:**
- セッションIDは33文字以上の一意な値を使用（UUID推奨）
- AgentCore Memory IDが設定されているか確認

#### 5. Claude モデルアクセスエラー

**解決策:** 
```
AWS Console → Bedrock → Model access で
Claude 3 Haiku / Sonnet のアクセスを有効化
```

#### 6. DynamoDBテーブルが残っている

**症状:** 未使用のテーブルがコストを発生させている

**解決策:**
```bash
# 削除（セマンティック検索には不要）
aws dynamodb delete-table --table-name ChatMessage-xxx-NONE
aws dynamodb delete-table --table-name FortuneResult-xxx-NONE
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

## 📊 実装ステータス

| 項目 | 状態 | 備考 |
|------|------|------|
| **フロントエンド** | ✅ 稼働中 | https://main.d41aq4729k4l7.amplifyapp.com |
| **AgentCore Runtime** | ✅ 稼働中 | my_agent-9NBXM54pmz |
| **Amplify Gen2 Backend** | ❌ 未作成 | `amplify/` ディレクトリなし |
| **S3 Vector Store** | ❌ 未実装 | RAG検索なし |
| **DynamoDB** | ⚠️ 削除推奨 | 未使用リソース |

---

**デプロイ済みフロントエンド**: https://main.d41aq4729k4l7.amplifyapp.com

**2025.12 対応版** - Lambda不要！AgentCore Runtime + S3 Vector Store（RAG）構成

**現状:** 暫定実装（Next.js API Route）で稼働中。Amplify Gen2 Backend への移行が必要。

---

## 🔗 セッション管理の重要性（おみくじ → チャット連携）

### 問題: チャットがおみくじ結果を覚えていない

AgentCore Runtime の **Memory機能** は、**同一セッションID** でのみ会話履歴を保持します。
セッションIDが異なると、別のユーザー・別の会話として扱われます。

### ❌ 現在の問題（セッションIDが毎回変わる）

```typescript
// lib/api.ts - おみくじを引く
export async function fetchOmikuji() {
  const sessionId = `omikuji-${Date.now()}`;  // ← 毎回新しいID生成
  ...
}

// lib/api.ts - チャット送信
export async function sendChatMessage(...) {
  sessionId: sessionId || `chat-${Date.now()}`,  // ← また別のID
  ...
}
```

**結果:**
```
おみくじを引く → セッションA（omikuji-1703412345678）→ 「大吉です！」
チャットで質問 → セッションB（chat-1703412345999）→ 「？？？何の運勢？」
```

AgentCore Runtime は セッションB では何も知らない状態になります。

### ✅ 解決策: 同一セッションIDを引き継ぐ

```typescript
// page.tsx - セッションIDを一度だけ生成して保持
const [sessionId] = useState(() => `user-${crypto.randomUUID()}`);

// おみくじを引く時
const result = await fetchOmikuji(sessionId);  // ← 同じID

// チャットで質問する時
const response = await sendChatMessage(message, sessionId);  // ← 同じID
```

**結果:**
```
おみくじを引く → セッションA → 「大吉です！ラッキーカラーはピンク✨」
チャットで質問 → セッションA → 「さっきの大吉の話ね！ピンクを取り入れると...」
```

### セッションID設計ガイドライン

| シナリオ | セッションID | 備考 |
|---------|-------------|------|
| **匿名ユーザー** | `user-${crypto.randomUUID()}` | ブラウザセッション中は維持 |
| **認証済みユーザー** | `user-${cognitoUserId}` | Cognitoユーザーと紐付け |
| **永続化する場合** | `user-${userId}-${date}` | 日別にセッション分離も可能 |

### AgentCore Runtime の Memory 仕様

- **セッションID単位** で会話履歴を保持
- **同一セッションID** であれば、過去の会話を全て記憶
- **異なるセッションID** は完全に分離（別人扱い）
- セッションIDは **33文字以上** 推奨（UUID形式）

### 実装例: フロントエンドでのセッション管理

```typescript
// page.tsx
'use client';
import { useState, useEffect } from 'react';

export default function Home() {
  // セッションIDを一度だけ生成（コンポーネントのライフサイクル中は維持）
  const [sessionId] = useState(() => {
    // ブラウザ環境でのみ実行
    if (typeof window !== 'undefined') {
      // 既存のセッションIDがあれば再利用
      const existing = sessionStorage.getItem('omikuji_session_id');
      if (existing) return existing;
      
      // 新規生成して保存
      const newId = `user-${crypto.randomUUID()}`;
      sessionStorage.setItem('omikuji_session_id', newId);
      return newId;
    }
    return `user-${Date.now()}`;
  });

  // おみくじを引く
  const drawFortune = async () => {
    const result = await fetchOmikuji(sessionId);  // ← セッションID渡す
    setFortune(result.fortune_data);
  };

  // チャットで質問
  const sendChat = async () => {
    const response = await sendChatMessage(
      chatInput,
      sessionId,  // ← 同じセッションID
      fortune     // ← おみくじ結果も渡す（バックアップ）
    );
    setChatMessages(prev => [...prev, response]);
  };
}
```

### なぜこれが重要か

1. **Memory機能の有効化**: AgentCore Runtime の会話履歴機能が正しく動作
2. **文脈の維持**: 「さっきの運勢について...」という質問に回答可能
3. **パーソナライズ**: ユーザーの過去のおみくじ履歴を踏まえたアドバイス
4. **一貫した体験**: おみくじ → チャット がシームレスに繋がる
