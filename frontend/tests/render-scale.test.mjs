import assert from 'node:assert/strict'
import test from 'node:test'
import { RENDER_ZOOM_KEY, UI_FONT, applyRenderZoom, canvasSizeFor, crispText, renderZoomFor } from '../src/game/render/renderScale.ts'

test('렌더 배율은 표시 너비×DPR을 800 세계 너비에 맞추고 범위를 제한한다', () => {
  // 실제 측정: 564 CSS px × DPR 1.25 = 705 기기 픽셀 → 800 캔버스를 0.88배로 줄이면 픽셀 줄이 빠진다.
  assert.equal(renderZoomFor(564, 1.25), 705 / 800)
  assert.equal(renderZoomFor(800, 2), 2)
  assert.equal(renderZoomFor(3000, 2), 3)
  assert.equal(renderZoomFor(200, 1), 0.5)
  assert.equal(renderZoomFor(0, 1), 1)
  assert.equal(renderZoomFor(700, Number.NaN), 700 / 800)
})

test('캔버스 크기는 정수이고 4:3을 유지하며 실제 배율을 함께 돌려준다', () => {
  for (const zoom of [0.5, 705 / 800, 1, 1.37, 2, 3]) {
    const size = canvasSizeFor(zoom)
    assert.ok(Number.isInteger(size.width) && Number.isInteger(size.height))
    assert.ok(Math.abs(size.width / size.height - 4 / 3) < 0.01)
    assert.equal(size.zoom, size.width / 800)
  }
  assert.deepEqual(canvasSizeFor(705 / 800), { width: 705, height: 529, zoom: 705 / 800 })
})

test('글자는 렌더 배율과 같은 해상도로 만들고, 크기가 바뀌면 컨테이너 안 글자까지 다시 맞춘다', () => {
  const made = []
  const makeText = (style) => { const t = { type: 'Text', style, resolution: 1, setResolution(value) { this.resolution = value; return this } }; made.push(t); return t }
  const camera = { setZoom(value) { this.zoom = value; return this }, centerOn(x, y) { this.center = [x, y]; return this } }
  let zoom = 1.5
  const scene = { registry: { get: key => key === RENDER_ZOOM_KEY ? zoom : undefined }, add: { text: (_x, _y, _v, style) => makeText(style) }, cameras: { main: camera }, children: { list: [] } }
  const label = crispText(scene, 0, 0, '연구원', { fontSize: '15px' })
  assert.equal(label.resolution, 1.5)
  assert.equal(label.style.fontFamily, UI_FONT)
  assert.match(UI_FONT, /Malgun Gothic/)
  const nested = crispText(scene, 0, 0, '배너', { fontSize: '15px' })
  scene.children.list.push(label, { type: 'Container', list: [nested] }, { type: 'Image' })
  zoom = 2.25
  applyRenderZoom(scene)
  assert.equal(camera.zoom, 2.25)
  assert.deepEqual(camera.center, [400, 300])
  assert.equal(label.resolution, 2.25)
  assert.equal(nested.resolution, 2.25)
  // 레지스트리가 없는 장면(테스트 대역)은 1배로 동작한다.
  assert.equal(crispText({ add: scene.add }, 0, 0, 'x', {}).resolution, 1)
})
