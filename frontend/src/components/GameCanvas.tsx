import { ROOMS } from '../game/maps/rooms'
import type { RoomId } from '../game/maps/rooms'
import { useCallback, useEffect, useRef, useState } from 'react'
import Phaser from 'phaser'
import LabLobbyScene from '../game/scenes/LabLobbyScene'
import { RENDER_ZOOM_KEY, canvasSizeFor, renderZoomFor } from '../game/render/renderScale'
import { PULLS_EVENTS } from '../features/pulls/pullsApi'
import PullsPanel from '../features/pulls/PullsPanel'
import LabInfoPanel from '../features/lab/components/LabInfoPanel'
import ServerRackPanel from '../features/lab/components/ServerRackPanel'
import ServerBlogPanel from '../features/lab/components/ServerBlogPanel'
import { isRackId } from '../features/lab/model/capacity'
import { LAB_EVENTS } from '../features/lab/labEvents'
import type { RoomPanelKind } from '../features/lab/model/labTypes'
import AgendaPanel from '../features/boards/AgendaPanel'
import BookPanel from '../features/books/BookPanel'
import SqlConsolePanel from '../features/admin/SqlConsolePanel'
import AdminApplyPanel from '../features/admin/AdminApplyPanel'
import MyDeskPanel from '../features/office/MyDeskPanel'
import UseMapPanel from '../features/usemap/UseMapPanel'
import ArcadePanel from '../features/arcade/ArcadePanel'
import GamblePanel from '../features/arcade/GamblePanel'
import { GAMBLE_MACHINES } from '../features/arcade/gambleApi'
import PhonePanel from '../features/phone/PhonePanel'
import { tradeMessage } from '../features/inventory/tradeMessages'
import TradeOfferPanel from '../features/inventory/TradeOfferPanel'
import VendingPanel from '../features/inventory/VendingPanel'
import FoodCartPanel from '../features/inventory/FoodCartPanel'
import { inventoryStore } from '../features/inventory/inventoryStore'
import { rulesStore } from '../features/rules/rulesStore'
import { SALARY_TICK_MS, tickSalary } from '../features/badge/badgeApi'
import type { TradeOffer } from '../features/multiplayer/model/protocol'
import GuestbookPanel from '../features/guestbook/GuestbookPanel'
import MultiplayerStatus from '../features/multiplayer/components/MultiplayerStatus'
import { INITIAL_CONNECTION, MULTIPLAYER_EVENTS } from '../features/multiplayer/model/protocol'
import type { ConnectionInfo, ChatMessage, ChatError } from '../features/multiplayer/model/protocol'
import MultiplayerClient from '../features/multiplayer/MultiplayerClient'
import ChatPanel from '../features/multiplayer/components/ChatPanel'
import MobileControls from './MobileControls'
import IntroPanel from '../features/intro/IntroPanel'
import EndingPanel from '../features/ending/EndingPanel'
import { playSfx } from '../audio/AudioManager'
import { authStore, useAuth } from '../features/auth/authStore'
import { MOBILE_INPUT } from '../game/input/mobileInput'
import type { DirectionInput } from '../game/input/mobileInput'

/**
 * Phaser 게임과 화면 패널의 수명을 관리하고, 방 이동·모바일 입력·상호작용 이벤트를 React에 연결한다.
 *
 * @author seulgae
 * @version 1.2, 야외 첫 출근과 튜토리얼 선택 연결
 * @see "None"
 * @param props 현재 방이 바뀔 때 호출하는 콜백
 * @returns 게임 캔버스와 현재 열린 상호작용 패널
 */
export default function GameCanvas({ onRoomChange }: { onRoomChange?: (roomId: RoomId) => void } = {}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const eventRef = useRef<Phaser.Events.EventEmitter | null>(null)
  const [pullsOpen, setPullsOpen] = useState(false)
  const [connection, setConnection] = useState<ConnectionInfo>(INITIAL_CONNECTION)
  const clientRef = useRef<MultiplayerClient | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatError, setChatError] = useState<ChatError | null>(null)
  const [chatAvailable, setChatAvailable] = useState(false)
  const [chatFocused, setChatFocused] = useState(false)
  const [controlsReset, setControlsReset] = useState(0)
  const [labPanel, setLabPanel] = useState<RoomPanelKind | null>(null)
  /** 서비스 연구실에서 연 업무 게시판 컴퓨터 */
  const [gambleId, setGambleId] = useState('')
  const [rackId, setRackId] = useState('')
  const [tableTalk, setTableTalk] = useState(false)
  /** 회의실에서 받은 교환 신청과 결과 알림 */
  const [tradeOffer, setTradeOffer] = useState<TradeOffer | null>(null)
  const [tradeNotice, setTradeNotice] = useState<string | null>(null)
  const closeTrade = useCallback(() => setTradeOffer(null), [])
  useEffect(() => { if (!tradeNotice) return; const timer = setTimeout(() => setTradeNotice(null), 4000); return () => clearTimeout(timer) }, [tradeNotice])
  // 로그인 확인이 늦어도 이름표를 갱신한다. 회의실 소켓이 연결된 상태라면 새 닉네임으로 다시 접속한다.
  const auth = useAuth()
  const memberNickname = auth.member?.nickname
  // 관리자실 문: 관리자 회원만 들어간다.
  useEffect(() => { clientRef.current?.setAdmin(auth.admin) }, [auth.admin, connection.phase])
  useEffect(() => { if (memberNickname) clientRef.current?.applyNickname(memberNickname) }, [memberNickname, connection.phase])

  /** 다른 UI 갱신 중에도 조이스틱의 입력 콜백을 유지한다. */
  const moveMobile = useCallback((input: DirectionInput) => {
    eventRef.current?.emit(MOBILE_INPUT.move, input)
  }, [])
  /** 터치 버튼을 기존 E 키 상호작용과 같은 장면 이벤트로 전달한다. */
  const interactMobile = useCallback(() => {
    containerRef.current?.focus({ preventScroll: true })
    eventRef.current?.emit(MOBILE_INPUT.interact)
  }, [])

  /**
   * 게임에 닫기 이벤트를 보내고 패널을 숨긴 뒤 게임 영역으로 초점을 돌린다.
   */
  const closePulls = () => {
    eventRef.current?.emit(PULLS_EVENTS.closePulls)
    setPullsOpen(false)
    containerRef.current?.focus({ preventScroll: true })
  }
  /** CCTV 패널이 렌더 중 ref를 직접 읽지 않도록 함수로 넘긴다. */
  const getClient = useCallback(() => clientRef.current, [])
  /** 서버 상태·빌드 정보 패널도 같은 방식으로 게임 입력을 복구한다. */
  const closeLabPanel = () => {
    eventRef.current?.emit(LAB_EVENTS.closePanel)
    setLabPanel(null)
    containerRef.current?.focus({ preventScroll: true })
  }

  /** 시작 안내의 선택을 장면에 전달하고 패널을 닫는다. */
  const chooseIntro = (skip: boolean) => {
    closeLabPanel()
    eventRef.current?.emit(LAB_EVENTS.introChoice, skip)
  }

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let game: Phaser.Game | null = null
    let resizeObserver: ResizeObserver | null = null
    const uiEvents = new Phaser.Events.EventEmitter()
    const client = new MultiplayerClient({
      status: info => { setConnection(info); setChatAvailable(client.canChat()); onRoomChange?.(info.roomId ?? "lobby") },
      history: setMessages,
      chat: message => {
        setMessages(previous => [...previous, message].slice(-50))
        // 다른 연구원의 새 메시지에만 알림음을 낸다(기록·내 메시지는 조용히).
        if (message.playerId !== client.selfPlayerId()) playSfx('chat', { volume: 0.6 })
      },
      chatError: setChatError,
      tradeOffer: setTradeOffer,
      tradeStatus: status => {
        if (status.status === 'sent') return
        setTradeNotice(tradeMessage(status.status, status.reason))
        if (status.status === 'accepted') { playSfx('success', { volume: 0.6 }); void inventoryStore.refresh() }
      },
    }, { isAdmin: () => authStore.get().admin, initialRoom: 'outdoor' })
    clientRef.current = client
    // 처음부터 가방(동전·HP·기력)을 읽어 둔다. 그래야 첫 간식·오락부터 변화량이 캐릭터 위에 뜬다.
    void inventoryStore.refresh()
    // 게임 규칙(행동 비용·간식·직급)을 운영 DB에서 받아 둔다. 실패하면 기본값을 쓴다.
    void rulesStore.load()
    // 접속해 있는 동안 1분마다 급여 차례를 확인한다(지급은 서버가 10분에 한 번). 받으면 가방을 다시 읽어 동전이 튀어 오른다.
    const payday = () => {
      if (!authStore.get().member) return
      tickSalary().then(view => { if (view.paid > 0) { playSfx('coin', { volume: 0.6 }); void inventoryStore.refresh() } }).catch(() => undefined)
    }
    const salaryTimer = window.setInterval(payday, SALARY_TICK_MS)
    const firstPay = window.setTimeout(payday, 5000)
    eventRef.current = uiEvents
    const openPulls = () => setPullsOpen(true)
    uiEvents.on(PULLS_EVENTS.openPulls, openPulls)
    const openLabPanel = (kind: RoomPanelKind) => setLabPanel(kind)
    uiEvents.on(LAB_EVENTS.serverRack, setRackId)
    uiEvents.on(LAB_EVENTS.gamble, setGambleId)
    uiEvents.on(LAB_EVENTS.openPanel, openLabPanel)
    uiEvents.on(LAB_EVENTS.tableTalk, setTableTalk)
    const resetMobile = () => setControlsReset(value => value + 1)
    uiEvents.on(MOBILE_INPUT.reset, resetMobile)

    // StrictMode의 첫 setup/cleanup에서는 생성 예약만 취소한다.
    const frameId = requestAnimationFrame(() => {
      // 내부 해상도를 표시 크기×DPR에 맞춰 브라우저 확대·축소 없이 기기 픽셀과 1:1로 그린다.
      const measure = () => canvasSizeFor(renderZoomFor(container.getBoundingClientRect().width, window.devicePixelRatio))
      let size = measure()
      game = new Phaser.Game({
        type: Phaser.AUTO,
        width: size.width,
        height: size.height,
        parent: container,
        backgroundColor: '#ddd5bf',
        pixelArt: true,
        roundPixels: true,
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        physics: {
          default: 'arcade',
          arcade: { gravity: { x: 0, y: 0 } },
        },
        scene: [new LabLobbyScene(uiEvents, client)],
        callbacks: { preBoot: booted => { booted.registry.set(RENDER_ZOOM_KEY, size.zoom) } },
      })
      resizeObserver = new ResizeObserver(() => {
        if (!game) return
        const next = measure()
        if (next.width === size.width) { game.scale.refresh(); return }
        size = next
        game.registry.set(RENDER_ZOOM_KEY, size.zoom)
        game.scale.resize(size.width, size.height)
      })
      resizeObserver.observe(container)
      client.start()
    })

    return () => {
      cancelAnimationFrame(frameId)
      resizeObserver?.disconnect()
      window.clearInterval(salaryTimer); window.clearTimeout(firstPay)
      // Phaser의 비동기 destroy 프레임을 기다리지 않고 소켓·타이머부터 정리한다.
      uiEvents.emit(MULTIPLAYER_EVENTS.dispose)
      uiEvents.off(PULLS_EVENTS.openPulls, openPulls)
      uiEvents.off(LAB_EVENTS.openPanel, openLabPanel)
      uiEvents.off(LAB_EVENTS.serverRack, setRackId)
      uiEvents.off(LAB_EVENTS.gamble, setGambleId)
      uiEvents.off(LAB_EVENTS.tableTalk, setTableTalk)
      uiEvents.off(MOBILE_INPUT.reset, resetMobile)
      client.destroy()
      clientRef.current = null
      uiEvents.removeAllListeners()
      eventRef.current = null
      game?.destroy(true)
    }
  }, [onRoomChange])

  return (
    <>
      <div ref={containerRef} className="game-canvas" tabIndex={0} role="application"
        onPointerDown={() => containerRef.current?.focus({ preventScroll: true })}
        aria-label="슬개기술연구소 게임 화면. WASD 또는 방향키 이동, E 출입구·연구 장비 사용" />
      <MultiplayerStatus connection={connection} />
      {/* 채팅은 멀티플레이가 열리는 회의실에서만 보인다. */}
      {connection.roomId === 'meeting-room' && <ChatPanel roomName={ROOMS[connection.roomId ?? "lobby"].name} messages={messages} connected={connection.phase === 'online' && chatAvailable}
        tableTalk={tableTalk}
        error={chatError} onSend={message => clientRef.current?.sendChat(message, tableTalk ? 'table' : 'room') ?? false}
        onInputFocus={focused => { setChatFocused(focused); eventRef.current?.emit('chat:focus') }}
        onExit={() => containerRef.current?.focus({ preventScroll: true })} onEdit={() => setChatError(null)} />}
      <MobileControls disabled={pullsOpen || labPanel !== null || chatFocused || connection.travelling === true} resetToken={controlsReset}
        onMove={moveMobile} onInteract={interactMobile} />
      {pullsOpen && <PullsPanel onClose={closePulls} />}
      {labPanel === 'agenda' && <AgendaPanel onClose={closeLabPanel} />}
      {labPanel === 'bookshelf' && <BookPanel onClose={closeLabPanel} admin={connection.roomId === 'control-room'} />}
      {labPanel === 'admin-console' && <SqlConsolePanel onClose={closeLabPanel} />}
      {labPanel === 'admin-apply' && <AdminApplyPanel onClose={closeLabPanel} />}
      {labPanel === 'my-desk' && <MyDeskPanel onClose={closeLabPanel} />}
      {labPanel === 'usemap' && <UseMapPanel onClose={closeLabPanel} />}
      {labPanel === 'arcade' && <ArcadePanel onClose={closeLabPanel} />}
      {labPanel === 'gamble' && GAMBLE_MACHINES[gambleId] && <GamblePanel game={GAMBLE_MACHINES[gambleId]!} onClose={closeLabPanel} />}
      {labPanel === 'inventory' && <PhonePanel client={getClient} onClose={closeLabPanel} />}
      {labPanel === 'guestbook' && <GuestbookPanel onClose={closeLabPanel} />}
      {labPanel === 'vending-machine' && <VendingPanel onClose={closeLabPanel} />}
      {labPanel === 'intro' && <IntroPanel onChoice={chooseIntro} />}
      {labPanel === 'ending' && <EndingPanel onClose={closeLabPanel} />}
      {labPanel === 'food-cart' && <FoodCartPanel onClose={closeLabPanel} />}
      {tradeOffer && <TradeOfferPanel offer={tradeOffer} onClose={closeTrade}
        onAnswer={itemId => { clientRef.current?.answerTrade(tradeOffer.tradeId, itemId); setTradeOffer(null) }} />}
      {tradeNotice && <p className="trade-toast" role="status">{tradeNotice}</p>}
      {labPanel === 'server-status' && <ServerRackPanel rack={isRackId(rackId) ? rackId : 'server-rack-1'} onClose={closeLabPanel} />}
      {labPanel === 'build-info' && <LabInfoPanel kind={labPanel} onClose={closeLabPanel} />}
      {labPanel === 'server-blog' && <ServerBlogPanel onClose={closeLabPanel} />}
    </>
  )
}
