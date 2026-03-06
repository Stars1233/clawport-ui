// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { LogEntry } from '@/lib/types'

const { mockReadFileSync, mockReaddirSync, mockExistsSync, mockStatSync } = vi.hoisted(() => ({
  mockReadFileSync: vi.fn(),
  mockReaddirSync: vi.fn(),
  mockExistsSync: vi.fn(),
  mockStatSync: vi.fn(),
}))

vi.mock('fs', () => ({
  readFileSync: mockReadFileSync,
  readdirSync: mockReaddirSync,
  existsSync: mockExistsSync,
  statSync: mockStatSync,
  default: { readFileSync: mockReadFileSync, readdirSync: mockReaddirSync, existsSync: mockExistsSync, statSync: mockStatSync },
}))

import { parseCronRunLine, parseConfigAuditLine, getLogEntries, computeLogSummary } from './logs'

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('WORKSPACE_PATH', '/tmp/test-workspace')
  mockExistsSync.mockReturnValue(true)
})

/* ── parseCronRunLine ──────────────────────────────────────────── */

describe('parseCronRunLine', () => {
  it('parses a valid finished cron run', () => {
    const line = JSON.stringify({
      ts: 1772190149746,
      jobId: 'abc-123',
      action: 'finished',
      status: 'ok',
      summary: 'All good',
      durationMs: 5000,
      deliveryStatus: 'delivered',
    })
    const entry = parseCronRunLine(line, 'abc-123.jsonl')
    expect(entry).not.toBeNull()
    expect(entry!.source).toBe('cron')
    expect(entry!.level).toBe('info')
    expect(entry!.ts).toBe(1772190149746)
    expect(entry!.summary).toBe('All good')
    expect(entry!.durationMs).toBe(5000)
    expect(entry!.jobId).toBe('abc-123')
  })

  it('parses an error cron run', () => {
    const line = JSON.stringify({
      ts: 1772190149746,
      jobId: 'abc-123',
      action: 'finished',
      status: 'error',
      error: 'delivery failed',
      summary: 'Failed run',
      durationMs: 1000,
    })
    const entry = parseCronRunLine(line, 'abc-123.jsonl')
    expect(entry!.level).toBe('error')
    expect(entry!.summary).toBe('Failed run')
  })

  it('skips non-finished actions', () => {
    const line = JSON.stringify({
      ts: 1772190149746,
      jobId: 'abc-123',
      action: 'started',
    })
    expect(parseCronRunLine(line, 'abc-123.jsonl')).toBeNull()
  })

  it('returns null for empty lines', () => {
    expect(parseCronRunLine('', 'test.jsonl')).toBeNull()
    expect(parseCronRunLine('   ', 'test.jsonl')).toBeNull()
  })

  it('returns null for malformed JSON', () => {
    expect(parseCronRunLine('{not valid json', 'test.jsonl')).toBeNull()
  })

  it('falls back to error string when summary is missing', () => {
    const line = JSON.stringify({
      ts: 100,
      action: 'finished',
      status: 'error',
      error: 'something broke',
    })
    const entry = parseCronRunLine(line, 'test.jsonl')
    expect(entry!.summary).toBe('something broke')
  })

  it('derives jobId from filename when not in line', () => {
    const line = JSON.stringify({ ts: 100, action: 'finished', status: 'ok' })
    const entry = parseCronRunLine(line, 'my-job-id.jsonl')
    expect(entry!.jobId).toBe('my-job-id')
  })
})

/* ── parseConfigAuditLine ──────────────────────────────────────── */

describe('parseConfigAuditLine', () => {
  it('parses a valid config audit entry with ISO ts', () => {
    const line = JSON.stringify({
      ts: '2026-02-23T04:12:48.180Z',
      source: 'config-io',
      event: 'config.write',
      result: 'rename',
      argv: ['node', 'openclaw', 'onboard'],
      suspicious: [],
    })
    const entry = parseConfigAuditLine(line)
    expect(entry).not.toBeNull()
    expect(entry!.source).toBe('config')
    expect(entry!.level).toBe('info')
    expect(entry!.ts).toBe(new Date('2026-02-23T04:12:48.180Z').getTime())
    expect(entry!.category).toBe('config.write')
  })

  it('marks suspicious entries as warn level', () => {
    const line = JSON.stringify({
      ts: '2026-02-23T04:12:48.180Z',
      event: 'config.write',
      suspicious: ['something odd'],
    })
    const entry = parseConfigAuditLine(line)
    expect(entry!.level).toBe('warn')
  })

  it('handles numeric ts', () => {
    const line = JSON.stringify({ ts: 1772190149746, event: 'config.write' })
    const entry = parseConfigAuditLine(line)
    expect(entry!.ts).toBe(1772190149746)
  })

  it('returns null for empty lines', () => {
    expect(parseConfigAuditLine('')).toBeNull()
  })

  it('returns null for malformed JSON', () => {
    expect(parseConfigAuditLine('not json')).toBeNull()
  })

  it('defaults ts to 0 for invalid date strings', () => {
    const line = JSON.stringify({ ts: 'not-a-date', event: 'config.write' })
    const entry = parseConfigAuditLine(line)
    expect(entry!.ts).toBe(0)
  })
})

/* ── getLogEntries ─────────────────────────────────────────────── */

describe('getLogEntries', () => {
  const cronLine = JSON.stringify({
    ts: 2000,
    jobId: 'job1',
    action: 'finished',
    status: 'ok',
    summary: 'cron entry',
    durationMs: 100,
  })
  const configLine = JSON.stringify({
    ts: '2026-03-01T00:00:00.000Z',
    event: 'config.write',
    result: 'rename',
    argv: [],
    suspicious: [],
  })

  it('merges cron + config entries sorted newest-first', () => {
    mockReaddirSync.mockReturnValue(['job1.jsonl'])
    mockStatSync.mockReturnValue({ mtimeMs: 1000 })
    mockReadFileSync.mockImplementation((filePath: string) => {
      if (filePath.includes('job1.jsonl')) return cronLine
      if (filePath.includes('config-audit.jsonl')) return configLine
      return ''
    })

    const entries = getLogEntries()
    expect(entries.length).toBe(2)
    // Config ts (2026-03-01) > cron ts (2000ms from epoch) so config comes first
    expect(entries[0].source).toBe('config')
    expect(entries[1].source).toBe('cron')
  })

  it('filters by source=cron', () => {
    mockReaddirSync.mockReturnValue(['job1.jsonl'])
    mockStatSync.mockReturnValue({ mtimeMs: 1000 })
    mockReadFileSync.mockReturnValue(cronLine)

    const entries = getLogEntries({ source: 'cron' })
    expect(entries.every(e => e.source === 'cron')).toBe(true)
  })

  it('filters by source=config', () => {
    mockReadFileSync.mockReturnValue(configLine)

    const entries = getLogEntries({ source: 'config' })
    expect(entries.every(e => e.source === 'config')).toBe(true)
  })

  it('respects limit', () => {
    const lines = Array.from({ length: 10 }, (_, i) =>
      JSON.stringify({ ts: i * 1000, jobId: 'j', action: 'finished', status: 'ok', summary: `run ${i}`, durationMs: 1 })
    ).join('\n')
    mockReaddirSync.mockReturnValue(['j.jsonl'])
    mockStatSync.mockReturnValue({ mtimeMs: 1000 })
    mockReadFileSync.mockReturnValue(lines)

    const entries = getLogEntries({ limit: 3, source: 'cron' })
    expect(entries.length).toBe(3)
  })

  it('returns empty array when directories do not exist', () => {
    mockExistsSync.mockReturnValue(false)
    const entries = getLogEntries()
    expect(entries).toEqual([])
  })
})

/* ── computeLogSummary ─────────────────────────────────────────── */

describe('computeLogSummary', () => {
  it('computes correct summary', () => {
    const entries: LogEntry[] = [
      { id: '1', ts: 3000, source: 'cron', level: 'error', category: 'cron-run', summary: 'fail', agentId: null, jobId: 'j1', durationMs: 100, details: {} },
      { id: '2', ts: 2000, source: 'cron', level: 'info', category: 'cron-run', summary: 'ok', agentId: null, jobId: 'j2', durationMs: 50, details: {} },
      { id: '3', ts: 1000, source: 'config', level: 'info', category: 'config.write', summary: 'write', agentId: null, jobId: null, durationMs: null, details: {} },
    ]
    const summary = computeLogSummary(entries)
    expect(summary.totalEntries).toBe(3)
    expect(summary.errorCount).toBe(1)
    expect(summary.sources.cron).toBe(2)
    expect(summary.sources.config).toBe(1)
    expect(summary.timeRange).toEqual({ oldest: 1000, newest: 3000 })
    expect(summary.recentErrors).toHaveLength(1)
    expect(summary.recentErrors[0].id).toBe('1')
  })

  it('returns null timeRange for empty entries', () => {
    const summary = computeLogSummary([])
    expect(summary.totalEntries).toBe(0)
    expect(summary.timeRange).toBeNull()
  })

  it('limits recentErrors to 5', () => {
    const entries: LogEntry[] = Array.from({ length: 8 }, (_, i) => ({
      id: String(i),
      ts: i * 1000,
      source: 'cron' as const,
      level: 'error' as const,
      category: 'cron-run',
      summary: `error ${i}`,
      agentId: null,
      jobId: null,
      durationMs: null,
      details: {},
    }))
    const summary = computeLogSummary(entries)
    expect(summary.recentErrors).toHaveLength(5)
  })
})
