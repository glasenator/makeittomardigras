export function formatValue(value: number): string {
  return value > 0 ? `+${value}` : `${value}`
}
