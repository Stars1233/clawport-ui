'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { LiveLogLine } from '@/lib/types'
import { Play, Pause } from 'lucide-react'

/* ── Helpers ───────────────────────────────────────────────────── */

const MAX_LINES = 500

const LEVEL_DOT: Record<string, string> = {
  info: 'var(--system-green)',
  warn: 'var(--system-orange)',
  error: 'var(--system-red)',
  debug: 'var(--text-tertiary)',
}

function parseSSELine(data: string): LiveLogLine | null {
  try {
    const obj = JSON.parse(data)
    return {
      type: obj.type ?? 'log',
      time: obj.time ?? obj.ts ?? new Date().toISOString(),
      level: obj.level ?? 'info',
      message: obj.message ?? obj.msg ?? JSON.stringify(obj),
    }
  } catch {
    // Plain text line
    return {
      type: 'log',
      time: new Date().toISOString(),
      level: 'info',
      message: data,
    }
  }
}

function formatTime(ts: string): string {
  const d = new Date(ts)
  if (isNaN(d.getTime())) return ts.slice(0, 8)
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

/* ── Component ─────────────────────────────────────────────────── */

interface ActivityFeedProps {
  active: boolean
}

export function ActivityFeed({ active }: ActivityFeedProps) {
  const [lines, setLines] = useState<LiveLogLine[]>([])
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [autoScroll, setAutoScroll] = useState(true)

  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const userScrolledRef = useRef(false)

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [lines, autoScroll])

  // Detect manual scroll
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    const atBottom = scrollHeight - scrollTop - clientHeight < 40
    if (!atBottom) {
      userScrolledRef.current = true
      setAutoScroll(false)
    }
  }, [])

  const reanchor = useCallback(() => {
    userScrolledRef.current = false
    setAutoScroll(true)
  }, [])

  const startStream = useCallback(() => {
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setStreaming(true)
    setError(null)

    fetch('/api/logs/stream', { signal: controller.signal })
      .then(res => {
        if (!res.ok || !res.body) {
          throw new Error(`Stream failed: HTTP ${res.status}`)
        }
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        function pump(): Promise<void> {
          return reader.read().then(({ done, value }) => {
            if (done) {
              setStreaming(false)
              return
            }
            buffer += decoder.decode(value, { stream: true })
            const chunks = buffer.split('\n\n')
            buffer = chunks.pop() || ''

            const newLines: LiveLogLine[] = []
            for (const chunk of chunks) {
              for (const line of chunk.split('\n')) {
                if (line.startsWith('data: ')) {
                  const parsed = parseSSELine(line.slice(6))
                  if (parsed) newLines.push(parsed)
                } else if (line.startsWith('event: error')) {
                  // Next data line will be the error
                } else if (line.startsWith('data: ') && chunk.includes('event: error')) {
                  try {
                    const errData = JSON.parse(line.slice(6))
                    setError(errData.error || 'Stream error')
                  } catch {
                    setError(line.slice(6))
                  }
                }
              }
            }

            if (newLines.length > 0) {
              setLines(prev => [...prev, ...newLines].slice(-MAX_LINES))
            }

            return pump()
          })
        }

        return pump()
      })
      .catch(err => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'Stream connection failed')
        setStreaming(false)
      })
  }, [])

  const stopStream = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    setStreaming(false)
  }, [])

  // Cleanup on unmount or when tab becomes inactive
  useEffect(() => {
    if (!active && streaming) {
      stopStream()
    }
    return () => {
      if (abortRef.current) {
        abortRef.current.abort()
        abortRef.current = null
      }
    }
  }, [active, streaming, stopStream])

  return (
    <div className="flex flex-col" style={{ height: '100%', minHeight: 0 }}>
      {/* Toolbar */}
      <div className="flex items-center flex-shrink-0" style={{ gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
        {/* Play/Pause */}
        <button
          onClick={streaming ? stopStream : startStream}
          className="focus-ring flex items-center"
          style={{
            padding: '6px 14px',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            cursor: 'pointer',
            fontSize: 'var(--text-footnote)',
            fontWeight: 'var(--weight-semibold)',
            gap: 6,
            background: streaming ? 'rgba(255,69,58,0.1)' : 'var(--accent-fill)',
            color: streaming ? 'var(--system-red)' : 'var(--accent)',
            transition: 'all 200ms var(--ease-smooth)',
          }}
        >
          {streaming ? <Pause size={14} /> : <Play size={14} />}
          {streaming ? 'Pause' : 'Stream'}
        </button>

        {/* Connection status */}
        <div className="flex items-center" style={{ gap: 6 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: streaming ? 'var(--system-green)' : 'var(--text-tertiary)',
              animation: streaming ? 'pulse-green 2s ease-in-out infinite' : undefined,
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)' }}>
            {streaming ? 'Connected' : 'Disconnected'}
          </span>
        </div>

        {/* Line count */}
        {lines.length > 0 && (
          <span style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)', marginLeft: 'auto' }}>
            {lines.length} line{lines.length !== 1 ? 's' : ''}
          </span>
        )}

        {/* Re-anchor button */}
        {!autoScroll && (
          <button
            onClick={reanchor}
            className="focus-ring"
            style={{
              padding: '4px 10px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              cursor: 'pointer',
              fontSize: 'var(--text-caption1)',
              fontWeight: 'var(--weight-medium)',
              background: 'var(--fill-secondary)',
              color: 'var(--text-secondary)',
            }}
          >
            Scroll to bottom
          </button>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div style={{
          padding: 'var(--space-2) var(--space-3)',
          marginBottom: 'var(--space-2)',
          borderRadius: 'var(--radius-sm)',
          background: 'rgba(255,69,58,0.06)',
          borderLeft: '3px solid var(--system-red)',
          fontSize: 'var(--text-caption1)',
          color: 'var(--system-red)',
        }}>
          {error}
        </div>
      )}

      {/* Feed area */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          borderRadius: 'var(--radius-md)',
          background: 'var(--material-regular)',
          border: '1px solid var(--separator)',
        }}
      >
        {lines.length === 0 ? (
          <div className="flex flex-col items-center justify-center" style={{ height: '100%', minHeight: 200, color: 'var(--text-secondary)', gap: 'var(--space-2)' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-tertiary)', marginBottom: 'var(--space-2)' }}>
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            <span style={{ fontSize: 'var(--text-subheadline)', fontWeight: 'var(--weight-medium)' }}>
              {streaming ? 'Waiting for log data...' : 'Click Stream to start'}
            </span>
            <span style={{ fontSize: 'var(--text-footnote)', color: 'var(--text-tertiary)', textAlign: 'center', maxWidth: 300 }}>
              Streams live output from the OpenClaw gateway via <code style={{ fontSize: 'var(--text-caption1)' }}>openclaw logs --follow</code>
            </span>
          </div>
        ) : (
          <div style={{ padding: 'var(--space-2) 0' }}>
            {lines.map((line, i) => (
              <div
                key={i}
                className="flex items-start hover-bg"
                style={{
                  padding: '3px var(--space-3)',
                  gap: 'var(--space-2)',
                  fontSize: 'var(--text-caption1)',
                  minHeight: 24,
                  background: line.level === 'error' ? 'rgba(255,69,58,0.04)' : undefined,
                }}
              >
                {/* Time */}
                <span className="font-mono flex-shrink-0" style={{ color: 'var(--text-tertiary)', minWidth: 70, fontSize: 'var(--text-caption2)' }}>
                  {formatTime(line.time)}
                </span>

                {/* Level dot */}
                <span className="flex-shrink-0" style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: LEVEL_DOT[line.level] ?? 'var(--text-tertiary)',
                  marginTop: 5,
                }} />

                {/* Message */}
                <span className="font-mono" style={{
                  color: line.level === 'error' ? 'var(--system-red)' : 'var(--text-secondary)',
                  wordBreak: 'break-word',
                  lineHeight: 'var(--leading-relaxed)',
                  fontSize: 'var(--text-caption2)',
                }}>
                  {line.message}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse-green {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
