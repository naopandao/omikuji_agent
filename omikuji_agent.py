"""
AI おみくじエージェント - Step 1: 基礎版
Memory + Code Interpreter を使った学習するおみくじ
"""

import os
import json
import random
from datetime import datetime
from bedrock_agentcore import BedrockAgentCoreApp
from strands import Agent
from bedrock_agentcore.tools import AgentCoreCodeInterpreter

# AgentCore アプリケーション初期化
app = BedrockAgentCoreApp()

# おみくじの結果リスト
FORTUNES = ["大吉", "中吉", "小吉", "吉", "末吉", "凶"]
FORTUNE_SCORES = {"大吉": 5, "中吉": 4, "小吉": 3, "吉": 3, "末吉": 2, "凶": 1}

# ラッキーアイテム
LUCKY_COLORS = ["赤", "青", "黄色", "緑", "紫", "ピンク", "白", "黒"]
LUCKY_ITEMS = ["スマホ", "ペン", "本", "お菓子", "音楽", "コーヒー", "笑顔", "友達"]
LUCKY_SPOTS = ["カフェ", "公園", "書店", "映画館", "駅", "図書館", "家", "コンビニ"]

def generate_fortune_message(fortune: str) -> str:
    """運勢に応じたメッセージを生成"""
    messages = {
        "大吉": [
            "今日は最高の日！何をやってもうまくいきそう✨",
            "超ラッキーデー！積極的に行動しよう🎉",
            "大吉おめでとう！今日は勝負の日だよ💪"
        ],
        "中吉": [
            "今日はいい感じ！調子に乗りすぎず着実に✨",
            "順調な一日になりそう！いいことあるよ😊",
            "中吉だよ～落ち着いて過ごせば吉💕"
        ],
        "小吉": [
            "小さな幸せが見つかる日！周りをよく見てね🌸",
            "ささやかな喜びがありそう！感謝の心で✨",
            "控えめだけど悪くない日！穏やかに過ごそう😌"
        ],
        "吉": [
            "普通にいい日！無難に過ごせば問題なし✨",
            "まあまあの運勢！特に心配ないよ😊",
            "安定してる日！焦らずゆっくり行こう🌿"
        ],
        "末吉": [
            "ちょっと慎重にね！でも大丈夫✨",
            "控えめな運勢...でも悪くないよ😌",
            "地味だけど堅実な日！コツコツ頑張ろう💪"
        ],
        "凶": [
            "今日はおとなしく...でも明日は良くなるよ！💪",
            "ちょっと運気低め💦でも気をつければ大丈夫✨",
            "凶出ちゃった😅でも逆にラッキーかも！？"
        ]
    }
    return random.choice(messages.get(fortune, ["今日も頑張ろう！"]))

def create_fortune_result() -> dict:
    """おみくじ結果を生成"""
    fortune = random.choice(FORTUNES)
    
    return {
        "fortune": fortune,
        "score": FORTUNE_SCORES[fortune],
        "lucky_color": random.choice(LUCKY_COLORS),
        "lucky_item": random.choice(LUCKY_ITEMS),
        "lucky_spot": random.choice(LUCKY_SPOTS),
        "message": generate_fortune_message(fortune),
        "timestamp": datetime.now().isoformat()
    }

def format_fortune_display(result: dict) -> str:
    """おみくじ結果を整形して表示"""
    fortune = result["fortune"]
    stars = "★" * result["score"] + "☆" * (5 - result["score"])
    
    display = f"""
🎴✨ ============ おみくじ結果 ============ ✨🎴

        【 {fortune} 】
        {stars}

💫 今日の運勢:
   {result["message"]}

🍀 ラッキーアイテム:
   - カラー: {result["lucky_color"]}
   - アイテム: {result["lucky_item"]}
   - スポット: {result["lucky_spot"]}

📅 引いた日時: {result["timestamp"]}

========================================
"""
    return display

@app.entrypoint
def invoke(payload, context=None):
    """エージェントのメインエントリーポイント"""
    
    # Memory設定（環境変数から取得）
    memory_id = os.environ.get("BEDROCK_AGENTCORE_MEMORY_ID")
    aws_region = os.environ.get("AWS_REGION", "us-east-1")
    
    # ユーザー入力取得
    user_prompt = payload.get("prompt", "おみくじを引きたい")
    session_id = payload.get("session_id", "default-session")
    
    # Memory設定
    session_manager = None
    if memory_id:
        from bedrock_agentcore.memory import AgentCoreMemorySessionManager, AgentCoreMemoryConfig
        memory_config = AgentCoreMemoryConfig(
            memory_id=memory_id,
            region=aws_region
        )
        session_manager = AgentCoreMemorySessionManager(
            session_id=session_id,
            memory_config=memory_config
        )
    
    # Code Interpreter ツール作成
    code_interpreter = AgentCoreCodeInterpreter(
        region=aws_region,
        session_id=session_id
    )
    
    # エージェント作成
    agent = Agent(
        tools=[code_interpreter],
        session_manager=session_manager
    )
    
    # おみくじを引く処理
    if "おみくじ" in user_prompt or "運勢" in user_prompt or "fortune" in user_prompt.lower():
        # おみくじ結果生成
        result = create_fortune_result()
        display = format_fortune_display(result)
        
        # エージェントに結果を伝えて会話（Memoryに明示的に保存）
        agent_prompt = f"""
ユーザーがおみくじを引きました。以下の結果が出ました：

【今日のおみくじ結果】
- 運勢: {result["fortune"]}
- ラッキーカラー: {result["lucky_color"]}
- ラッキーアイテム: {result["lucky_item"]}
- ラッキースポット: {result["lucky_spot"]}

{display}

ユーザーの質問: {user_prompt}

フレンドリーなギャル語で、おみくじ結果を伝えてください。
今後の会話でもこのおみくじ結果を覚えておいて、ユーザーが質問したら参照してください。
もし過去のおみくじ履歴があれば、それも踏まえてアドバイスしてください。
"""
        agent_response = agent(agent_prompt)
        
        return {
            "result": str(agent_response.message),
            "fortune_data": result,
            "display": display
        }
    
    # 統計・分析の質問
    elif "統計" in user_prompt or "グラフ" in user_prompt or "分析" in user_prompt:
        agent_prompt = f"""
ユーザーからの質問: {user_prompt}

過去のおみくじ履歴を分析して、統計情報を提供してください。
Code Interpreterを使って、グラフを作成できます。

例：
- 運勢の分布
- 大吉の出現率
- 時系列の運勢推移
"""
        agent_response = agent(agent_prompt)
        
        return {
            "result": str(agent_response.message)
        }
    
    # その他の会話（チャット機能）
    else:
        # プロンプトにおみくじコンテキストが含まれているかチェック
        if "おみくじ結果" in user_prompt or "運勢:" in user_prompt or "ラッキー" in user_prompt:
            # おみくじコンテキスト付きチャット
            enhanced_prompt = f"""
{user_prompt}

【重要な指示】
- ユーザーが引いたおみくじ結果を必ず参照して回答してください
- 運勢やラッキーアイテムについて具体的にアドバイスしてください
- フレンドリーなギャル語で話してください
- 過去の会話履歴がある場合は、それも考慮してください
"""
            agent_response = agent(enhanced_prompt)
        else:
            # 通常のチャット
            agent_response = agent(user_prompt)
        
        return {
            "result": str(agent_response.message)
        }

if __name__ == "__main__":
    # ローカルテスト用
    app.run()
