import Phaser from 'phaser'
import Player from '../Player'
import createLobbyMap from '../LobbyMap'
import { RESEARCH_EVENTS } from '../../features/research/researchEvents'
import { LAB_EVENTS } from '../../features/lab/labEvents'
import { hasTextInputFocus } from '../interaction'
import { createPixelAssets } from '../assets/pixelAssets'
import { createRoomAssets } from '../assets/roomAssets'
import { createRoomFx } from '../rooms/RoomFx'
import type { RoomFx } from '../rooms/RoomFx'
import { ROOM_THEMES } from '../rooms/roomThemes'
import { applyRenderZoom, crispText } from '../render/renderScale'
import LobbyMultiplayer from '../multiplayer/LobbyMultiplayer'
import { SPAWN } from '../maps/lobbyLayout'
import { MULTIPLAYER_EVENTS } from '../../features/multiplayer/model/protocol'
import type MultiplayerClient from '../../features/multiplayer/MultiplayerClient'
import { MOBILE_INPUT } from '../input/mobileInput'
import type { DirectionInput } from '../input/mobileInput'
import { ROOMS, doorHint, nearestInteraction, roomObstacles } from '../maps/rooms'
import type { RoomId, RoomInteraction, Seat } from '../maps/rooms'
import { setRoomObstacles } from '../multiplayer/networkPosition'

/**
 * 방의 표시·충돌·출입구와 방별 상호작용(연구 기록·빌드 정보·서버 상태·테이블 대화)을 연결하는 게임 장면이다.
 *
 * @author seulgae
 * @version 1.2, 방별 테마·문 열림 연출·방 이벤트 연결
 * @see "None"
 */
/** 상호작용·출입구 안내 문구가 보이는 시간(ms). 그 뒤에는 테두리 강조만 남는다. */
const HINT_VISIBLE_MS = 2000

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
  /** 회의실 의자에 앉아 자동으로 켠 테이블 대화 */
  private seatTalk = false
  private sitRequestedAt = 0
  private interactionHighlight?: Phaser.GameObjects.Rectangle
  /** 안내 문구는 이름표와 겹치므로 대상이나 문구가 바뀐 순간부터 잠깐만 보여 준다. */
  private hintKey?: string
  private hintShownAt = 0
  private multiplayer?: LobbyMultiplayer
  private fx?: RoomFx
  /** 서버 승인을 기다리며 열어 둔 출입구 */
  private openingDoor?: string
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

  private readonly resizeRender = () => applyRenderZoom(this)
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
    createRoomAssets(this)
  }

  /** @param data 방 전환으로 재시작할 때 지나온 방. 도착 문 닫힘 연출에 쓴다. */
  create(data: { from?: RoomId } = {}) {
    this.panelOpen = false
    this.tableTalk = false
    this.seatTalk = false
    this.uiEvents.emit(LAB_EVENTS.tableTalk, false)
    this.activeRoom = this.client.currentRoom()
    this.restartPending = false
    this.transition = this.client.isTravelling()
    setRoomObstacles(roomObstacles(this.activeRoom))
    this.cameras.main.fadeIn(180)
    this.touchInput = { x: 0, y: 0 }
    this.touchInteraction = false
    this.openingDoor = undefined
    this.cameras.main.setBackgroundColor(ROOM_THEMES[this.activeRoom].camera)
    const { obstacles, interactionHighlight, plants } = createLobbyMap(this, this.activeRoom)
    this.interactionHighlight = interactionHighlight
    this.fx = createRoomFx(this, this.activeRoom, {
      from: data.from, client: this.client, plants, player: () => this.player && { x: this.player.x, y: this.player.y },
    })
    this.player = new Player(this, SPAWN.x, SPAWN.y)
    this.physics.add.collider(this.player, obstacles)
    this.multiplayer = new LobbyMultiplayer(this, this.player, this.client)
    this.roomSubscription = this.client.subscribe({ room: (roomId, pending) => {
      this.transition = pending || roomId !== this.activeRoom
      if (this.transition) { this.resetChatInput(); this.setTableTalk(false) }
      if (roomId !== this.activeRoom && !this.restartPending) {
        // 승인이 빨리 와도 문이 다 열린 뒤 페이드한다.
        this.restartPending = true
        const from = this.activeRoom
        this.time.delayedCall(this.fx?.doors.remainingOpenMs() ?? 0, () => {
          this.cameras.main.fadeOut(200)
          this.time.delayedCall(210, () => this.scene.restart({ from }))
        })
      } else if (!pending && this.openingDoor) {
        // 거부·시간 초과로 같은 방에 남으면 문을 다시 닫는다.
        this.fx?.doors.close(this.openingDoor)
        this.openingDoor = undefined
      }
    } })
    this.uiEvents.once(MULTIPLAYER_EVENTS.dispose, this.stopMultiplayer)
    this.interactKey = this.input.keyboard?.addKey('E')
    this.interactionHint = crispText(this, 0, 0, '', {
      fontSize: '14px', fontStyle: 'bold', color: '#fff2d2',
      backgroundColor: '#243f43', padding: { x: 12, y: 8 },
    }).setOrigin(0.5).setDepth(1000).setVisible(false)
    // 렌더 캔버스 크기가 바뀌면 카메라 줌과 글자 해상도를 다시 맞춘다.
    applyRenderZoom(this)
    this.scale.on('resize', this.resizeRender)

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
      this.fx?.destroy()
      this.fx = undefined
      this.scale.off('resize', this.resizeRender)
      this.uiEvents.off(MULTIPLAYER_EVENTS.dispose, this.stopMultiplayer)
      this.uiEvents.off(RESEARCH_EVENTS.closeResearch, this.closePanel)
      this.uiEvents.off(LAB_EVENTS.closePanel, this.closePanel)
      this.uiEvents.off('chat:focus', this.resetChatInput)
    })
  }

  update(_time = 0, delta = 16.67) {
    if (!this.player) return

    const textFocused = hasTextInputFocus()
    // 낚시처럼 방 연출이 진행 중이면 캐릭터를 멈춘다.
    this.player.update(!this.panelOpen && !this.transition && !textFocused && !this.fx?.locksMovement(), this.touchInput)
    this.multiplayer?.update(delta)
    const door = ROOMS[this.activeRoom].doors.find(d => Math.hypot(this.player!.x - d.x, this.player!.y - d.y) <= 56)
    // 출입구가 우선이며, E 한 번에 한 대상만 실행한다.
    const target = door ? undefined : nearestInteraction(this.activeRoom, this.player.x, this.player.y)
    this.syncSeat()
    // 테이블 범위를 벗어나면 서버 거부를 기다리지 않고 근거리 대화를 끈다. 회의실 의자에 앉아 있는 동안은 유지한다.
    if (this.tableTalk && target?.kind !== 'table-talk' && !this.seatTalk) this.setTableTalk(false)
    const enabled = !this.panelOpen && !this.transition && !textFocused
    if (door) this.interactionHint?.setPosition(door.x, door.y - 70).setText(doorHint(door))
    else if (target) this.interactionHint?.setPosition(target.x, target.y - target.height / 2 - 30).setText(this.fx?.hint(target) ?? this.hintFor(target))
    // 대상이 바뀌거나(다가감) 문구가 바뀌면(테이블 대화 참여·나가기, 서버실 경보) 다시 2초 동안 보여 준다.
    const hintKey = door || target ? `${door?.id ?? target?.id}|${this.interactionHint?.text ?? ''}` : undefined
    if (hintKey !== this.hintKey) { this.hintKey = hintKey; this.hintShownAt = this.time.now }
    const hintExpired = this.time.now - this.hintShownAt >= HINT_VISIBLE_MS
    this.interactionHint?.setVisible(enabled && (!!door || !!target) && !hintExpired)
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
      if (this.client.changeRoom(door.id)) {
        this.openingDoor = door.id
        this.fx?.doors.open(door.id)
      }
      return
    }
    if (!target) return
    if (this.fx?.intercept(target)) return
    if (target.kind === 'table-talk') {
      this.setTableTalk(!this.tableTalk)
      return
    }
    if (target.kind === 'seat') {
      this.toggleSeat(target as Seat)
      return
    }
    this.panelOpen = true
    this.resetChatInput()
    this.interactionHint?.setVisible(false)
    this.interactionHighlight?.setVisible(false)
    if (target.kind === 'research') this.uiEvents.emit(RESEARCH_EVENTS.openResearch)
    // 책장은 책이 날아오는 연출(RoomFx)이 끝난 뒤 책 읽기 창을 연다.
    else if (target.kind === 'bookshelf') this.time.delayedCall(450, () => { if (this.panelOpen) this.uiEvents.emit(LAB_EVENTS.openPanel, 'bookshelf') })
    else this.uiEvents.emit(LAB_EVENTS.openPanel, target.kind)
  }

  /** 테이블 대화 상태가 바뀔 때만 React 채팅 패널에 알린다. */
  /** quiet: 회의실 의자로 자동 참여·해제할 때는 배너를 띄우지 않는다. */
  private setTableTalk(active: boolean, quiet = false) {
    if (this.tableTalk === active) return
    this.tableTalk = active
    this.uiEvents.emit(LAB_EVENTS.tableTalk, active)
    this.fx?.setTableTalk(active, quiet)
  }

  private hintFor(target: RoomInteraction) {
    if (target.kind === 'table-talk') return this.tableTalk ? 'E · 테이블 대화 나가기' : 'E · 테이블 대화 참여'
    // 의자는 자주 지나치므로 짧게 E만 보여 준다.
    if (target.kind === 'seat') return 'E'
    return 'E · ' + target.label
  }

  /** 같은 의자에서 E를 다시 누르면 일어난다. 서버 확인 전에 먼저 앉은 모습을 보여 준다. */
  private toggleSeat(seat: Seat) {
    if (!this.player) return
    if (this.player.seat?.id === seat.id) {
      this.player.sit(undefined)
      this.client.sit(null)
      return
    }
    if (!this.client.sit(seat.id)) return
    this.player.sit(seat)
    this.sitRequestedAt = this.time.now
    // 회의실 의자에 앉으면 테이블 대화에 자동으로 참여한다.
    if (this.activeRoom === 'meeting-room') { this.seatTalk = true; this.setTableTalk(true, true) }
  }

  /** 서버가 1.5초 안에 앉음을 확인하지 않으면(멀거나 빈자리 아님) 일어난다. 일어나면 자동 테이블 대화도 끈다. */
  private syncSeat() {
    const seat = this.player?.seat
    if (seat && this.time.now - this.sitRequestedAt > 1500 && this.client.selfSeat() !== seat.id) this.player!.sit(undefined)
    if (this.seatTalk && !this.player?.seat) { this.seatTalk = false; this.setTableTalk(false, true) }
  }
}
