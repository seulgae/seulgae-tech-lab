import Phaser from 'phaser'
import Player from '../Player'
import createLobbyMap from '../LobbyMap'
import { RESEARCH_EVENTS } from '../../features/research/researchEvents'
import { LAB_EVENTS } from '../../features/lab/labEvents'
import { hasTextInputFocus } from '../interaction'
import { createPixelAssets } from '../assets/pixelAssets'
import LobbyMultiplayer from '../multiplayer/LobbyMultiplayer'
import { SPAWN } from '../maps/lobbyLayout'
import { MULTIPLAYER_EVENTS } from '../../features/multiplayer/model/protocol'
import type MultiplayerClient from '../../features/multiplayer/MultiplayerClient'
import { MOBILE_INPUT } from '../input/mobileInput'
import type { DirectionInput } from '../input/mobileInput'
import { ROOMS, nearestInteraction, roomObstacles } from '../maps/rooms'
import type { RoomId, RoomInteraction } from '../maps/rooms'
import { setRoomObstacles } from '../multiplayer/networkPosition'

/**
 * 방의 표시·충돌·출입구와 방별 상호작용(연구 기록·빌드 정보·서버 상태·테이블 대화)을 연결하는 게임 장면이다.
 *
 * @author seulgae
 * @version 1.1, 공유 맵 기반 방별 상호작용과 테이블 대화 범위 관리
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
  private panelOpen = false
  private tableTalk = false
  private interactionHighlight?: Phaser.GameObjects.Rectangle
  private multiplayer?: LobbyMultiplayer
  private readonly uiEvents: Phaser.Events.EventEmitter
  private readonly client: MultiplayerClient
  private touchInput: DirectionInput = { x: 0, y: 0 }
  private touchInteraction = false
  /** 터치도 기존 플레이어·소켓 입력 경로를 사용하며 놓는 순간 정지를 전달한다. */
  private readonly moveTouch = (input: DirectionInput) => {
    this.touchInput = input
    if (!this.player) return
    this.player.update(!this.panelOpen && !this.transition && !hasTextInputFocus(), input)
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

  private readonly closePanel = () => {
    this.panelOpen = false
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
    this.panelOpen = false
    this.tableTalk = false
    this.uiEvents.emit(LAB_EVENTS.tableTalk, false)
    this.activeRoom = this.client.currentRoom()
    this.restartPending = false
    this.transition = this.client.isTravelling()
    setRoomObstacles(roomObstacles(this.activeRoom))
    this.cameras.main.fadeIn(180)
    this.touchInput = { x: 0, y: 0 }
    this.touchInteraction = false
    this.cameras.main.setBackgroundColor('#263238')
    const { obstacles, interactionHighlight } = createLobbyMap(this, this.activeRoom)
    this.interactionHighlight = interactionHighlight
    this.player = new Player(this, SPAWN.x, SPAWN.y)
    this.physics.add.collider(this.player, obstacles)
    this.multiplayer = new LobbyMultiplayer(this, this.player, this.client)
    this.roomSubscription = this.client.subscribe({ room: (roomId, pending) => {
      this.transition = pending || roomId !== this.activeRoom
      if (this.transition) { this.resetChatInput(); this.setTableTalk(false) }
      if (roomId !== this.activeRoom && !this.restartPending) {
        this.restartPending = true
        this.cameras.main.fadeOut(150)
        this.time.delayedCall(160, () => this.scene.restart())
      }
    } })
    this.uiEvents.once(MULTIPLAYER_EVENTS.dispose, this.stopMultiplayer)
    this.interactKey = this.input.keyboard?.addKey('E')
    this.interactionHint = this.add.text(0, 0, '', {
      fontFamily: 'monospace', fontSize: '14px', color: '#fff2d2',
      backgroundColor: '#243f43', padding: { x: 12, y: 8 },
    }).setOrigin(0.5).setResolution(2).setDepth(1000).setVisible(false)

    this.uiEvents.on(RESEARCH_EVENTS.closeResearch, this.closePanel)
    this.uiEvents.on(LAB_EVENTS.closePanel, this.closePanel)
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
      this.setTableTalk(false)
      this.uiEvents.off(MULTIPLAYER_EVENTS.dispose, this.stopMultiplayer)
      this.uiEvents.off(RESEARCH_EVENTS.closeResearch, this.closePanel)
      this.uiEvents.off(LAB_EVENTS.closePanel, this.closePanel)
      this.uiEvents.off('chat:focus', this.resetChatInput)
    })
  }

  update(_time = 0, delta = 16.67) {
    if (!this.player) return

    const textFocused = hasTextInputFocus()
    this.player.update(!this.panelOpen && !this.transition && !textFocused, this.touchInput)
    this.multiplayer?.update(delta)
    const door = ROOMS[this.activeRoom].doors.find(d => Math.hypot(this.player!.x - d.x, this.player!.y - d.y) <= 56)
    // 출입구가 우선이며, E 한 번에 한 대상만 실행한다.
    const target = door ? undefined : nearestInteraction(this.activeRoom, this.player.x, this.player.y)
    // 테이블 범위를 벗어나면 서버 거부를 기다리지 않고 근거리 대화를 끈다.
    if (this.tableTalk && target?.kind !== 'table-talk') this.setTableTalk(false)
    const enabled = !this.panelOpen && !this.transition && !textFocused
    if (door) this.interactionHint?.setPosition(door.x, door.y - 70).setText('E · ' + ROOMS[door.target as RoomId].name + ' 입장')
    else if (target) this.interactionHint?.setPosition(target.x, target.y - target.height / 2 - 30).setText(this.hintFor(target))
    this.interactionHint?.setVisible(enabled && (!!door || !!target))
    if (target) this.interactionHighlight?.setPosition(target.x, target.y + 2).setSize(target.width + 14, target.height + 8)
      .setDepth(target.y + target.height / 2 + 1)
    this.interactionHighlight?.setVisible(!!target && enabled)

    // 범위 밖과 패널 표시 중에도 소비해, 누르고 있던 E가 나중에 실행되지 않게 한다.
    const pressed = this.interactKey && Phaser.Input.Keyboard.JustDown(this.interactKey)
    const touchPressed = this.touchInteraction
    this.touchInteraction = false
    if (!(pressed || touchPressed) || !enabled) return
    if (door) {
      this.resetChatInput()
      this.client.changeRoom(door.id)
      return
    }
    if (!target) return
    if (target.kind === 'table-talk') {
      this.setTableTalk(!this.tableTalk)
      return
    }
    this.panelOpen = true
    this.resetChatInput()
    this.interactionHint?.setVisible(false)
    this.interactionHighlight?.setVisible(false)
    if (target.kind === 'research') this.uiEvents.emit(RESEARCH_EVENTS.openResearch)
    else this.uiEvents.emit(LAB_EVENTS.openPanel, target.kind)
  }

  /** 테이블 대화 상태가 바뀔 때만 React 채팅 패널에 알린다. */
  private setTableTalk(active: boolean) {
    if (this.tableTalk === active) return
    this.tableTalk = active
    this.uiEvents.emit(LAB_EVENTS.tableTalk, active)
  }

  private hintFor(target: RoomInteraction) {
    if (target.kind === 'table-talk') return this.tableTalk ? 'E · 테이블 대화 나가기' : 'E · 테이블 대화 참여'
    return 'E · ' + target.label
  }
}
