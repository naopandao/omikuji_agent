# セットアップガイド 🎯

## 元のコードから Amplify Gen2 へ移行したよ！

### 🔄 主な変更点

#### Before (Cloudflare Workers + Lambda)
```
Frontend (HTML + Vanilla JS)
    ↓
Hono on Cloudflare Workers
    ↓ HTTP Request
Lambda Function (Python)
    ↓
AWS Bedrock AgentCore
```

#### After (Amplify Gen2)
```
Frontend (Next.js 14 + React)
    ↓
Next.js API Routes
    ↓
Amplify Gen2 Functions (Lambda)
    ↓
AWS Bedrock AgentCore
```

### ✨ メリット

1. **統合された開発体験**
   - すべて AWS で完結
   - Amplify CLI で一括管理
   - 環境変数・シークレット管理が楽

2. **自動的な権限管理**
   - IAM Role が自動設定
   - Bedrock の権限も自動付与
   - セキュリティベストプラクティス

3. **スケーラブル**
   - Lambda の自動スケーリング
   - Cognito で認証管理
   - DynamoDB でデータ永続化

4. **デプロイが簡単**
   - Git push で自動デプロイ
   - プレビュー環境も自動作成
   - ロールバックも簡単

## 🏃 クイックスタート

### 1. 依存関係のインストール

```bash
cd /home/user/webapp/nextjs-app
npm install
```

**注意**: インストールに時間がかかる場合があります（5-10分）

### 2. AWS 認証情報の確認

すでに設定されているはずですが、確認：

```bash
aws configure list
aws sts get-caller-identity
```

### 3. Amplify Sandbox の起動

```bash
# バックエンドをデプロイ（初回は10-15分かかる）
npx ampx sandbox
```

これにより自動的に：
- ✅ Lambda Functions がデプロイされる
- ✅ Cognito User Pool が作成される
- ✅ AppSync API + DynamoDB が作成される
- ✅ IAM Roles が設定される（Bedrock 権限付き）
- ✅ `amplify_outputs.json` が生成される

**待機中にやること:**
- ☕ コーヒー飲む
- 📖 README.md を読む
- 🎵 音楽聴く

### 4. 環境変数の確認

`amplify_outputs.json` が生成されたら、内容を確認：

```bash
cat amplify_outputs.json
```

Lambda Function の名前をメモして `.env.local` を更新：

```env
# Lambda Function Names (実際の名前に置き換え)
OMIKUJI_FUNCTION_NAME=omikuji-XXXXXXXX
INVOKE_AGENT_FUNCTION_NAME=invoke-agent-XXXXXXXX
```

### 5. Next.js 開発サーバーの起動

**別のターミナルで:**

```bash
cd /home/user/webapp/nextjs-app
npm run dev
```

http://localhost:3000 にアクセス！🎉

### 6. テスト

1. **おみくじを引く**
   - 「おみくじを引く」ボタンをクリック
   - AgentCore が呼び出される
   - 結果が表示される

2. **ログを確認**
   ```bash
   # Lambda のログを見る
   aws logs tail /aws/lambda/omikuji-XXXXXXXX --follow
   ```

## 🐛 トラブルシューティング

### エラー: `amplify_outputs.json not found`

**原因**: Amplify Sandbox がまだ起動していない

**解決策**:
```bash
npx ampx sandbox
# 完了するまで待つ（10-15分）
```

### エラー: `AccessDeniedException: User is not authorized to perform: bedrock:InvokeAgent`

**原因**: Lambda の IAM Role に権限がない

**解決策**:
`amplify/backend.ts` を確認して、以下が含まれているか確認：

```typescript
const bedrockPolicy = new PolicyStatement({
  actions: [
    'bedrock:InvokeAgent',
    'bedrock-agent-runtime:InvokeAgent',
  ],
  resources: ['*'],
});

backend.omikujiFunction.resources.lambda.addToRolePolicy(bedrockPolicy);
```

その後、再デプロイ：
```bash
npx ampx sandbox --profile your-aws-profile
```

### エラー: `Function not found`

**原因**: Lambda Function の名前が間違っている

**解決策**:
1. `amplify_outputs.json` で実際の Function 名を確認
2. `.env.local` を更新
3. Next.js を再起動

```bash
# Function 名を確認
cat amplify_outputs.json | grep functions

# .env.local を更新
nano .env.local

# Next.js 再起動
npm run dev
```

### エラー: `npm install` がタイムアウト

**解決策**:
```bash
# キャッシュをクリア
npm cache clean --force

# 再試行
npm install --legacy-peer-deps
```

## 📊 動作確認チェックリスト

- [ ] `npm install` が成功
- [ ] `npx ampx sandbox` が完了
- [ ] `amplify_outputs.json` が生成された
- [ ] Lambda Functions が AWS Console で確認できる
- [ ] `npm run dev` でサーバーが起動
- [ ] http://localhost:3000 にアクセスできる
- [ ] おみくじボタンが動作する
- [ ] 結果が表示される
- [ ] Lambda のログが出力されている

## 🚢 本番デプロイ準備

### 1. GitHub リポジトリにプッシュ

```bash
cd /home/user/webapp/nextjs-app

git init
git add .
git commit -m "Initial commit: Amplify Gen2 おみくじエージェント"

# GitHub に push
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git branch -M main
git push -u origin main
```

### 2. Amplify Hosting でアプリを作成

1. AWS Console → Amplify
2. 「新しいアプリを作成」
3. GitHub リポジトリを接続
4. Branch: `main` を選択
5. Build settings は自動検出される
6. 「デプロイ」をクリック

### 3. 環境変数を設定

Amplify Console → 「環境変数」で設定：

```
AGENT_ID=my_agent-9NBXM54pmz
AGENT_ALIAS_ID=TSTALIASID
BEDROCK_REGION=ap-northeast-1
AWS_REGION=ap-northeast-1
```

### 4. デプロイ完了！

URL が発行されるので、アクセスして確認！🎉

例: `https://main.d1234567890abc.amplifyapp.com`

## 💡 次にやること

- [ ] チャット UI を追加
- [ ] ユーザー認証を有効化
- [ ] おみくじ履歴を表示
- [ ] 統計ページを作成
- [ ] シェア機能を追加

## 🎓 学習リソース

- [Amplify Gen2 Documentation](https://docs.amplify.aws/)
- [Next.js Documentation](https://nextjs.org/docs)
- [AWS Bedrock AgentCore Guide](https://docs.aws.amazon.com/bedrock/latest/userguide/agents.html)

## 🆘 ヘルプ

問題が解決しない場合：

1. **GitHub Issues を確認**
2. **AWS Support に問い合わせ**
3. **Community Forums で質問**

頑張ってね〜！✨
