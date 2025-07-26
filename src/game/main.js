import { Game as MainGame } from './scenes/Game';
import { TitleScene } from './scenes/TitleScene';
import { AUTO, Game, Scale } from 'phaser';

// Find out more information about the Game Config at:
// https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
const config = {
    type: AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    parent: 'game-container',
    backgroundColor: '#028af8',
    scale: {
        mode: Scale.RESIZE,
        autoCenter: Scale.CENTER_BOTH
    },
    scene: [
        TitleScene,
        MainGame
    ]
};

const StartGame = (parent) => {
    return new Game({ ...config, parent });
}

export default StartGame;
