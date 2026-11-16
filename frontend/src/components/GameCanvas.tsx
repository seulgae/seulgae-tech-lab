import { useCallback, useEffect, useRef, useState } from 'react'
import Phaser from 'phaser'
import LabLobbyScene from '../game/scenes/LabLobbyScene'
import { RESEARCH_EVENTS } from '../features/research/researchEvents'
import ResearchPanel from '../features/research/components/ResearchPanel'
import MultiplayerStatus from '../features/multiplayer/components/MultiplayerStatus'
import { INITIAL_CONNECTION, MULTIPLAYER_EVENTS } from '../features/multiplayer/model/protocol'
import type { ConnectionInfo, ChatMessage, ChatError } from '../features/multiplayer/model/protocol'
import MultiplayerClient from '../features/multiplayer/MultiplayerClient'
import ChatPanel from '../features/multiplayer/components/ChatPanel'
import MobileControls from './MobileControls'
import { MOBILE_INPUT } from '../game/input/mobileInput'
import type { DirectionInput } from '../game/input/mobileInput'

/**
 * Phaser 게임의 생성·정리와 연구 기록 패널의 이벤트 연결을 관리한다.
 *
 * @author seulgae
 * @version 1.0, 모바일 조작과 채팅·연구 패널 입력 잠금 연결
 * @see "None"
 * @returns 게임 캔버스와 조건부 연구 기록 패널
 */
export default function GameCanvas() {
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

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let game: Phaser.Game | null = null
    let resizeObserver: ResizeObserver | null = null
    const uiEvents = new Phaser.Events.EventEmitter()
    const client = new MultiplayerClient({
      status: info => { setConnection(info); setChatAvailable(client.canChat()) },
      history: setMessages,
      chat: message => setMessages(previous => [...previous, message].slice(-50)),
      chatError: setChatError,
    })
    clientRef.current = client
    eventRef.current = uiEvents
    const openResearch = () => setResearchOpen(true)
    uiEvents.on(RESEARCH_EVENTS.openResearch, openResearch)
    const resetMobile = () => setControlsReset(value => value + 1)
    uiEvents.on(MOBILE_INPUT.reset, resetMobile)

    // StrictMode의 첫 setup/cleanup에서는 생성 예약만 취소한다.
    const frameId = requestAnimationFrame(() => {
      game = new Phaser.Game({
        type: Phaser.AUTO,
        width: 800,
        height: 600,
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
      })
      resizeObserver = new ResizeObserver(() => game?.scale.refresh())
      resizeObserver.observe(container)
      client.start()
    })

    return () => {
      cancelAnimationFrame(frameId)
      resizeObserver?.disconnect()
      // Phaser의 비동기 destroy 프레임을 기다리지 않고 소켓·타이머부터 정리한다.
      uiEvents.emit(MULTIPLAYER_EVENTS.dispose)
      uiEvents.off(RESEARCH_EVENTS.openResearch, openResearch)
      uiEvents.off(MOBILE_INPUT.reset, resetMobile)
      client.destroy()
      clientRef.current = null
      uiEvents.removeAllListeners()
      eventRef.current = null
      game?.destroy(true)
    }
  }, [])

  return (
    <>
      <div ref={containerRef} className="game-canvas" tabIndex={0} role="application"
        onPointerDown={() => containerRef.current?.focus({ preventScroll: true })}
        aria-label="슬개기술연구소 게임 화면. WASD 또는 방향키 이동, E 연구 기록 열기" />
      <MultiplayerStatus connection={connection} />
      <ChatPanel messages={messages} connected={connection.phase === 'online' && chatAvailable}
        error={chatError} onSend={message => clientRef.current?.sendChat(message) ?? false}
        onInputFocus={focused => { setChatFocused(focused); eventRef.current?.emit('chat:focus') }}
        onExit={() => containerRef.current?.focus({ preventScroll: true })} onEdit={() => setChatError(null)} />
      <MobileControls disabled={researchOpen || chatFocused} resetToken={controlsReset}
        onMove={moveMobile} onInteract={interactMobile} />
      {researchOpen && <ResearchPanel onClose={closeResearch} />}
    </>
  )
}
