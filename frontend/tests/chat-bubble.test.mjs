import assert from 'node:assert/strict'
import test from 'node:test'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { UI_FONT, crispText } from '../src/game/render/renderScale.ts'

test('채팅 말풍선은 객체를 재사용하고 카메라 안에서 따라다니며 5초 후 소멸한다', t => {
  t.mock.timers.enable({ apis: ['Date'], now: 1000 })
  let created = 0, destroyed = false
  const graphic = {}
  for (const method of ['clear','fillStyle','fillRect','lineStyle','strokeRect']) graphic[method] = () => graphic
  const text = { width: 238, height: 70, setResolution() { return this }, setText(value) { this.value=value;return this }, getWrappedText() { return this.value.split('\n') } }
  const container = { alpha: 1, setDepth() { return this }, setPosition(x,y) { this.x=x;this.y=y;return this }, setAlpha(value) { this.alpha=value;return this }, destroy() { destroyed=true } }
  const scene = { cameras: { main: { worldView: { x: 0, y: 0, right: 800, bottom: 600 } } }, add: {
    graphics() {created++;return graphic}, text() {created++;return text}, container() {created++;return container},
  } }
  const source=stripTypeScriptTypes(readFileSync(new URL('../src/game/multiplayer/ChatBubble.ts',import.meta.url),'utf8'))
    .replace(/^import .*$/gm,'').replace('export default class ChatBubble','class ChatBubble')
  const Bubble=vm.runInNewContext(source+'\nChatBubble',{Date,Math,UI_FONT,crispText})
  const bubble=new Bubble(scene,'처음')
  assert.equal(created,3)
  assert.equal(bubble.update(790,80),true)
  assert.ok(container.x >= 6 && container.x+text.width <=794)
  assert.ok(container.y >=6 && container.y+text.height<=594)
  const oldX=container.x
  bubble.update(400,400)
  assert.notEqual(container.x,oldX)
  t.mock.timers.tick(4700)
  assert.equal(bubble.update(400,400),true)
  assert.ok(container.alpha>0 && container.alpha<1)
  bubble.setMessage('새 메시지')
  assert.equal(created,3)
  assert.equal(container.alpha,1)
  bubble.setMessage('한 줄\n'.repeat(40))
  assert.equal(text.value.split('\n').length,12)
  assert.ok(text.value.endsWith('…'))
  t.mock.timers.tick(5000)
  assert.equal(bubble.update(400,400),false)
  assert.equal(container.alpha,0)
  bubble.destroy();assert.equal(destroyed,true)
})
