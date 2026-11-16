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
import { MOBILE_INPUT } from '../input/mobileInput'
import type { DirectionInput } from '../input/mobileInput'

/**
 * 로비의 표시·충돌·컴퓨터 상호작용을 연결하는 게임 장면이다.
 *
 * @author seulgae
 * @version 1.0, 키보드·터치 이동과 컴퓨터 상호작용 및 입력 해제 연결
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
  private touchInput: DirectionInput = { x: 0, y: 0 }
  private touchInteraction = false
  /** 터치도 기존 플레이어·소켓 입력 경로를 사용하며 놓는 순간 정지를 전달한다. */
  private readonly moveTouch = (input: DirectionInput) => {
    this.touchInput = input
    if (!this.player) return
    this.player.update(!this.researchOpen && !hasTextInputFocus(), input)
    this.client.setInput(this.player.getInput())
  }
  private readonly interactTouch = () => { this.touchInteraction = true }
  private readonly resetChatInput = () => {
    this.touchInput = { x: 0, y: 0 }
    this.touchInteraction = false
    this.input.keyboard?.resetKeys()
    this.player?.update(false)
    this.multiplayer?.stopInput()
    this.uiEvents.emit(MOBILE_INPUT.reset)
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
    this.touchInput = { x: 0, y: 0 }
    this.touchInteraction = false
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
    this.uiEvents.on(MOBILE_INPUT.move, this.moveTouch)
    this.uiEvents.on(MOBILE_INPUT.interact, this.interactTouch)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.multiplayer?.stopInput()
      this.stopMultiplayer()
      this.uiEvents.off(MOBILE_INPUT.move, this.moveTouch)
      this.uiEvents.off(MOBILE_INPUT.interact, this.interactTouch)
      this.touchInput = { x: 0, y: 0 }
      this.touchInteraction = false
      this.uiEvents.emit(MOBILE_INPUT.reset)
      this.uiEvents.off(MULTIPLAYER_EVENTS.dispose, this.stopMultiplayer)
      this.uiEvents.off(RESEARCH_EVENTS.closeResearch, this.closeResearch)
      this.uiEvents.off('chat:focus', this.resetChatInput)
    })
  }

  update(_time = 0, delta = 16.67) {
    if (!this.player) return

    const textFocused = hasTextInputFocus()
    this.player.update(!this.researchOpen && !textFocused, this.touchInput)
    this.multiplayer?.update(delta)
    const nearby = isNearObject(this.player.x, this.player.y, COMPUTER, 56)
    const enabled = !this.researchOpen && !textFocused
    this.interactionHint?.setVisible(enabled && nearby)
    this.computerHighlight?.setVisible(nearby && enabled)

    // 범위 밖과 패널 표시 중에도 소비해, 누르고 있던 E가 나중에 실행되지 않게 한다.
    const pressed = this.interactKey && Phaser.Input.Keyboard.JustDown(this.interactKey)
    const touchPressed = this.touchInteraction
    this.touchInteraction = false
    if ((pressed || touchPressed) && nearby && enabled) {
      this.researchOpen = true
      this.resetChatInput()
      this.interactionHint?.setVisible(false)
      this.computerHighlight?.setVisible(false)
      this.uiEvents.emit(RESEARCH_EVENTS.openResearch)
    }
  }
}
