"""
AI おみくじエージェント - Step 1: 基礎版（公式準拠）
まずはシンプルに動かして、後でMemory/Code Interpreter追加
"""

import random
from datetime import datetime
from bedrock_agentcore.runtime import BedrockAgentCoreApp
from strands import Agent

# AgentCore アプリケーション初期化
app = BedrockAgentCoreApp()
agent = Agent()

# おみくじの結果リスト
FORTUNES = ["大吉", "中吉", "小吉", "吉", "末吉", "凶"]
FORTUNE_SCORES = {"大吉": 5, "中吉": 4, "小吉": 3, "吉": 3, "末吉": 2, "凶": 1}

# ラッキーアイテム
LUCKY_COLORS = ["赤", "青", "黄色", "緑", "紫", "ピンク", "白", "黒"]
LUCKY_ITEMS = ["スマホ", "ペン", "本", "お菓子", "音楽", "コーヒー", "笑顔", "友達"]
LUCKY_SPOTS = ["カフェ", "公園", "書店", "映画館", "駅", "図書館", "家", "コンビニ"]

def create_fortune_result():
    """おみくじ結果を生成"""
    fortune = random.choice(FORTUNES)
    score = FORTUNE_SCORES[fortune]
    stars = "★" * score + "☆" * (5 - score)
    
    return {
        "fortune": fortune,
        "stars": stars,
        "lucky_color": random.choice(LUCKY_COLORS),
        "lucky_item": random.choice(LUCKY_ITEMS),
        "lucky_spot": random.choice(LUCKY_SPOTS),
        "timestamp": datetime.now().isoformat()
    }

@app.entrypoint
def invoke(payload):
    """エージェントのメインエントリーポイント"""
    
    # ユーザー入力取得
    user_message = payload.get("prompt", "おみくじを引きたい")
    
    # おみくじを引く処理
    if "おみくじ" in user_message or "運勢" in user_message:
        result = create_fortune_result()
        
        # エージェントに伝えるプロンプト
        agent_prompt = f"""
ユーザーがおみくじを引きました！以下の結果が出ました：

🎴 ============ おみくじ結果 ============ 🎴

【 {result['fortune']} 】
{result['stars']}

🍀 ラッキーアイテム:
- カラー: {result['lucky_color']}
- アイテム: {result['lucky_item']}
- スポット: {result['lucky_spot']}

========================================

フレンドリーでギャル語っぽい口調で、おみくじ結果を伝えてください。
楽しくポジティブに！絵文字もたくさん使ってね✨
"""
        agent_response = agent(agent_prompt)
        
        return {
            "result": str(agent_response.message),
            "fortune_data": result
        }
    
    # その他の会話
    else:
        agent_response = agent(user_message)
        return {
            "result": str(agent_response.message)
        }

if __name__ == "__main__":
    # ローカルテスト用
    app.run()
