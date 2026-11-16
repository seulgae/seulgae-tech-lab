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
import { ROOMS, roomObstacles } from '../maps/rooms'
import type { RoomId } from '../maps/rooms'
import { setRoomObstacles } from '../multiplayer/networkPosition'

/**
 * 로비의 표시·충돌·컴퓨터 상호작용을 연결하는 게임 장면이다.
 *
 * @author seulgae
 * @version 1.0, 서버 승인 방 전환·출입구 우선 처리와 리스너 정리
 * @see "None"
 */
export default class LabLobbyScene extends Phaser.Scene {
  private player?: Player
  private activeRoom: RoomId = 'lobby'
  private transition = false
  private roomSubscription?: () => void
  private restartPending = false
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
    this.player.update(!this.researchOpen && !this.transition && !hasTextInputFocus(), input)
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
    this.activeRoom = this.client.currentRoom()
    this.restartPending = false
    this.transition = this.client.isTravelling()
    setRoomObstacles(roomObstacles(this.activeRoom))
    this.cameras.main.fadeIn(180)
    this.touchInput = { x: 0, y: 0 }
    this.touchInteraction = false
    this.cameras.main.setBackgroundColor('#263238')
    const { obstacles, computerHighlight } = createLobbyMap(this, this.activeRoom)
    this.computerHighlight = computerHighlight
    this.player = new Player(this, SPAWN.x, SPAWN.y)
    this.physics.add.collider(this.player, obstacles)
    this.multiplayer = new LobbyMultiplayer(this, this.player, this.client)
    this.roomSubscription = this.client.subscribe({ room: (roomId, pending) => {
      this.transition = pending || roomId !== this.activeRoom
      if (this.transition) this.resetChatInput()
      if (roomId !== this.activeRoom && !this.restartPending) {
        this.restartPending = true
        this.cameras.main.fadeOut(150)
        this.time.delayedCall(160, () => this.scene.restart())
      }
    } })
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
      this.roomSubscription?.()
      this.roomSubscription = undefined
      this.multiplayer?.stopInput()
      this.stopMultiplayer()
      this.player = undefined
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
    this.player.update(!this.researchOpen && !this.transition && !textFocused, this.touchInput)
    this.multiplayer?.update(delta)
    const door = ROOMS[this.activeRoom].doors.find(d => Math.hypot(this.player!.x - d.x, this.player!.y - d.y) <= 56)
    const nearby = this.activeRoom === 'lobby' && isNearObject(this.player.x, this.player.y, COMPUTER, 56)
    const enabled = !this.researchOpen && !this.transition && !textFocused
    this.interactionHint?.setPosition(door ? door.x : COMPUTER.x, door ? door.y - 70 : COMPUTER.y - 102)
      .setText(door ? 'E · ' + ROOMS[door.target as RoomId].name + ' 입장' : 'E · 연구 기록').setVisible(enabled && (!!door || nearby))
    this.computerHighlight?.setVisible(nearby && enabled)

    // 범위 밖과 패널 표시 중에도 소비해, 누르고 있던 E가 나중에 실행되지 않게 한다.
    const pressed = this.interactKey && Phaser.Input.Keyboard.JustDown(this.interactKey)
    const touchPressed = this.touchInteraction
    this.touchInteraction = false
    if ((pressed || touchPressed) && door && enabled) {
      this.resetChatInput()
      this.client.changeRoom(door.id)
      return
    }
    if ((pressed || touchPressed) && nearby && enabled) {
      this.researchOpen = true
      this.resetChatInput()
      this.interactionHint?.setVisible(false)
      this.computerHighlight?.setVisible(false)
      this.uiEvents.emit(RESEARCH_EVENTS.openResearch)
    }
  }
}
