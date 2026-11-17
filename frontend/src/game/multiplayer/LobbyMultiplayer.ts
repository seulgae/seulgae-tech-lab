import Phaser from 'phaser'
import MultiplayerClient from '../../features/multiplayer/MultiplayerClient'
import type { PlayerState, ChatMessage } from '../../features/multiplayer/model/protocol'
import type Player from '../Player'
import RemotePlayer from './RemotePlayer'
import ChatBubble from './ChatBubble'
import LocalReconciliation from './LocalReconciliation'
import MovementDiagnostics from './MovementDiagnostics'
import AcknowledgedMovement from './AcknowledgedMovement'
import { crispText } from '../render/renderScale.ts'
import { playSpatialSfx } from '../../audio/AudioManager.ts'
import { FootstepTracker, footstepSound } from '../../audio/soundRules.ts'

/**
 * 공유 소켓을 장면에서 구독하고 본인 예측 위치와 채팅 말풍선을 연결한다.
 *
 * @author seulgae
 * @version 1.0, 완료 물리 스텝 재생·로컬 예측·원격 캐릭터 및 채팅 구독
 * @see "None"
 */
export default class LobbyMultiplayer {
  private readonly client: MultiplayerClient
  private readonly remotes = new Map<string, RemotePlayer>()
  /** 같은 방 다른 연구원의 발걸음(화면에 그려진 보간 위치 기준, 거리 감쇠) */
  private readonly remoteSteps = new Map<string, FootstepTracker>()
  private readonly ownLabel: Phaser.GameObjects.Text
  private readonly bubbles = new Map<string, ChatBubble>()
  private readonly unsubscribe: () => void
  private selfId: string | null = null
  private readonly player: Player
  private readonly scene: Phaser.Scene
  private readonly world: Phaser.Physics.Arcade.World
  private readonly reconciliation = new LocalReconciliation()
  private readonly acknowledged = new AcknowledgedMovement()
  /** Arcade가 실제로 완료한 스텝의 시간만 서버와 공유한다. 렌더 프레임 delta를 대입하지 않는다. */
  private readonly physicsStep = (seconds: number) => {
    this.client.recordStep(this.player.getInput(), seconds * 1000)
  }
  private frameDelta = 16.67
  private readonly diagnostics = new MovementDiagnostics()
  private readonly afterPhysics = () => {
    if (this.client.usesCommands()) {
      const target = this.acknowledged.reconcile(this.player)
      if (target) {
        const actual = this.player.correctPosition(target.x, target.y, true)
        this.diagnostics.corrected(Math.hypot(actual.x, actual.y), Math.hypot(actual.x, actual.y) > 128)
      }
    } else {
      const hard = this.reconciliation.takeHardPosition()
      if (hard) {
        const actual = this.player.correctPosition(hard.x, hard.y, true)
        this.diagnostics.corrected(Math.hypot(actual.x, actual.y), true)
      } else {
        const requested = this.reconciliation.step(this.frameDelta)
        if (requested.x || requested.y) {
          const actual = this.player.correctPosition(this.player.x + requested.x, this.player.y + requested.y)
          this.reconciliation.applied(actual, requested)
          this.diagnostics.corrected(Math.hypot(actual.x, actual.y))
        }
      }
    }
    const anchor = this.player.labelAnchor()
    this.ownLabel.setPosition(anchor.x, anchor.y)
    for (const [id, bubble] of this.bubbles) {
      const actor = id === this.selfId ? this.player : this.remotes.get(id)
      if (!actor || !bubble.update(actor.x, actor.y)) { bubble.destroy(); this.bubbles.delete(id) }
    }
    this.diagnostics.frame(this.player.x, this.player.y, this.player.getInput(), this.frameDelta,
      this.client.usesCommands() ? this.acknowledged.lastError : this.reconciliation.lastError)
  }

  constructor(scene: Phaser.Scene, player: Player, client: MultiplayerClient) {
    this.scene = scene; this.player = player
    this.world = scene.physics.world
    this.client = client
    this.ownLabel = crispText(scene, player.x, player.y - 55, '나 · 로컬 연구원', {
      fontSize: '15px', fontStyle: 'bold', color: '#fff0bd', backgroundColor: '#14202acc', padding: { x: 5, y: 2 },
    }).setOrigin(0.5)
    this.unsubscribe = client.subscribe({
      inputSent: sequence => {
        if (!client.usesCommands()) this.reconciliation.record(sequence, { x: this.player.x, y: this.player.y })
        this.diagnostics.sent()
      },
      predicted: command => { if (!this.acknowledged.record(command)) client.restartMovement() },
      snapshot: (players, selfId, serverTime) => this.applySnapshot(players, selfId, serverTime),
      chat: message => this.showChat(message),
      status: info => {
        this.ownLabel.setText(info.phase === 'online' ? `나 · ${info.nickname}` : '나 · 로컬 연구원')
      },
    })
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.afterPhysics)
    this.world.on(Phaser.Physics.Arcade.Events.WORLD_STEP, this.physicsStep)
  }

  private applySnapshot(players: PlayerState[], selfId: string | null, serverTime?: number) {
    this.diagnostics.received()
    if (this.selfId !== selfId) {
      for (const bubble of this.bubbles.values()) bubble.destroy()
      this.bubbles.clear()
    }
    const own = players.find(player => player.id === selfId)
    if (own) {
      // 수신 콜백에서는 Body를 변경하지 않는다. ack 기준 오차만 기록한다.
      if (this.client.usesCommands()) {
        if (this.selfId !== selfId) this.acknowledged.reset(own)
        else this.acknowledged.receive(own)
      } else if (this.selfId !== selfId) this.reconciliation.reset(own)
      else this.reconciliation.receive(own, this.player, Date.now(), this.player.getInput())
    }
    else if (!selfId) { this.reconciliation.reset(); this.acknowledged.reset() }
    this.selfId = selfId
    const otherIds = new Set(players.filter(player => player.id !== selfId).map(player => player.id))
    for (const [id, remote] of this.remotes) {
      if (!otherIds.has(id)) {
        remote.destroy(); this.remotes.delete(id); this.remoteSteps.delete(id)
        this.bubbles.get(id)?.destroy(); this.bubbles.delete(id)
      }
    }
    for (const state of players) {
      if (state.id === selfId) continue
      const remote = this.remotes.get(state.id)
      if (remote) remote.setTarget(state, serverTime)
      else this.remotes.set(state.id, new RemotePlayer(this.scene, state, serverTime))
    }
  }

  update(delta: number) {
    this.frameDelta = delta
    this.client.setInput(this.player.getInput())
    for (const [id, remote] of this.remotes) {
      remote.update(delta)
      let steps = this.remoteSteps.get(id)
      if (!steps) { steps = new FootstepTracker(); this.remoteSteps.set(id, steps) }
      // 스냅샷이 반복 와도 실제로 그려진 위치가 움직일 때만 소리가 난다.
      if (steps.update(remote.x, remote.y)) {
        playSpatialSfx(footstepSound(this.client.currentRoom(), remote.x, remote.y), remote, this.player, { volume: 0.7, rate: 0.9 + Math.random() * 0.2 })
      }
    }
    const label = this.player.labelAnchor()
    this.ownLabel.setPosition(label.x, label.y).setDepth(900)
  }

  private showChat(message: ChatMessage) {
    const actor = message.playerId === this.selfId ? this.player : this.remotes.get(message.playerId)
    if (!actor) return
    let bubble = this.bubbles.get(message.playerId)
    if (bubble) bubble.setMessage(message.message)
    else { bubble = new ChatBubble(this.scene, message.message); this.bubbles.set(message.playerId, bubble) }
    bubble.update(actor.x, actor.y)
  }

  stopInput() { this.client.setInput({ x: 0, y: 0 }) }

  destroy() {
    this.scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.afterPhysics)
    // Scene shutdown에서는 Physics 플러그인이 먼저 world 참조를 비울 수 있다.
    this.world.off(Phaser.Physics.Arcade.Events.WORLD_STEP, this.physicsStep)
    this.reconciliation.reset()
    this.acknowledged.reset()
    this.unsubscribe()
    for (const remote of this.remotes.values()) remote.destroy()
    this.remotes.clear(); this.remoteSteps.clear(); this.ownLabel.destroy()
    for (const bubble of this.bubbles.values()) bubble.destroy()
    this.bubbles.clear()
  }
}
