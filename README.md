# AI おみくじエージェント 🎴✨

AWS Bedrock AgentCore Runtime + Strands Agents を使ったAI占いアプリケーション

## 概要

ユーザーがおみくじを引くと、AIが運勢を占い、フレンドリーなギャル語風メッセージでラッキーアイテムやスポットをお知らせします。**Strands Agents + AgentCore Memory** により、おみくじ結果についてチャットで会話できます。

## 🌟 ライブデモ

**本番サイト**: https://main.d41aq4729k4l7.amplifyapp.com

## アーキテクチャ

### Strands Agents + AgentCore Memory 統合構成

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AWS Cloud (ap-northeast-1)                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                       Amplify Hosting                                 │  │
│  │  ┌──────────────────┐     ┌──────────────────┐                       │  │
│  │  │    Next.js SSR   │     │   API Routes     │                       │  │
│  │  │    Frontend      │────▶│  /api/omikuji    │                       │  │
│  │  │                  │     │  /api/chat       │                       │  │
│  │  └──────────────────┘     └────────┬─────────┘                       │  │
│  │                                    │                                  │  │
│  └────────────────────────────────────┼──────────────────────────────────┘  │
│                                       │ InvokeAgentRuntime                  │
│                                       │ (AWS SDK v3)                        │
│                                       ▼                                     │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    AgentCore Runtime (ECR)                            │  │
│  │  ┌────────────────────────────────────────────────────────────────┐  │  │
│  │  │                    omikuji_agent.py                             │  │  │
│  │  │  ┌──────────────────────────────────────────────────────────┐  │  │  │
│  │  │  │              Strands Agent                                │  │  │  │
│  │  │  │  ┌─────────────────┐    ┌─────────────────────────────┐  │  │  │  │
│  │  │  │  │ AgentCore       │    │   Bedrock Claude            │  │  │  │  │
│  │  │  │  │ Memory Config   │───▶│   (Haiku / Sonnet)          │  │  │  │  │
│  │  │  │  │                 │    │   ギャル語生成               │  │  │  │  │
│  │  │  │  └─────────────────┘    └─────────────────────────────┘  │  │  │  │
│  │  │  │           │                                               │  │  │  │
│  │  │  │           ▼                                               │  │  │  │
│  │  │  │  ┌─────────────────────────────────────────────────────┐  │  │  │  │
│  │  │  │  │     AgentCoreMemorySessionManager                   │  │  │  │  │
│  │  │  │  │     (会話履歴の自動管理)                             │  │  │  │  │
│  │  │  │  └─────────────────────────────────────────────────────┘  │  │  │  │
│  │  │  └──────────────────────────────────────────────────────────┘  │  │  │
│  │  └────────────────────────────────────────────────────────────────┘  │  │
│  │                                    │                                  │  │
│  └────────────────────────────────────┼──────────────────────────────────┘  │
│                                       │                                     │
│                                       ▼                                     │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    AgentCore Memory (STM)                             │  │
│  │                    ID: my_agent_mem-W3DiyUCFmg                        │  │
│  │                    - 会話履歴の永続化                                  │  │
│  │                    - セッション単位で管理                              │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### ユーザーフロー

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      おみくじ → チャット フロー                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1️⃣ ユーザーがおみくじを引く                                            │
│     └─→ 新しい session_id を発行（例: omikuji-20251225-abc123）        │
│     └─→ おみくじ結果「中吉」を取得                                      │
│     └─→ AgentCore Memory に結果を記録                                   │
│                                                                         │
│  2️⃣ ユーザーがチャットで質問                                            │
│     └─→ 「中吉ってどうなの？」                                         │
│     └─→ 同じ session_id を使用                                         │
│     └─→ Agent が Memory から「中吉」の結果を参照して回答                │
│                                                                         │
│  3️⃣ もう一度おみくじを引く                                              │
│     └─→ 新しい session_id を発行（例: omikuji-20251225-def456）        │
│     └─→ 前のセッションはリセット、新しい結果で会話開始                  │
│                                                                         │
│  💡 ポイント: おみくじID = session_id = チャットID                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 🧠 Strands Agents とは

**Strands Agents** は、AWS が 2025年の re:Invent で発表したオープンソース AI エージェントフレームワークです。

### 特徴

| 特徴 | 説明 |
|------|------|
| **LLM 駆動** | モデルの推論能力でタスクを計画・実行 |
| **AWS 統合** | Bedrock, EKS, Lambda, EC2 とシームレス連携 |
| **Memory 管理** | AgentCore Memory との統合で会話履歴を永続化 |
| **ツール登録** | Code Interpreter, RAG, カスタムツール対応 |
| **マルチエージェント** | Handoffs, Swarms, Graph ワークフロー |

### Strands vs 他フレームワーク

| フレームワーク | 特徴 | AWS統合 |
|---------------|------|---------|
| **Strands** | AWS公式、AgentCore統合 | ⭐⭐⭐ |
| LangChain | 汎用的、エコシステム豊富 | ⭐⭐ |
| CrewAI | マルチエージェント特化 | ⭐ |

### Strands + AgentCore Memory 統合

```python
from bedrock_agentcore.memory.integrations.strands.config import AgentCoreMemoryConfig
from bedrock_agentcore.memory.integrations.strands.session_manager import AgentCoreMemorySessionManager
from strands import Agent

# Memory設定
config = AgentCoreMemoryConfig(
    memory_id="my_agent_mem-W3DiyUCFmg",  # AgentCore Memory ID
    session_id=session_id,                 # おみくじID（フロントエンドから）
    actor_id=actor_id                      # ユーザー識別子
)

# セッションマネージャー作成
session_manager = AgentCoreMemorySessionManager(
    agentcore_memory_config=config,
    region_name="ap-northeast-1"
)

# Strands Agent作成（Memory統合済み！）
agent = Agent(
    system_prompt="フレンドリーなギャル語で話すおみくじAIです",
    session_manager=session_manager  # ← これがキー！
)

# 会話は自動的に Memory に保存される
response = agent("おみくじを引いて！")
```

## 技術スタック

### バックエンド（AgentCore Runtime）

| 技術 | 用途 | バージョン |
|------|------|-----------|
| Amazon Bedrock AgentCore Runtime | AIエージェント基盤 | 2025.12 |
| **Strands Agents SDK** | エージェントフレームワーク | Latest |
| **AgentCoreMemorySessionManager** | 会話履歴管理 | bedrock-agentcore[strands-agents] |
| AWS Bedrock Claude | メッセージ生成 | Haiku 3 / Sonnet 4 |
| Python | ランタイム | 3.11 |

### フロントエンド

| 技術 | 用途 | バージョン |
|------|------|-----------|
| Next.js | フロントエンド | 14.x |
| AWS Amplify Hosting | ホスティング | Latest |
| TailwindCSS | スタイリング | 3.x |
| TypeScript | 型安全 | 5.x |

### インフラストラクチャ

| 技術 | 用途 | IaC |
|------|------|-----|
| AWS Amplify Hosting | ホスティング・CI/CD | Amplify Console |
| Amazon ECR | コンテナレジストリ | - |
| AWS CodeBuild | ARM64コンテナビルド | **CloudFormation** ✅ |
| AgentCore Memory | 会話履歴 (STM) | - |
| CloudWatch Logs | ログ監視 | - |

### インフラコード (IaC)

```
infra/
├── codebuild.yml           # CodeBuild プロジェクト定義
│   ├── GitHub 連携設定
│   ├── ARM64 ビルド環境
│   └── ECR プッシュ設定
│
└── deploy-codebuild.sh     # デプロイスクリプト
    ├── create  - スタック作成
    ├── update  - スタック更新
    ├── delete  - スタック削除
    └── status  - ステータス確認
```

### CI/CD パイプライン

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CI/CD アーキテクチャ                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  【フロントエンド】 Next.js                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  GitHub (main)  ──push──▶  Amplify Hosting (自動デプロイ)           │   │
│  │                            - ビルド & デプロイ 自動実行              │   │
│  │                            - SSR対応                                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  【バックエンド】 AgentCore Runtime                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  GitHub (main)  ──手動トリガー──▶  CodeBuild (ARM64)                │   │
│  │                                      │                              │   │
│  │                                      ▼                              │   │
│  │                                  ECR (コンテナ)                      │   │
│  │                                      │                              │   │
│  │                                      ▼                              │   │
│  │                              AgentCore Runtime (手動更新)            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  📝 CodeBuild は GitHub リポジトリから直接ソースを取得                       │
│     （S3経由のZIPアップロード不要）                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## プロジェクト構成

```
omikuji-agent/
├── README.md                     # このファイル
├── requirements.txt              # Python依存関係
├── Dockerfile                    # ARM64コンテナ定義
├── buildspec.yml                 # CodeBuild設定
│
├── omikuji_agent.py              # AgentCore Runtime エージェント ⭐
│   ├── Strands Agent 初期化
│   ├── AgentCoreMemorySessionManager 統合
│   └── おみくじ生成ロジック
│
├── infra/                        # インフラコード (IaC) ⭐
│   ├── codebuild.yml             # CodeBuild CloudFormation テンプレート
│   └── deploy-codebuild.sh       # デプロイスクリプト
│
└── nextjs-app/                   # Amplify Hosting フロントエンド
    ├── app/
    │   ├── api/
    │   │   ├── omikuji/route.ts  # おみくじAPI
    │   │   └── chat/route.ts     # チャットAPI
    │   ├── page.tsx              # メインページ
    │   └── layout.tsx            # レイアウト
    ├── lib/
    │   └── api.ts                # API クライアント（セッション管理）
    ├── package.json
    └── tailwind.config.ts
```

## セットアップ

### 前提条件

- AWS アカウント（Bedrock Claude モデルアクセス有効化済み）
- AWS CLI v2 設定済み
- Node.js 18+
- Python 3.11+
- Docker（ARM64ビルド用）
- GitHub OAuth 連携設定済み（CodeBuild用）

### Step 0: インフラストラクチャのデプロイ（初回のみ）

CodeBuild プロジェクトを CloudFormation でデプロイします。

```bash
# CloudFormation スタックをデプロイ
./infra/deploy-codebuild.sh create

# ステータス確認
./infra/deploy-codebuild.sh status
```

**注意**: 既存の CodeBuild プロジェクトがある場合は `update` を使用してください。

### Step 1: AgentCore Memory 作成（初回のみ）

```bash
# AgentCore Memory を作成
aws bedrock-agentcore-control create-memory \
  --name "omikuji_agent_mem" \
  --description "Memory for omikuji agent with STM" \
  --region ap-northeast-1
```

### Step 2: AgentCore Runtime デプロイ

```bash
# 依存関係インストール
pip install bedrock-agentcore strands-agents

# ECRにコンテナをプッシュ（CodeBuild経由）
aws codebuild start-build --project-name bedrock-agentcore-my_agent-builder

# AgentCore Runtime 作成
aws bedrock-agentcore-control create-agent-runtime \
  --agent-runtime-name omikuji_agent \
  --agent-runtime-artifact containerUri=<ECR_URI>:latest \
  --role-arn <IAM_ROLE_ARN> \
  --network-configuration networkMode=PUBLIC \
  --environment-variables BEDROCK_AGENTCORE_MEMORY_ID=<MEMORY_ID>
```

### Step 3: フロントエンドデプロイ

```bash
cd nextjs-app
npm install
git push origin main  # Amplify自動デプロイ
```

## 🚀 デプロイ手順（詳細）

### AgentCore Runtime 更新デプロイ

`omikuji_agent.py` を変更した場合の再デプロイ手順です。

**CodeBuild は GitHub リポジトリと連携済み**のため、mainブランチのコードから直接ビルドされます。

#### Step 1: コードを main にマージ

```bash
# feature ブランチで作業
git checkout -b feature/your-feature
# ... コード変更 ...
git add -A && git commit -m "feat: your changes"
git push -u origin feature/your-feature

# PR作成 → レビュー → main にマージ
gh pr create --base main --title "your PR title"
```

#### Step 2: CodeBuild でARM64コンテナをビルド

```bash
# CodeBuildプロジェクトを実行（GitHubのmainブランチから自動取得）
aws codebuild start-build --project-name bedrock-agentcore-my_agent-builder

# ビルド状況を確認
aws codebuild batch-get-builds --ids <BUILD_ID> --query 'builds[0].{status:buildStatus,phase:currentPhase}'
```

**📝 ビルドトリガー対象ファイル:**
- `omikuji_agent.py` - エージェントロジック
- `Dockerfile` - コンテナ定義
- `requirements.txt` - Python依存関係
- `buildspec.yml` - ビルド設定

**⚠️ 注意: Docker Hub Rate Limit**

Docker Hub の pull rate limit に引っかかる場合は、Dockerfile のベースイメージを ECR Public に変更してください：

```dockerfile
# NG: Docker Hub（rate limitあり）
FROM --platform=linux/arm64 python:3.11-slim

# OK: ECR Public（rate limitなし）
FROM --platform=linux/arm64 public.ecr.aws/docker/library/python:3.11-slim
```

#### Step 3: AgentCore Runtime を更新

```bash
# 現在のロールARNを確認（初回のみ）
aws bedrock-agentcore-control get-agent-runtime \
  --agent-runtime-id omikuji_agent-JkUdnzGA2D \
  --query 'roleArn' --output text

# 最新イメージでRuntimeを更新
aws bedrock-agentcore-control update-agent-runtime \
  --agent-runtime-id omikuji_agent-JkUdnzGA2D \
  --agent-runtime-artifact 'containerConfiguration={containerUri=<ACCOUNT_ID>.dkr.ecr.ap-northeast-1.amazonaws.com/bedrock-agentcore-my_agent:latest}' \
  --network-configuration networkMode=PUBLIC \
  --role-arn <ROLE_ARN>

# 更新状況を確認
aws bedrock-agentcore-control get-agent-runtime \
  --agent-runtime-id omikuji_agent-JkUdnzGA2D \
  --query '{status:status,version:agentRuntimeVersion}'
```

ステータスが `READY` になるまで待ちます（約1-2分）。

#### Step 4: 動作確認

```bash
# テスト呼び出し（base64エンコードが必要）
PAYLOAD=$(echo '{"prompt": "test", "session_id": "test-session-12345678901234567890123456", "actor_id": "test_user", "action": "draw"}' | base64 -w 0)

aws bedrock-agentcore invoke-agent-runtime \
  --agent-runtime-arn arn:aws:bedrock-agentcore:ap-northeast-1:<ACCOUNT_ID>:runtime/omikuji_agent-JkUdnzGA2D \
  --runtime-session-id "test-session-12345678901234567890123456" \
  --payload "$PAYLOAD" \
  /tmp/response.json

cat /tmp/response.json
```

### フロントエンド（Amplify）デプロイ

Next.js フロントエンドは GitHub へのプッシュで自動デプロイされます。

```bash
# 変更をコミット
git add -A
git commit -m "feat: your changes"

# mainにプッシュ（Amplify自動デプロイ）
git push origin main

# デプロイ状況を確認
aws amplify list-jobs --app-id d41aq4729k4l7 --branch-name main --max-items 1
```

### デプロイ確認チェックリスト

| 確認項目 | コマンド |
|---------|---------|
| CodeBuild ステータス | `aws codebuild batch-get-builds --ids <BUILD_ID> --query 'builds[0].buildStatus'` |
| ECR イメージ確認 | `aws ecr describe-images --repository-name bedrock-agentcore-my_agent --query 'imageDetails[0].imageTags'` |
| Runtime ステータス | `aws bedrock-agentcore-control get-agent-runtime --agent-runtime-id omikuji_agent-JkUdnzGA2D --query 'status'` |
| Amplify デプロイ | `aws amplify list-jobs --app-id d41aq4729k4l7 --branch-name main --max-items 1 --query 'jobSummaries[0].status'` |
| CloudWatch ログ | `aws logs filter-log-events --log-group-name /aws/bedrock-agentcore/runtime/omikuji_agent-JkUdnzGA2D --limit 10` |

### トラブルシューティング

#### セッションIDエラー

```
ValidationException: Value at 'runtimeSessionId' failed to satisfy constraint: 
Member must have length greater than or equal to 33
```

**原因**: セッションIDが33文字未満

**解決**: `lib/api.ts` の `generateNewSessionId()` で36文字以上のIDを生成するように修正

```typescript
// 36文字のセッションID生成
export function generateNewSessionId(): string {
  const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const uuid = crypto.randomUUID();
  const randomParts = uuid.split('-').slice(0, 2).join('-');
  return `omikuji-${timestamp}-${randomParts}`;
}
```

#### Docker Hub Rate Limit

```
error pulling image: 429 Too Many Requests
```

**原因**: Docker Hub の anonymous pull 制限

**解決**: Dockerfile で ECR Public イメージを使用

```dockerfile
FROM --platform=linux/arm64 public.ecr.aws/docker/library/python:3.11-slim
```

#### AgentCore Runtime 更新エラー

```
Unknown parameter 'containerUri' in agentRuntimeArtifact
```

**解決**: 正しいパラメータ形式を使用

```bash
# NG
--agent-runtime-artifact containerUri=xxx

# OK
--agent-runtime-artifact 'containerConfiguration={containerUri=xxx}'
```

#### AgentCore Runtime 更新時に role-arn エラー

```
the following arguments are required: --role-arn
```

**原因**: `update-agent-runtime` コマンドには `--role-arn` が必須

**解決**: 現在のロールARNを取得して指定

```bash
# ロールARN確認
aws bedrock-agentcore-control get-agent-runtime \
  --agent-runtime-id omikuji_agent-JkUdnzGA2D \
  --query 'roleArn' --output text

# 更新時に --role-arn を追加
aws bedrock-agentcore-control update-agent-runtime \
  --agent-runtime-id omikuji_agent-JkUdnzGA2D \
  --agent-runtime-artifact 'containerConfiguration={containerUri=xxx}' \
  --network-configuration networkMode=PUBLIC \
  --role-arn arn:aws:iam::<ACCOUNT_ID>:role/AmazonBedrockAgentCoreSDKRuntime-...
```

## 環境変数

### AgentCore Runtime（omikuji_agent.py）

| 変数名 | 説明 | 例 |
|--------|------|-----|
| `AWS_REGION` | AWSリージョン | ap-northeast-1 |
| `BEDROCK_AGENTCORE_MEMORY_ID` | Memory ID | my_agent_mem-W3DiyUCFmg |

### Next.js API Routes

| 変数名 | 説明 | 例 |
|--------|------|-----|
| `AGENTCORE_RUNTIME_ARN` | Runtime ARN | arn:aws:bedrock-agentcore:... |
| `AWS_REGION` | AWSリージョン | ap-northeast-1 |

## セッション管理設計

### おみくじID = session_id = チャットID

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      セッション管理の設計                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  【フロントエンド】                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ おみくじを引く → 新しい session_id 発行                          │   │
│  │ チャットする → 同じ session_id を使用                            │   │
│  │ 再度おみくじ → 新しい session_id 発行                            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  【session_id 形式】                                                    │
│  omikuji-{timestamp}-{uuid8}-{uuid4}  (36文字以上必須)                 │
│  例: omikuji-20251225143052-a1b2c3d4-e5f6                              │
│                                                                         │
│  【AgentCore Memory】                                                   │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ session_id ごとに会話履歴を分離                                  │   │
│  │ - おみくじ結果を記憶                                             │   │
│  │ - チャット履歴を記憶                                             │   │
│  │ - 別の session_id は別の会話                                     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### AgentCoreMemoryConfig パラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `memory_id` | str | ✅ | AgentCore Memory ID |
| `session_id` | str | ✅ | おみくじID（フロントエンドから） |
| `actor_id` | str | ✅ | ユーザー識別子 |
| `retrieval_config` | dict | ❌ | 検索設定（LTM用） |

## 現在のステータス

### ✅ 完了

- [x] AgentCore Runtime デプロイ（omikuji_agent-JkUdnzGA2D）
- [x] Strands Agent 基本実装
- [x] フロントエンド UI 完成
- [x] Amplify Hosting デプロイ
- [x] おみくじ機能稼働
- [x] チャット機能稼働
- [x] **Strands + AgentCore Memory 統合** ✨
  - AgentCoreMemorySessionManager 実装
  - セッション管理の修正（36文字以上のセッションID）
  - おみくじ/チャット分離（action パラメータ）
- [x] **CodeBuild GitHub 連携** 🚀
  - GitHub リポジトリから直接ビルド（S3 ZIP 廃止）
  - 再現性のあるデプロイフロー確立

### 📋 TODO

- [ ] Code Interpreter 統合（統計・グラフ生成）
- [ ] Long-Term Memory (LTM) 対応
- [ ] actor_id のユーザー個別化（現在は全ユーザー共通）
- [ ] Cognito 認証連携
- [ ] CloudWatch GenAI Dashboard 設定

## AgentCore Runtime 情報

| 項目 | 値 |
|------|-----|
| **Runtime Name** | omikuji_agent |
| **Runtime ID** | omikuji_agent-JkUdnzGA2D |
| **Runtime ARN** | arn:aws:bedrock-agentcore:ap-northeast-1:226484346947:runtime/omikuji_agent-JkUdnzGA2D |
| **Role ARN** | arn:aws:iam::226484346947:role/AmazonBedrockAgentCoreSDKRuntime-ap-northeast-1-e72c1a7c7a |
| **Memory ID** | my_agent_mem-W3DiyUCFmg |
| **Status** | READY |
| **ECR Repository** | bedrock-agentcore-my_agent |
| **CodeBuild Project** | bedrock-agentcore-my_agent-builder |

## 参考リンク

### AWS 公式

- [Amazon Bedrock AgentCore](https://aws.amazon.com/bedrock/agentcore/)
- [AgentCore Memory ドキュメント](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/memory.html)
- [Strands SDK Memory 統合](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/strands-sdk-memory.html)

### Strands Agents

- [Strands Agents 公式サイト](https://strandsagents.com/latest/)
- [AgentCore Memory Session Manager](https://strandsagents.com/latest/documentation/docs/community/session-managers/agentcore-memory/)
- [GitHub: bedrock-agentcore-sdk-python](https://github.com/aws/bedrock-agentcore-sdk-python/)

### チュートリアル

- [AWS re:Invent 2025 - Build observable AI agents with Strands](https://www.youtube.com/watch?v=RQfW7eQsXqk)
- [Making AI Agents Remember: Amazon Bedrock Agent Core Memory](https://dev.to/aws/bring-ai-agents-with-long-term-memory-into-production-in-minutes-338l)

## ライセンス

MIT License

## 作者

Made with 💕 and Strands Agents 🧵

---

**本番サイト**: https://main.d41aq4729k4l7.amplifyapp.com

**2025.12 対応版** - Strands Agents + AgentCore Memory 統合構成
