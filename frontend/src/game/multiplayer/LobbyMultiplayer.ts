import Phaser from 'phaser'
import MultiplayerClient from '../../features/multiplayer/MultiplayerClient'
import type { PlayerState, ChatMessage } from '../../features/multiplayer/model/protocol'
import type Player from '../Player'
import RemotePlayer from './RemotePlayer'
import ChatBubble from './ChatBubble'
import LocalReconciliation from './LocalReconciliation'
import MovementDiagnostics from './MovementDiagnostics'

/**
 * 공유 소켓을 장면에서 구독하고 본인 예측 위치와 채팅 말풍선을 연결한다.
 *
 * @author seulgae
 * @version 1.0, 서버 스냅샷·로컬 예측·원격 캐릭터 및 채팅 구독
 * @see "None"
 */
export default class LobbyMultiplayer {
  private readonly client: MultiplayerClient
  private readonly remotes = new Map<string, RemotePlayer>()
  private readonly ownLabel: Phaser.GameObjects.Text
  private readonly bubbles = new Map<string, ChatBubble>()
  private readonly unsubscribe: () => void
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
    for (const [id, bubble] of this.bubbles) {
      const actor = id === this.selfId ? this.player : this.remotes.get(id)
      if (!actor || !bubble.update(actor.x, actor.y)) { bubble.destroy(); this.bubbles.delete(id) }
    }
    this.diagnostics.frame(this.player.x, this.player.y, this.player.getInput(), this.frameDelta, this.reconciliation.lastError)
  }

  constructor(scene: Phaser.Scene, player: Player, client: MultiplayerClient) {
    this.scene = scene; this.player = player
    this.client = client
    this.ownLabel = scene.add.text(player.x, player.y - 55, '나 · 로컬 연구원', {
      fontFamily: 'Arial, sans-serif', fontSize: '16px', color: '#fff0bd', backgroundColor: '#20383a', padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setResolution(2)
    this.unsubscribe = client.subscribe({
      inputSent: sequence => {
        this.reconciliation.record(sequence, { x: this.player.x, y: this.player.y })
        this.diagnostics.sent()
      },
      snapshot: (players, selfId) => this.applySnapshot(players, selfId),
      chat: message => this.showChat(message),
      status: info => {
        this.ownLabel.setText(info.phase === 'online' ? `나 · ${info.nickname}` : '나 · 로컬 연구원')
      },
    })
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.afterPhysics)
  }

  private applySnapshot(players: PlayerState[], selfId: string | null) {
    this.diagnostics.received()
    if (this.selfId !== selfId) {
      for (const bubble of this.bubbles.values()) bubble.destroy()
      this.bubbles.clear()
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
      if (!otherIds.has(id)) {
        remote.destroy(); this.remotes.delete(id)
        this.bubbles.get(id)?.destroy(); this.bubbles.delete(id)
      }
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
    this.reconciliation.reset()
    this.unsubscribe()
    for (const remote of this.remotes.values()) remote.destroy()
    this.remotes.clear(); this.ownLabel.destroy()
    for (const bubble of this.bubbles.values()) bubble.destroy()
    this.bubbles.clear()
  }
}
