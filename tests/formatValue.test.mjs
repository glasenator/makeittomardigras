import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { transformWithEsbuild } from 'vite'

const source = await readFile(new URL('../src/formatValue.ts', import.meta.url), 'utf8')
const { code } = await transformWithEsbuild(source, 'formatValue.ts')
const { formatValue } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)

test('positive values have a plus sign; negative values and zero retain their signs', () => {
  assert.equal(formatValue(1), '+1')
  assert.equal(formatValue(10), '+10')
  assert.equal(formatValue(0), '0')
  assert.equal(formatValue(-1), '-1')
  assert.equal(formatValue(-10), '-10')
})
