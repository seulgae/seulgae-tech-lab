import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { joystickInput } from '../game/input/mobileInput'
import type { DirectionInput } from '../game/input/mobileInput'
import './MobileControls.css'

type Props = { disabled: boolean; resetToken: number; onMove: (input: DirectionInput) => void; onInteract: () => void }

/**
 * 하단 8방향 조이스틱과 상호작용 버튼을 제공하고 터치 종료·취소 시 입력을 해제한다.
 * @author seulgae
 * @version 1.0, 포인터 캡처와 화면 전환에 안전한 모바일 조작
 * @see "None"
 * @param props 입력 잠금·초기화와 게임에 전달할 이동 및 상호작용 콜백
 * @returns 모바일 하단 조작 영역
 */
export default function MobileControls({ disabled, resetToken, onMove, onInteract }: Props) {
  const pad = useRef<HTMLButtonElement>(null)
  const pointer = useRef<number | null>(null)
  const [offset, setOffset] = useState({ x: 0, y: 0, active: false })

  /** 입력을 먼저 비운 뒤 캡처를 해제해 lostpointercapture의 중복 종료를 피한다. */
  const reset = useCallback(() => {
    const id = pointer.current
    pointer.current = null
    if (id !== null && pad.current?.hasPointerCapture(id)) pad.current.releasePointerCapture(id)
    setOffset({ x: 0, y: 0, active: false }); onMove({ x: 0, y: 0 })
  }, [onMove])

  useEffect(() => {
    // 입력 잠금 전환은 외부 게임 상태와 동기화하고 진행 중인 제스처를 취소한다.
    const frame = requestAnimationFrame(reset)
    return () => cancelAnimationFrame(frame)
  }, [disabled, resetToken, reset])
  useEffect(() => {
    const element = pad.current
    const hidden = () => { if (document.hidden) reset() }
    window.addEventListener('blur', reset)
    window.addEventListener('resize', reset)
    document.addEventListener('visibilitychange', hidden)
    return () => {
      window.removeEventListener('blur', reset)
      window.removeEventListener('resize', reset)
      document.removeEventListener('visibilitychange', hidden)
      const id = pointer.current
      pointer.current = null
      if (id !== null && element?.hasPointerCapture(id)) element.releasePointerCapture(id)
      onMove({ x: 0, y: 0 })
    }
  }, [reset, onMove])

  /** 패드 밖으로 드래그해도 캡처한 한 손가락만 현재 방향을 갱신한다. */
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    if (disabled || pointer.current !== event.pointerId) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const value = joystickInput(event.clientX - bounds.left - bounds.width / 2,
      event.clientY - bounds.top - bounds.height / 2, bounds.width * 0.3)
    setOffset({ ...value.offset, active: true }); onMove(value.direction)
  }
  const finish = (event: PointerEvent<HTMLButtonElement>) => { if (pointer.current === event.pointerId) reset() }

  return <div className="mobile-controls" role="group" aria-label="모바일 게임 조작">
    <div className="mobile-stick-wrap">
      <button ref={pad} type="button" className={`mobile-stick${offset.active && !disabled ? ' is-active' : ''}`}
        disabled={disabled} aria-label="이동 조이스틱" aria-describedby="mobile-movement-help"
        onContextMenu={event => event.preventDefault()}
        onPointerDown={event => {
          if (disabled || pointer.current !== null || event.button !== 0) return
          event.preventDefault(); pointer.current = event.pointerId
          event.currentTarget.setPointerCapture(event.pointerId); move(event)
        }} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish}>
        <span className="stick-arrow is-up" aria-hidden="true">↑</span>
        <span className="stick-arrow is-left" aria-hidden="true">←</span>
        <span className="stick-arrow is-right" aria-hidden="true">→</span>
        <span className="stick-arrow is-down" aria-hidden="true">↓</span>
        <span className="stick-knob" aria-hidden="true" style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}><i /></span>
      </button>
      <span id="mobile-movement-help">드래그해서 이동</span>
    </div>
    <button type="button" className="mobile-interact" disabled={disabled} aria-label="E 상호작용"
      onClick={onInteract}><span aria-hidden="true">E</span><small>상호작용</small></button>
  </div>
}
