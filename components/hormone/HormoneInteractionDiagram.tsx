'use client'

import { useState, useCallback, useMemo } from 'react'
import {
  DIAGRAM_SVG_WIDTH,
  DIAGRAM_SVG_HEIGHT,
  DIAGRAM_NODE_RADIUS,
  INTERACTION_EDGE_COLORS,
  INTERACTION_TYPE_LABELS,
} from '@/lib/constants/hormone-techniques'

type HormoneNode = {
  id: string
  name: string
  slug: string
  category: string
}

type InteractionEdge = {
  hormoneAId: string
  hormoneBId: string
  type: string
  description: string | null
}

type Props = {
  hormones: HormoneNode[]
  interactions: InteractionEdge[]
}

/** ノード位置を計算（major=内側五角形, secondary=外側） */
function calculatePositions(hormones: HormoneNode[]) {
  const cx = DIAGRAM_SVG_WIDTH / 2
  const cy = DIAGRAM_SVG_HEIGHT / 2
  const majorRadius = 130
  const secondaryRadius = 210

  const major = hormones.filter((h) => h.category === 'major')
  const secondary = hormones.filter((h) => h.category === 'secondary')

  const positions = new Map<string, { x: number; y: number }>()

  major.forEach((h, i) => {
    const angle = (2 * Math.PI * i) / major.length - Math.PI / 2
    positions.set(h.id, {
      x: cx + majorRadius * Math.cos(angle),
      y: cy + majorRadius * Math.sin(angle),
    })
  })

  secondary.forEach((h, i) => {
    const angle = (2 * Math.PI * i) / secondary.length - Math.PI / 2
    positions.set(h.id, {
      x: cx + secondaryRadius * Math.cos(angle),
      y: cy + secondaryRadius * Math.sin(angle),
    })
  })

  return positions
}

const ALL_INTERACTION_TYPES = new Set(['synergistic', 'antagonistic', 'modulatory'])

export function HormoneInteractionDiagram({ hormones, interactions }: Props) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [hoveredEdgeIndex, setHoveredEdgeIndex] = useState<number | null>(null)
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set(ALL_INTERACTION_TYPES))
  const [searchQuery, setSearchQuery] = useState('')

  const toggleType = useCallback((type: string) => {
    setActiveTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) {
        next.delete(type)
      } else {
        next.add(type)
      }
      return next
    })
  }, [])

  const normalizedSearch = searchQuery.trim().toLowerCase()

  const matchingNodeIds = useMemo(() => {
    if (!normalizedSearch) return null
    const ids = new Set<string>()
    for (const h of hormones) {
      if (h.name.toLowerCase().includes(normalizedSearch)) {
        ids.add(h.id)
      }
    }
    return ids
  }, [hormones, normalizedSearch])

  const filteredInteractions = useMemo(() => {
    return interactions.filter((edge) => {
      if (!activeTypes.has(edge.type)) return false
      if (matchingNodeIds && !matchingNodeIds.has(edge.hormoneAId) && !matchingNodeIds.has(edge.hormoneBId)) return false
      return true
    })
  }, [interactions, activeTypes, matchingNodeIds])

  const positions = calculatePositions(hormones)

  const handleNodeClick = useCallback((nodeId: string) => {
    setSelectedNodeId((prev) => (prev === nodeId ? null : nodeId))
    setHoveredEdgeIndex(null)
  }, [])

  const isNodeHighlighted = useCallback(
    (nodeId: string) => {
      if (matchingNodeIds && !matchingNodeIds.has(nodeId)) return false
      if (!selectedNodeId) return true
      if (nodeId === selectedNodeId) return true
      return filteredInteractions.some(
        (i) =>
          (i.hormoneAId === selectedNodeId && i.hormoneBId === nodeId) ||
          (i.hormoneBId === selectedNodeId && i.hormoneAId === nodeId)
      )
    },
    [selectedNodeId, filteredInteractions, matchingNodeIds]
  )

  const isEdgeConnected = useCallback(
    (edge: InteractionEdge) => {
      if (!selectedNodeId) return true
      return edge.hormoneAId === selectedNodeId || edge.hormoneBId === selectedNodeId
    },
    [selectedNodeId]
  )

  if (hormones.length === 0) {
    return <p className="text-sm text-muted-foreground">ダイアグラムデータがありません。</p>
  }

  return (
    <div className="space-y-4">
      {/* フィルターコントロール */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">種類:</span>
        {Object.entries(INTERACTION_TYPE_LABELS).map(([type, label]) => {
          const isActive = activeTypes.has(type)
          return (
            <button
              key={type}
              type="button"
              onClick={() => toggleType(type)}
              className={`px-2 py-1 text-xs rounded border transition-colors ${
                isActive
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:bg-accent'
              }`}
            >
              {label}
            </button>
          )
        })}
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="ホルモン名で検索..."
          className="ml-auto px-2 py-1 text-xs rounded border border-border bg-background placeholder:text-muted-foreground w-40 focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <svg
        viewBox={`0 0 ${DIAGRAM_SVG_WIDTH} ${DIAGRAM_SVG_HEIGHT}`}
        className="w-full max-w-[600px] mx-auto"
        role="img"
        aria-label="ホルモン相互作用ダイアグラム"
      >
        {/* エッジ */}
        {filteredInteractions.map((edge, idx) => {
          const posA = positions.get(edge.hormoneAId)
          const posB = positions.get(edge.hormoneBId)
          if (!posA || !posB) return null
          const color = INTERACTION_EDGE_COLORS[edge.type] ?? '#9ca3af'
          const connected = isEdgeConnected(edge)
          const hovered = hoveredEdgeIndex === idx
          return (
            <line
              key={`edge-${edge.hormoneAId}-${edge.hormoneBId}-${edge.type}`}
              x1={posA.x}
              y1={posA.y}
              x2={posB.x}
              y2={posB.y}
              stroke={color}
              strokeWidth={hovered ? 3 : 2}
              opacity={connected ? 1 : 0.15}
              className="cursor-pointer transition-opacity"
              onMouseEnter={() => setHoveredEdgeIndex(idx)}
              onMouseLeave={() => setHoveredEdgeIndex(null)}
            >
              <title>
                {edge.description ?? `${edge.type}`}
              </title>
            </line>
          )
        })}

        {/* ノード */}
        {hormones.map((hormone) => {
          const pos = positions.get(hormone.id)
          if (!pos) return null
          const highlighted = isNodeHighlighted(hormone.id)
          const isSelected = selectedNodeId === hormone.id
          const isMajor = hormone.category === 'major'
          return (
            <g
              key={hormone.id}
              className="cursor-pointer"
              onClick={() => handleNodeClick(hormone.id)}
              opacity={highlighted ? 1 : 0.2}
            >
              <circle
                cx={pos.x}
                cy={pos.y}
                r={DIAGRAM_NODE_RADIUS}
                fill={isMajor ? '#166534' : '#1e40af'}
                stroke={isSelected ? '#f59e0b' : '#ffffff'}
                strokeWidth={isSelected ? 3 : 2}
                className="transition-all"
              />
              <text
                x={pos.x}
                y={pos.y}
                textAnchor="middle"
                dominantBaseline="central"
                fill="white"
                fontSize={11}
                fontWeight="bold"
                className="pointer-events-none select-none"
              >
                {hormone.name.length > 5
                  ? hormone.name.slice(0, 4) + '…'
                  : hormone.name}
              </text>
              <title>{hormone.name}</title>
            </g>
          )
        })}
      </svg>

      {/* ホバー中エッジの説明 */}
      {hoveredEdgeIndex !== null && (() => {
        const edge = filteredInteractions[hoveredEdgeIndex]
        if (!edge) return null
        return (
          <div className="rounded-lg border p-3 text-sm bg-muted/50">
            <p className="font-medium">
              {hormones.find((h) => h.id === edge.hormoneAId)?.name}
              {' ↔ '}
              {hormones.find((h) => h.id === edge.hormoneBId)?.name}
              <span className="ml-2 text-xs text-muted-foreground">
                ({INTERACTION_TYPE_LABELS[edge.type] ?? edge.type})
              </span>
            </p>
            {edge.description && (
              <p className="text-muted-foreground mt-1">{edge.description}</p>
            )}
          </div>
        )
      })()}

      {/* 凡例 */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
        <span className="font-medium">線の色:</span>
        {Object.entries(INTERACTION_EDGE_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1">
            <div className="w-4 h-0.5 rounded" style={{ backgroundColor: color }} />
            <span>{INTERACTION_TYPE_LABELS[type] ?? type}</span>
          </div>
        ))}
        <span className="font-medium ml-2">ノード:</span>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-green-800" />
          <span>五大ホルモン</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-blue-800" />
          <span>二次ホルモン</span>
        </div>
      </div>
    </div>
  )
}
