import assert from 'node:assert/strict'
import test from 'node:test'
import { RACKS, formatMb, isRackId, parseCapacity, sparkline } from '../src/features/lab/model/capacity.ts'
import { ROOMS, nearestInteraction } from '../src/game/maps/rooms.ts'

const sample = {
  probe: { state: 'OK', collectedAt: '2026-11-23T09:00:00Z' },
  cpu: { usedPercent: 17, user: 12, system: 4, ioWait: 1, load1: 0.52, load5: 0.48, load15: 0.4, cores: 4, loadPerCore: 0.13, jvmProcessPercent: 3.2, warning: false, history: [{ at: 'a', value: 10 }, { at: 'b', value: 90 }] },
  memory: { usedPercent: 42.5, totalMb: 7629, usedMb: 2861, availableMb: 4386, buffCacheMb: 3814, swapTotalMb: 1907, swapUsedMb: 190, warning: false, history: [] },
  heap: { usedMb: 120, committedMb: 256, maxMb: 512, usedPercent: 23.4, nonHeapMb: 90, gcCount: 12, gcMillis: 340, threads: 40, peakThreads: 45, warning: false },
  uptime: { hostSeconds: 93784, hostBootAt: '2026-11-22T06:57:16Z', jvmSeconds: 3600, jvmStartAt: '2026-11-23T08:00:00Z' },
  serverTime: '2026-11-23T09:00:05Z',
}

test('서버실 랙 4개: 1 CPU, 2 메모리, 3 JVM 힙, 4 가동시간, 랙마다 따로 잡힌다', () => {
  assert.deepEqual(Object.values(RACKS).map(rack => rack.topic), ['cpu', 'memory', 'heap', 'uptime'])
  const racks = ROOMS['server-room'].interactions
  assert.deepEqual(racks.map(rack => rack.id), Object.keys(RACKS))
  assert.ok(racks.every(rack => rack.kind === 'server-status'))
  for (const rack of racks) assert.equal(nearestInteraction('server-room', rack.x, rack.y + 74)?.id, rack.id, `${rack.id} 앞에 서면 그 랙`)
  assert.equal(isRackId('server-rack-4'), true)
  assert.equal(isRackId('server-racks-left'), false)
})

test('용량 응답 검사·표기: SSH 미설정이면 메모리는 비고, 이상한 값은 거절', () => {
  assert.deepEqual(parseCapacity(sample), sample)
  assert.equal(parseCapacity({ ...sample, probe: { state: 'NOT_CONFIGURED', collectedAt: null }, memory: null, uptime: { ...sample.uptime, hostSeconds: null, hostBootAt: null } }).memory, null)
  assert.throws(() => parseCapacity({ ...sample, cpu: { ...sample.cpu, usedPercent: -1 } }))
  assert.throws(() => parseCapacity({ ...sample, heap: { ...sample.heap, maxMb: 'big' } }))
  assert.throws(() => parseCapacity(null))
  assert.equal(formatMb(512), '512 MiB')
  assert.equal(formatMb(7629), '7.5 GiB')
  assert.equal(sparkline([{ at: 'a', value: 0 }, { at: 'b', value: 100 }], 100, 40), 'M0.0,40.0 L100.0,0.0')
  assert.equal(sparkline([{ at: 'a', value: 50 }]), '', '점 하나로는 선을 긋지 않는다')
})
