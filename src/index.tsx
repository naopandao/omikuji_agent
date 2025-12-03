import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import { 
  BedrockAgentRuntimeClient, 
  InvokeFlowCommand 
} from '@aws-sdk/client-bedrock-agent-runtime'

const app = new Hono()

// 静的ファイルの配信
app.get('*', serveStatic({ root: './' }))

// CORS有効化
app.use('/api/*', cors())

// AgentCore設定
const AGENT_ARN = 'arn:aws:bedrock-agentcore:ap-northeast-1:226484346947:runtime/my_agent-9NBXM54pmz'
const AWS_REGION = 'ap-northeast-1'

// AWS SDK クライアント
const bedrockClient = new BedrockAgentRuntimeClient({
  region: AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
  }
})

/**
 * AgentCoreを呼び出す関数（本番版）
 */
async function invokeAgentCore(prompt: string, sessionId: string = 'default-session') {
  try {
    console.log('[AgentCore] Invoking with prompt:', prompt, 'sessionId:', sessionId)
    
    const command = new InvokeFlowCommand({
      flowIdentifier: AGENT_ARN,
      inputs: [{
        content: {
          document: {
            message: prompt
          }
        },
        nodeName: 'FlowInputNode',
        nodeOutputName: 'document'
      }]
    })
    
    const response = await bedrockClient.send(command)
    
    // レスポンスの整形
    const outputs = response.responseStream
    let fullResponse = ''
    
    if (outputs) {
      for await (const event of outputs) {
        if (event.flowOutputEvent) {
          const content = event.flowOutputEvent.content
          if (content && 'document' in content) {
            fullResponse += JSON.stringify(content.document)
          }
        }
      }
    }
    
    return {
      result: fullResponse || JSON.stringify({
        role: 'assistant',
        content: [{ text: 'エラーが発生しました' }]
      }),
      sessionId
    }
  } catch (error) {
    console.error('[AgentCore] Error:', error)
    
    // フォールバック：ダミーレスポンス
    const fortuneTypes = ['大吉', '中吉', '小吉', '吉', '末吉', '凶']
    const colors = ['赤', '青', '黄色', '緑', '紫', 'ピンク']
    const items = ['スマホ', 'ペン', '本', 'お菓子', '音楽', 'コーヒー']
    const spots = ['カフェ', '公園', '書店', '映画館', '駅', '図書館']
    
    if (prompt.includes('おみくじ') || prompt.includes('運勢')) {
      const fortune = fortuneTypes[Math.floor(Math.random() * fortuneTypes.length)]
      const score = { '大吉': 5, '中吉': 4, '小吉': 3, '吉': 3, '末吉': 2, '凶': 1 }[fortune] || 3
      const stars = '★'.repeat(score) + '☆'.repeat(5 - score)
      
      return {
        result: JSON.stringify({
          role: 'assistant',
          content: [{
            text: `やば～！おみくじ出たよ～！✨\n\n今日は【${fortune}】だって！${getFortunedComment(fortune)}\n\nラッキーカラーは${colors[Math.floor(Math.random() * colors.length)]}だよ～🎨\n${items[Math.floor(Math.random() * items.length)]}持ってくといいかも✨\n\n${spots[Math.floor(Math.random() * spots.length)]}に行くといいことあるよ～📍💕`
          }]
        }),
        fortune_data: {
          fortune,
          stars,
          lucky_color: colors[Math.floor(Math.random() * colors.length)],
          lucky_item: items[Math.floor(Math.random() * items.length)],
          lucky_spot: spots[Math.floor(Math.random() * spots.length)],
          timestamp: new Date().toISOString()
        }
      }
    } else {
      return {
        result: JSON.stringify({
          role: 'assistant',
          content: [{
            text: generateChatResponse(prompt)
          }]
        })
      }
    }
  }
}

function getFortunedComment(fortune: string): string {
  const comments: Record<string, string> = {
    '大吉': '超ラッキー！今日は最高だよ～！😍💕',
    '中吉': 'いい感じじゃん！😊✨',
    '小吉': 'まあまあいい感じだね～🌸',
    '吉': '普通にいい日だよ！✨',
    '末吉': 'ちょっと地味だけどOK！🍀',
    '凶': '今日は無理しないでね～💪'
  }
  return comments[fortune] || ''
}

function generateChatResponse(message: string): string {
  const msg = message.toLowerCase()
  
  if (msg.includes('ありがと') || msg.includes('thank')) {
    return 'どういたしまして～！😊💕\n\nまた何か聞きたいことあったら言ってね！\n毎日おみくじ引いて運気チェックしよ～🎴✨'
  }
  
  if (msg.includes('運勢') || msg.includes('おみくじ')) {
    return 'おみくじ引いてみる？🎴\n\nおみくじタブから引いてみてね～✨\n引いた後に結果について質問してくれたら詳しく教えるよ！😊'
  }
  
  if (msg.includes('アドバイス') || msg.includes('どうすれば')) {
    return '今日のアドバイスね！💡\n\n1. ポジティブに考える ✨\n2. ラッキーアイテム持つ 🎁\n3. 笑顔を忘れない 😊\n4. 新しいことに挑戦 🚀\n\n運気は自分で作るものだよ～💪💕'
  }
  
  const responses = [
    'それめっちゃ面白いね！😊✨\n他に気になることある？',
    'なるほどね～！💡\nおみくじの結果とか統計も見てみる？',
    'そうなんだ～！✨\n今日の運勢とか気になる？🎴',
    'いいね！😊💕\n何か他にも手伝えることあったら言ってね！',
    'わかった！✨\nおみくじ引いてみたり、統計見てみたりしてね～📊'
  ]
  
  return responses[Math.floor(Math.random() * responses.length)]
}

// Lambda API Endpoint (本番環境)
const LAMBDA_API_ENDPOINT = 'https://6zzt3d5iej.execute-api.ap-northeast-1.amazonaws.com'

// おみくじAPI - Lambda Proxy
app.post('/api/omikuji', async (c) => {
  try {
    const body = await c.req.json()
    
    // Lambda APIに転送
    const response = await fetch(`${LAMBDA_API_ENDPOINT}/api/omikuji`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    })
    
    if (!response.ok) {
      throw new Error(`Lambda API error: ${response.status}`)
    }
    
    const result = await response.json()
    return c.json(result)
  } catch (error) {
    console.error('Omikuji API error:', error)
    return c.json({ error: 'おみくじの取得に失敗しました' }, 500)
  }
})

// チャットAPI - Lambda Proxy
app.post('/api/chat', async (c) => {
  try {
    const body = await c.req.json()
    
    if (!body.message) {
      return c.json({ error: 'メッセージが必要です' }, 400)
    }
    
    // Lambda APIに転送
    const response = await fetch(`${LAMBDA_API_ENDPOINT}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    })
    
    if (!response.ok) {
      throw new Error(`Lambda API error: ${response.status}`)
    }
    
    const result = await response.json()
    return c.json(result)
  } catch (error) {
    console.error('Chat API error:', error)
    return c.json({ error: 'チャットの送信に失敗しました' }, 500)
  }
})

// ヘルスチェック - Lambda Proxy
app.get('/api/health', async (c) => {
  try {
    const response = await fetch(`${LAMBDA_API_ENDPOINT}/api/health`)
    const result = await response.json()
    return c.json(result)
  } catch (error) {
    return c.json({ status: 'error', message: 'Lambda API unavailable' }, 500)
  }
})

// ルートパス
app.get('/', (c) => {
  return c.redirect('/index.html')
})

export default app
