import assert from 'node:assert/strict'
import test from 'node:test'
import { createFloorData, LOBBY_OBJECTS, WORLD, COMPUTER } from '../src/game/maps/lobbyLayout.ts'
import { createPlayerAnimations, getFacing } from '../src/game/PlayerAnimation.ts'
import { createPixelAssets } from '../src/game/assets/pixelAssets.ts'

test('타일 바닥이 화면을 빈틈없이 덮고 유효한 타일만 사용한다', () => {
  const data = createFloorData()
  assert.ok(data.length * WORLD.tile >= WORLD.height)
  assert.equal(data[0].length * WORLD.tile, WORLD.width)
  for (const row of data) {
    assert.equal(row.length, 25)
    assert.ok(row.every(index => index >= 0 && index < 3))
  }
})

test('가구 충돌 영역이 벽 안쪽에 있고 시작 위치를 막지 않는다', () => {
  for (const { body } of LOBBY_OBJECTS) {
    assert.ok(body.x - body.width / 2 >= WORLD.wall)
    assert.ok(body.x + body.width / 2 <= WORLD.width - WORLD.wall)
    assert.ok(body.y - body.height / 2 >= WORLD.wall)
    assert.ok(body.y + body.height / 2 <= WORLD.height - WORLD.wall)
    const overlapsSpawn = Math.abs(body.x - 400) < body.width / 2 + 10 && Math.abs(body.y - 392) < body.height / 2 + 8
    assert.equal(overlapsSpawn, false)
  }
  assert.deepEqual(LOBBY_OBJECTS.find(object => object.texture === 'computer').body, COMPUTER)
})

test('입력 방향을 표현하고 정지 시 마지막 방향을 유지한다', () => {
  assert.equal(getFacing(1, 0, 'down'), 'right')
  assert.equal(getFacing(-1, 0, 'down'), 'left')
  assert.equal(getFacing(0, -1, 'down'), 'up')
  assert.equal(getFacing(0, 1, 'left'), 'down')
  assert.equal(getFacing(0, 0, 'left'), 'left')
  assert.equal(getFacing(1, -1, 'down'), 'up')
})

test('네 방향 걷기·대기에 각각 독립된 4프레임을 등록하며 중복 생성하지 않는다', () => {
  const animations = new Map()
  const scene = { anims: {
    exists: key => animations.has(key),
    generateFrameNumbers: (_texture, { start, end }) => Array.from({ length: end - start + 1 }, (_, i) => start + i),
    create: config => animations.set(config.key, config),
  } }
  createPlayerAnimations(scene)
  createPlayerAnimations(scene)
  assert.equal(animations.size, 8)
  assert.equal(new Set([...animations.values()].flatMap(animation => animation.frames)).size, 32)
  for (const [key, animation] of animations) {
    assert.equal(animation.frames.length, 4)
    assert.equal(animation.frameRate, key.startsWith('walk') ? 9 : 2)
    assert.equal(animation.repeat, -1)
  }
})

test('원본 픽셀을 정수 좌표로 생성하고 캐릭터 시트를 실제 사용할 이름으로 등록한다', () => {
  const originalDocument = globalThis.document
  const textures = new Map()
  const sheets = []
  globalThis.document = { createElement: () => {
    const canvas = { width: 0, height: 0, getContext: () => ({
      fillRect(x, y, width, height) {
        assert.ok([x, y, width, height].every(Number.isInteger))
        assert.ok(x >= 0 && y >= 0 && x + width <= canvas.width && y + height <= canvas.height)
      },
    }) }
    return canvas
  } }
  try {
    const scene = { textures: {
      exists: key => textures.has(key),
      addCanvas: (key, canvas) => { const texture = { key, canvas }; textures.set(key, texture); return texture },
      addSpriteSheet: (key, texture, config) => sheets.push({ key, texture, config }),
    } }
    createPixelAssets(scene)
    createPixelAssets(scene)
    assert.equal(textures.size, 32)
    assert.ok(textures.has('mini-terminal'), '관리자 신청 컴퓨터')
    for (const key of ['npc-professor-0', 'npc-professor-1', 'npc-professor-shock', 'npc-professor-happy']) assert.ok(textures.has(key), key)
    for (const kind of ['woman', 'man', 'elder', 'cleaner', 'kid-boy', 'kid-girl', 'fisher']) for (const frame of [0, 1]) assert.ok(textures.has(`npc-${kind}-${frame}`), `NPC ${kind} ${frame}`)
    assert.equal(textures.get('food-cart').canvas.width, 48, '포장마차')
    assert.ok(textures.has('pet-robot') && textures.has('pet-robot-blink'), '튜토리얼 미니 로봇 펫(눈 깜박임 프레임 포함)')
    assert.equal(sheets.length, 1)
    assert.equal(sheets[0].texture.key, 'researcher')
    assert.equal(sheets[0].key, 'researcher')
    assert.equal(textures.get('researcher').canvas.width, 64)
    assert.equal(textures.get('researcher').canvas.height, 192)
    assert.deepEqual(sheets[0].config, { frameWidth: 16, frameHeight: 24 })
  } finally {
    if (originalDocument === undefined) delete globalThis.document
    else globalThis.document = originalDocument
  }
})
