# AI おみくじエージェント 🎴✨

AWS Bedrock AgentCore を使ったAI占いアプリケーション

## 概要

ユーザーがおみくじを引くと、AIが運勢を占い、フレンドリーなギャル語風メッセージでラッキーアイテムやスポットをお知らせします。Memory機能により過去の履歴を記憶し、パーソナライズされたアドバイスを提供します。

## アーキテクチャ

### 推奨構成: Amplify Gen2 + AgentCore 直接連携（Lambda不要）

Amplify Gen2 の **HTTP Data Source** を使って、AppSync から AgentCore Runtime の `InvokeAgentRuntime` API を直接呼び出せます。Lambda 不要でシンプルかつ高速な構成が可能です。

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
│  │  │                                                    │             │   │ │
│  │  │                                    ┌───────────────┘             │   │ │
│  │  │                                    │ InvokeAgentRuntime          │   │ │
│  │  └────────────────────────────────────┼─────────────────────────────┘   │ │
│  │                                       ▼                                 │ │
│  │                         ┌────────────────────────────┐                  │ │
│  │                         │   Bedrock AgentCore        │                  │ │
│  │                         │   Runtime                  │                  │ │
│  │                         │   ┌──────────────────────┐ │                  │ │
│  │                         │   │  omikuji_agent.py    │ │                  │ │
│  │                         │   │  (Direct Deploy)     │ │                  │ │
│  │                         │   │  Python 3.10-3.13    │ │                  │ │
│  │                         │   └──────────────────────┘ │                  │ │
│  │                         │              │             │                  │ │
│  │                         │   ┌──────────┴───────────┐ │                  │ │
│  │                         │   │                      │ │                  │ │
│  │                         │   ▼                      ▼ │                  │ │
│  │                         │ ┌────────────┐ ┌─────────┐│                  │ │
│  │                         │ │  Memory    │ │  Code   ││                  │ │
│  │                         │ │ (会話履歴) │ │Interpret││                  │ │
│  │                         │ └────────────┘ └─────────┘│                  │ │
│  │                         │              │             │                  │ │
│  │                         │              ▼             │                  │ │
│  │                         │   ┌──────────────────────┐ │                  │ │
│  │                         │   │   Bedrock Claude     │ │                  │ │
│  │                         │   │   (Sonnet 4 / Haiku) │ │                  │ │
│  │                         │   └──────────────────────┘ │                  │ │
│  │                         └────────────────────────────┘                  │ │
│  │                                                                         │ │
│  │  ┌─────────────────┐                         ┌─────────────────────┐   │ │
│  │  │  CloudWatch     │                         │  CloudWatch GenAI   │   │ │
│  │  │  Logs           │                         │  Dashboard          │   │ │
│  │  └─────────────────┘                         └─────────────────────┘   │ │
│  │                                                                         │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘

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
| **Amplify Gen2 + AgentCore（推奨）** | ❌ 不要 | ❌ 不要 | 🟢 シンプル | 🚀 高速 |
| API Gateway + AgentCore | ❌ 不要 | ✅ 必要 | 🟡 中程度 | 🚀 高速 |
| Lambda 経由（従来） | ✅ 必要 | ✅ 必要 | 🔴 複雑 | ⏱️ 遅い |

## Amplify Gen2 + AgentCore 連携の実装

### 1. backend.ts - HTTP Data Source の設定

```typescript
// amplify/backend.ts
import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { Policy, PolicyStatement } from 'aws-cdk-lib/aws-iam';

const backend = defineBackend({
  auth,
  data,
});

// AgentCore Runtime を HTTP Data Source として追加
const AGENTCORE_RUNTIME_ARN = 'arn:aws:bedrock-agentcore:ap-northeast-1:226484346947:runtime/my_agent-9NBXM54pmz';
const AGENTCORE_ENDPOINT = `https://bedrock-agentcore.ap-northeast-1.amazonaws.com/runtimes/${AGENTCORE_RUNTIME_ARN}/invocations`;

const dataStack = backend.data.stack;
const dataResources = backend.data.resources;

// AgentCore HTTP Data Source
dataResources.cfnResources.cfnGraphqlApi.addPropertyOverride(
  'HttpConfig',
  {
    Endpoint: AGENTCORE_ENDPOINT,
    AuthorizationConfig: {
      AuthorizationType: 'AWS_IAM',
      AwsIamConfig: {
        SigningRegion: 'ap-northeast-1',
        SigningServiceName: 'bedrock-agentcore',
      },
    },
  }
);

// IAM Policy for AgentCore
const agentCorePolicy = new Policy(dataStack, 'AgentCorePolicy', {
  statements: [
    new PolicyStatement({
      actions: ['bedrock-agentcore:InvokeAgentRuntime'],
      resources: [AGENTCORE_RUNTIME_ARN],
    }),
  ],
});

backend.data.resources.graphqlApi.applyRemovalPolicy(
  agentCorePolicy
);
```

### 2. data/resource.ts - Schema 定義

```typescript
// amplify/data/resource.ts
import { a, defineData, type ClientSchema } from '@aws-amplify/backend';

const schema = a.schema({
  // おみくじ結果の型定義
  FortuneData: a.customType({
    fortune: a.string().required(),
    stars: a.string().required(),
    luckyColor: a.string().required(),
    luckyItem: a.string().required(),
    luckySpot: a.string().required(),
    timestamp: a.string().required(),
  }),

  OmikujiResponse: a.customType({
    result: a.string().required(),
    fortuneData: a.ref('FortuneData'),
  }),

  // AgentCore を直接呼び出すカスタムクエリ
  drawOmikuji: a
    .query()
    .arguments({
      prompt: a.string().default('おみくじを引きたい'),
      sessionId: a.string(),
    })
    .returns(a.ref('OmikujiResponse'))
    .authorization((allow) => [allow.authenticated()])
    .handler(
      a.handler.custom({
        dataSource: 'AgentCoreHttpDataSource',
        entry: './resolvers/drawOmikuji.js',
      })
    ),

  // チャット用クエリ
  chat: a
    .query()
    .arguments({
      message: a.string().required(),
      sessionId: a.string(),
    })
    .returns(a.string())
    .authorization((allow) => [allow.authenticated()])
    .handler(
      a.handler.custom({
        dataSource: 'AgentCoreHttpDataSource',
        entry: './resolvers/chat.js',
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

### 3. resolvers/drawOmikuji.js - AppSync JS Resolver

```javascript
// amplify/data/resolvers/drawOmikuji.js
import { util } from '@aws-appsync/utils';

const AGENT_RUNTIME_ARN = 'arn:aws:bedrock-agentcore:ap-northeast-1:226484346947:runtime/my_agent-9NBXM54pmz';

export function request(ctx) {
  const { prompt, sessionId } = ctx.args;
  const runtimeSessionId = sessionId || `session-${util.autoId()}`;
  
  return {
    method: 'POST',
    resourcePath: `/runtimes/${AGENT_RUNTIME_ARN}/invocations`,
    params: {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Amzn-Bedrock-AgentCore-Runtime-Session-Id': runtimeSessionId,
      },
      body: JSON.stringify({
        prompt: prompt || 'おみくじを引きたい',
      }),
    },
  };
}

export function response(ctx) {
  const { error, result } = ctx;
  
  if (error) {
    return util.error(error.message, error.type);
  }
  
  const body = JSON.parse(result.body);
  
  return {
    result: body.result,
    fortuneData: body.fortune_data,
  };
}
```

### 4. フロントエンド呼び出し

```typescript
// app/page.tsx
'use client';

import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';

const client = generateClient<Schema>();

export default function OmikujiPage() {
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const drawOmikuji = async () => {
    setLoading(true);
    try {
      const response = await client.queries.drawOmikuji({
        prompt: 'おみくじ引きたい～！',
      });
      
      if (response.data) {
        setResult(response.data.result);
        console.log('Fortune:', response.data.fortuneData);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={drawOmikuji} disabled={loading}>
        {loading ? '占い中...' : 'おみくじを引く！'}
      </button>
      {result && <p>{result}</p>}
    </div>
  );
}
```

## AgentCore Runtime デプロイ方式の比較

| 項目 | Direct Code Deploy（推奨） | Container Deploy |
|------|---------------------------|------------------|
| Docker 必要 | ❌ 不要 | ✅ 必要 |
| デプロイ時間 | 🚀 約10秒（更新時） | ⏱️ 約30秒 |
| パッケージサイズ | 250MB まで | 2GB まで |
| 対応言語 | Python 3.10-3.13 | 多言語対応 |
| セッション作成 | 25 sessions/秒 | 0.16 sessions/秒 |
| 管理コスト | 💰 低い | 💰 中程度 |

## 技術スタック

### バックエンド
| 技術 | 用途 | バージョン |
|------|------|-----------|
| AWS Bedrock AgentCore Runtime | AIエージェント基盤 | Direct Code Deploy |
| AWS AppSync | GraphQL API | Amplify Gen2 |
| Strands Agents SDK | エージェントフレームワーク | Latest |
| AWS Bedrock Claude | メッセージ生成 | Sonnet 4 / Haiku 3 |
| AgentCore Memory | 会話履歴保持 | Built-in |

### フロントエンド
| 技術 | 用途 | バージョン |
|------|------|-----------|
| Next.js (Amplify Gen2) | フロントエンド | 14.x |
| AWS Amplify Data | データクライアント | Gen2 |
| TailwindCSS | スタイリング | 3.x |
| Chart.js | グラフ描画 | Latest |

### インフラストラクチャ
| 技術 | 用途 |
|------|------|
| AWS Amplify Gen2 | ホスティング・Backend・CI/CD |
| AgentCore Starter Toolkit | エージェントデプロイ CLI |
| CloudWatch Logs | ログ監視 |

## プロジェクト構成

```
omikuji-agent/
├── README.md                          # このファイル
├── requirements.txt                   # Python依存関係
├── pyproject.toml                     # uv プロジェクト設定
│
├── omikuji_agent.py                   # AgentCore メインエージェント
├── my_agent.py                        # AgentCore 基礎版エージェント
│
├── nextjs-app/                        # Amplify Gen2 アプリ
│   ├── amplify/                       # Amplify Backend
│   │   ├── backend.ts                 # Backend 定義 + AgentCore 連携
│   │   ├── auth/                      # Cognito 認証
│   │   └── data/                      # AppSync + AgentCore
│   │       ├── resource.ts            # Schema 定義
│   │       └── resolvers/             # AppSync JS Resolvers
│   │           ├── drawOmikuji.js     # おみくじResolver
│   │           └── chat.js            # チャットResolver
│   ├── app/                           # Next.js App Router
│   └── lib/                           # ユーティリティ
│
├── public/                            # 静的ファイル（代替UI）
│   └── index.html
│
└── amplify.yml                        # Amplify ビルド設定
```

## セットアップ

### 前提条件
- AWS アカウント
- AWS CLI v2 設定済み
- Node.js 18+
- Python 3.10〜3.13
- **uv** パッケージマネージャー（推奨）

### 1. AgentCore エージェントのデプロイ

```bash
# プロジェクト初期化
uv init omikuji-agent --python 3.13
cd omikuji-agent

# 依存関係インストール
uv add bedrock-agentcore strands-agents strands-agents-tools
uv add --dev bedrock-agentcore-starter-toolkit

# ローカルテスト
source .venv/bin/activate
uv run omikuji_agent.py

# AgentCore Runtime へデプロイ
agentcore configure --entrypoint omikuji_agent.py --name omikuji-agent
# → "Code Zip" を選択

# テスト
agentcore invoke '{"prompt":"おみくじ引きたい～！"}'
```

### 2. Amplify Gen2 アプリのセットアップ

```bash
cd nextjs-app
npm install

# Amplify Sandbox 起動（開発環境）
npx ampx sandbox

# 別ターミナルで Next.js 起動
npm run dev
```

### 3. 本番デプロイ

```bash
# Git にプッシュ → Amplify Hosting が自動デプロイ
git push origin main

# または CLI でデプロイ
npx ampx pipeline-deploy --branch main
```

## API リファレンス

### GraphQL Queries

```graphql
# おみくじを引く
query DrawOmikuji($prompt: String, $sessionId: String) {
  drawOmikuji(prompt: $prompt, sessionId: $sessionId) {
    result
    fortuneData {
      fortune
      stars
      luckyColor
      luckyItem
      luckySpot
      timestamp
    }
  }
}

# AIとチャット
query Chat($message: String!, $sessionId: String) {
  chat(message: $message, sessionId: $sessionId)
}
```

### TypeScript Client

```typescript
// おみくじを引く
const { data } = await client.queries.drawOmikuji({
  prompt: 'おみくじ引きたい～！',
  sessionId: 'user-session-123',
});

// チャット
const { data } = await client.queries.chat({
  message: '今日の運勢どう？',
  sessionId: 'user-session-123',
});
```

## 機能一覧

### コア機能
- 🎴 **おみくじ機能**: AIがランダムに運勢を占い、結果を表示
- 💬 **チャット機能**: おみくじ結果についてAIと会話
- 📊 **統計機能**: 過去のおみくじ結果をグラフで可視化
- 📜 **履歴機能**: 過去のおみくじ結果を一覧表示

### AgentCore 機能
- 🧠 **Memory**: 会話履歴を保持し、パーソナライズされた応答
- 🐍 **Code Interpreter**: 統計分析やグラフ生成
- 🔍 **Observability**: CloudWatch GenAI Dashboard でリアルタイム監視
- 🛡️ **Policy Controls**: エージェントの動作制御

## トラブルシューティング

### よくある問題

#### 1. AppSync から AgentCore への接続エラー

```
解決策: 
- IAM Policy に bedrock-agentcore:InvokeAgentRuntime 権限を追加
- HTTP Data Source の署名設定を確認（SigningServiceName: 'bedrock-agentcore'）
```

#### 2. セッション管理エラー

```
解決策:
- X-Amzn-Bedrock-AgentCore-Runtime-Session-Id ヘッダーを必ず設定
- セッションIDは一意な値を使用（UUID推奨）
```

#### 3. Claude モデルアクセスエラー

```
解決策: AWS Console → Bedrock → Model access で
Claude Sonnet 4 または Claude 3 Haiku のアクセスを有効化
```

#### 4. ストリーミングレスポンス

```
注意: AppSync は現在ストリーミングをサポートしていません
長時間のレスポンスが必要な場合は、WebSocket Subscriptions の使用を検討
```

## ロードマップ

- [x] AgentCore Direct Code Deployment 対応
- [x] Amplify Gen2 + AgentCore 直接連携
- [ ] WebSocket によるストリーミング対応
- [ ] Agent-to-Agent Protocol 連携
- [ ] おみくじ履歴のDynamoDB永続化
- [ ] SNSシェア機能
- [ ] 多言語対応

## 参考リンク

- [Amazon Bedrock AgentCore](https://aws.amazon.com/bedrock/agentcore/)
- [Amplify Gen2 - Connect to Amazon Bedrock](https://docs.amplify.aws/react/build-a-backend/data/custom-business-logic/connect-bedrock/)
- [Amplify Gen2 - HTTP Data Source](https://docs.amplify.aws/react/build-a-backend/data/custom-business-logic/connect-http-datasource/)
- [AgentCore InvokeAgentRuntime API](https://docs.aws.amazon.com/bedrock-agentcore/latest/APIReference/API_InvokeAgentRuntime.html)
- [Strands Agents SDK](https://strandsagents.com/latest/)

## ライセンス

MIT License

## 作者

Made with 💕

---

**エンドポイント**
- AgentCore ARN: `arn:aws:bedrock-agentcore:ap-northeast-1:226484346947:runtime/my_agent-9NBXM54pmz`
