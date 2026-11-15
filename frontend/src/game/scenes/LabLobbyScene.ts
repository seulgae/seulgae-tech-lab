import Phaser from 'phaser'
import Player from '../Player'
import createLobbyMap from '../LobbyMap'

export default class LabLobbyScene extends Phaser.Scene {
  private player?: Player

  constructor() {
    super('LabLobbyScene')
  }

  create() {
    this.cameras.main.setBackgroundColor('#263238')
    const obstacles = createLobbyMap(this)
    this.add.text(400, 60, 'Seulgae Tech Lab', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '32px',
      color: '#ffffff',
    }).setOrigin(0.5)
    this.player = new Player(this, 400, 400)
    this.physics.add.collider(this.player, obstacles)
  }

  update() {
    this.player?.update()
  }
}
