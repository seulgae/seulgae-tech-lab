import assert from 'node:assert/strict'
import test from 'node:test'
import RemoteInterpolation from '../src/game/multiplayer/RemoteInterpolation.ts'

const state = (x, moving = true, ack = 0) => ({ id: 'remote', nickname: '테스트', x, y: 440, facing: 'right', moving, ack })
const deviation = values => { const mean = values.reduce((a,b)=>a+b,0)/values.length; return Math.sqrt(values.reduce((sum,v)=>sum+(v-mean)**2,0)/values.length) }

test('20Hz 지터·중복 이동 틱에서 원격 보간의 프레임별 속도 변동을 줄인다', t => {
  const timeline = new RemoteInterpolation(), messages = []
  let previousDue = 0, rendered = 100, old = 100, latest = 100
  const newSpeeds = [], oldSpeeds = []
  for (let at = 0; at <= 2500; at += 50) {
    const motionTime = Math.min(2000, at % 200 === 100 ? at - 50 : at)
    previousDue = Math.max(previousDue + 1, at + [100,130,95,110][at/50%4])
    messages.push({ at, due: previousDue, state: state(100 + motionTime * 0.2, at < 2000, at/50) })
  }
  let initialized = false
  for (let now = 0; now < 4000; now += 1000 / 60) {
    while (messages[0]?.due <= now) {
      const message = messages.shift(); latest = message.state.x
      timeline.push(message.state, message.at, message.due); initialized = true
    }
    if (!initialized) continue
    const x = timeline.sample(now, 1000/60).x
    const oldX = old + (latest - old) * (1000/60/80)
    if (now > 600 && now < 1800) { newSpeeds.push((x-rendered)*60); oldSpeeds.push((oldX-old)*60) }
    rendered=x; old=oldX
  }
  const after = deviation(newSpeeds), before = deviation(oldSpeeds)
  t.diagnostic(`프레임 속도 표준편차(px/s): 최신 목표 추종=${before.toFixed(2)}, 버퍼 보간=${after.toFixed(2)}`)
  assert.ok(after < before * 0.3)
  assert.ok(Math.abs(rendered - 500) < 1e-8)
  assert.equal(timeline.sample(5000, 16).x, 500)
})

test('긴 유휴 후 첫 이동을 과거 전체에 보간하지 않고 단절 중에는 외삽하지 않는다', () => {
  const timeline = new RemoteInterpolation()
  timeline.push(state(100, false), 0, 100)
  for (let at = 50; at < 5000; at += 50) { timeline.push(state(100, false), at, at+100); timeline.sample(at+100,50) }
  timeline.push(state(110), 5000, 5100)
  assert.equal(timeline.sample(5100, 16).x, 100)
  assert.ok(timeline.sample(5300, 100).x <= 110)
  assert.equal(timeline.sample(9000, 1000).x, 110)
  timeline.push(state(600), 10000, 10100)
  assert.equal(timeline.sample(10100, 5000).x, 600)
})
