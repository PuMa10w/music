import { useEffect, useState } from 'react'

export interface ProgressData {
  action: string
  step?: string
  percent?: number
  message?: string
  status?: string
}

export function useWebSocket(jobId: string | null) {
  const [progress, setProgress] = useState<ProgressData | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!jobId) {
      setProgress(null)
      setConnected(false)
      return
    }

    let stopped = false

    const poll = async () => {
      try {
        const res = await fetch(`/api/status/${jobId}`)
        const data = await res.json()
        if (!stopped) {
          setConnected(true)
          setProgress({
            action: data.event || data.status || 'processing',
            step: data.step,
            percent: data.percent,
            message: data.message || data.status || '',
            status: data.status,
          })
        }
      } catch {
        if (!stopped) setConnected(false)
      }
    }

    poll()
    const timer = window.setInterval(poll, 1000)
    return () => {
      stopped = true
      window.clearInterval(timer)
    }
  }, [jobId])

  return { progress, connected }
}
