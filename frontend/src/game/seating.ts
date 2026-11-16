import type Phaser from 'phaser'
import type { Seat } from './maps/rooms.ts'

/** 앉은 모습은 의자 방석 위(그림 기준선에서 14px 위)에 그린다. */
const SEAT_LIFT = 14

/**
 * 의자에 앉은 연구원을 의자 위에 그리는 별도 이미지이다.
 * 물리 몸체와 서버 좌표는 의자 뒤에 그대로 두고 겉모습만 의자로 옮긴다.
 *
 * @author seulgae
 * @version 1.0, 의자 앉기 표시
 * @see "None"
 */
export default class SeatView {
  private readonly image: Phaser.GameObjects.Image
  seat?: Seat

  constructor(scene: Phaser.Scene, tint?: number) {
    this.image = scene.add.image(0, 0, 'researcher-sit').setOrigin(0.5, 1).setScale(2).setVisible(false)
    if (tint !== undefined) this.image.setTint(tint)
  }

  /** 앉을 의자를 지정하거나(undefined면 일어남) 현재 표시를 갱신한다. */
  show(seat?: Seat) {
    this.seat = seat
    if (!seat) { this.image.setVisible(false); return }
    this.image.setPosition(seat.x, seat.bottom - SEAT_LIFT).setDepth(seat.bottom + 1).setVisible(true)
  }

  /** 이름표를 둘 위치. 앉았으면 의자 위, 아니면 undefined */
  labelAnchor() { return this.seat ? { x: this.seat.x, y: this.seat.bottom - SEAT_LIFT - 46 } : undefined }

  destroy() { this.image.destroy() }
}
