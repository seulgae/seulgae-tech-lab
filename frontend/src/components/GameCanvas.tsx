import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import LabLobbyScene from '../game/scenes/LabLobbyScene'

export default function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let game: Phaser.Game | null = null

    // StrictMode의 첫 setup/cleanup에서는 생성 예약만 취소한다.
    const frameId = requestAnimationFrame(() => {
      game = new Phaser.Game({
        type: Phaser.AUTO,
        width: 800,
        height: 600,
        parent: container,
        scene: [LabLobbyScene],
      })
    })

    return () => {
      cancelAnimationFrame(frameId)
      game?.destroy(true)
    }
  }, [])

  return <div ref={containerRef} className="game-canvas" aria-label="슬개기술연구소 게임 화면" />
}
