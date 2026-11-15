import Phaser from 'phaser'
import Player from '../Player'

export default class LabLobbyScene extends Phaser.Scene {
  private player?: Player

  constructor() {
    super('LabLobbyScene')
  }

  create() {
    this.cameras.main.setBackgroundColor('#263238')
    this.add.rectangle(400, 300, 100, 100, 0x4caf50)
    this.add.text(400, 60, 'Seulgae Tech Lab', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '32px',
      color: '#ffffff',
    }).setOrigin(0.5)
    this.player = new Player(this, 400, 400)
  }

  update(_time: number, delta: number) {
    this.player?.update(delta)
  }
}
