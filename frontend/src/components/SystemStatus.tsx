import React, { useState, useEffect } from 'react';

interface ServiceStatus {
  status: 'ok' | 'degraded' | 'error' | 'disabled' | 'not_implemented' | 'unknown';
  message: string;
}

interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  services: {
    redis: ServiceStatus;
    python: ServiceStatus;
    disk: ServiceStatus;
  };
}

const statusColors: Record<string, string> = {
  ok: '#10b981', // green
  degraded: '#f59e0b', // yellow
  error: '#ef4444', // red
  disabled: '#6b7280', // gray
  not_implemented: '#8b5cf6', // purple
  unknown: '#9ca3af', // light gray
};

const statusLabels: Record<string, string> = {
  ok: 'OK',
  degraded: 'Degraded',
  error: 'Error',
  disabled: 'Disabled',
  not_implemented: 'Not Implemented',
  unknown: 'Unknown',
};

const SystemStatus: React.FC = () => {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const fetchHealth = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/health');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: HealthResponse = await response.json();
      setHealth(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch health status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !health) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <span style={styles.spinner}></span>
          <span>Loading system status...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <span style={{ color: statusColors.error }}>⚠</span>
          <span>Health check failed: {error}</span>
          <button onClick={fetchHealth} style={styles.refreshButton}>Retry</button>
        </div>
      </div>
    );
  }

  if (!health) return null;

  const overallStatusColor = statusColors[health.status] || statusColors.unknown;

  return (
    <div style={styles.container}>
      <div 
        style={styles.header}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={styles.statusIndicator}>
          <span style={{ 
            ...styles.statusDot, 
            backgroundColor: overallStatusColor 
          }}></span>
          <span style={styles.title}>System Status: {health.status.toUpperCase()}</span>
        </div>
        <div style={styles.actions}>
          <button onClick={(e) => { e.stopPropagation(); fetchHealth(); }} style={styles.refreshButton}>
            ↻
          </button>
          <span style={styles.expandIcon}>{expanded ? '▼' : '▶'}</span>
        </div>
      </div>

      {expanded && (
        <div style={styles.details}>
          <div style={styles.timestamp}>
            Last checked: {new Date(health.timestamp).toLocaleString()}
          </div>
          
          {Object.entries(health.services).map(([serviceName, service]) => {
            const serviceStatusColor = statusColors[service.status] || statusColors.unknown;
            const serviceLabel = statusLabels[service.status] || service.status;
            
            return (
              <div key={serviceName} style={styles.serviceRow}>
                <div style={styles.serviceName}>
                  <span style={{ 
                    ...styles.statusDot, 
                    backgroundColor: serviceStatusColor,
                    width: '8px',
                    height: '8px'
                  }}></span>
                  <span style={styles.serviceLabel}>
                    {serviceName.charAt(0).toUpperCase() + serviceName.slice(1)}:
                  </span>
                </div>
                <div style={styles.serviceInfo}>
                  <span style={{ color: serviceStatusColor }}>{serviceLabel}</span>
                  <span style={styles.serviceMessage}>{service.message}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    backgroundColor: '#1f2937',
    border: '1px solid #374151',
    borderRadius: '8px',
    padding: '12px',
    minWidth: '280px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
    color: '#e5e7eb',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '14px',
    zIndex: 1000,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
    userSelect: 'none',
  },
  statusIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  statusDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    display: 'inline-block',
  },
  title: {
    fontWeight: 600,
    fontSize: '14px',
  },
  actions: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  refreshButton: {
    backgroundColor: '#374151',
    border: 'none',
    color: '#e5e7eb',
    padding: '4px 8px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '16px',
    lineHeight: '1',
  },
  expandIcon: {
    fontSize: '12px',
    color: '#9ca3af',
  },
  details: {
    marginTop: '12px',
    paddingTop: '12px',
    borderTop: '1px solid #374151',
  },
  timestamp: {
    fontSize: '12px',
    color: '#9ca3af',
    marginBottom: '12px',
  },
  serviceRow: {
    marginBottom: '8px',
  },
  serviceName: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '4px',
  },
  serviceLabel: {
    fontWeight: 500,
  },
  serviceInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    marginLeft: '14px',
    fontSize: '12px',
  },
  serviceMessage: {
    color: '#9ca3af',
    fontSize: '12px',
  },
  spinner: {
    display: 'inline-block',
    width: '12px',
    height: '12px',
    border: '2px solid #9ca3af',
    borderTopColor: '#e5e7eb',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
};

export default SystemStatus;
