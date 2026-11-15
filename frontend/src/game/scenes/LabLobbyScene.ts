import Phaser from 'phaser'
import Player from '../Player'
import createLobbyMap, { COMPUTER } from '../LobbyMap'
import { RESEARCH_EVENTS } from '../../features/research/researchEvents'
import { isNearObject } from '../interaction'

export default class LabLobbyScene extends Phaser.Scene {
  private player?: Player
  private interactionHint?: Phaser.GameObjects.Text
  private interactKey?: Phaser.Input.Keyboard.Key
  private researchOpen = false
  private readonly uiEvents: Phaser.Events.EventEmitter

  private readonly closeResearch = () => {
    this.researchOpen = false
  }

  constructor(uiEvents: Phaser.Events.EventEmitter) {
    super('LabLobbyScene')
    this.uiEvents = uiEvents
  }

  create() {
    this.researchOpen = false
    this.cameras.main.setBackgroundColor('#263238')
    const obstacles = createLobbyMap(this)
    this.add.text(400, 60, 'Seulgae Tech Lab', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '32px',
      color: '#ffffff',
    }).setOrigin(0.5)
    this.player = new Player(this, 400, 400)
    this.physics.add.collider(this.player, obstacles)
    this.interactKey = this.input.keyboard?.addKey('E')
    this.interactionHint = this.add.text(COMPUTER.x, COMPUTER.y - 82, 'E · 상호작용', {
      fontFamily: 'Arial, sans-serif', fontSize: '16px', color: '#ffffff',
      backgroundColor: '#101c22', padding: { x: 10, y: 6 },
    }).setOrigin(0.5).setVisible(false)

    this.uiEvents.on(RESEARCH_EVENTS.closeResearch, this.closeResearch)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.uiEvents.off(RESEARCH_EVENTS.closeResearch, this.closeResearch)
    })
  }

  update() {
    if (!this.player) return

    this.player.update(!this.researchOpen)
    const nearby = isNearObject(this.player.x, this.player.y, COMPUTER, 56)
    this.interactionHint?.setVisible(nearby && !this.researchOpen)

    // 범위 밖과 패널 표시 중에도 소비해, 누르고 있던 E가 나중에 실행되지 않게 한다.
    const pressed = this.interactKey && Phaser.Input.Keyboard.JustDown(this.interactKey)
    if (pressed && nearby && !this.researchOpen) {
      this.researchOpen = true
      this.player.update(false)
      this.interactionHint?.setVisible(false)
      this.uiEvents.emit(RESEARCH_EVENTS.openResearch)
    }
  }
}
