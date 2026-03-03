// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { PIPELINES, getPipelinesForJob, getAllPipelineJobNames } from './cron-pipelines'

describe('PIPELINES', () => {
  it('has 3 pipeline definitions', () => {
    expect(PIPELINES).toHaveLength(3)
  })

  it('Morning Briefing has correct edges', () => {
    const p = PIPELINES.find(p => p.name === 'Morning Briefing')!
    expect(p.edges).toHaveLength(1)
    expect(p.edges[0]).toEqual({
      from: 'vault-morning-snapshot',
      to: 'builder-briefing',
      artifact: 'vault-snapshot.json',
    })
  })

  it('Pulse Daily Pipeline has 4 edges', () => {
    const p = PIPELINES.find(p => p.name === 'Pulse Daily Pipeline')!
    expect(p.edges).toHaveLength(4)
  })
})

describe('getPipelinesForJob', () => {
  it('finds pipelines for a source job', () => {
    const result = getPipelinesForJob('vault-morning-snapshot')
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Morning Briefing')
  })

  it('finds pipelines for a target job', () => {
    const result = getPipelinesForJob('builder-briefing')
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Morning Briefing')
  })

  it('finds multiple pipelines for jobs in multiple pipelines', () => {
    const result = getPipelinesForJob('pulse-daily-hype-brief')
    expect(result).toHaveLength(1) // only in Pulse Daily Pipeline
    expect(result[0].name).toBe('Pulse Daily Pipeline')
  })

  it('returns empty for standalone jobs', () => {
    const result = getPipelinesForJob('kaze-japan-flights')
    expect(result).toHaveLength(0)
  })
})

describe('getAllPipelineJobNames', () => {
  it('returns all unique job names from pipelines', () => {
    const names = getAllPipelineJobNames()
    expect(names.has('vault-morning-snapshot')).toBe(true)
    expect(names.has('builder-briefing')).toBe(true)
    expect(names.has('pulse-feed-aggregator')).toBe(true)
    expect(names.has('pulse-daily-hype-brief')).toBe(true)
    expect(names.has('herald-linkedin-content')).toBe(true)
    expect(names.has('pulse-lumen-bridge')).toBe(true)
    expect(names.has('seo-data-drop-reminder')).toBe(true)
    expect(names.has('seo-team-weekly')).toBe(true)
  })

  it('does not contain standalone jobs', () => {
    const names = getAllPipelineJobNames()
    expect(names.has('kaze-japan-flights')).toBe(false)
    expect(names.has('robin-weekly-brief')).toBe(false)
  })
})
