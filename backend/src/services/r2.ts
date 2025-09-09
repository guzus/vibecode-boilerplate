import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const createClient = () => {
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 credentials not configured. Please set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY')
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey
    },
    // Required for R2 compatibility
    forcePathStyle: true
  })
}

let client: S3Client | null = null

const getClient = () => {
  if (!client) {
    client = createClient()
  }
  return client
}

export const r2 = {
  getSignedPutUrl: async (bucket: string, key: string, expiresIn = 900) => {
    const command = new PutObjectCommand({ 
      Bucket: bucket, 
      Key: key 
    })
    
    return getSignedUrl(getClient(), command, { 
      expiresIn 
    })
  },
  
  getSignedGetUrl: async (bucket: string, key: string, expiresIn = 3600) => {
    const command = new GetObjectCommand({ 
      Bucket: bucket, 
      Key: key 
    })
    
    return getSignedUrl(getClient(), command, { 
      expiresIn 
    })
  }
}