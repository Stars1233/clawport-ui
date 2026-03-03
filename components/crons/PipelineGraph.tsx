"use client"

import {
  ReactFlow,
  Controls,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
  ConnectionLineType,
} from "@xyflow/react"
import { useEffect, useMemo } from "react"
import type { CronJob } from "@/lib/types"
import { PIPELINES, getAllPipelineJobNames } from "@/lib/cron-pipelines"
import { formatDuration } from "@/lib/cron-utils"

interface PipelineGraphProps {
  crons: CronJob[]
}

/* ─── Custom node ─────────────────────────────────────────────── */

function CronPipelineNode({ data }: NodeProps) {
  const d = data as { name: string; schedule: string; status: string; deliveryTo: string | null; color: string } & Record<string, unknown>
  const statusColor = d.status === "ok" ? "#22c55e" : d.status === "error" ? "#ef4444" : "#a1a1aa"
  const hasDelivery = d.deliveryTo !== null

  return (
    <div
      style={{
        background: "var(--material-regular)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        borderRadius: "var(--radius-md, 10px)",
        border: "1px solid var(--separator)",
        borderLeft: `3px solid ${d.color}`,
        padding: "10px 14px",
        minWidth: 180,
        maxWidth: 220,
        boxShadow: "var(--shadow-card, 0 2px 8px rgba(0,0,0,0.15))",
      }}
    >
      {/* Name + status dot */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: statusColor, flexShrink: 0 }} />
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--text-primary)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {d.name}
        </div>
      </div>

      {/* Schedule */}
      <div style={{ fontSize: 10, color: "var(--text-secondary)", marginBottom: 2 }}>{d.schedule}</div>

      {/* Delivery badge */}
      {hasDelivery && (
        <div
          style={{
            display: "inline-block",
            fontSize: 9,
            padding: "1px 6px",
            borderRadius: 4,
            background: "var(--accent, #6366f1)",
            color: "#fff",
            opacity: 0.8,
            marginTop: 2,
          }}
        >
          delivered
        </div>
      )}

      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  )
}

const pipelineNodeTypes = { cronPipelineNode: CronPipelineNode }

/* ─── Agent colors ─────────────────────────────────────────────── */

const AGENT_COLORS: Record<string, string> = {
  pulse: "#6366f1",
  herald: "#f59e0b",
  robin: "#10b981",
  lumen: "#3b82f6",
  echo: "#8b5cf6",
  spark: "#f97316",
  scribe: "#14b8a6",
  kaze: "#ec4899",
  jarvis: "#ef4444",
  maven: "#84cc16",
}

/* ─── Layout builder ──────────────────────────────────────────── */

function buildPipelineLayout(crons: CronJob[]): { nodes: Node[]; edges: Edge[] } {
  const cronMap = new Map(crons.map(c => [c.name, c]))
  const nodes: Node[] = []
  const edges: Edge[] = []
  const placed = new Set<string>()

  let groupY = 0

  for (const pipeline of PIPELINES) {
    // Group label node
    nodes.push({
      id: `label-${pipeline.name}`,
      type: "default",
      data: { label: pipeline.name },
      position: { x: 0, y: groupY },
      selectable: false,
      draggable: false,
      style: {
        background: "transparent",
        border: "none",
        fontSize: 13,
        fontWeight: 700,
        color: "var(--text-secondary)",
        padding: 0,
        width: 200,
      },
    })

    groupY += 36

    // Determine node positions using topological ordering
    // Collect unique job names in this pipeline preserving dependency order
    const jobNames: string[] = []
    for (const edge of pipeline.edges) {
      if (!jobNames.includes(edge.from)) jobNames.push(edge.from)
      if (!jobNames.includes(edge.to)) jobNames.push(edge.to)
    }

    // Assign columns by dependency depth
    const depth = new Map<string, number>()
    for (const name of jobNames) depth.set(name, 0)
    // Iterate to propagate depths
    for (let pass = 0; pass < jobNames.length; pass++) {
      for (const edge of pipeline.edges) {
        const fromD = depth.get(edge.from) || 0
        const toD = depth.get(edge.to) || 0
        if (fromD + 1 > toD) depth.set(edge.to, fromD + 1)
      }
    }

    // Group by depth for vertical stacking
    const byDepth = new Map<number, string[]>()
    for (const [name, d] of depth) {
      const arr = byDepth.get(d) || []
      arr.push(name)
      byDepth.set(d, arr)
    }

    const maxDepth = Math.max(...Array.from(byDepth.keys()), 0)
    const colSpacing = 280
    const rowSpacing = 80

    for (let d = 0; d <= maxDepth; d++) {
      const namesAtDepth = byDepth.get(d) || []
      namesAtDepth.forEach((name, i) => {
        const cron = cronMap.get(name)
        const nodeId = `${pipeline.name}::${name}`
        placed.add(name)

        nodes.push({
          id: nodeId,
          type: "cronPipelineNode",
          data: {
            name,
            schedule: cron?.scheduleDescription || "—",
            status: cron?.status || "idle",
            deliveryTo: cron?.delivery?.to || null,
            color: AGENT_COLORS[cron?.agentId || ""] || "var(--text-secondary)",
          } as Record<string, unknown>,
          position: { x: d * colSpacing + 20, y: groupY + i * rowSpacing },
        })
      })
    }

    // Edges
    for (const pEdge of pipeline.edges) {
      const sourceId = `${pipeline.name}::${pEdge.from}`
      const targetId = `${pipeline.name}::${pEdge.to}`
      const sourceCron = cronMap.get(pEdge.from)
      const isErrored = sourceCron?.status === "error"

      edges.push({
        id: `${sourceId}→${targetId}`,
        source: sourceId,
        target: targetId,
        type: "smoothstep",
        label: pEdge.artifact,
        labelStyle: { fontSize: 9, fill: "var(--text-muted)" },
        style: {
          stroke: isErrored ? "#ef4444" : "var(--accent, #6366f1)",
          strokeWidth: 1.5,
          strokeDasharray: isErrored ? "6 4" : undefined,
          opacity: isErrored ? 0.7 : 1,
        },
        animated: !isErrored,
      })
    }

    // Advance Y for next group
    const maxNodesPerCol = Math.max(
      ...Array.from(byDepth.values()).map(arr => arr.length),
      1
    )
    groupY += maxNodesPerCol * rowSpacing + 40
  }

  return { nodes, edges }
}

/* ─── Standalone crons card grid ─────────────────────────────── */

function StandaloneCrons({ crons }: { crons: CronJob[] }) {
  const pipelineNames = getAllPipelineJobNames()
  const standalone = crons.filter(c => !pipelineNames.has(c.name))

  if (standalone.length === 0) return null

  return (
    <div style={{ marginTop: 24 }}>
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: "var(--text-secondary)",
          marginBottom: 12,
        }}
      >
        Standalone Crons ({standalone.length})
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 10,
        }}
      >
        {standalone.map(cron => {
          const statusColor = cron.status === "ok" ? "#22c55e" : cron.status === "error" ? "#ef4444" : "#a1a1aa"
          const color = AGENT_COLORS[cron.agentId || ""] || "var(--text-secondary)"

          return (
            <div
              key={cron.id}
              style={{
                background: "var(--material-regular)",
                borderRadius: "var(--radius-md, 10px)",
                border: "1px solid var(--separator)",
                borderLeft: `3px solid ${color}`,
                padding: "10px 14px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: statusColor, flexShrink: 0 }} />
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {cron.name}
                </div>
              </div>
              <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>
                {cron.scheduleDescription || "—"}
              </div>
              {cron.lastDurationMs != null && (
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                  {formatDuration(cron.lastDurationMs)}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── Main component ──────────────────────────────────────────── */

export function PipelineGraph({ crons }: PipelineGraphProps) {
  const layout = useMemo(() => buildPipelineLayout(crons), [crons])
  const [nodes, setNodes, onNodesChange] = useNodesState(layout.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(layout.edges)

  useEffect(() => {
    const { nodes: n, edges: e } = buildPipelineLayout(crons)
    setNodes(n)
    setEdges(e)
  }, [crons, setNodes, setEdges])

  return (
    <div>
      <div style={{ height: 500, border: "1px solid var(--separator)", borderRadius: "var(--radius-md, 10px)", overflow: "hidden" }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={pipelineNodeTypes}
          connectionLineType={ConnectionLineType.SmoothStep}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          minZoom={0.3}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Controls position="bottom-left" style={{ left: 8, bottom: 8 }} />
        </ReactFlow>
      </div>
      <StandaloneCrons crons={crons} />
    </div>
  )
}
