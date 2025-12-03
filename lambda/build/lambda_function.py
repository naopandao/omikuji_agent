"""
AWS Lambda Function for Omikuji Agent - v2
AgentCore Python SDKを使った直接呼び出し

Lambda Layer に bedrock-agentcore SDK をインストールして使用
"""

import json
import os
import sys
from datetime import datetime

# Bedrock Runtime for Claude
try:
    import boto3
    bedrock_runtime = boto3.client(
        service_name='bedrock-runtime',
        region_name=os.environ.get('BEDROCK_REGION', 'ap-northeast-1')
    )
    CLAUDE_AVAILABLE = True
    print("[Init] Bedrock Claude initialized successfully")
except Exception as e:
    CLAUDE_AVAILABLE = False
    print(f"[Init] Failed to initialize Claude: {e}")


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
    
    # おみくじロジックを直接実行
    result = invoke_agentcore_logic(prompt)
    print(f"[Omikuji] Result: {result}")
    return result


def handle_chat(body):
    """チャット処理"""
    message = body.get('message', '')
    session_id = body.get('sessionId', f"session-{int(datetime.utcnow().timestamp() * 1000)}")
    
    if not message:
        raise ValueError('Message is required')
    
    print(f"[Chat] Processing message: {message}")
    
    # Claude経由でチャット実行
    if CLAUDE_AVAILABLE:
        try:
            response_text = invoke_claude(message, session_id)
            return {
                'response': json.dumps({
                    'role': 'assistant',
                    'content': [{'text': response_text}]
                }),
                'sessionId': session_id
            }
        except Exception as e:
            print(f"[Chat] Claude error: {e}, falling back to rule-based mode")
    
    # フォールバック：ルールベース
    response_text = generate_chat_fallback(message)
    return {
        'response': json.dumps({
            'role': 'assistant',
            'content': [{'text': response_text}]
        }),
        'sessionId': session_id
    }


def invoke_claude(message, session_id):
    """
    Claude 3 Haikuを使った自然な会話生成
    """
    system_prompt = """あなたはフレンドリーでギャル語っぽい口調のAIアシスタントです。
ユーザーのおみくじの結果について質問されたり、運勢についてアドバイスを求められたりします。

特徴：
- 絵文字をたくさん使う ✨💕😊
- 優しくてポジティブ
- 具体的で親切なアドバイス
- カジュアルだけど親身になる

口調の例：
- 「〜だよ」「〜だね」「〜じゃん」
- 「やば〜！」「超〜」「めっちゃ」
- 語尾に「✨」「💕」「😊」などの絵文字"""

    try:
        response = bedrock_runtime.invoke_model(
            modelId='anthropic.claude-3-haiku-20240307-v1:0',
            body=json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 500,
                "temperature": 0.7,
                "system": system_prompt,
                "messages": [
                    {
                        "role": "user",
                        "content": message
                    }
                ]
            })
        )
        
        response_body = json.loads(response['body'].read())
        ai_text = response_body['content'][0]['text']
        
        print(f"[Claude] Response: {ai_text[:100]}...")
        return ai_text
        
    except Exception as e:
        print(f"[Claude] Error: {e}")
        raise


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
        
        # Claude使って自然なおみくじメッセージ生成
        if CLAUDE_AVAILABLE:
            try:
                omikuji_prompt = f"""今日のおみくじ結果をユーザーに伝えてください。

運勢: {result['fortune']}
ラッキーカラー: {result['lucky_color']}
ラッキーアイテム: {result['lucky_item']}
ラッキースポット: {result['lucky_spot']}

以下の要件で伝えてください：
- ギャル語っぽいフレンドリーな口調
- 絵文字をたくさん使う ✨💕😊
- その運勢の意味を具体的に説明
- ラッキーアイテムの活用方法を提案
- ラッキースポットに行く理由も添える
- 前向きで元気が出る内容に
- 150文字程度"""
                
                ai_message = invoke_claude(omikuji_prompt, "omikuji-generation")
            except Exception as e:
                print(f"[Omikuji] Claude error: {e}, using fallback")
                ai_message = generate_simple_omikuji_message(result)
        else:
            ai_message = generate_simple_omikuji_message(result)
        
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


def generate_simple_omikuji_message(result):
    """シンプルなおみくじメッセージ生成（Claude使えない時用）"""
    fortune = result['fortune']
    
    fortune_messages = {
        '大吉': {
            'comment': '超ラッキー！今日は最高の日になりそう！😍✨',
            'advice': '何事にも積極的にチャレンジしてみて！新しい出会いや発見があるかも💕'
        },
        '中吉': {
            'comment': 'いい感じだね！順調な1日になりそう！😊✨',
            'advice': '焦らず自分のペースで進めばOK！コツコツ頑張ろう💪'
        },
        '小吉': {
            'comment': 'まあまあいい感じ！小さな幸せを見つけられそう🌸',
            'advice': '周りの人に優しくすると、もっといいことあるよ💕'
        },
        '吉': {
            'comment': '普通にいい日だよ！安定感バッチリ✨',
            'advice': 'いつも通りで大丈夫！無理せず楽しもう😊'
        },
        '末吉': {
            'comment': 'ちょっと地味だけど悪くないよ！🍀',
            'advice': '慎重に行動すれば問題なし！地道にいこう💪'
        },
        '凶': {
            'comment': '今日は少し気をつけてね💦でも大丈夫！',
            'advice': '無理しないで、リラックスすることが大事！明日はきっといい日だよ✨'
        }
    }
    
    msg_data = fortune_messages.get(fortune, fortune_messages['吉'])
    
    # ラッキースポットのまともな説明
    spot_reasons = {
        'カフェ': 'でゆっくり過ごすと、いいアイデアが浮かぶかも☕✨',
        '公園': 'で自然を感じるとリフレッシュできるよ🌳💚',
        '書店': 'で面白い本に出会えそう！📚✨',
        '映画館': 'で感動体験できるかも🎬💕',
        '駅': '周辺でいい出会いがありそう🚃✨',
        '図書館': 'で静かに過ごすと集中できるよ📖',
        '家': 'でゆっくりすることが今日のベスト！🏠💕',
        'コンビニ': 'で新商品チェックすると楽しいかも🍫✨'
    }
    
    spot_msg = spot_reasons.get(result['lucky_spot'], 'に行くと何かいいことあるよ✨')
    
    message = f"""やば～！おみくじ出たよ～！🎴✨

今日は【{fortune}】だって！{msg_data['comment']}

{msg_data['advice']}

ラッキーカラーは**{result['lucky_color']}**！🎨
今日は{result['lucky_color']}系のものを身につけるといいよ💕

ラッキーアイテムは**{result['lucky_item']}**！
{result['lucky_item']}を活用してみてね✨

ラッキースポットは**{result['lucky_spot']}**！
{result['lucky_spot']}{spot_msg}"""
    
    return message


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
    """フォールバック用チャット応答生成 - より親切で自然な会話"""
    import random
    
    msg = message.lower()
    
    # 感謝の言葉
    if 'ありがと' in msg or 'thank' in msg:
        return 'どういたしまして～！😊💕\n\nまた何か聞きたいことあったら言ってね！\n毎日おみくじ引いて運気チェックしよ～🎴✨'
    
    # 挨拶
    if any(word in msg for word in ['こんにち', 'おはよ', 'こんばん', 'やっほ', 'hello', 'hi']):
        return 'やっほー！✨\n今日はどうだった？😊\n\nおみくじ引いてみる？🎴\nそれとも何か相談したいことある？💭'
    
    # おみくじ関連
    if '運勢' in msg or 'おみくじ' in msg or '引' in msg:
        return 'おみくじ引いてみよ～！🎴✨\n\nおみくじタブから引けるよ！\n引いた後に結果について質問してくれたら詳しく教えるね😊💕'
    
    # アドバイス・悩み相談
    if any(word in msg for word in ['アドバイス', 'どうすれば', '悩', '困', '心配', '不安', '辛', '聞いて']):
        return 'なるほど～！話聞くよ！😊💕\n\nまず、深呼吸してリラックスしよ〜✨\n\n今日のアドバイスだけど：\n1. 自分を責めないで 💖\n2. 一歩ずつ進めばOK 👣\n3. 誰かに話すだけでも楽になるよ 🗣️\n\nおみくじ引いて運気チェックしてみる？🎴\nラッキーアイテムとか参考になるかも！✨'
    
    # ポジティブな内容
    if any(word in msg for word in ['嬉し', '楽し', '最高', 'やった', '良かった', 'ラッキー']):
        return 'それ超いいじゃん！！😍✨\n\nその調子その調子〜！💪💕\n今日はいい日になりそうだね🌟\n\nおみくじ引いたらもっといい結果出るかも🎴✨'
    
    # 質問形式
    if '?' in msg or '？' in msg or 'どう' in msg or 'なに' in msg or '何' in msg:
        return 'いい質問だね！💡\n\n私ができることは：\n🎴 おみくじを引く\n💬 話を聞く\n📊 運勢の統計を見る\n✨ ラッキーアイテム教える\n\n他に気になることある？😊'
    
    # デフォルト - より親切な応答
    friendly_responses = [
        'うんうん、わかるよ〜！😊\n他にも何か話したいことある？✨',
        'そっか〜！💭\nおみくじ引いてみたら何かヒントあるかも🎴',
        'なるほどね！✨\n今日の運勢とか気になる？😊',
        'それいいね！💕\n何か他にも手伝えることあったら言ってね！',
        'へぇ〜！興味深い✨\nもっと詳しく教えて？😊'
    ]
    
    return random.choice(friendly_responses)
