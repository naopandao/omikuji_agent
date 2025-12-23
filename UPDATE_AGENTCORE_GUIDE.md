# AgentCore Runtime 更新ガイド

## 問題
`omikuji_agent.py` を修正したが、AgentCore Runtime に反映されていないため、チャット機能が正しく動作しない。

## 解決方法

### オプション1: AWS Console から更新（推奨）

1. **AWS Console にログイン**
   ```
   https://ap-northeast-1.console.aws.amazon.com/
   ```

2. **Bedrock サービスに移動**
   - サービス検索で "Bedrock" を検索
   - Amazon Bedrock を選択

3. **Agents を選択**
   - 左側メニューから "Agents" または "Agent Runtimes" を選択

4. **該当のエージェントを探す**
   - Runtime ID: `my_agent-9NBXM54pmz`
   - または名前で検索: `omikuji-agent`, `my_agent` など

5. **Update / Edit / Redeploy ボタンをクリック**

6. **コードを更新**
   - `omikuji_agent.py` の最新版をアップロード
   - または GitHub リポジトリから pull するよう設定

### オプション2: Lambda としてデプロイされている場合

もし AgentCore Runtime が Lambda 関数として実装されている場合：

1. **Lambda Console に移動**
   ```
   https://ap-northeast-1.console.aws.amazon.com/lambda/home?region=ap-northeast-1#/functions
   ```

2. **関数を検索**
   - 検索: `omikuji`, `agent`, `my_agent` など

3. **コードを更新**
   - `omikuji_agent.py` の内容をコピー&ペースト
   - または .zip ファイルをアップロード

4. **Deploy ボタンをクリック**

### オプション3: ECR + Docker の場合

もし Docker コンテナとしてデプロイされている場合：

```bash
# 1. ECR リポジトリを確認
aws ecr describe-repositories --region ap-northeast-1 | grep omikuji

# 2. Dockerfile が存在するか確認
ls -la Dockerfile

# 3. イメージをビルド＆プッシュ
docker build --platform linux/arm64 -t omikuji-agent .
docker tag omikuji-agent:latest $ECR_URI/omikuji-agent:latest
docker push $ECR_URI/omikuji-agent:latest

# 4. AgentCore Runtime を更新
# AWS Console から手動で更新
```

## 修正内容の確認

更新後、以下の動作を確認：

1. おみくじを引く（例: 中吉）
2. チャットで質問（例: "中吉かーバースデーなんだけどなー"）
3. AIが正しく "中吉" を参照して応答するか確認

## 現在のARN

```
Runtime ARN: arn:aws:bedrock-agentcore:ap-northeast-1:226484346947:runtime/my_agent-9NBXM54pmz
Region: ap-northeast-1
```

## 更新が必要なファイル

```
/Users/nana-tokiwa/YX/yunixy-dev/omikuji_agent/omikuji_agent.py
```

最新版は GitHub の main ブランチにあります：
```
https://github.com/naopandao/omikuji_agent/blob/main/omikuji_agent.py
```

