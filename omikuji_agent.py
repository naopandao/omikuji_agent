"""
AI おみくじエージェント - シンプル版
基本的なおみくじ機能 + Strands Agent
"""

import os
import json
import random
from datetime import datetime
from bedrock_agentcore import BedrockAgentCoreApp
from strands import Agent

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

def extract_text_from_response(response) -> str:
    """Strands Agentのレスポンスからテキストを抽出"""
    # response.message は {'role': 'assistant', 'content': [{'text': '...'}]} 形式
    message = response.message
    
    # 辞書の場合
    if isinstance(message, dict):
        content = message.get('content', [])
        if isinstance(content, list):
            texts = []
            for item in content:
                if isinstance(item, dict) and 'text' in item:
                    texts.append(item['text'])
            if texts:
                return '\n'.join(texts)
        # contentがない場合、textを直接探す
        if 'text' in message:
            return message['text']
    
    # 文字列の場合はそのまま返す
    return str(message)


@app.entrypoint
def invoke(payload, context=None):
    """エージェントのメインエントリーポイント"""
    
    # ユーザー入力取得
    user_prompt = payload.get("prompt", "おみくじを引きたい")
    session_id = payload.get("session_id", "default-session")
    
    # シンプルなエージェント作成（Memory/Code Interpreterなし）
    agent = Agent()
    
    # おみくじを引く処理
    if "おみくじ" in user_prompt or "運勢" in user_prompt or "fortune" in user_prompt.lower():
        # おみくじ結果生成
        result = create_fortune_result()
        result["stars"] = "★" * result["score"] + "☆" * (5 - result["score"])
        
        # エージェントに結果を伝えて会話
        agent_prompt = f"""
ユーザーがおみくじを引きました。以下の結果が出ました：

【今日のおみくじ結果】
- 運勢: {result["fortune"]}
- ラッキーカラー: {result["lucky_color"]}
- ラッキーアイテム: {result["lucky_item"]}
- ラッキースポット: {result["lucky_spot"]}

ユーザーの質問: {user_prompt}

フレンドリーなギャル語で、おみくじ結果を伝えてください。
短めに、でも楽しく！絵文字も使ってね✨
"""
        agent_response = agent(agent_prompt)
        ai_text = extract_text_from_response(agent_response)
        
        return {
            "result": ai_text,
            "fortune_data": result,
        }
    
    # その他の会話（チャット機能）
    else:
        # プロンプトにおみくじコンテキストが含まれているかチェック
        enhanced_prompt = f"""
{user_prompt}

【重要な指示】
- フレンドリーなギャル語で話してください
- 短めに、でも楽しく！
- 絵文字を使ってね✨
"""
        agent_response = agent(enhanced_prompt)
        ai_text = extract_text_from_response(agent_response)
        
        return {
            "result": ai_text
        }

if __name__ == "__main__":
    # ローカルテスト用
    app.run()
