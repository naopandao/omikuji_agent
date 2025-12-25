"""
AI おみくじエージェント - Strands + AgentCore Memory 統合版

Strands Agents と AgentCore Memory を統合し、
おみくじ結果についてチャットで会話できるようにします。

セッション管理:
- おみくじを引く → 新しい session_id を発行
- チャットする → 同じ session_id を使用
- 再度おみくじ → 新しい session_id を発行（新しい会話開始）
"""

import os
import json
import random
from datetime import datetime
from bedrock_agentcore import BedrockAgentCoreApp
from strands import Agent

# Strands + AgentCore Memory 統合
from bedrock_agentcore.memory.integrations.strands.config import AgentCoreMemoryConfig
from bedrock_agentcore.memory.integrations.strands.session_manager import AgentCoreMemorySessionManager

# AgentCore アプリケーション初期化
app = BedrockAgentCoreApp()

# 環境変数
AWS_REGION = os.environ.get("AWS_REGION", "ap-northeast-1")
MEMORY_ID = os.environ.get("BEDROCK_AGENTCORE_MEMORY_ID", "my_agent_mem-W3DiyUCFmg")

# おみくじの結果リスト
FORTUNES = ["大吉", "中吉", "小吉", "吉", "末吉", "凶"]
FORTUNE_SCORES = {"大吉": 5, "中吉": 4, "小吉": 3, "吉": 3, "末吉": 2, "凶": 1}

# ラッキーアイテム
LUCKY_COLORS = ["赤", "青", "黄色", "緑", "紫", "ピンク", "白", "黒"]
LUCKY_ITEMS = ["スマホ", "ペン", "本", "お菓子", "音楽", "コーヒー", "笑顔", "友達"]
LUCKY_SPOTS = ["カフェ", "公園", "書店", "映画館", "駅", "図書館", "家", "コンビニ"]

# システムプロンプト
SYSTEM_PROMPT = """あなたはフレンドリーなギャル語で話すおみくじAIです。

【あなたの特徴】
- 明るく元気なギャル語で話す（「〜じゃん！」「マジで！」「やばい！」など）
- 絵文字をたくさん使う（✨💕🎉😊など）
- ユーザーのおみくじ結果を覚えていて、それについて会話できる
- 短めに、でも楽しく話す

【重要】
- ユーザーがおみくじを引いたら、その結果を必ず覚えておく
- チャットで質問されたら、今日のおみくじ結果を踏まえて回答する
- 過去の会話も覚えていて、文脈を維持する
"""


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


def create_agent_with_memory(session_id: str, actor_id: str) -> Agent:
    """
    AgentCore Memory と統合された Strands Agent を作成
    
    Args:
        session_id: おみくじID（フロントエンドから渡される）
        actor_id: ユーザー識別子
    
    Returns:
        Memory統合済みのStrands Agent
    """
    # AgentCore Memory 設定
    memory_config = AgentCoreMemoryConfig(
        memory_id=MEMORY_ID,
        session_id=session_id,
        actor_id=actor_id
    )
    
    # セッションマネージャー作成
    session_manager = AgentCoreMemorySessionManager(
        agentcore_memory_config=memory_config,
        region_name=AWS_REGION
    )
    
    # Strands Agent 作成（Memory統合）
    agent = Agent(
        system_prompt=SYSTEM_PROMPT,
        session_manager=session_manager
    )
    
    return agent


@app.entrypoint
def invoke(payload, context=None):
    """
    エージェントのメインエントリーポイント
    
    Payload:
        - prompt: ユーザーの入力
        - session_id: セッションID（おみくじID）
        - actor_id: ユーザー識別子（オプション）
    """
    
    # ペイロードからパラメータ取得
    user_prompt = payload.get("prompt", "おみくじを引きたい")
    session_id = payload.get("session_id", f"default-{datetime.now().strftime('%Y%m%d%H%M%S')}")
    actor_id = payload.get("actor_id", "anonymous_user")
    
    print(f"[omikuji_agent] session_id={session_id}, actor_id={actor_id}, prompt={user_prompt[:50]}...")
    
    # Memory統合済み Agent を作成
    agent = create_agent_with_memory(session_id, actor_id)
    
    # おみくじを引く処理
    if "おみくじ" in user_prompt or "運勢" in user_prompt or "fortune" in user_prompt.lower() or "omikuji" in user_prompt.lower():
        # おみくじ結果生成
        result = create_fortune_result()
        result["stars"] = "★" * result["score"] + "☆" * (5 - result["score"])
        
        # エージェントに結果を伝えて会話（Memoryに記録される）
        agent_prompt = f"""
ユーザーがおみくじを引きました！以下の結果が出ました：

【今日のおみくじ結果】
- 運勢: {result["fortune"]}（{result["stars"]}）
- ラッキーカラー: {result["lucky_color"]}
- ラッキーアイテム: {result["lucky_item"]}
- ラッキースポット: {result["lucky_spot"]}

この結果を覚えておいてね！
ユーザーの質問: {user_prompt}

フレンドリーなギャル語で、おみくじ結果を伝えてください。
短めに、でも楽しく！絵文字も使ってね✨
"""
        agent_response = agent(agent_prompt)
        ai_text = extract_text_from_response(agent_response)
        
        return {
            "result": ai_text,
            "fortune_data": result,
            "session_id": session_id
        }
    
    # その他の会話（チャット機能）
    else:
        # Memoryから過去のおみくじ結果が自動的に参照される
        enhanced_prompt = f"""
ユーザーからの質問: {user_prompt}

【重要な指示】
- 今日のおみくじ結果を覚えていたら、それを踏まえて回答して
- フレンドリーなギャル語で話してください
- 短めに、でも楽しく！
- 絵文字を使ってね✨
"""
        agent_response = agent(enhanced_prompt)
        ai_text = extract_text_from_response(agent_response)
        
        return {
            "result": ai_text,
            "session_id": session_id
        }


if __name__ == "__main__":
    # ローカルテスト用
    app.run()
