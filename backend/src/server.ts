import Fastify from 'fastify'
import cors from '@fastify/cors'
import { authMiddleware } from './services/firebase'
import { r2 } from './services/r2'

const app = Fastify({ 
  logger: true,
  requestIdLogLabel: 'reqId',
  disableRequestLogging: false,
  requestIdHeader: 'x-request-id',
  trustProxy: true
})

await app.register(cors, { 
  origin: true,
  credentials: true 
})

app.get('/healthz', async () => ({ ok: true, timestamp: new Date().toISOString() }))

app.get('/me', { 
  preHandler: authMiddleware 
}, async (req: any) => {
  return { 
    uid: req.user.uid,
    email: req.user.email 
  }
})

app.get('/uploads/presign', { 
  preHandler: authMiddleware 
}, async (req: any) => {
  const timestamp = Date.now()
  const randomId = Math.random().toString(36).substring(7)
  const key = `users/${req.user.uid}/${timestamp}-${randomId}.bin`
  
  const url = await r2.getSignedPutUrl(
    process.env.R2_BUCKET_NAME!, 
    key
  )
  
  return { 
    key, 
    url,
    expiresIn: 900 
  }
})

const port = Number(process.env.PORT) || 8080
const host = '0.0.0.0'

try {
  await app.listen({ port, host })
  app.log.info(`Server listening on ${host}:${port}`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}