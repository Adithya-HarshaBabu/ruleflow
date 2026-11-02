import { useMemo } from 'react'
import { ORDERS } from '../rules/data'
import { trace } from '../rules/evaluate'
import type { Group } from '../rules/types'

interface Props {
  root: Group
  selectedId: string | null
  onSelect: (id: string | null) => void
}

export function TestPanel({ root, selectedId, onSelect }: Props) {
  const results = useMemo(() => ORDERS.map((o) => ({ order: o, passed: trace(root, o).passed })), [root])
  const matched = results.filter((r) => r.passed).length

  return (
    <section className="card test">
      <div className="card-head">
        <h2>Test against sample orders</h2>
        <span className="match-count">
          <strong>{matched}</strong> of {ORDERS.length} orders match
        </span>
      </div>
      <p className="muted small">Click an order to see which conditions it passed. Matching orders are highlighted.</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Order</th>
              <th>Total</th>
              <th>Customer</th>
              <th>Country</th>
              <th>Payment</th>
              <th>Risk</th>
              <th>Category</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {results.map(({ order, passed }) => (
              <tr
                key={order.id}
                className={`${passed ? 'hit' : ''} ${selectedId === order.id ? 'selected' : ''}`}
                onClick={() => onSelect(selectedId === order.id ? null : order.id)}
                tabIndex={0}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(selectedId === order.id ? null : order.id)}
                aria-selected={selectedId === order.id}
              >
                <td className="mono">{order.id}</td>
                <td className="num">${order.orderTotal}</td>
                <td>
                  {String(order.customerType)} <span className="muted small">· {String(order.accountAgeDays)}d</span>
                </td>
                <td>{String(order.country)}</td>
                <td>{String(order.paymentMethod).replace('_', ' ')}</td>
                <td className="num">
                  <span className={`risk ${Number(order.riskScore) >= 70 ? 'high' : Number(order.riskScore) >= 40 ? 'mid' : ''}`}>{String(order.riskScore)}</span>
                </td>
                <td>{String(order.category)}</td>
                <td>{passed ? <span className="result pass">✓ match</span> : <span className="muted small">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
