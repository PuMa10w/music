import { useEffect, useState } from 'react'
import { API_BASE } from '../api/api'

interface ServiceStatus {
  status: 'ok' | 'degraded' | 'error' | 'disabled' | 'not_implemented' | 'unknown'
  message: string
}

interface HealthResponse {
  status: 'ok' | 'degraded' | 'error'
  timestamp: string
  services: Record<string, ServiceStatus>
}

const labels: Record<string, string> = {
  ok: 'OK',
  degraded: 'Warning',
  error: 'Error',
  disabled: 'Disabled',
  not_implemented: 'Not ready',
  unknown: 'Unknown',
}

export default function SystemStatus() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  const fetchHealth = async () => {
    try {
      const response = await fetch(`${API_BASE}/health`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      setHealth(await response.json())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Health check failed')
    }
  }

  useEffect(() => {
    fetchHealth()
    const interval = window.setInterval(fetchHealth, 30000)
    return () => window.clearInterval(interval)
  }, [])

  const status = error ? 'error' : health?.status || 'unknown'

  return (
    <div className={`system-pill status-${status}`}>
      <button className="system-summary" onClick={() => setExpanded(!expanded)}>
        <span className="system-dot" />
        <span>{error ? `Health: ${error}` : `System: ${labels[status] || status}`}</span>
      </button>
      <button className="system-refresh" onClick={fetchHealth}>Refresh</button>

      {expanded && health && (
        <div className="system-popover">
          <p>Checked: {new Date(health.timestamp).toLocaleString()}</p>
          {Object.entries(health.services).map(([name, service]) => (
            <div key={name} className="system-row">
              <strong>{name}</strong>
              <span>{labels[service.status] || service.status}</span>
              <small>{service.message}</small>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
