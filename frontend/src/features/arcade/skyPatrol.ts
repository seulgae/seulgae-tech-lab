import { SCREEN, banner, clampDt } from './retroGame.ts'
import type { Phase, RetroEvent, RetroGame } from './retroGame.ts'

/**
 * 하늘 순찰대: 아래쪽 내 비행기를 상하좌우로 움직이며 자동으로 쏘는 총알로 위에서 내려오는 적기를 떨어뜨린다.
 * 적기에 부딪히거나 적 총알에 맞으면 목숨이 하나 줄고, 셋 다 잃으면 끝. 시간이 지날수록 적이 많아진다.
 *
 * @author 길태형
 * @version 1.0, 오락실 게임 고르기
 * @see "None"
 */
export const PLANE = { width: 16, height: 14, speed: 140 }
export const ENEMY = { width: 16, height: 12 }
const SHOT_EVERY = 0.18, BULLET_SPEED = 260, ENEMY_SHOT_SPEED = 110, INVINCIBLE = 1.5

export type Thing = { x: number; y: number; vx: number; vy: number }
export type SkyPatrol = {
  phase: Phase; score: number; lives: number; time: number
  plane: { x: number; y: number }; bullets: Thing[]; enemies: (Thing & { hp: number; fire: number })[]; shots: Thing[]
  reload: number; spawn: number; invincible: number
}

/** 경과 시간에 따라 짧아지는 적기 등장 간격(초) */
export const spawnSeconds = (time: number) => Math.max(0.35, 1.2 - time * 0.012)

/**
 * 두 사각형(가운데 기준)이 겹치는지.
 *
 * @returns 겹치면 true
 */
export const overlap = (a: { x: number; y: number }, aw: number, ah: number, b: { x: number; y: number }, bw: number, bh: number) =>
  Math.abs(a.x - b.x) * 2 < aw + bw && Math.abs(a.y - b.y) * 2 < ah + bh

export const skyPatrol: RetroGame<SkyPatrol> = {
  id: 'sky', name: '하늘 순찰대', highKey: 'seulgae.arcade.sky',
  help: '방향키(또는 마우스·터치)로 움직이면 총알은 저절로 나가요. 적기와 적 총알을 피해요.',
  create: () => ({
    phase: 'ready', score: 0, lives: 3, time: 0, plane: { x: SCREEN.width / 2, y: 210 }, bullets: [], enemies: [], shots: [], reload: 0, spawn: 1, invincible: 0,
  }),
  stat: state => `LIFE ${'♥'.repeat(Math.max(0, state.lives))}`,
  step(state, seconds, input, random) {
    const events: RetroEvent[] = []
    if (state.phase !== 'playing') {
      if (!input.pressed.action) return { state, events }
      return { state: { ...skyPatrol.create(random), phase: 'playing' }, events }
    }
    const dt = clampDt(seconds)
    const s: SkyPatrol = { ...state, time: state.time + dt, invincible: Math.max(0, state.invincible - dt) }
    /* 내 비행기 */
    const dx = (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0), dy = (input.held.down ? 1 : 0) - (input.held.up ? 1 : 0)
    s.plane = {
      x: Math.min(SCREEN.width - PLANE.width / 2, Math.max(PLANE.width / 2, state.plane.x + dx * PLANE.speed * dt)),
      y: Math.min(SCREEN.height - PLANE.height / 2, Math.max(120, state.plane.y + dy * PLANE.speed * dt)),
    }
    /* 자동 사격 */
    s.reload = state.reload - dt
    let bullets = state.bullets.map(b => ({ ...b, y: b.y + b.vy * dt })).filter(b => b.y > -6)
    if (s.reload <= 0) { bullets = [...bullets, { x: s.plane.x - 4, y: s.plane.y - 8, vx: 0, vy: -BULLET_SPEED }, { x: s.plane.x + 4, y: s.plane.y - 8, vx: 0, vy: -BULLET_SPEED }]; s.reload = SHOT_EVERY }
    /* 적기 등장·이동·사격 */
    s.spawn = state.spawn - dt
    let enemies = state.enemies.map(e => ({ ...e, x: e.x + e.vx * dt, y: e.y + e.vy * dt, fire: e.fire - dt }))
    if (s.spawn <= 0) {
      enemies.push({ x: 12 + random() * (SCREEN.width - 24), y: -8, vx: (random() - 0.5) * 40, vy: 40 + random() * 40 + s.time * 0.6, hp: random() < 0.2 ? 3 : 1, fire: 0.8 + random() * 1.5 })
      s.spawn = spawnSeconds(s.time)
    }
    let shots = state.shots.map(b => ({ ...b, x: b.x + b.vx * dt, y: b.y + b.vy * dt })).filter(b => b.y < SCREEN.height + 6 && b.x > -6 && b.x < SCREEN.width + 6)
    for (const enemy of enemies) if (enemy.fire <= 0 && enemy.y > 0 && enemy.y < 150) {
      const ax = s.plane.x - enemy.x, ay = s.plane.y - enemy.y, length = Math.hypot(ax, ay) || 1
      shots.push({ x: enemy.x, y: enemy.y + 6, vx: ax / length * ENEMY_SHOT_SPEED, vy: ay / length * ENEMY_SHOT_SPEED })
      enemy.fire = 1.6 + random() * 1.4
    }
    /* 내 총알 ↔ 적기 */
    for (const bullet of bullets) for (const enemy of enemies) {
      if (enemy.hp > 0 && bullet.y > -10 && overlap(bullet, 2, 6, enemy, ENEMY.width, ENEMY.height)) {
        enemy.hp -= 1; bullet.y = -100
        if (enemy.hp <= 0) { s.score += 50; events.push('score') }
      }
    }
    bullets = bullets.filter(b => b.y > -10)
    enemies = enemies.filter(e => e.hp > 0 && e.y < SCREEN.height + 12)
    /* 적기·적 총알 ↔ 내 비행기(맞은 뒤 잠깐은 무적) */
    if (s.invincible <= 0) {
      const rammed = enemies.find(e => overlap(e, ENEMY.width, ENEMY.height, s.plane, PLANE.width - 4, PLANE.height - 4))
      const shot = shots.find(b => overlap(b, 3, 3, s.plane, PLANE.width - 6, PLANE.height - 6))
      if (rammed || shot) {
        if (rammed) rammed.hp = 0
        if (shot) shots = shots.filter(b => b !== shot)
        enemies = enemies.filter(e => e.hp > 0)
        s.lives = state.lives - 1; s.invincible = INVINCIBLE; events.push('hit')
        if (s.lives <= 0) { events.push('over'); return { state: { ...s, bullets, enemies, shots, phase: 'over' }, events } }
      }
    }
    s.score += Math.floor(s.time) > Math.floor(state.time) ? 1 : 0
    return { state: { ...s, bullets, enemies, shots }, events }
  },
  draw(context, state, scale) {
    context.fillStyle = '#0a1a33'; context.fillRect(0, 0, SCREEN.width * scale, SCREEN.height * scale)
    /* 흘러가는 구름 점 */
    context.fillStyle = 'rgba(255,255,255,.18)'
    for (let i = 0; i < 18; i++) { const y = (i * 37 + state.time * 30) % SCREEN.height; context.fillRect(((i * 71) % SCREEN.width) * scale, y * scale, 10 * scale, 2 * scale) }
    const rect = (x: number, y: number, w: number, h: number, color: string) => { context.fillStyle = color; context.fillRect((x - w / 2) * scale, (y - h / 2) * scale, w * scale, h * scale) }
    for (const enemy of state.enemies) {
      rect(enemy.x, enemy.y, ENEMY.width, 4, enemy.hp > 1 ? '#a78bfa' : '#9ca3af'); rect(enemy.x, enemy.y + 1, 4, ENEMY.height, enemy.hp > 1 ? '#7c3aed' : '#6b7280'); rect(enemy.x, enemy.y + 5, 8, 2, '#ef4444')
    }
    for (const bullet of state.bullets) rect(bullet.x, bullet.y, 2, 6, '#ffd23f')
    for (const shot of state.shots) rect(shot.x, shot.y, 3, 3, '#ff4d8d')
    if (state.invincible <= 0 || Math.floor(state.time * 10) % 2 === 0) {
      const p = state.plane
      rect(p.x, p.y + 1, PLANE.width, 4, '#38bdf8'); rect(p.x, p.y, 4, PLANE.height, '#e0f2fe'); rect(p.x, p.y + 6, 8, 2, '#38bdf8'); rect(p.x, p.y - 5, 2, 3, '#0ea5e9')
    }
    if (state.phase === 'ready') banner(context, scale, 'SPACE / 탭 으로 출격')
    if (state.phase === 'over') banner(context, scale, 'GAME OVER · 다시 하기')
  },
}
