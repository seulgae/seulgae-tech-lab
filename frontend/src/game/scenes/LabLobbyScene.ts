import Phaser from 'phaser'
import Player from '../Player'
import createLobbyMap, { COMPUTER } from '../LobbyMap'
import { RESEARCH_EVENTS } from '../../features/research/researchEvents'
import { isNearObject, hasTextInputFocus } from '../interaction'
import { createPixelAssets } from '../assets/pixelAssets'
import LobbyMultiplayer from '../multiplayer/LobbyMultiplayer'
import { SPAWN } from '../maps/lobbyLayout'
import { MULTIPLAYER_EVENTS } from '../../features/multiplayer/model/protocol'
import type MultiplayerClient from '../../features/multiplayer/MultiplayerClient'

/**
 * 로비의 표시·충돌·컴퓨터 상호작용을 연결하는 게임 장면이다.
 *
 * @author seulgae
 * @version 1.0, 타일 로비와 픽셀 캐릭터 및 접근 강조 연결
 * @see "None"
 */
export default class LabLobbyScene extends Phaser.Scene {
  private player?: Player
  private interactionHint?: Phaser.GameObjects.Text
  private interactKey?: Phaser.Input.Keyboard.Key
  private researchOpen = false
  private computerHighlight?: Phaser.GameObjects.Rectangle
  private multiplayer?: LobbyMultiplayer
  private readonly uiEvents: Phaser.Events.EventEmitter
  private readonly client: MultiplayerClient
  private readonly resetChatInput = () => {
    this.input.keyboard?.resetKeys()
    this.player?.update(false)
    this.multiplayer?.stopInput()
  }

  private readonly closeResearch = () => {
    this.researchOpen = false
  }
  private readonly stopMultiplayer = () => {
    this.multiplayer?.destroy()
    this.multiplayer = undefined
  }

  constructor(uiEvents: Phaser.Events.EventEmitter, client: MultiplayerClient) {
    super('LabLobbyScene')
    this.uiEvents = uiEvents
    this.client = client
  }

  preload() {
    createPixelAssets(this)
  }

  create() {
    this.researchOpen = false
    this.cameras.main.setBackgroundColor('#263238')
    const { obstacles, computerHighlight } = createLobbyMap(this)
    this.computerHighlight = computerHighlight
    this.player = new Player(this, SPAWN.x, SPAWN.y)
    this.physics.add.collider(this.player, obstacles)
    this.multiplayer = new LobbyMultiplayer(this, this.player, this.client)
    this.uiEvents.once(MULTIPLAYER_EVENTS.dispose, this.stopMultiplayer)
    this.interactKey = this.input.keyboard?.addKey('E')
    this.interactionHint = this.add.text(COMPUTER.x, COMPUTER.y - 102, 'E  ·  연구 기록', {
      fontFamily: 'monospace', fontSize: '14px', color: '#fff2d2',
      backgroundColor: '#243f43', padding: { x: 12, y: 8 },
    }).setOrigin(0.5).setResolution(2).setDepth(1000).setVisible(false)

    this.uiEvents.on(RESEARCH_EVENTS.closeResearch, this.closeResearch)
    this.uiEvents.on('chat:focus', this.resetChatInput)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.stopMultiplayer()
      this.uiEvents.off(MULTIPLAYER_EVENTS.dispose, this.stopMultiplayer)
      this.uiEvents.off(RESEARCH_EVENTS.closeResearch, this.closeResearch)
      this.uiEvents.off('chat:focus', this.resetChatInput)
    })
  }

  update(_time = 0, delta = 16.67) {
    if (!this.player) return

    const textFocused = hasTextInputFocus()
    this.player.update(!this.researchOpen && !textFocused)
    this.multiplayer?.update(delta)
    const nearby = isNearObject(this.player.x, this.player.y, COMPUTER, 56)
    const enabled = !this.researchOpen && !textFocused
    this.interactionHint?.setVisible(enabled && nearby)
    this.computerHighlight?.setVisible(nearby && enabled)

    // 범위 밖과 패널 표시 중에도 소비해, 누르고 있던 E가 나중에 실행되지 않게 한다.
    const pressed = this.interactKey && Phaser.Input.Keyboard.JustDown(this.interactKey)
    if (pressed && nearby && enabled) {
      this.researchOpen = true
      this.player.update(false)
      this.multiplayer?.stopInput()
      this.interactionHint?.setVisible(false)
      this.computerHighlight?.setVisible(false)
      this.uiEvents.emit(RESEARCH_EVENTS.openResearch)
    }
  }
}
