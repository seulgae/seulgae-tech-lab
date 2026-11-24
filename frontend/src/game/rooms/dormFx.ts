import Phaser from 'phaser'
import type { RoomInteraction } from '../maps/rooms'
import type { Context } from './fxContext'
import type { RoomHandlers } from './RoomFx'
import { playSfx } from '../../audio/AudioManager'
import {
  DORM_CHANGED_EVENT, DORM_PLACE_EVENT, canPlace, fetchDorm, placeFurniture, restInBed, storeFurniture, takePlacement,
} from '../../features/dorm/dormApi'
import type { RestResult } from '../../features/dorm/dormApi'
import { ruleValue } from '../../features/rules/rulesStore'
import type { DormView, Furniture } from '../../features/dorm/dormApi'

/** 가구 코드 → 텍스처(침대·러그·조명은 기숙사 전용, 나머지는 연구소 가구를 그대로 쓴다) */
export const DORM_TEXTURES: Record<string, string> = {
  BED: 'dorm-bed', DESK: 'office-desk', COMPUTER: 'computer', CHAIR: 'office-chair', ARMCHAIR: 'armchair', SOFA: 'lounge-sofa',
  BOOKSHELF: 'bookshelf', PLANT: 'plant', TALL_PLANT: 'tall-plant', LAMP: 'dorm-lamp', WHITEBOARD: 'whiteboard',
  COFFEE_MACHINE: 'coffee-machine', ARCADE: 'arcade-cabinet', RUG: 'dorm-rug',
}
/** 놓을 자리: 캐릭터 발끝보다 이만큼 위(가구가 캐릭터를 덮지 않게) */
const PLACE_GAP = 20
const PLACE_TARGET = 'dorm-place'
const ITEM_PREFIX = 'dorm-item-'
const BED_PREFIX = 'dorm-bed-'
/** 침대에서 이만큼 멀어지면 일어난 것으로 본다(px) */
const REST_LEAVE = 90

type Drawn = { parts: Phaser.GameObjects.GameObject[] }

/**
 * 개인 기숙사(office-4): 내 가구만 그리고, 부딪히는 가구는 충돌 영역을 만든다.
 * 배치 중에는 캐릭터 위에 반투명 가구(초록=놓을 수 있음, 빨강=못 놓음)가 따라다니고 E로 놓는다(ESC 취소).
 * 놓인 가구 앞에서 E를 누르면 보관함으로 되돌린다. 비회원은 빈 방과 로그인 안내만 본다.
 * 침대 앞에서 E를 누르면 눕는다: 누워 있는 동안 휴식 간격(tb_lab_game_rule REST_EVERY_SEC)마다 서버에 회복을 요청하고,
 * 다시 E를 누르거나 침대에서 멀어지면 일어난다. 침대 보관은 폰 가구 앱 보관함에서 한다.
 *
 * @author 길태형
 * @version 1.1, 침대 휴식
 * @see "None"
 * @param ctx 방 연출 도구(장면·배너·옵션)
 * @returns 방 핸들러
 */
export function dormFx(ctx: Context): RoomHandlers {
  const { scene, banner } = ctx
  const obstacles = ctx.options.obstacles
  let view: DormView | null = null
  let drawn: Drawn[] = []
  let placing: string | null = null
  let ghost: Phaser.GameObjects.Image | undefined
  let busy = false
  let stopped = false
  /** 누워 있는 침대(없으면 null)와 머리 위 Zz, 다음 회복 요청 타이머 */
  let resting: { id: string; x: number; y: number } | null = null
  let snore: Phaser.GameObjects.Text | undefined
  let restTimer: Phaser.Time.TimerEvent | undefined

  const shapeOf = (code: string): Furniture | undefined => view?.catalog.find(entry => entry.code === code)
  const spot = () => {
    const player = ctx.options.player?.()
    return player && { x: Math.round(player.x), y: Math.round(player.y - PLACE_GAP) }
  }

  /* 놓인 가구를 모두 지우고 다시 그린다(가구 수가 적어 통째로 그려도 충분하다). */
  const render = () => {
    for (const item of drawn) for (const part of item.parts) part.destroy()
    drawn = []
    for (const item of view?.furniture ?? []) {
      const shape = shapeOf(item.code)
      if (!item.placed || !shape || item.x === null || item.y === null) continue
      const parts: Phaser.GameObjects.GameObject[] = []
      const floorItem = !shape.blocking
      if (!floorItem) parts.push(scene.add.ellipse(item.x, item.y - 2, shape.width * 0.9, 10, 0x000000, 0.18).setDepth(item.y - 1))
      parts.push(scene.add.image(item.x, item.y, DORM_TEXTURES[item.code] ?? 'plant').setOrigin(0.5, 1).setScale(2).setDepth(floorItem ? -20 : item.y))
      /* 부딪히는 가구만 바닥 크기의 충돌 영역을 만든다(러그는 밟고 지나간다). */
      if (shape.blocking && obstacles) {
        const body = scene.add.rectangle(item.x, item.y - shape.height / 2, shape.width, shape.height).setVisible(false)
        obstacles.add(body)
        parts.push(body)
      }
      drawn.push({ parts })
    }
  }

  const load = async () => {
    try { view = await fetchDorm(); if (!stopped) render() }
    catch { if (!stopped) banner.show('로그인하면 나만의 기숙사를 가구로 꾸밀 수 있어요', '#e7c66f', 3600) }
  }

  const cancel = (message?: string) => {
    placing = null
    ghost?.destroy()
    ghost = undefined
    if (message) banner.show(message)
  }

  const startPlacing = async (id: string) => {
    wake()
    if (!view) await load()
    const item = view?.furniture.find(entry => entry.id === id)
    if (stopped || !item) return
    cancel()
    placing = id
    ghost = scene.add.image(0, 0, DORM_TEXTURES[item.code] ?? 'plant').setOrigin(0.5, 1).setScale(2).setAlpha(0.6).setDepth(1000)
    banner.show(`${shapeOf(item.code)?.name ?? '가구'}: 자리를 고르고 E로 놓아요 · ESC 취소`, '#86efac', 3200)
  }

  /* 일어난다: 타이머와 Zz를 치운다 */
  const wake = (message?: string) => {
    if (!resting) return
    resting = null
    restTimer?.remove()
    restTimer = undefined
    snore?.destroy()
    snore = undefined
    if (message) banner.show(message, '#a7d98a', 2600)
  }

  /* 서버에 회복을 한 번 요청하고, 다음 간격에 다시 부른다(간격은 서버가 지키므로 조금 일찍 불러도 안전하다). */
  const restOnce = async () => {
    if (!resting) return
    let result: RestResult
    try { result = await restInBed() }
    catch (cause) { wake(cause instanceof Error ? cause.message : '쉬지 못했어요.'); return }
    if (!resting || stopped) return
    if (result.unlimited) { wake('연구소장은 HP·기력이 무제한이라 쉴 필요가 없어요'); return }
    const full = result.hp >= result.hpMax && result.fatigue >= result.fatigueMax
    if (result.recovered) {
      playSfx('success', { volume: 0.4 })
      banner.show(`푹 쉬는 중… HP ${result.hp}/${result.hpMax} · 기력 ${result.fatigue}/${result.fatigueMax}`, '#a7d98a', 2600)
    }
    if (full) { wake('HP·기력이 가득 찼어요. 개운하게 일어났어요!'); return }
    restTimer = scene.time.delayedCall(Math.max(5, result.everySec) * 1000, () => { void restOnce() })
  }

  /* 침대에 눕는다 */
  const lieDown = (target: RoomInteraction) => {
    const id = target.id.slice(BED_PREFIX.length)
    resting = { id, x: target.x, y: target.y }
    snore = scene.add.text(target.x, target.y - target.height / 2 - 18, 'Zz', { fontFamily: 'monospace', fontSize: '16px', color: '#cfe3ff' }).setOrigin(0.5).setDepth(1001)
    scene.tweens.add({ targets: snore, y: snore.y - 10, alpha: 0.4, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    const every = ruleValue('REST_EVERY_SEC'), hp = ruleValue('REST_HP'), fatigue = ruleValue('REST_FATIGUE')
    banner.show(`침대에 누웠어요 · ${every}초마다 HP +${hp} · 기력 +${fatigue} · E로 일어나기`, '#cfe3ff', 3200)
    void restOnce()
  }

  /* 배치 중이면 반투명 가구를 캐릭터 위로 옮기고 놓을 수 있는지 색으로 보여 준다. 누워 있다가 멀어지면 일어난다. */
  const follow = () => {
    const player = ctx.options.player?.()
    if (resting && player && Math.hypot(player.x - resting.x, player.y - resting.y) > REST_LEAVE) wake('침대에서 일어났어요')
    const at = spot()
    if (!ghost || !placing || !at || !view) return
    ghost.setPosition(at.x, at.y).setTint(canPlace(view, placing, at.x, at.y) ? 0x86efac : 0xf87171)
  }

  const onPlace = () => { const id = takePlacement(); if (id) void startPlacing(id) }
  const onChanged = () => { if (!busy) void load() }
  const onEscape = () => { if (placing) cancel('배치를 취소했어요. 가구는 보관함에 그대로 있어요.') }

  scene.events.on(Phaser.Scenes.Events.UPDATE, follow)
  window.addEventListener(DORM_PLACE_EVENT, onPlace)
  window.addEventListener(DORM_CHANGED_EVENT, onChanged)
  scene.input.keyboard?.on('keydown-ESC', onEscape)
  void load().then(onPlace)

  /* 서버 요청 하나(배치·보관)를 실행하고 다시 그린다. */
  const run = async (action: () => Promise<DormView>, done: string) => {
    if (busy) return
    busy = true
    try {
      view = await action()
      if (stopped) return
      render()
      playSfx('click', { volume: 0.6 })
      banner.show(done)
    } catch (cause) {
      playSfx('error', { volume: 0.5 })
      banner.show(cause instanceof Error ? cause.message : '요청에 실패했어요.', '#f87171')
    } finally { busy = false }
  }

  const place = () => {
    const at = spot()
    const id = placing
    if (!at || !id || !view) return
    if (!canPlace(view, id, at.x, at.y)) {
      playSfx('error', { volume: 0.5 })
      banner.show('벽·문 앞·다른 가구와 겹치는 곳에는 놓을 수 없어요', '#f87171')
      return
    }
    cancel()
    void run(() => placeFurniture(id, at.x, at.y), '가구를 놓았어요')
  }

  return {
    /* 배치 중에는 캐릭터 위 놓을 자리 하나만, 아니면 놓인 가구들이 E 대상이다. */
    targets: (): RoomInteraction[] => {
      const at = spot()
      if (placing && at && view) {
        const shape = shapeOf(view.furniture.find(entry => entry.id === placing)?.code ?? '')
        const width = shape?.width ?? 32, height = shape?.height ?? 24
        return [{ id: PLACE_TARGET, kind: 'npc', label: '여기에 놓기', x: at.x, y: at.y - height / 2, width, height, range: PLACE_GAP + 40 }]
      }
      return (view?.furniture ?? []).flatMap(item => {
        const shape = shapeOf(item.code)
        if (!item.placed || !shape || item.x === null || item.y === null) return []
        /* 침대는 눕기, 나머지 가구는 보관하기 */
        const bed = item.code === 'BED'
        return [{ id: (bed ? BED_PREFIX : ITEM_PREFIX) + item.id, kind: 'npc' as const, label: bed ? '침대에서 쉬기' : `${shape.name} 보관하기`, x: item.x, y: item.y - shape.height / 2, width: shape.width, height: shape.height, range: 20 }]
      })
    },
    hint: target => {
      if (target.id === PLACE_TARGET) {
        const at = spot()
        return view && placing && at && canPlace(view, placing, at.x, at.y) ? 'E · 여기에 놓기 · ESC 취소' : '여기에는 놓을 수 없어요 · ESC 취소'
      }
      if (target.id.startsWith(BED_PREFIX)) return resting ? 'E · 일어나기' : 'E · 침대에서 쉬기 (침대 보관은 폰 가구 앱)'
      return target.id.startsWith(ITEM_PREFIX) ? `E · ${target.label}(보관함으로)` : undefined
    },
    intercept: target => {
      if (target.id === PLACE_TARGET) { place(); return true }
      if (target.id.startsWith(BED_PREFIX)) { if (resting) wake('침대에서 일어났어요'); else lieDown(target); return true }
      if (!target.id.startsWith(ITEM_PREFIX)) return false
      const id = target.id.slice(ITEM_PREFIX.length)
      void run(() => storeFurniture(id), '보관함에 넣었어요')
      return true
    },
    destroy: () => {
      stopped = true
      wake()
      cancel()
      for (const item of drawn) for (const part of item.parts) part.destroy()
      scene.events.off(Phaser.Scenes.Events.UPDATE, follow)
      window.removeEventListener(DORM_PLACE_EVENT, onPlace)
      window.removeEventListener(DORM_CHANGED_EVENT, onChanged)
      scene.input.keyboard?.off('keydown-ESC', onEscape)
    },
  }
}
