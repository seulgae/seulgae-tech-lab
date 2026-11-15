import Phaser from 'phaser'

export default class LabLobbyScene extends Phaser.Scene {
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
  }
}
