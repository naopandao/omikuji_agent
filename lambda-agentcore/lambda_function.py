import json
import boto3

def lambda_handler(event, context):
    # CORSヘッダー
    headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    }
    
    # OPTIONSリクエスト（CORS preflight）
    if event.get('requestContext', {}).get('http', {}).get('method') == 'OPTIONS':
        return {'statusCode': 200, 'headers': headers, 'body': ''}
    
    try:
        # リクエストボディ取得
        body = json.loads(event.get('body', '{}'))
        prompt = body.get('prompt', 'おみくじを引いてください')
        session_id = body.get('sessionId', 'default')
        
        # AgentCore Runtime呼び出し
        client = boto3.client('bedrock-agentcore', region_name='ap-northeast-1')
        
        response = client.invoke_agent_runtime(
            agentRuntimeArn='arn:aws:bedrock-agentcore:ap-northeast-1:226484346947:runtime/my_agent-9NBXM54pmz',
            payload=json.dumps({'prompt': prompt, 'session_id': session_id}).encode('utf-8')
        )
        
        # ストリーミングレスポンス読み取り
        result = b''
        for chunk in response['response']:
            result += chunk
        
        parsed = json.loads(result.decode('utf-8'))
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({'success': True, 'data': parsed}, ensure_ascii=False)
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'success': False, 'error': str(e)}, ensure_ascii=False)
        }
