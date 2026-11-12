import { formatValue } from './formatValue'

export default function CardNumber({ value, position, bustWarning }: { value: number; position: 'top' | 'bottom' | 'left' | 'right'; bustWarning?: 'money' | 'energy' }) {
  if (value !== 0) return <span className={bustWarning ? 'bust-warning' : undefined} aria-label={bustWarning ? `${formatValue(value)}; would bust ${bustWarning} if the week ended now` : undefined} title={bustWarning ? `Would bust ${bustWarning} if the week ended now` : undefined}>{formatValue(value)}</span>
  if (position === 'left' || position === 'right') {
    return (
      <span className={`flip-value flip-value-${position}`} aria-label={`FLIP: up, down, and ${position}`}>
        <span aria-hidden="true">↑</span>
        <span aria-hidden="true">{position === 'left' ? '← FLIP' : 'FLIP →'}</span>
        <span aria-hidden="true">↓</span>
      </span>
    )
  }
  return (
    <span className={`flip-value flip-value-${position}`} aria-label={`FLIP: left, right, and ${position === 'top' ? 'up' : 'down'}`}>
      <span className="flip-arrows" aria-hidden="true">{position === 'top' ? '↑' : '↓'}</span>
      <span aria-hidden="true">← FLIP →</span>
    </span>
  )
}
