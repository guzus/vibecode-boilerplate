import admin from 'firebase-admin'
import { FastifyRequest, FastifyReply } from 'fastify'

if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID
  
  if (!projectId) {
    throw new Error('FIREBASE_PROJECT_ID environment variable is required')
  }
  
  admin.initializeApp({ 
    projectId,
    // On Cloud Run, this uses Application Default Credentials
    // For local dev, you can use Firebase emulators or a service account key
  })
}

export interface AuthenticatedRequest extends FastifyRequest {
  user: {
    uid: string
    email?: string
  }
}

export const authMiddleware = async (
  req: FastifyRequest, 
  reply: FastifyReply
) => {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') 
    ? authHeader.slice(7) 
    : null
    
  if (!token) {
    return reply.code(401).send({ 
      error: 'Missing authentication token' 
    })
  }
  
  try {
    const decodedToken = await admin.auth().verifyIdToken(token)
    ;(req as any).user = { 
      uid: decodedToken.uid, 
      email: decodedToken.email 
    }
  } catch (error) {
    req.log.error(error, 'Failed to verify token')
    return reply.code(401).send({ 
      error: 'Invalid authentication token' 
    })
  }
}

export const getAuth = () => admin.auth()
export const getFirestore = () => admin.firestore()