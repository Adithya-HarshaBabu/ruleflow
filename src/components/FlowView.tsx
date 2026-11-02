import { useMemo } from 'react'
import { Background, Controls, Handle, MarkerType, Position, ReactFlow, type Edge, type Node, type NodeProps } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { describeAction, describeCondition } from '../rules/explain'
import type { Trace } from '../rules/evaluate'
import type { Rule, RuleNode } from '../rules/types'

const X = 250
const Y = 64

// The root group gets a second output at the bottom so the "then" edge can run under the tree.
function RootNode({ data }: NodeProps) {
  return (
    <>
      <Handle type="target" position={Position.Left} />
      {String(data.label)}
      <Handle type="source" position={Position.Right} id="children" />
      <Handle type="source" position={Position.Bottom} id="then" />
    </>
  )
}

const nodeTypes = { root: RootNode }

/** Read-only diagram of the rule: order → groups → conditions → actions, laid out as a tidy tree. */
export function FlowView({ rule, trace }: { rule: Rule; trace?: Map<string, Trace> }) {
  const { nodes, edges } = useMemo(() => {
    const nodes: Node[] = []
    const edges: Edge[] = []
    let leaf = 0
    let maxDepth = 0

    const state = (id: string) => {
      const t = trace?.get(id)
      return t ? (t.passed ? 'pass' : 'fail') : ''
    }

    // Returns the node's y so parents can centre themselves on their children.
    const place = (node: RuleNode, depth: number, parentId: string, label?: string, isRoot = false): number => {
      maxDepth = Math.max(maxDepth, depth)
      let y: number
      if (node.kind === 'group' && node.children.length) {
        const ys = node.children.map((c) => place(c, depth + 1, node.id, node.combinator.toUpperCase()))
        y = (Math.min(...ys) + Math.max(...ys)) / 2
      } else {
        y = leaf++ * Y
      }
      const text =
        node.kind === 'group'
          ? `${node.negate ? 'NOT ' : ''}${node.combinator === 'and' ? 'ALL of' : 'ANY of'}${node.children.length ? '' : ' (empty)'}`
          : describeCondition(node)
      nodes.push({
        id: node.id,
        position: { x: depth * X, y },
        data: { label: text },
        className: `flow-node ${node.kind} ${state(node.id)}`,
        sourcePosition: 'right' as Node['sourcePosition'],
        targetPosition: 'left' as Node['targetPosition'],
        ...(isRoot && { type: 'root' }),
      })
      edges.push({
        id: `${parentId}-${node.id}`,
        source: parentId,
        target: node.id,
        label,
        className: state(node.id),
        ...(parentId === rootId && { sourceHandle: 'children' }),
      })
      return y
    }

    const rootId = rule.root.id
    const rootY = place(rule.root, 1, 'start', undefined, true)
    const bottom = Math.max(rootY, (leaf - 1) * Y)
    nodes.push({
      id: 'start',
      position: { x: 0, y: rootY },
      data: { label: 'Order placed' },
      className: 'flow-node start',
      sourcePosition: 'right' as Node['sourcePosition'],
      type: 'input',
    })
    nodes.push({
      id: 'actions',
      position: { x: X, y: bottom + Y * 1.6 },
      data: { label: rule.actions.length ? rule.actions.map(describeAction).join(' → ') : 'No actions yet' },
      className: `flow-node action-node ${state(rule.root.id)}`,
      targetPosition: 'top' as Node['targetPosition'],
      type: 'output',
    })
    edges.push({
      id: 'root-actions',
      source: rule.root.id,
      sourceHandle: 'then',
      target: 'actions',
      label: 'if matched',
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed },
      className: 'then-edge',
    })
    return { nodes, edges }
  }, [rule, trace])

  return (
    <div className="flow">
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView nodesDraggable={false} nodesConnectable={false} proOptions={{ hideAttribution: true }}>
        <Background gap={20} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  )
}
