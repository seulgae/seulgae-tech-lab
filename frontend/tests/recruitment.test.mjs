import test from 'node:test'
import assert from 'node:assert/strict'
import { nextRun, safeLink } from '../src/features/recruitment/recruitmentApi.ts'

test('예약 시각은 서울 기준이며 마지막 업무 이후 다음날로 넘어간다', () => {
  assert.equal(nextRun([9], new Date('2026-11-22T00:00:00Z')).toISOString(), '2026-11-23T00:00:00.000Z')
  assert.equal(nextRun([15, 17], new Date('2026-11-22T06:01:00Z')).toISOString(), '2026-11-22T08:00:00.000Z')
  assert.equal(nextRun([15, 17], new Date('2026-11-22T08:01:00Z')).toISOString(), '2026-11-23T06:00:00.000Z')
})
test('원본 링크는 허용된 출처의 HTTPS 주소만 표시한다', () => {
  assert.equal(safeLink('https://www.saramin.co.kr/jobs/1'), true)
  assert.equal(safeLink('https://jobplanet.co.kr.evil.test/a'), false)
  assert.equal(safeLink('javascript:alert(1)'), false)
  assert.equal(safeLink('https://user:pass@jobkorea.co.kr/a'), false)
})
