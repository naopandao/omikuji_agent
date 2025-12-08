# おみくじエージェント - AWS Amplify Gen2

AWS Bedrock AgentCore を使ったAI占いアプリ！✨

## アーキテクチャ 🏗️

```
Frontend (Next.js 14 + TypeScript)
    ↓ API Routes
Backend (Amplify Gen2 Functions)
    ↓ AWS SDK
AWS Bedrock AgentCore Runtime
```

### 主要技術スタック

- **Frontend**: Next.js 14, React 18, TypeScript, TailwindCSS
- **Backend**: AWS Amplify Gen2 (Lambda Functions)
- **AI**: AWS Bedrock AgentCore Runtime
- **Auth**: Amazon Cognito (Amplify Auth)
- **Database**: AWS AppSync + DynamoDB (Amplify Data)
- **Infrastructure**: AWS CDK (Amplify が自動管理)

## プロジェクト構成 📁

```
nextjs-app/
├── amplify/                    # Amplify Gen2 Backend
│   ├── auth/                   # 認証設定
│   ├── data/                   # GraphQL API + DynamoDB
│   ├── functions/              # Lambda Functions
│   │   ├── invoke-agent/       # AgentCore 呼び出し
│   │   └── omikuji/            # おみくじ生成
│   └── backend.ts              # Backend 定義
├── app/                        # Next.js App Router
│   ├── api/                    # API Routes
│   │   ├── omikuji/
│   │   └── chat/
│   ├── layout.tsx
│   ├── page.tsx                # メインページ
│   └── globals.css
├── lib/                        # ライブラリ
│   ├── amplify-client.ts       # Client-side Amplify
│   ├── amplify-server.ts       # Server-side Amplify
│   └── api.ts                  # API クライアント
└── public/                     # 静的ファイル
```

## セットアップ 🚀

### 1. 依存関係のインストール

```bash
cd nextjs-app
npm install
```

### 2. AWS 認証情報の設定

```bash
# AWS CLI でログイン
aws configure

# または環境変数で設定
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key
export AWS_REGION=ap-northeast-1
```

### 3. Amplify Sandbox の起動

```bash
# バックエンドをローカルでデプロイ（開発環境）
npm run amplify:sandbox
```

これにより：
- Lambda Functions がデプロイされる
- Cognito User Pool が作成される
- AppSync API + DynamoDB が作成される
- `amplify_outputs.json` が生成される

### 4. Next.js 開発サーバーの起動

```bash
# 別のターミナルで
npm run dev
```

http://localhost:3000 にアクセス！

## 本番デプロイ 🚢

### Amplify Hosting にデプロイ

1. **Git リポジトリをプッシュ**

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/your-username/your-repo.git
git push -u origin main
```

2. **AWS Amplify Console でアプリを作成**

- AWS Console → Amplify → 「新しいアプリを作成」
- GitHub リポジトリを接続
- Branch: `main`
- Build settings は自動検出される

3. **環境変数を設定**

Amplify Console で以下を設定：
- `AGENT_ID`: Bedrock AgentCore の Agent ID
- `AGENT_ALIAS_ID`: Agent Alias ID
- `BEDROCK_REGION`: ap-northeast-1

4. **デプロイ**

```bash
# または CLI でデプロイ
npm run amplify:deploy
```

## 環境変数 ⚙️

### `.env.local` (ローカル開発用)

```env
AWS_REGION=ap-northeast-1
AWS_ACCOUNT_ID=your_account_id
AGENT_ID=my_agent-9NBXM54pmz
AGENT_ALIAS_ID=TSTALIASID
BEDROCK_REGION=ap-northeast-1
OMIKUJI_FUNCTION_NAME=omikuji
INVOKE_AGENT_FUNCTION_NAME=invoke-agent
```

### Amplify Hosting (本番環境)

Amplify Console の「環境変数」セクションで設定します。

## API エンドポイント 📡

### POST /api/omikuji

おみくじを引く

**Request:**
```json
{
  "userId": "guest"
}
```

**Response:**
```json
{
  "result": "...",
  "fortune_data": {
    "fortune": "大吉",
    "stars": "★★★★★",
    "luckyColor": "赤",
    "luckyItem": "スマホ",
    "luckySpot": "カフェ",
    "timestamp": "2024-12-04T10:00:00.000Z"
  },
  "sessionId": "omikuji-1234567890"
}
```

### POST /api/chat

AgentCore とチャット

**Request:**
```json
{
  "message": "今日の運勢は？",
  "sessionId": "chat-1234567890"
}
```

**Response:**
```json
{
  "response": "今日は良い日ですよ！",
  "sessionId": "chat-1234567890"
}
```

## トラブルシューティング 🔧

### Lambda Function が見つからない

Amplify Sandbox を起動した後、`amplify_outputs.json` に正しい Function 名が記載されているか確認してください。

### AgentCore の権限エラー

Lambda の IAM Role に以下の権限が必要です：
- `bedrock:InvokeAgent`
- `bedrock-agent-runtime:InvokeAgent`

`amplify/backend.ts` で自動設定されます。

### 認証エラー

Amplify Auth の設定を確認：
```bash
npx ampx sandbox --profile your-aws-profile
```

## 開発ワークフロー 👩‍💻

1. **機能追加**
   - `app/` でフロントエンド開発
   - `amplify/functions/` でバックエンド開発

2. **テスト**
   - `npm run dev` でローカルテスト
   - `npm run amplify:sandbox` でバックエンドテスト

3. **デプロイ**
   - Git push → 自動デプロイ
   - または `npm run amplify:deploy`

## 今後の機能 🎯

- [ ] チャット機能の UI 実装
- [ ] おみくじ履歴の表示
- [ ] ユーザー認証機能
- [ ] おみくじ統計・分析
- [ ] シェア機能
- [ ] おみくじのカスタマイズ

## ライセンス 📄

MIT License

## 作者 ✨

Made with 💕 by Nana
