import { useEffect, useRef, useState } from 'react'
import Phaser from 'phaser'
import LabLobbyScene from '../game/scenes/LabLobbyScene'
import { RESEARCH_EVENTS } from '../features/research/researchEvents'
import ResearchPanel from '../features/research/components/ResearchPanel'

/**
 * Phaser 게임의 생성·정리와 연구 기록 패널의 이벤트 연결을 관리한다.
 *
 * @author seulgae
 * @version 1.0, 픽셀 렌더링과 FIT 스케일링 및 크기 관찰 정리
 * @see "None"
 * @returns 게임 캔버스와 조건부 연구 기록 패널
 */
export default function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)
  const eventRef = useRef<Phaser.Events.EventEmitter | null>(null)
  const [researchOpen, setResearchOpen] = useState(false)

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
    eventRef.current = uiEvents
    const openResearch = () => setResearchOpen(true)
    uiEvents.on(RESEARCH_EVENTS.openResearch, openResearch)

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
        scene: [new LabLobbyScene(uiEvents)],
      })
      resizeObserver = new ResizeObserver(() => game?.scale.refresh())
      resizeObserver.observe(container)
    })

    return () => {
      cancelAnimationFrame(frameId)
      resizeObserver?.disconnect()
      uiEvents.off(RESEARCH_EVENTS.openResearch, openResearch)
      uiEvents.removeAllListeners()
      eventRef.current = null
      game?.destroy(true)
    }
  }, [])

  return (
    <>
      <div ref={containerRef} className="game-canvas" tabIndex={0} role="application" aria-label="슬개기술연구소 게임 화면. WASD 또는 방향키 이동, E 연구 기록 열기" />
      {researchOpen && <ResearchPanel onClose={closeResearch} />}
    </>
  )
}
