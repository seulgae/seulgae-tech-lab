import Phaser from 'phaser'
import Player from '../Player'
import createLobbyMap from '../LobbyMap'
import { PULLS_EVENTS } from '../../features/pulls/pullsApi'
import { LAB_EVENTS } from '../../features/lab/labEvents'
import { closerTarget, hasTextInputFocus, isNearObject } from '../interaction'
import { createPixelAssets } from '../assets/pixelAssets'
import { createRoomAssets } from '../assets/roomAssets'
import { createRoomFx } from '../rooms/RoomFx'
import type { RoomFx } from '../rooms/RoomFx'
import { ROOM_THEMES } from '../rooms/roomThemes'
import { applyRenderZoom, crispText } from '../render/renderScale'
import LobbyMultiplayer from '../multiplayer/LobbyMultiplayer'
import PetBot from '../pet/PetBot'
import { readIntroProgress, saveIntroProgress } from '../../features/intro/introProgress'
import type { IntroProgress } from '../../features/intro/introProgress'
import { SPAWN } from '../maps/lobbyLayout'
import { MULTIPLAYER_EVENTS } from '../../features/multiplayer/model/protocol'
import type MultiplayerClient from '../../features/multiplayer/MultiplayerClient'
import { MOBILE_INPUT } from '../input/mobileInput'
import type { DirectionInput } from '../input/mobileInput'
import { roomSeats, ROOMS, doorHint, nearestInteraction, roomObstacles } from '../maps/rooms'
import type { RoomId, RoomInteraction, Seat } from '../maps/rooms'
import { setRoomObstacles } from '../multiplayer/networkPosition'
import { AudioManager, playSfx } from '../../audio/AudioManager'
import type { GameLike } from '../../audio/AudioManager'
import { FootstepTracker, footstepSound } from '../../audio/soundRules'
import type { EffectKey } from '../../audio/synth'
import { skyPhase } from '../rooms/timeOfDay'
import { COIN_EVENT, OPEN_INVENTORY_EVENT, VITALS_EVENT, inventoryStore, vitalsText } from '../../features/inventory/inventoryStore'
import type { GroundItem } from '../../features/multiplayer/model/protocol'
import { FISH_COLORS } from '../rooms/fishingLogic'

/** 패널을 열 때 함께 나는 장비 소리(컴퓨터 타이핑, 키오스크, 화이트보드 마커 등) */
/** 호숫가 동쪽에서 정문까지 곧장 걸을 수 있는 첫 출근 위치다. */
const FIRST_DAY_SPAWN = { x: 400, y: 280 }
const FIRST_DAY_BOT = { x: 467, y: 315 }
const RESEARCH_ENTRANCE = 'outdoor-to-lobby'
/** 서비스 연구실 왼쪽 맨 아래 의자: 내 자리(앉으면 모니터가 켜진다) */
const MY_DESK_SEAT = 'office-1-chair-2'
const PANEL_SOUNDS: Partial<Record<string, EffectKey>> = {
  'pull-requests': 'kiosk', 'build-info': 'typing', 'server-status': 'beep', agenda: 'marker', bookshelf: 'page', 'admin-console': 'typing', 'admin-apply': 'kiosk',
  'my-desk': 'typing', usemap: 'kiosk', arcade: 'success', gamble: 'coin', guestbook: 'kiosk', 'food-cart': 'coin',
}

/**
 * 방 표시·출입구·이동과 충돌을 관리하고 첫 출근 및 방별 상호작용을 React 패널에 연결한다.
 *
 * @author seulgae
 * @version 1.2, 방별 테마·문 열림 연출·방 이벤트 연결
 * @see "None"
 */
/** 서버가 앉음을 확인해 줄 때까지 기다리는 시간(ms). 운영 왕복(약 1초)과 대기 중인 걸음 처리를 넉넉히 덮는다. */
const SEAT_CONFIRM_MS = 3000
/** 상호작용·출입구 안내 문구가 보이는 시간(ms). 그 뒤에는 테두리 강조만 남는다. */
const HINT_VISIBLE_MS = 2000

export default class LabLobbyScene extends Phaser.Scene {
  private player?: Player
  private activeRoom: RoomId = 'lobby'
  private transition = false
  private pet?: PetBot
  private introProgress = readIntroProgress()
  private introGuiding = false
  private roomSubscription?: () => void
  private restartPending = false
  private interactionHint?: Phaser.GameObjects.Text
  private interactKey?: Phaser.Input.Keyboard.Key
  /** I: 가방(인벤토리) 열기 */
  private inventoryKey?: Phaser.Input.Keyboard.Key
  /** 방 바닥에 놓인 아이템(누구나 E로 줍는다) */
  private readonly groundSprites = new Map<string, Phaser.GameObjects.Image>()
  private ground: GroundItem[] = []
  private groundSubscription?: () => void
  private readonly openInventoryFromButton = () => { if (!this.panelOpen && !this.transition) this.openInventory() }
  /** HP·기력 변화량을 캐릭터 위에 띄운다(줄면 붉게, 늘면 초록). */
  private readonly showVitals = (event: Event) => {
    const change = (event as CustomEvent<{ hp: number; fatigue: number }>).detail
    if (!change || !this.player) return
    const text = vitalsText(change)
    if (!text) return
    const gained = change.hp + change.fatigue > 0
    const label = crispText(this, this.player.x, this.player.y - 88, text, { fontSize: '12px', fontStyle: 'bold', color: gained ? '#a7f3a0' : '#ff9a9a', backgroundColor: '#000000aa', padding: { x: 6, y: 3 } })
      .setOrigin(0.5).setDepth(1002)
    this.tweens.add({ targets: label, y: label.y - 22, alpha: 0, delay: 700, duration: 1100, onComplete: () => label.destroy() })
  }
  private readonly showCoin = (event: Event) => this.coinPop((event as CustomEvent<{ amount: number }>).detail?.amount ?? 0)
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
  /** 실제로 움직인 거리만큼만 발걸음 소리를 낸다. */
  private readonly footsteps = new FootstepTracker()
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
  /** 글 입력 칸에 포커스가 있는 동안 게임 키 가로채기를 끈 상태인지 */
  private keyCaptureReleased = false
  /**
   * Phaser는 이동·상호작용 키(방향키, Space, W/A/S/D, E, I)를 창 전체에서 가로챈다(preventDefault).
   * 게시판·방명록·채팅 입력 칸에 포커스가 있으면 가로채기를 꺼서 띄어쓰기와 영문 글자가 그대로 입력되게 한다.
   */
  private syncKeyCapture(textFocused = hasTextInputFocus()) {
    const keyboard = this.input.keyboard
    if (!keyboard || textFocused === this.keyCaptureReleased) return
    this.keyCaptureReleased = textFocused
    if (textFocused) keyboard.disableGlobalCapture()
    else keyboard.enableGlobalCapture()
  }
  /** 포커스가 바뀌는 즉시 반영한다(다음 프레임 전에 누른 키도 입력 칸에 들어가도록). focusout 때는 포커스가 옮겨진 뒤 확인한다. */
  private readonly syncKeyCaptureNow = () => this.syncKeyCapture()
  private readonly onFocusChange = () => { setTimeout(() => this.syncKeyCapture(), 0) }

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
    if (this.panelOpen) playSfx('panel-close', { volume: 0.6 })
    this.panelOpen = false
  }
  /** 안내를 시작하면 봇이 길 쪽에서 다가온다. 건너뛰면 정문으로 바로 입장한다. */
  private readonly chooseIntro = (skip: boolean) => {
    if (this.introProgress || this.introGuiding || this.activeRoom !== 'outdoor' || !this.player) return
    if (skip && this.openDoor(RESEARCH_ENTRANCE)) {
      this.finishIntro('skipped')
      return
    }
    this.introGuiding = true
    this.pet = new PetBot(this, 'outdoor', this.player, { approachFrom: FIRST_DAY_BOT })
    crispText(this, 400, 394, '↓ 연구소 정문 · 가까이서 E', {
      fontSize: '13px', fontStyle: 'bold', color: '#fff2d2',
      backgroundColor: '#243f43', padding: { x: 8, y: 5 },
    }).setOrigin(0.5).setDepth(990)
  }

  private finishIntro(progress: IntroProgress) {
    this.introProgress = progress
    this.introGuiding = false
    saveIntroProgress(progress)
  }

  private openDoor(id: string) {
    if (!this.client.changeRoom(id)) return false
    this.openingDoor = id
    this.fx?.doors.open(id)
    return true
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
    // 방 음악·환경음: 처음 클릭 전에는 브라우저 정책상 기다렸다가 시작한다. 바깥은 1분마다 시간대(밤 환경음)를 다시 맞춘다.
    const audio = AudioManager.for(this.game as unknown as GameLike)
    audio.enterRoom(this.activeRoom, skyPhase(new Date()))
    this.time.addEvent({ delay: 60_000, loop: true, callback: () => audio.enterRoom(this.activeRoom, skyPhase(new Date())) })
    this.footsteps.reset()
    this.fx = createRoomFx(this, this.activeRoom, {
      openPanel: kind => {
        if (this.panelOpen || this.transition || !this.player) return false
        this.panelOpen = true
        this.resetChatInput()
        playSfx('panel-open', { volume: 0.6 })
        this.uiEvents.emit(LAB_EVENTS.openPanel, kind)
        return true
      },
      from: data.from, client: this.client, plants, player: () => this.player && { x: this.player.x, y: this.player.y }, obstacles,
    })
    const firstDay = !data.from && this.activeRoom === 'outdoor' && !this.introProgress
    const defaultSpawn = data.from || this.activeRoom !== 'lobby' ? ROOMS[this.activeRoom].spawn : SPAWN
    const spawn = firstDay ? FIRST_DAY_SPAWN : defaultSpawn
    this.player = new Player(this, spawn.x, spawn.y)
    this.physics.add.collider(this.player, obstacles)
    this.multiplayer = new LobbyMultiplayer(this, this.player, this.client)
    // 곁을 따라다니며 방마다 할 일을 알려 주는 미니 로봇(내 화면에만 보인다)
    if (!firstDay) {
      this.pet = new PetBot(this, this.activeRoom, this.player, { automaticTips: this.introProgress !== 'skipped' })
    }
    this.roomSubscription = this.client.subscribe({ room: (roomId, pending) => {
      this.transition = pending || roomId !== this.activeRoom
      if (this.transition) { this.resetChatInput(); this.setTableTalk(false) }
      if (roomId !== this.activeRoom && !this.restartPending) {
        // 승인이 빨리 와도 문이 다 열린 뒤 페이드한다.
        this.restartPending = true
        const from = this.activeRoom
        this.time.delayedCall(this.fx?.doors.remainingOpenMs() ?? 0, () => {
          playSfx('transition', { volume: 0.5 })
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
    this.inventoryKey = this.input.keyboard?.addKey('I')
    this.groundSubscription = this.client.subscribe({
      ground: items => this.drawGround(items),
      inventoryChanged: () => { void inventoryStore.refresh() },
      inventoryError: reason => this.floatText(reason === 'login' ? '로그인하면 폰 보관함을 쓸 수 있어요' : '지금은 할 수 없어요'),
    })
    this.drawGround(this.client.ground?.() ?? [])
    globalThis.addEventListener?.(COIN_EVENT, this.showCoin)
    globalThis.addEventListener?.(VITALS_EVENT, this.showVitals)
    globalThis.addEventListener?.(OPEN_INVENTORY_EVENT, this.openInventoryFromButton)
    globalThis.document?.addEventListener?.('focusin', this.syncKeyCaptureNow)
    globalThis.document?.addEventListener?.('focusout', this.onFocusChange)
    this.interactionHint = crispText(this, 0, 0, '', {
      fontSize: '14px', fontStyle: 'bold', color: '#fff2d2',
      backgroundColor: '#243f43', padding: { x: 12, y: 8 },
    }).setOrigin(0.5).setDepth(1000).setVisible(false)
    // 렌더 캔버스 크기가 바뀌면 카메라 줌과 글자 해상도를 다시 맞춘다.
    applyRenderZoom(this)
    this.scale.on('resize', this.resizeRender)

    this.uiEvents.on(PULLS_EVENTS.closePulls, this.closePanel)
    this.uiEvents.on(LAB_EVENTS.closePanel, this.closePanel)
    this.uiEvents.on(LAB_EVENTS.introChoice, this.chooseIntro)
    if (firstDay) {
      this.panelOpen = true
      this.uiEvents.emit(LAB_EVENTS.openPanel, 'intro')
    }
    this.uiEvents.on('chat:focus', this.resetChatInput)
    this.uiEvents.on(MOBILE_INPUT.move, this.moveTouch)
    this.uiEvents.on(MOBILE_INPUT.interact, this.interactTouch)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.roomSubscription?.()
      this.roomSubscription = undefined
      this.groundSubscription?.()
      this.groundSubscription = undefined
      globalThis.removeEventListener?.(COIN_EVENT, this.showCoin)
      globalThis.removeEventListener?.(VITALS_EVENT, this.showVitals)
      globalThis.removeEventListener?.(OPEN_INVENTORY_EVENT, this.openInventoryFromButton)
      globalThis.document?.removeEventListener?.('focusin', this.syncKeyCaptureNow)
      globalThis.document?.removeEventListener?.('focusout', this.onFocusChange)
      this.syncKeyCapture(false)
      for (const sprite of this.groundSprites.values()) sprite.destroy()
      this.groundSprites.clear()
      this.multiplayer?.stopInput()
      this.stopMultiplayer()
      this.pet?.destroy()
      this.pet = undefined
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
      this.uiEvents.off(PULLS_EVENTS.closePulls, this.closePanel)
      this.uiEvents.off(LAB_EVENTS.closePanel, this.closePanel)
      this.uiEvents.off(LAB_EVENTS.introChoice, this.chooseIntro)
      this.uiEvents.off('chat:focus', this.resetChatInput)
    })
  }

  update(_time = 0, delta = 16.67) {
    if (!this.player) return

    const textFocused = hasTextInputFocus()
    this.syncKeyCapture(textFocused)
    this.client.setPosition?.(this.player.x, this.player.y)
    // 낚시처럼 방 연출이 진행 중이면 캐릭터를 멈춘다.
    this.player.update(!this.panelOpen && !this.transition && !textFocused && !this.fx?.locksMovement(), this.touchInput)
    // 앉아 있거나 막혀서 좌표가 그대로면 발걸음이 나지 않는다. 음높이를 조금씩 바꿔 반복감을 줄인다.
    if (this.player.seat) this.footsteps.reset()
    else if (this.footsteps.update(this.player.x, this.player.y, delta)) {
      playSfx(footstepSound(this.activeRoom, this.player.x, this.player.y), { volume: 0.45, rate: 0.92 + Math.random() * 0.16 })
    }
    this.multiplayer?.update(delta)
    this.pet?.update(this.player, delta)
    const door = ROOMS[this.activeRoom].doors.find(d => Math.hypot(this.player!.x - d.x, this.player!.y - d.y) <= 56)
    // 출입구가 우선이며, E 한 번에 한 대상만 실행한다.
    // 바닥 아이템이 바로 발밑에 있으면 줍기가 먼저다.
    // 움직이는 대상(NPC 등)과 고정 대상(의자·컴퓨터)이 둘 다 범위 안이면 가장자리까지 더 가까운 쪽을 고른다.
    // (예전에는 NPC가 늘 먼저라, 내 자리 의자 앞에서도 근처 연구원에게 말 걸기가 잡혔다.)
    const target = door ? undefined : this.nearestPickup() ?? closerTarget(this.player.x, this.player.y, this.nearestMoving(), nearestInteraction(this.activeRoom, this.player.x, this.player.y))
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
    if (enabled && this.inventoryKey && this.inventoryKey !== this.interactKey && Phaser.Input.Keyboard.JustDown(this.inventoryKey)) {
      this.openInventory()
      return
    }
    if (!(pressed || touchPressed) || !enabled) return
    if (door) {
      this.resetChatInput()
      // 관리자실은 관리자 회원만(문만 막는 것이고, 쿼리 콘솔 API는 서버가 따로 확인한다)
      if (this.client.canEnter?.(door.target) === false) {
        playSfx('error', { volume: 0.5 })
        this.floatText('관리자만 들어갈 수 있어요')
        return
      }
      if (this.openDoor(door.id) && this.introGuiding && door.id === RESEARCH_ENTRANCE) {
        this.finishIntro('guided')
      }
      return
    }
    if (!target) return
    if (target.kind === 'pickup') {
      if (this.client.pickItem?.(target.id)) playSfx('click', { volume: 0.6 })
      return
    }
    if (this.fx?.intercept(target)) return
    if (target.kind === 'table-talk') {
      this.setTableTalk(!this.tableTalk)
      return
    }
    if (target.kind === 'seat') {
      this.toggleSeat(target as Seat)
      return
    }
    // 내 자리 컴퓨터는 의자에 앉아서 켠다: 아직 안 앉았으면 먼저 앉히고(앉으면 모니터가 켜진다), 앉아 있으면 바로 켠다.
    if (target.kind === 'my-desk' && this.player?.seat?.id !== MY_DESK_SEAT) {
      const seat = roomSeats(this.activeRoom).find(item => item.id === MY_DESK_SEAT)
      if (seat) { this.toggleSeat(seat); return }
    }
    this.panelOpen = true
    this.resetChatInput()
    this.interactionHint?.setVisible(false)
    this.interactionHighlight?.setVisible(false)
    playSfx('panel-open', { volume: 0.6 })
    const panelSound = PANEL_SOUNDS[target.kind]
    if (panelSound) playSfx(panelSound, { volume: 0.7 })
    if (target.kind === 'pull-requests') this.uiEvents.emit(PULLS_EVENTS.openPulls)
    // 책장은 책이 날아오는 연출(RoomFx)이 끝난 뒤 책 읽기 창을 연다.
    else if (target.kind === 'bookshelf') this.time.delayedCall(450, () => { if (this.panelOpen) this.uiEvents.emit(LAB_EVENTS.openPanel, 'bookshelf') })
    else {
      if (target.kind === 'server-status') this.uiEvents.emit(LAB_EVENTS.serverRack, target.id)
      if (target.kind === 'gamble') this.uiEvents.emit(LAB_EVENTS.gamble, target.id)
      this.uiEvents.emit(LAB_EVENTS.openPanel, target.kind)
    }
  }

  /** 가방(인벤토리) 창을 연다. 장면 입력은 패널이 닫힐 때까지 멈춘다. */
  private openInventory() {
    this.panelOpen = true
    this.resetChatInput()
    this.interactionHint?.setVisible(false)
    this.interactionHighlight?.setVisible(false)
    playSfx('panel-open', { volume: 0.6 })
    this.uiEvents.emit(LAB_EVENTS.openPanel, 'inventory')
  }

  /** 움직이는 대상(NPC·포장마차) 중 범위 안에서 가장 가까운 것 */
  private nearestMoving(): RoomInteraction | undefined {
    if (!this.player) return undefined
    let best: RoomInteraction | undefined
    let bestDistance = Infinity
    for (const target of this.fx?.targets?.() ?? []) {
      if (!isNearObject(this.player.x, this.player.y, target, target.range)) continue
      const distance = Math.hypot(this.player.x - target.x, this.player.y - target.y)
      if (distance < bestDistance) { best = target; bestDistance = distance }
    }
    return best
  }

  /** 발밑 28px 안의 바닥 아이템을 줍기 대상으로 만든다. */
  private nearestPickup(): RoomInteraction | undefined {
    if (!this.player) return undefined
    let best: GroundItem | undefined
    let bestDistance = 28
    for (const item of this.ground) {
      const distance = Math.hypot(item.x - this.player.x, item.y - this.player.y)
      if (distance <= bestDistance) { best = item; bestDistance = distance }
    }
    return best && { id: best.id, kind: 'pickup', label: `${best.name}${best.sizeCm ? ` ${best.sizeCm}cm` : ''} 줍기`, x: best.x, y: best.y - 6, width: 24, height: 14, range: 28 }
  }

  /** 바닥 아이템을 물고기 그림으로 그린다(새 목록으로 통째로 다시 그린다). */
  private drawGround(items: GroundItem[]) {
    this.ground = items
    if (!this.add?.image) return
    const ids = new Set(items.map(item => item.id))
    for (const [id, sprite] of this.groundSprites) if (!ids.has(id)) { sprite.destroy(); this.groundSprites.delete(id) }
    for (const item of items) {
      if (this.groundSprites.has(item.id)) continue
      const sprite = this.add.image(item.x, item.y - 4, 'fish').setScale(2).setTint(FISH_COLORS[item.name] ?? 0xffffff).setDepth(item.y - 8)
      this.tweens?.add({ targets: sprite, y: sprite.y - 2, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
      this.groundSprites.set(item.id, sprite)
    }
  }

  /** 동전이 늘거나 줄면 머리 위로 동전이 "땡" 하고 튀어 오른다. */
  private coinPop(amount: number) {
    if (!this.player || !amount || !this.add?.image) return
    playSfx(amount > 0 ? 'coin' : 'click', { volume: 0.7 })
    const coin = this.add.image(this.player.x, this.player.y - 46, 'coin').setScale(2).setDepth(1001)
    const label = crispText(this, this.player.x, this.player.y - 62, `${amount > 0 ? '+' : ''}${amount}원`, {
      fontSize: '12px', fontStyle: 'bold', color: amount > 0 ? '#ffd23f' : '#f0a08f', stroke: '#3b2418', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(1001)
    this.tweens.add({ targets: coin, y: coin.y - 26, duration: 420, ease: 'Back.easeOut' })
    this.tweens.add({ targets: coin, scaleX: { from: 2, to: 0.2 }, duration: 160, yoyo: true, repeat: 2 })
    this.tweens.add({ targets: [coin, label], alpha: 0, delay: 900, duration: 300, onComplete: () => { coin.destroy(); label.destroy() } })
    this.tweens.add({ targets: label, y: label.y - 18, duration: 900 })
  }

  /** 장면 위에 잠깐 뜨는 안내(가방 오류 등) */
  private floatText(message: string) {
    if (!this.player) return
    const text = crispText(this, this.player.x, this.player.y - 70, message, { fontSize: '12px', color: '#fff2d2', backgroundColor: '#000000aa', padding: { x: 6, y: 3 } })
      .setOrigin(0.5).setDepth(1001)
    this.tweens.add({ targets: text, alpha: 0, delay: 1600, duration: 300, onComplete: () => text.destroy() })
  }

  /** 테이블 대화 상태가 바뀔 때만 React 채팅 패널에 알린다. */
  /** quiet: 회의실 의자로 자동 참여·해제할 때는 배너를 띄우지 않는다. */
  private setTableTalk(active: boolean, quiet = false) {
    if (this.tableTalk === active) return
    this.tableTalk = active
    this.uiEvents.emit(LAB_EVENTS.tableTalk, active)
    if (!quiet) playSfx('notify', { volume: 0.5 })
    this.fx?.setTableTalk(active, quiet)
  }

  private hintFor(target: RoomInteraction) {
    if (target.kind === 'table-talk') return this.tableTalk ? 'E · 테이블 대화 나가기' : 'E · 테이블 대화 참여'
    // 의자는 자주 지나치므로 짧게 E만 보여 준다.
    if (target.kind === 'seat') return 'E'
    return 'E · ' + target.label
  }

  /**
   * 같은 의자에서 E를 다시 누르면 일어난다. 회의실(연결 중)은 서버가 확인하고, 그 밖의 방은 혼자라 바로 앉는다.
   */
  private toggleSeat(seat: Seat) {
    if (!this.player) return
    const online = this.client.isOnline?.() ?? true
    if (this.player.seat?.id === seat.id) {
      this.player.sit(undefined)
      playSfx('chair-stand', { volume: 0.7 })
      if (online) this.client.sit(null)
      return
    }
    if (online && !this.client.sit(seat.id)) return
    this.player.sit(seat)
    playSfx('chair-sit', { volume: 0.7 })
    this.sitRequestedAt = this.time.now
    // 회의실 의자에 앉으면 테이블 대화에 자동으로 참여한다.
    if (this.activeRoom === 'meeting-room') { this.seatTalk = true; this.setTableTalk(true, true) }
    // 서비스 연구실 내 자리에 앉으면 잠깐 뒤 모니터(내 자리 컴퓨터)가 켜진다.
    if (seat.id === MY_DESK_SEAT) this.time.delayedCall(400, () => { if (this.player?.seat?.id === MY_DESK_SEAT) this.openDesk() })
  }

  /** 내 자리 컴퓨터 모니터를 연다(자리에 앉은 채로). 장면 입력은 창이 닫힐 때까지 멈춘다. */
  private openDesk() {
    if (this.panelOpen || this.transition) return
    this.panelOpen = true
    this.resetChatInput()
    this.interactionHint?.setVisible(false)
    this.interactionHighlight?.setVisible(false)
    playSfx('typing', { volume: 0.6 })
    this.uiEvents.emit(LAB_EVENTS.openPanel, 'my-desk')
  }

  /** 서버가 3초(SEAT_CONFIRM_MS) 안에 앉음을 확인하지 않으면(멀거나 빈자리 아님) 일어난다. 일어나면 자동 테이블 대화도 끈다. */
  private syncSeat() {
    const seat = this.player?.seat
    if (seat && (this.client.isOnline?.() ?? true) && this.time.now - this.sitRequestedAt > SEAT_CONFIRM_MS && this.client.selfSeat() !== seat.id) this.player!.sit(undefined)
    if (this.seatTalk && !this.player?.seat) { this.seatTalk = false; this.setTableTalk(false, true) }
  }
}
