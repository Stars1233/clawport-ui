// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { parseSchedule, describeCron, formatDuration, parseScheduleSlots } from './cron-utils'

// --- parseSchedule ---

describe('parseSchedule', () => {
  it('handles a plain string', () => {
    const result = parseSchedule('0 8 * * *')
    expect(result).toEqual({ expression: '0 8 * * *', timezone: null })
  })

  it('handles object with expression + timezone', () => {
    const result = parseSchedule({ expression: '0 8 * * *', timezone: 'America/Chicago' })
    expect(result).toEqual({ expression: '0 8 * * *', timezone: 'America/Chicago' })
  })

  it('handles object with cron key', () => {
    const result = parseSchedule({ cron: '0 10 * * 1-5' })
    expect(result).toEqual({ expression: '0 10 * * 1-5', timezone: null })
  })

  it('handles object with value key', () => {
    const result = parseSchedule({ value: '0 6 * * 1' })
    expect(result).toEqual({ expression: '0 6 * * 1', timezone: null })
  })

  it('handles null', () => {
    const result = parseSchedule(null)
    expect(result).toEqual({ expression: '', timezone: null })
  })

  it('handles undefined', () => {
    const result = parseSchedule(undefined)
    expect(result).toEqual({ expression: '', timezone: null })
  })

  it('handles empty object', () => {
    const result = parseSchedule({})
    expect(result).toEqual({ expression: '', timezone: null })
  })

  it('ignores non-string timezone', () => {
    const result = parseSchedule({ expression: '0 8 * * *', timezone: 123 })
    expect(result).toEqual({ expression: '0 8 * * *', timezone: null })
  })

  it('handles actual data format: { kind: "cron", expr: "...", tz: "..." }', () => {
    const result = parseSchedule({ kind: 'cron', expr: '0 6 * * *', tz: 'America/Chicago' })
    expect(result).toEqual({ expression: '0 6 * * *', timezone: 'America/Chicago' })
  })

  it('handles expr without tz', () => {
    const result = parseSchedule({ kind: 'cron', expr: '0 12 * * 1' })
    expect(result).toEqual({ expression: '0 12 * * 1', timezone: null })
  })

  it('prefers expr over expression when both present', () => {
    const result = parseSchedule({ expr: '0 6 * * *', expression: '0 8 * * *' })
    expect(result).toEqual({ expression: '0 6 * * *', timezone: null })
  })
})

// --- describeCron ---

describe('describeCron', () => {
  it('daily at 8:00 AM', () => {
    expect(describeCron('0 8 * * *')).toBe('Daily at 8 AM')
  })

  it('daily at 3:00 PM', () => {
    expect(describeCron('0 15 * * *')).toBe('Daily at 3 PM')
  })

  it('daily at 12:00 AM (midnight)', () => {
    expect(describeCron('0 0 * * *')).toBe('Daily at 12 AM')
  })

  it('daily at 12:00 PM (noon)', () => {
    expect(describeCron('0 12 * * *')).toBe('Daily at 12 PM')
  })

  it('daily with non-zero minutes', () => {
    expect(describeCron('30 14 * * *')).toBe('Daily at 2:30 PM')
  })

  it('weekdays at 10:00 AM', () => {
    expect(describeCron('0 10 * * 1-5')).toBe('Weekdays at 10 AM')
  })

  it('Mondays at 6:00 AM', () => {
    expect(describeCron('0 6 * * 1')).toBe('Mondays at 6 AM')
  })

  it('Sundays at 12:00 AM', () => {
    expect(describeCron('0 0 * * 0')).toBe('Sundays at 12 AM')
  })

  it('Fridays at 5:00 PM', () => {
    expect(describeCron('0 17 * * 5')).toBe('Fridays at 5 PM')
  })

  it('Saturdays at 9:00 AM', () => {
    expect(describeCron('0 9 * * 6')).toBe('Saturdays at 9 AM')
  })

  it('every 2 days at 12:00 PM', () => {
    expect(describeCron('0 12 */2 * *')).toBe('Every 2 days at 12 PM')
  })

  it('every minute', () => {
    expect(describeCron('* * * * *')).toBe('Every minute')
  })

  it('every hour', () => {
    expect(describeCron('0 * * * *')).toBe('Every hour')
  })

  it('monthly on the 1st at 8:00 AM', () => {
    expect(describeCron('0 8 1 * *')).toBe('Monthly on the 1st at 8 AM')
  })

  it('monthly on the 2nd at 9:00 AM', () => {
    expect(describeCron('0 9 2 * *')).toBe('Monthly on the 2nd at 9 AM')
  })

  it('monthly on the 3rd at 10:00 AM', () => {
    expect(describeCron('0 10 3 * *')).toBe('Monthly on the 3rd at 10 AM')
  })

  it('monthly on the 15th at 6:00 PM', () => {
    expect(describeCron('0 18 15 * *')).toBe('Monthly on the 15th at 6 PM')
  })

  it('returns raw expression for unparseable input', () => {
    expect(describeCron('*/5 */2 1,15 * 1-5')).toBe('*/5 */2 1,15 * 1-5')
  })

  it('returns raw expression for 6-field cron', () => {
    expect(describeCron('0 0 8 * * *')).toBe('0 0 8 * * *')
  })

  it('returns empty string for empty input', () => {
    expect(describeCron('')).toBe('')
  })

  it('returns empty string for whitespace-only input', () => {
    expect(describeCron('   ')).toBe('')
  })
})

// --- formatDuration ---

describe('formatDuration', () => {
  it('formats seconds only', () => {
    expect(formatDuration(45000)).toBe('45s')
  })

  it('formats zero', () => {
    expect(formatDuration(0)).toBe('0s')
  })

  it('formats minutes and seconds', () => {
    expect(formatDuration(147116)).toBe('2m 27s')
  })

  it('formats exact minutes', () => {
    expect(formatDuration(120000)).toBe('2m')
  })

  it('formats hours and minutes', () => {
    expect(formatDuration(3660000)).toBe('1h 1m')
  })

  it('formats exact hours', () => {
    expect(formatDuration(3600000)).toBe('1h 0m')
  })

  it('handles negative values', () => {
    expect(formatDuration(-1)).toBe('—')
  })

  it('handles Infinity', () => {
    expect(formatDuration(Infinity)).toBe('—')
  })
})

// --- parseScheduleSlots ---

describe('parseScheduleSlots', () => {
  it('parses daily cron', () => {
    const result = parseScheduleSlots('0 8 * * *')
    expect(result).toEqual({ hour: 8, minute: 0, days: [0, 1, 2, 3, 4, 5, 6] })
  })

  it('parses weekday cron', () => {
    const result = parseScheduleSlots('0 10 * * 1-5')
    expect(result).toEqual({ hour: 10, minute: 0, days: [1, 2, 3, 4, 5] })
  })

  it('parses specific day cron', () => {
    const result = parseScheduleSlots('0 12 * * 1')
    expect(result).toEqual({ hour: 12, minute: 0, days: [1] })
  })

  it('parses comma-separated days', () => {
    const result = parseScheduleSlots('30 9 * * 1,3,5')
    expect(result).toEqual({ hour: 9, minute: 30, days: [1, 3, 5] })
  })

  it('returns null for empty input', () => {
    expect(parseScheduleSlots('')).toBeNull()
  })

  it('returns null for 6-field cron', () => {
    expect(parseScheduleSlots('0 0 8 * * *')).toBeNull()
  })

  it('returns null for wildcard hour', () => {
    expect(parseScheduleSlots('0 * * * *')).toBeNull()
  })
})
