import { ROOMS } from '../game/maps/rooms'
import type { RoomId } from '../game/maps/rooms'
import { useCallback, useEffect, useRef, useState } from 'react'
import Phaser from 'phaser'
import LabLobbyScene from '../game/scenes/LabLobbyScene'
import { RENDER_ZOOM_KEY, canvasSizeFor, renderZoomFor } from '../game/render/renderScale'
import { RESEARCH_EVENTS } from '../features/research/researchEvents'
import ResearchPanel from '../features/research/components/ResearchPanel'
import LabInfoPanel from '../features/lab/components/LabInfoPanel'
import { LAB_EVENTS } from '../features/lab/labEvents'
import type { RoomPanelKind } from '../features/lab/model/labTypes'
import AgendaPanel from '../features/boards/AgendaPanel'
import BookPanel from '../features/books/BookPanel'
import SqlConsolePanel from '../features/admin/SqlConsolePanel'
import AdminApplyPanel from '../features/admin/AdminApplyPanel'
import WorkBoardPanel from '../features/work/WorkBoardPanel'
import { WORK_BOARDS } from '../features/work/workApi'
import ArcadePanel from '../features/arcade/ArcadePanel'
import PhonePanel from '../features/phone/PhonePanel'
import { tradeMessage } from '../features/inventory/tradeMessages'
import TradeOfferPanel from '../features/inventory/TradeOfferPanel'
import FoodCartPanel from '../features/inventory/FoodCartPanel'
import { inventoryStore } from '../features/inventory/inventoryStore'
import type { TradeOffer } from '../features/multiplayer/model/protocol'
import GuestbookPanel from '../features/guestbook/GuestbookPanel'
import MultiplayerStatus from '../features/multiplayer/components/MultiplayerStatus'
import { INITIAL_CONNECTION, MULTIPLAYER_EVENTS } from '../features/multiplayer/model/protocol'
import type { ConnectionInfo, ChatMessage, ChatError } from '../features/multiplayer/model/protocol'
import MultiplayerClient from '../features/multiplayer/MultiplayerClient'
import ChatPanel from '../features/multiplayer/components/ChatPanel'
import MobileControls from './MobileControls'
import { playSfx } from '../audio/AudioManager'
import { useAuth } from '../features/auth/authStore'
import { MOBILE_INPUT } from '../game/input/mobileInput'
import type { DirectionInput } from '../game/input/mobileInput'

/**
 * Phaser 게임의 생성·정리와 연구 기록 패널의 이벤트 연결을 관리한다.
 *
 * @author seulgae
 * @version 1.0, 현재 방·채팅 패널과 기존 모바일 입력 잠금 연결
 * @see "None"
 * @returns 게임 캔버스와 조건부 연구 기록 패널
 */
export default function GameCanvas({ onRoomChange }: { onRoomChange?: (roomId: RoomId) => void } = {}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const eventRef = useRef<Phaser.Events.EventEmitter | null>(null)
  const [researchOpen, setResearchOpen] = useState(false)
  const [connection, setConnection] = useState<ConnectionInfo>(INITIAL_CONNECTION)
  const clientRef = useRef<MultiplayerClient | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatError, setChatError] = useState<ChatError | null>(null)
  const [chatAvailable, setChatAvailable] = useState(false)
  const [chatFocused, setChatFocused] = useState(false)
  const [controlsReset, setControlsReset] = useState(0)
  const [labPanel, setLabPanel] = useState<RoomPanelKind | null>(null)
  /** 서비스 연구실에서 연 업무 게시판 컴퓨터 */
  const [workBoardId, setWorkBoardId] = useState('')
  const [tableTalk, setTableTalk] = useState(false)
  /** 회의실에서 받은 교환 신청과 결과 알림 */
  const [tradeOffer, setTradeOffer] = useState<TradeOffer | null>(null)
  const [tradeNotice, setTradeNotice] = useState<string | null>(null)
  const closeTrade = useCallback(() => setTradeOffer(null), [])
  useEffect(() => { if (!tradeNotice) return; const timer = setTimeout(() => setTradeNotice(null), 4000); return () => clearTimeout(timer) }, [tradeNotice])
  // 로그인 확인이 게임 시작보다 늦게 끝나도(모바일) 회원 닉네임으로 다시 접속한다.
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
  const closeResearch = () => {
    eventRef.current?.emit(RESEARCH_EVENTS.closeResearch)
    setResearchOpen(false)
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
    })
    clientRef.current = client
    eventRef.current = uiEvents
    const openResearch = () => setResearchOpen(true)
    uiEvents.on(RESEARCH_EVENTS.openResearch, openResearch)
    const openLabPanel = (kind: RoomPanelKind) => setLabPanel(kind)
    const pickWorkBoard = (id: string) => setWorkBoardId(id)
    uiEvents.on(LAB_EVENTS.workBoard, pickWorkBoard)
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
      // Phaser의 비동기 destroy 프레임을 기다리지 않고 소켓·타이머부터 정리한다.
      uiEvents.emit(MULTIPLAYER_EVENTS.dispose)
      uiEvents.off(RESEARCH_EVENTS.openResearch, openResearch)
      uiEvents.off(LAB_EVENTS.openPanel, openLabPanel)
      uiEvents.off(LAB_EVENTS.workBoard, pickWorkBoard)
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
      <MobileControls disabled={researchOpen || labPanel !== null || chatFocused || connection.travelling === true} resetToken={controlsReset}
        onMove={moveMobile} onInteract={interactMobile} />
      {researchOpen && <ResearchPanel onClose={closeResearch} />}
      {labPanel === 'agenda' && <AgendaPanel onClose={closeLabPanel} />}
      {labPanel === 'bookshelf' && <BookPanel onClose={closeLabPanel} />}
      {labPanel === 'admin-console' && <SqlConsolePanel onClose={closeLabPanel} />}
      {labPanel === 'admin-apply' && <AdminApplyPanel onClose={closeLabPanel} />}
      {labPanel === 'work-board' && WORK_BOARDS[workBoardId] && <WorkBoardPanel board={WORK_BOARDS[workBoardId]!} onClose={closeLabPanel} />}
      {labPanel === 'arcade' && <ArcadePanel onClose={closeLabPanel} />}
      {labPanel === 'inventory' && <PhonePanel client={getClient} onClose={closeLabPanel} />}
      {labPanel === 'guestbook' && <GuestbookPanel onClose={closeLabPanel} />}
      {labPanel === 'food-cart' && <FoodCartPanel onClose={closeLabPanel} />}
      {tradeOffer && <TradeOfferPanel offer={tradeOffer} onClose={closeTrade}
        onAnswer={itemId => { clientRef.current?.answerTrade(tradeOffer.tradeId, itemId); setTradeOffer(null) }} />}
      {tradeNotice && <p className="trade-toast" role="status">{tradeNotice}</p>}
      {(labPanel === 'server-status' || labPanel === 'build-info') && <LabInfoPanel kind={labPanel} onClose={closeLabPanel} />}
    </>
  )
}
