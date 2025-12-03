"""
AWS Lambda Function for Omikuji Agent - v2
AgentCore Python SDKを使った直接呼び出し

Lambda Layer に bedrock-agentcore SDK をインストールして使用
"""

import json
import os
import sys
from datetime import datetime

# AgentCore SDKのインポート（Lambda Layerから）
try:
    from bedrock_agentcore import BedrockAgentCoreApp
    from strands import Agent
    AGENTCORE_AVAILABLE = True
except ImportError:
    AGENTCORE_AVAILABLE = False
    print("[Warning] bedrock-agentcore not available, using fallback mode")

# AgentCore設定
AGENT_NAME = os.environ.get('AGENT_NAME', 'my_agent')

# Agentの初期化（グローバル - コールドスタート高速化）
if AGENTCORE_AVAILABLE:
    try:
        app = BedrockAgentCoreApp()
        agent = Agent()
        print(f"[Init] AgentCore initialized successfully")
    except Exception as e:
        print(f"[Init] Failed to initialize AgentCore: {e}")
        AGENTCORE_AVAILABLE = False


def lambda_handler(event, context):
    """Lambda関数のエントリーポイント"""
    
    print(f"[Lambda] Received event: {json.dumps(event)}")
    
    # CORS対応のヘッダー
    headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    }
    
    # OPTIONSリクエスト（プリフライト）への対応
    if event.get('requestContext', {}).get('http', {}).get('method') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({'message': 'OK'})
        }
    
    try:
        # リクエストボディの解析
        body = json.loads(event.get('body', '{}'))
        endpoint = event.get('requestContext', {}).get('http', {}).get('path', '')
        
        print(f"[Lambda] Endpoint: {endpoint}, Body: {body}")
        
        # エンドポイントによる処理分岐
        if '/omikuji' in endpoint:
            result = handle_omikuji(body)
        elif '/chat' in endpoint:
            result = handle_chat(body)
        elif '/health' in endpoint:
            result = {
                'status': 'ok',
                'agentcore_available': AGENTCORE_AVAILABLE,
                'timestamp': datetime.utcnow().isoformat()
            }
        else:
            return {
                'statusCode': 404,
                'headers': headers,
                'body': json.dumps({'error': 'Endpoint not found'})
            }
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps(result, ensure_ascii=False)
        }
        
    except Exception as e:
        print(f"[Lambda] Error: {str(e)}")
        import traceback
        traceback.print_exc()
        
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': 'Internal server error',
                'message': str(e)
            })
        }


def handle_omikuji(body):
    """おみくじ処理"""
    prompt = body.get('prompt', 'おみくじ引きたい～！')
    session_id = body.get('sessionId', f"session-{int(datetime.utcnow().timestamp() * 1000)}")
    
    print(f"[Omikuji] Processing with prompt: {prompt}")
    
    if AGENTCORE_AVAILABLE:
        try:
            # AgentCore経由でおみくじ実行
            result = invoke_agentcore_logic(prompt)
            print(f"[Omikuji] AgentCore result: {result}")
            return result
        except Exception as e:
            print(f"[Omikuji] AgentCore error: {e}, falling back to demo mode")
    
    # フォールバック：ダミーレスポンス
    return generate_fallback_omikuji(prompt)


def handle_chat(body):
    """チャット処理"""
    message = body.get('message', '')
    session_id = body.get('sessionId', f"session-{int(datetime.utcnow().timestamp() * 1000)}")
    
    if not message:
        raise ValueError('Message is required')
    
    print(f"[Chat] Processing message: {message}")
    
    if AGENTCORE_AVAILABLE:
        try:
            # AgentCore経由でチャット実行
            result = invoke_agentcore_logic(message)
            return {
                'response': result.get('result', ''),
                'sessionId': session_id
            }
        except Exception as e:
            print(f"[Chat] AgentCore error: {e}, falling back to demo mode")
    
    # フォールバック：ダミーレスポンス
    response_text = generate_chat_fallback(message)
    return {
        'response': json.dumps({
            'role': 'assistant',
            'content': [{'text': response_text}]
        }),
        'sessionId': session_id
    }


def invoke_agentcore_logic(prompt):
    """
    AgentCoreのロジックを直接実行
    my_agent.pyと同じロジック
    """
    import random
    
    # おみくじの結果リスト
    FORTUNES = ["大吉", "中吉", "小吉", "吉", "末吉", "凶"]
    FORTUNE_SCORES = {"大吉": 5, "中吉": 4, "小吉": 3, "吉": 3, "末吉": 2, "凶": 1}
    LUCKY_COLORS = ["赤", "青", "黄色", "緑", "紫", "ピンク", "白", "黒"]
    LUCKY_ITEMS = ["スマホ", "ペン", "本", "お菓子", "音楽", "コーヒー", "笑顔", "友達"]
    LUCKY_SPOTS = ["カフェ", "公園", "書店", "映画館", "駅", "図書館", "家", "コンビニ"]
    
    # おみくじを引く処理
    if "おみくじ" in prompt or "運勢" in prompt:
        fortune = random.choice(FORTUNES)
        score = FORTUNE_SCORES[fortune]
        stars = "★" * score + "☆" * (5 - score)
        
        result = {
            "fortune": fortune,
            "stars": stars,
            "lucky_color": random.choice(LUCKY_COLORS),
            "lucky_item": random.choice(LUCKY_ITEMS),
            "lucky_spot": random.choice(LUCKY_SPOTS),
            "timestamp": datetime.utcnow().isoformat()
        }
        
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
        
        # Agentを使ってレスポンス生成
        try:
            agent_response = agent(agent_prompt)
            ai_message = str(agent_response.message)
        except:
            # Agentが使えない場合の簡易レスポンス
            comments = {
                '大吉': '超ラッキー！今日は最高だよ～！😍💕',
                '中吉': 'いい感じじゃん！😊✨',
                '小吉': 'まあまあいい感じだね～🌸',
                '吉': '普通にいい日だよ！✨',
                '末吉': 'ちょっと地味だけどOK！🍀',
                '凶': '今日は無理しないでね～💪'
            }
            
            ai_message = f"やば～！おみくじ出たよ～！✨\n\n今日は【{fortune}】だって！{comments[fortune]}\n\nラッキーカラーは{result['lucky_color']}だよ～🎨\n{result['lucky_item']}持ってくといいかも✨\n\n{result['lucky_spot']}に行くといいことあるよ～📍💕"
        
        return {
            "result": json.dumps({
                "role": "assistant",
                "content": [{"text": ai_message}]
            }),
            "fortune_data": result
        }
    
    # その他の会話
    else:
        try:
            agent_response = agent(prompt)
            ai_message = str(agent_response.message)
        except:
            ai_message = generate_chat_fallback(prompt)
        
        return {
            "result": json.dumps({
                "role": "assistant",
                "content": [{"text": ai_message}]
            })
        }


def generate_fallback_omikuji(prompt):
    """フォールバック用おみくじ生成"""
    import random
    
    fortune_types = ['大吉', '中吉', '小吉', '吉', '末吉', '凶']
    colors = ['赤', '青', '黄色', '緑', '紫', 'ピンク']
    items = ['スマホ', 'ペン', '本', 'お菓子', '音楽', 'コーヒー']
    spots = ['カフェ', '公園', '書店', '映画館', '駅', '図書館']
    
    fortune = random.choice(fortune_types)
    score = {'大吉': 5, '中吉': 4, '小吉': 3, '吉': 3, '末吉': 2, '凶': 1}.get(fortune, 3)
    stars = '★' * score + '☆' * (5 - score)
    
    comments = {
        '大吉': '超ラッキー！今日は最高だよ～！😍💕',
        '中吉': 'いい感じじゃん！😊✨',
        '小吉': 'まあまあいい感じだね～🌸',
        '吉': '普通にいい日だよ！✨',
        '末吉': 'ちょっと地味だけどOK！🍀',
        '凶': '今日は無理しないでね～💪'
    }
    
    message = f"やば～！おみくじ出たよ～！✨\n\n今日は【{fortune}】だって！{comments[fortune]}\n\nラッキーカラーは{random.choice(colors)}だよ～🎨\n{random.choice(items)}持ってくといいかも✨\n\n{random.choice(spots)}に行くといいことあるよ～📍💕"
    
    return {
        'result': json.dumps({
            'role': 'assistant',
            'content': [{'text': message}]
        }),
        'fortune_data': {
            'fortune': fortune,
            'stars': stars,
            'lucky_color': random.choice(colors),
            'lucky_item': random.choice(items),
            'lucky_spot': random.choice(spots),
            'timestamp': datetime.utcnow().isoformat()
        }
    }


def generate_chat_fallback(message):
    """フォールバック用チャット応答生成"""
    import random
    
    msg = message.lower()
    
    if 'ありがと' in msg or 'thank' in msg:
        return 'どういたしまして～！😊💕\n\nまた何か聞きたいことあったら言ってね！\n毎日おみくじ引いて運気チェックしよ～🎴✨'
    
    if '運勢' in msg or 'おみくじ' in msg:
        return 'おみくじ引いてみる？🎴\n\nおみくじタブから引いてみてね～✨\n引いた後に結果について質問してくれたら詳しく教えるよ！😊'
    
    if 'アドバイス' in msg or 'どうすれば' in msg:
        return '今日のアドバイスね！💡\n\n1. ポジティブに考える ✨\n2. ラッキーアイテム持つ 🎁\n3. 笑顔を忘れない 😊\n4. 新しいことに挑戦 🚀\n\n運気は自分で作るものだよ～💪💕'
    
    responses = [
        'それめっちゃ面白いね！😊✨\n他に気になることある？',
        'なるほどね～！💡\nおみくじの結果とか統計も見てみる？',
        'そうなんだ～！✨\n今日の運勢とか気になる？🎴',
        'いいね！😊💕\n何か他にも手伝えることあったら言ってね！',
        'わかった！✨\nおみくじ引いてみたり、統計見てみたりしてね～📊'
    ]
    
    return random.choice(responses)
