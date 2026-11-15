import { useEffect, useRef, useState } from 'react'
import Phaser from 'phaser'
import LabLobbyScene from '../game/scenes/LabLobbyScene'
import { GAME_EVENTS } from '../game/gameEvents'
import ResearchPanel from './ResearchPanel'

export default function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)
  const eventRef = useRef<Phaser.Events.EventEmitter | null>(null)
  const [researchOpen, setResearchOpen] = useState(false)

  const closeResearch = () => {
    eventRef.current?.emit(GAME_EVENTS.closeResearch)
    setResearchOpen(false)
    containerRef.current?.focus({ preventScroll: true })
  }

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let game: Phaser.Game | null = null
    const uiEvents = new Phaser.Events.EventEmitter()
    eventRef.current = uiEvents
    const openResearch = () => setResearchOpen(true)
    uiEvents.on(GAME_EVENTS.openResearch, openResearch)

    // StrictMode의 첫 setup/cleanup에서는 생성 예약만 취소한다.
    const frameId = requestAnimationFrame(() => {
      game = new Phaser.Game({
        type: Phaser.AUTO,
        width: 800,
        height: 600,
        parent: container,
        physics: {
          default: 'arcade',
          arcade: { gravity: { x: 0, y: 0 } },
        },
        scene: [new LabLobbyScene(uiEvents)],
      })
    })

    return () => {
      cancelAnimationFrame(frameId)
      uiEvents.off(GAME_EVENTS.openResearch, openResearch)
      uiEvents.removeAllListeners()
      eventRef.current = null
      game?.destroy(true)
    }
  }, [])

  return (
    <>
      <div ref={containerRef} className="game-canvas" tabIndex={0} aria-label="슬개기술연구소 게임 화면" />
      {researchOpen && <ResearchPanel onClose={closeResearch} />}
    </>
  )
}
