import Phaser from 'phaser'
import MultiplayerClient from '../../features/multiplayer/MultiplayerClient'
import { MULTIPLAYER_EVENTS } from '../../features/multiplayer/model/protocol'
import type { PlayerState } from '../../features/multiplayer/model/protocol'
import type Player from '../Player'
import RemotePlayer from './RemotePlayer'

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
  private selfId: string | null = null
  private readonly player: Player
  private readonly scene: Phaser.Scene

  constructor(scene: Phaser.Scene, player: Player, events: Phaser.Events.EventEmitter) {
    this.scene = scene; this.player = player
    this.ownLabel = scene.add.text(player.x, player.y - 55, '나 · 로컬 연구원', {
      fontFamily: 'Arial, sans-serif', fontSize: '16px', color: '#fff0bd', backgroundColor: '#20383a', padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setResolution(2)
    this.client = new MultiplayerClient({
      snapshot: (players, selfId) => this.applySnapshot(players, selfId),
      status: info => {
        this.ownLabel.setText(info.phase === 'online' ? `나 · ${info.nickname}` : '나 · 로컬 연구원')
        events.emit(MULTIPLAYER_EVENTS.status, info)
      },
    })
    this.client.start()
  }

  private applySnapshot(players: PlayerState[], selfId: string | null) {
    const own = players.find(player => player.id === selfId)
    if (own) {
      // 짧은 지연은 기존 Arcade 예측을 유지하고, 큰 오차와 재접속은 서버 위치로 보정한다.
      if (this.selfId !== selfId || Math.hypot(this.player.x - own.x, this.player.y - own.y) > 24) this.player.body.reset(own.x, own.y)
    }
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
    this.client.setInput(this.player.getInput())
    for (const remote of this.remotes.values()) remote.update(delta)
    this.ownLabel.setPosition(this.player.x, this.player.y - 55).setDepth(900)
  }

  stopInput() { this.client.setInput({ x: 0, y: 0 }) }

  destroy() {
    this.client.destroy()
    for (const remote of this.remotes.values()) remote.destroy()
    this.remotes.clear(); this.ownLabel.destroy()
  }
}
