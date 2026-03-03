/**
 * Manually-defined pipeline map — describes implicit cron pipelines
 * based on file I/O and scheduling dependencies.
 */

export interface PipelineEdge {
  from: string
  to: string
  artifact: string
}

export interface Pipeline {
  name: string
  edges: PipelineEdge[]
}

export const PIPELINES: Pipeline[] = [
  {
    name: 'Morning Briefing',
    edges: [
      { from: 'vault-morning-snapshot', to: 'builder-briefing', artifact: 'vault-snapshot.json' },
    ],
  },
  {
    name: 'Pulse Daily Pipeline',
    edges: [
      { from: 'pulse-feed-aggregator', to: 'pulse-daily-hype-brief', artifact: 'pulse-feed-latest.txt' },
      { from: 'pulse-launch-watcher', to: 'pulse-daily-hype-brief', artifact: 'pulse-launches-latest.txt' },
      { from: 'pulse-daily-hype-brief', to: 'herald-linkedin-content', artifact: 'pulse-feed-latest.txt' },
      { from: 'pulse-daily-hype-brief', to: 'pulse-lumen-bridge', artifact: 'hot-signals.json' },
    ],
  },
  {
    name: 'SEO Weekly Pipeline',
    edges: [
      { from: 'seo-data-drop-reminder', to: 'seo-team-weekly', artifact: 'SEO-Drops/' },
    ],
  },
]

/** Get all pipelines that include a specific job name. */
export function getPipelinesForJob(name: string): Pipeline[] {
  return PIPELINES.filter(p =>
    p.edges.some(e => e.from === name || e.to === name)
  )
}

/** Get the set of all job names that appear in any pipeline. */
export function getAllPipelineJobNames(): Set<string> {
  const names = new Set<string>()
  for (const p of PIPELINES) {
    for (const e of p.edges) {
      names.add(e.from)
      names.add(e.to)
    }
  }
  return names
}
