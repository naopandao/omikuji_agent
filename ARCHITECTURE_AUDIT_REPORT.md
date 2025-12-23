# アーキテクチャ監査レポート 🔍

**監査日時**: 2025-12-20  
**対象プロジェクト**: omikuji_agent  
**AWS Account**: 226484346947  
**Region**: ap-northeast-1

---

## 📊 監査結果サマリー

| 項目 | README.md記載 | 実際のデプロイ状態 | 状態 |
|------|--------------|------------------|------|
| **アーキテクチャ** | Amplify Gen2 + AppSync + HTTP Data Source | **Next.js SSR + API Route** | ⚠️ **不一致** |
| **AgentCore接続** | AppSync HTTP Data Source経由 | **API Route経由（直接SDK呼び出し）** | ⚠️ **不一致** |
| **Lambda** | 不要（推奨構成） | **不要（実装済み）** | ✅ 一致 |
| **Amplify Backend** | Gen2 Backend定義あり | **Backend定義なし** | ❌ **未実装** |
| **Cognito認証** | 実装済み | **実装済み（未使用）** | 🟡 部分一致 |
| **DynamoDB** | 履歴保存 | **テーブル作成済み（未使用）** | 🟡 部分一致 |
| **IAM Role** | AmplifySSRComputeRole | **設定済み** | ✅ 一致 |

---

## 🏗️ 実際のアーキテクチャ

### 現行構成（実装済み）

```
┌────────────┐     ┌─────────────────────────────────────┐     ┌─────────────────────┐
│            │     │        Amplify Hosting              │     │                     │
│  ブラウザ   │────▶│  Next.js SSR (WEB_COMPUTE)         │────▶│  AgentCore Runtime  │
│  (React)   │     │  /api/omikuji (API Route)          │     │  my_agent-9NBXM54pmz│
│            │     │                                     │     │                     │
└────────────┘     └─────────────────────────────────────┘     └──────────┬──────────┘
                              │                                           │
                              │ AmplifySSRComputeRole                     │
                              │ (IAM認証)                                 ▼
                              │                                 ┌─────────────────────┐
                              │                                 │   Bedrock Claude    │
                              │                                 │   (AI生成)          │
                              └─────────────────────────────────└─────────────────────┘
```

**特徴:**
- ✅ Lambda不要（Next.js API Routeで処理）
- ✅ AgentCore Runtime直接呼び出し（@aws-sdk/client-bedrock-agentcore使用）
- ✅ IAM認証済み（AmplifySSRComputeRole）
- ⚠️ AppSync未使用
- ⚠️ Amplify Gen2 Backend未定義

---

## 📋 詳細監査結果

### 1. Amplify Hosting

**実態:**
```json
{
  "appId": "d41aq4729k4l7",
  "name": "omikuji_agent",
  "platform": "WEB_COMPUTE",
  "framework": "Next.js - SSR",
  "defaultDomain": "d41aq4729k4l7.amplifyapp.com",
  "productionBranch": {
    "branchName": "main",
    "status": "SUCCEED",
    "lastDeployTime": "2025-12-18T11:13:12.226000+09:00"
  }
}
```

**評価:**
- ✅ WEB_COMPUTE（SSR）モードで稼働中
- ✅ 本番デプロイ成功
- ✅ Next.js SSRフレームワーク認識済み

---

### 2. AppSync GraphQL API

**実態:**
```json
{
  "apiId": "2vlq6e2jnvadxjsogoxuzt4ikm",
  "name": "amplifyData",
  "authenticationType": "AWS_IAM",
  "dataSources": [
    {
      "name": "ChatMessageTable",
      "type": "AMAZON_DYNAMODB"
    },
    {
      "name": "FortuneResultTable",
      "type": "AMAZON_DYNAMODB"
    },
    {
      "name": "NONE_DS",
      "type": "NONE"
    }
  ]
}
```

**評価:**
- ✅ AppSync API作成済み
- ❌ **HTTP Data Source（AgentCore接続）が存在しない**
- ✅ DynamoDBテーブル接続済み（ChatMessage, FortuneResult）
- ⚠️ **AppSync経由のAgentCore呼び出しは未実装**

**問題点:**
README.mdでは「AppSync → HTTP Data Source → AgentCore Runtime」と記載されているが、実際にはHTTP Data Sourceが設定されていない。

---

### 3. AgentCore Runtime接続

**実装方法:**
```typescript
// nextjs-app/app/api/omikuji/route.ts
const { BedrockAgentCoreClient, InvokeAgentRuntimeCommand } = 
  await import('@aws-sdk/client-bedrock-agentcore');

const client = new BedrockAgentCoreClient({
  region: AWS_REGION,
});

const command = new InvokeAgentRuntimeCommand({
  agentRuntimeArn: AGENT_RUNTIME_ARN,
  payload: Buffer.from(JSON.stringify({ 
    prompt,
    session_id: sessionId 
  }), 'utf-8'),
});

const response = await client.send(command);
```

**評価:**
- ✅ AWS SDK v3で直接AgentCore呼び出し
- ✅ ストリーミングレスポンス対応
- ✅ フォールバック機能実装済み
- ⚠️ AppSync経由ではなくAPI Route経由

**AgentCore Runtime情報:**
```
Runtime ARN: arn:aws:bedrock-agentcore:ap-northeast-1:226484346947:runtime/my_agent-9NBXM54pmz
エンドポイント: DEFAULT (READY)
ステータス: READY
```

**注意:** AWS CLIでは`bedrock-agentcore`コマンドがまだサポートされていないため、CLIでの確認は不可。

---

### 4. IAM Role & Permissions

**AmplifySSRComputeRole:**
```json
{
  "RoleName": "AmplifySSRComputeRole",
  "Arn": "arn:aws:iam::226484346947:role/AmplifySSRComputeRole",
  "PolicyName": "AgentCoreInvokePolicy",
  "PolicyDocument": {
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": "bedrock-agentcore:InvokeAgentRuntime",
        "Resource": "arn:aws:bedrock-agentcore:ap-northeast-1:226484346947:runtime/*"
      }
    ]
  }
}
```

**評価:**
- ✅ AgentCore呼び出し権限付与済み
- ✅ ワイルドカードでruntime/*を許可
- ✅ 正しいリージョン（ap-northeast-1）

---

### 5. Cognito User Pool

**実態:**
```json
{
  "Id": "ap-northeast-1_U6WhqunVB",
  "Name": "amplifyAuthUserPool4BA7F805-PCLHQsf6j2jq",
  "EstimatedNumberOfUsers": 0,
  "Status": "ACTIVE"
}
```

**評価:**
- ✅ Cognito User Pool作成済み
- ⚠️ **フロントエンドで認証機能未実装**
- ⚠️ ユーザー数0（未使用）

---

### 6. DynamoDB Tables

**実態:**
```
ChatMessage-2vlq6e2jnvadxjsogoxuzt4ikm-NONE
FortuneResult-2vlq6e2jnvadxjsogoxuzt4ikm-NONE
```

**評価:**
- ✅ テーブル作成済み
- ⚠️ **API Routeから使用されていない**
- ⚠️ AppSync経由のデータ保存も未実装

---

### 7. Amplify Gen2 Backend

**実態:**
```bash
# nextjs-app/amplify/ ディレクトリが存在しない
Error: Directory /Users/nana-tokiwa/YX/yunixy-dev/omikuji_agent/nextjs-app/amplify does not exist
```

**評価:**
- ❌ **Amplify Gen2 Backend定義ファイルが存在しない**
- ❌ `backend.ts`, `auth/resource.ts`, `data/resource.ts` などが削除されている
- ⚠️ README.mdの構成例と完全に不一致

**Git履歴:**
```
deleted: nextjs-app/amplify/auth/resource.ts
deleted: nextjs-app/amplify/backend.ts
deleted: nextjs-app/amplify/data/resource.ts
deleted: nextjs-app/amplify/functions/invoke-agent/handler.ts
deleted: nextjs-app/amplify/functions/invoke-agent/resource.ts
deleted: nextjs-app/amplify/functions/omikuji/handler.ts
deleted: nextjs-app/amplify/functions/omikuji/resource.ts
```

---

## 🔍 README.mdとの差異

### README.md記載の「推奨構成」

```
Client → Amplify Gen2 → AppSync → HTTP Data Source → AgentCore Runtime
```

**特徴:**
- Lambda不要
- AppSync HTTP Data Sourceで直接AgentCore呼び出し
- Amplify Gen2 Backend定義
- Cognito認証連携
- DynamoDB履歴保存

### 実際の「現行構成」

```
Client → Amplify Hosting → Next.js API Route → AgentCore Runtime (AWS SDK)
```

**特徴:**
- Lambda不要（✅ 一致）
- API Route経由でAgentCore呼び出し（⚠️ 不一致）
- Amplify Gen2 Backend未定義（❌ 不一致）
- Cognito未使用（⚠️ 不一致）
- DynamoDB未使用（⚠️ 不一致）

---

## 📈 実装状況

### ✅ 完了（動作中）

1. **Amplify Hosting (WEB_COMPUTE)**
   - Next.js SSRデプロイ済み
   - 本番環境稼働中
   - URL: https://main.d41aq4729k4l7.amplifyapp.com

2. **AgentCore Runtime連携**
   - API Route経由で呼び出し成功
   - ストリーミングレスポンス対応
   - フォールバック機能実装

3. **IAM認証**
   - AmplifySSRComputeRole設定済み
   - AgentCore呼び出し権限付与

4. **フロントエンドUI**
   - おみくじ機能実装
   - ギャル語AIメッセージ表示
   - レスポンシブデザイン

### 🟡 部分実装（未使用）

1. **AppSync GraphQL API**
   - API作成済み
   - DynamoDB Data Source設定済み
   - **HTTP Data Source未設定**
   - フロントエンドから未使用

2. **Cognito User Pool**
   - User Pool作成済み
   - **認証機能未実装**

3. **DynamoDB Tables**
   - ChatMessage, FortuneResultテーブル作成済み
   - **データ保存未実装**

### ❌ 未実装

1. **Amplify Gen2 Backend**
   - `amplify/` ディレクトリ削除済み
   - Backend定義ファイルなし
   - AppSync Resolverなし

2. **Memory機能**
   - AgentCore Memory未設定
   - 会話履歴保持なし

3. **Code Interpreter統計機能**
   - グラフ生成未実装
   - 統計分析未実装

---

## 🎯 推奨アクション

### 優先度: 高 🔴

1. **README.mdの修正**
   - 現行アーキテクチャ（API Route方式）に記載を更新
   - 「推奨構成」と「現行構成」を明確に分離
   - 実装済み機能と未実装機能を明記

2. **アーキテクチャの選択**
   
   **Option A: 現行構成を継続（API Route方式）**
   - メリット: シンプル、既に動作中
   - デメリット: AppSync/DynamoDBが未使用
   - 必要作業: README.md更新のみ

   **Option B: 推奨構成へ移行（AppSync + HTTP Data Source）**
   - メリット: README.md記載通り、GraphQL活用
   - デメリット: 大規模な実装変更が必要
   - 必要作業: 
     - Amplify Gen2 Backend再構築
     - AppSync HTTP Data Source設定
     - API Route → AppSync移行
     - フロントエンドGraphQLクライアント実装

### 優先度: 中 🟡

3. **DynamoDB履歴保存の実装**
   - 既存テーブルを活用
   - おみくじ結果の永続化
   - 過去履歴の表示機能

4. **Cognito認証の実装**
   - ユーザーログイン機能
   - セッション管理
   - ユーザーごとの履歴分離

### 優先度: 低 🟢

5. **Memory機能の有効化**
   - AgentCore Memory設定
   - パーソナライズされた応答

6. **Code Interpreter統計機能**
   - グラフ生成
   - 運勢の統計分析

---

## 📝 結論

### 現状評価

**良い点:**
- ✅ AgentCore Runtime連携が動作している
- ✅ Lambda不要のシンプルな構成
- ✅ IAM認証が正しく設定されている
- ✅ フロントエンドUIが完成している

**問題点:**
- ❌ README.mdの記載と実装が大きく乖離
- ❌ Amplify Gen2 Backendが削除されている
- ⚠️ AppSync/Cognito/DynamoDBが未使用
- ⚠️ 推奨構成（AppSync + HTTP Data Source）が未実装

### 推奨方針

**短期（即座に対応）:**
1. README.mdを現行アーキテクチャに合わせて更新
2. 「現行構成」と「目標構成」を明確に分離
3. 実装済み機能のステータスを正確に記載

**中期（次のイテレーション）:**
1. アーキテクチャ方針を決定（API Route継続 or AppSync移行）
2. 決定した方針に基づいて実装を進める
3. 未使用リソース（AppSync/DynamoDB）の活用または削除

**長期（将来の拡張）:**
1. Memory機能の有効化
2. Code Interpreter統計機能の実装
3. マルチユーザー対応（Cognito認証）

---

## 📊 リソース一覧

### 稼働中のAWSリソース

| サービス | リソース名/ID | 用途 | 状態 |
|---------|-------------|------|------|
| Amplify Hosting | d41aq4729k4l7 | フロントエンド | ✅ 稼働中 |
| AppSync | 2vlq6e2jnvadxjsogoxuzt4ikm | GraphQL API | 🟡 未使用 |
| Cognito | ap-northeast-1_U6WhqunVB | 認証 | 🟡 未使用 |
| DynamoDB | ChatMessage-2vlq6e2jnvadxjsogoxuzt4ikm-NONE | チャット履歴 | 🟡 未使用 |
| DynamoDB | FortuneResult-2vlq6e2jnvadxjsogoxuzt4ikm-NONE | おみくじ履歴 | 🟡 未使用 |
| IAM Role | AmplifySSRComputeRole | SSR実行権限 | ✅ 使用中 |
| AgentCore Runtime | my_agent-9NBXM54pmz | AIエージェント | ✅ 稼働中 |

---

**監査実施者**: AI Assistant  
**レポート作成日**: 2025-12-20

