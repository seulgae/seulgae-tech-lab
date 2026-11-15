import Phaser from 'phaser'
import MultiplayerClient from '../../features/multiplayer/MultiplayerClient'
import { MULTIPLAYER_EVENTS, GREET_RANGE } from '../../features/multiplayer/model/protocol'
import type { PlayerState, Greeting } from '../../features/multiplayer/model/protocol'
import type Player from '../Player'
import RemotePlayer from './RemotePlayer'
import GreetingBubble from './GreetingBubble'
import { nearestPlayer } from '../interaction'
import LocalReconciliation from './LocalReconciliation'
import MovementDiagnostics from './MovementDiagnostics'

/**
 * 게임 장면과 소켓의 수명을 묶고 본인 예측 위치를 서버 상태로 보정한다.
 *
 * @author seulgae
 * @version 1.0, 서버 스냅샷과 로컬 예측·원격 캐릭터 연결
 * @see "None"
 */
export default class LobbyMultiplayer {
  private readonly client: MultiplayerClient
  private readonly remotes = new Map<string, RemotePlayer>()
  private readonly ownLabel: Phaser.GameObjects.Text
  private players: PlayerState[] = []
  private readonly bubbles = new Map<string, GreetingBubble>()
  private readonly greetedEvents = new Set<string>()
  private selfId: string | null = null
  private readonly player: Player
  private readonly scene: Phaser.Scene
  private readonly reconciliation = new LocalReconciliation()
  private frameDelta = 16.67
  private readonly diagnostics = new MovementDiagnostics()
  private readonly afterPhysics = () => {
    const hard = this.reconciliation.takeHardPosition()
    if (hard) {
      const actual = this.player.correctPosition(hard.x, hard.y, true)
      this.diagnostics.corrected(Math.hypot(actual.x, actual.y), true)
    }
    else {
      const requested = this.reconciliation.step(this.frameDelta)
      if (requested.x || requested.y) {
        const actual = this.player.correctPosition(this.player.x + requested.x, this.player.y + requested.y)
        this.reconciliation.applied(actual, requested)
        this.diagnostics.corrected(Math.hypot(actual.x, actual.y))
      }
    }
    this.ownLabel.setPosition(this.player.x, this.player.y - 55)
    this.diagnostics.frame(this.player.x, this.player.y, this.player.getInput(), this.frameDelta, this.reconciliation.lastError)
  }

  constructor(scene: Phaser.Scene, player: Player, events: Phaser.Events.EventEmitter) {
    this.scene = scene; this.player = player
    this.ownLabel = scene.add.text(player.x, player.y - 55, '나 · 로컬 연구원', {
      fontFamily: 'Arial, sans-serif', fontSize: '16px', color: '#fff0bd', backgroundColor: '#20383a', padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setResolution(2)
    this.client = new MultiplayerClient({
      inputSent: sequence => {
        this.reconciliation.record(sequence, { x: this.player.x, y: this.player.y })
        this.diagnostics.sent()
      },
      snapshot: (players, selfId) => this.applySnapshot(players, selfId),
      greeted: event => this.showGreeting(event),
      status: info => {
        this.ownLabel.setText(info.phase === 'online' ? `나 · ${info.nickname}` : '나 · 로컬 연구원')
        events.emit(MULTIPLAYER_EVENTS.status, info)
      },
    })
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.afterPhysics)
    this.client.start()
  }

  private applySnapshot(players: PlayerState[], selfId: string | null) {
    this.diagnostics.received()
    this.players = players
    if (this.selfId !== selfId) {
      for (const bubble of this.bubbles.values()) bubble.destroy()
      this.bubbles.clear(); this.greetedEvents.clear()
    }
    const own = players.find(player => player.id === selfId)
    if (own) {
      // 수신 콜백에서는 Body를 변경하지 않는다. ack 기준 오차만 기록한다.
      if (this.selfId !== selfId) this.reconciliation.reset(own)
      else this.reconciliation.receive(own, this.player, Date.now())
    }
    else if (!selfId) this.reconciliation.reset()
    this.selfId = selfId
    const otherIds = new Set(players.filter(player => player.id !== selfId).map(player => player.id))
    for (const [id, remote] of this.remotes) {
      if (!otherIds.has(id)) { remote.destroy(); this.remotes.delete(id) }
    }
    for (const state of players) {
      if (state.id === selfId) continue
      const remote = this.remotes.get(state.id)
      if (remote) remote.setTarget(state)
      else this.remotes.set(state.id, new RemotePlayer(this.scene, state))
    }
  }

  update(delta: number) {
    this.frameDelta = delta
    this.client.setInput(this.player.getInput())
    for (const remote of this.remotes.values()) remote.update(delta)
    this.ownLabel.setPosition(this.player.x, this.player.y - 55).setDepth(900)
    for (const [id, bubble] of this.bubbles) {
      const actor = id === this.selfId ? this.player : this.remotes.get(id)
      if (!actor || !bubble.update(actor.x, actor.y)) { bubble.destroy(); this.bubbles.delete(id) }
    }
  }

  nearestGreetingTarget() { return this.client.canGreet() ? nearestPlayer(this.player.x, this.player.y, this.players, this.selfId, GREET_RANGE) : null }

  greet(targetId: string) { this.client.greet(targetId) }

  private showGreeting(event: Greeting) {
    if (this.greetedEvents.has(event.eventId) || !this.players.some(player => player.id === event.playerId)) return
    this.greetedEvents.add(event.eventId)
    if (this.greetedEvents.size > 128) this.greetedEvents.delete(this.greetedEvents.values().next().value!)
    this.bubbles.get(event.playerId)?.destroy()
    const bubble = new GreetingBubble(this.scene, event.message, event.durationMs)
    this.bubbles.set(event.playerId, bubble)
    const actor = event.playerId === this.selfId ? this.player : this.remotes.get(event.playerId)
    if (actor) bubble.update(actor.x, actor.y)
  }

  stopInput() { this.client.setInput({ x: 0, y: 0 }) }

  destroy() {
    this.scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.afterPhysics)
    this.reconciliation.reset()
    this.client.destroy()
    for (const remote of this.remotes.values()) remote.destroy()
    this.remotes.clear(); this.ownLabel.destroy()
    for (const bubble of this.bubbles.values()) bubble.destroy()
    this.bubbles.clear(); this.greetedEvents.clear()
  }
}
