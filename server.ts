import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'

const app = new Hono()

// CORS設定
app.use('*', cors())

// 静的ファイル配信
app.use('/*', serveStatic({ root: './public' }))

// おみくじAPIエンドポイント
app.post('/api/omikuji', async (c) => {
  try {
    const body = await c.req.json()
    const prompt = body.prompt || 'おみくじを引きたい'

    // AWS SDK v3でAgentCoreを呼び出し
    const { BedrockAgentRuntimeClient, InvokeAgentCommand } = await import('@aws-sdk/client-bedrock-agent-runtime')
    
    const client = new BedrockAgentRuntimeClient({
      region: 'ap-northeast-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    })

    const agentArn = 'arn:aws:bedrock-agentcore:ap-northeast-1:226484346947:runtime/my_agent-9NBXM54pmz'
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(7)}`

    const command = new InvokeAgentCommand({
      agentRuntimeArn: agentArn,
      runtimeSessionId: sessionId,
      payload: new TextEncoder().encode(JSON.stringify({ prompt })),
      qualifier: 'DEFAULT',
    })

    const response = await client.send(command)

    // レスポンスを結合
    let content = ''
    if (response.response) {
      for await (const chunk of response.response) {
        if (chunk && chunk.length > 0) {
          content += new TextDecoder().decode(chunk)
        }
      }
    }

    const result = JSON.parse(content)
    return c.json(result)

  } catch (error) {
    console.error('Error calling AgentCore:', error)
    return c.json(
      { error: 'おみくじの取得に失敗しました', details: error.message },
      500
    )
  }
})

// ヘルスチェック
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// デフォルトルート
app.get('/', (c) => {
  return c.redirect('/index.html')
})

export default app
