'use client'

import { useEffect, useState } from 'react'
import { initFirebase, signInWithGoogle, signOut, onAuthChange } from '@/lib/firebase'
import { apiClient } from '@/lib/api'

export default function Home() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [healthStatus, setHealthStatus] = useState<string>('')

  useEffect(() => {
    initFirebase()
    
    const unsubscribe = onAuthChange((user) => {
      setUser(user)
      setLoading(false)
    })

    checkHealth()
    
    return () => unsubscribe()
  }, [])

  const checkHealth = async () => {
    try {
      const data = await apiClient('/healthz')
      setHealthStatus(data.ok ? 'API is healthy' : 'API is unhealthy')
    } catch (error) {
      setHealthStatus('API is unreachable')
    }
  }

  const fetchUserData = async () => {
    if (!user) return
    
    try {
      const token = await user.getIdToken()
      const data = await apiClient('/me', {
        headers: { Authorization: `Bearer ${token}` }
      })
      alert(`User UID: ${data.uid}`)
    } catch (error) {
      console.error('Failed to fetch user data:', error)
    }
  }

  const requestUploadUrl = async () => {
    if (!user) return
    
    try {
      const token = await user.getIdToken()
      const data = await apiClient('/uploads/presign', {
        headers: { Authorization: `Bearer ${token}` }
      })
      console.log('Upload URL:', data.url)
      alert(`Got presigned URL for key: ${data.key}`)
    } catch (error) {
      console.error('Failed to get upload URL:', error)
    }
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold mb-8 text-center">Boilerplate App</h1>
        
        <div className="mb-8 text-center">
          <p className="mb-2">API Status: {healthStatus || 'Checking...'}</p>
        </div>

        <div className="flex flex-col items-center gap-4">
          {user ? (
            <>
              <p className="mb-4">Logged in as: {user.email}</p>
              <button
                onClick={fetchUserData}
                className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Fetch User Data
              </button>
              <button
                onClick={requestUploadUrl}
                className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Get Upload URL
              </button>
              <button
                onClick={signOut}
                className="px-6 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Sign Out
              </button>
            </>
          ) : (
            <button
              onClick={signInWithGoogle}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Sign In with Google
            </button>
          )}
        </div>
      </div>
    </main>
  )
}