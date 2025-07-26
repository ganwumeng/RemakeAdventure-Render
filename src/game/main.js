import { Game as MainGame } from './scenes/Game';
import { TitleScene } from './scenes/TitleScene';
import { AUTO, Game, Scale } from 'phaser';

// Find out more information about the Game Config at:
// https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig

// 检测是否为移动端
const isMobile = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           (window.innerWidth <= 768 && window.innerHeight <= 1024);
};

// 设置游戏尺寸 - 移动端使用固定的桌面端尺寸以保持正确的布局
const getGameDimensions = () => {
    if (isMobile()) {
        // 移动端使用固定的桌面端尺寸（常见的桌面分辨率）
        return {
            width: 1366,
            height: 768
        };
    } else {
        // 桌面端使用窗口尺寸
        return {
            width: window.innerWidth,
            height: window.innerHeight
        };
    }
};

const dimensions = getGameDimensions();

const config = {
    type: AUTO,
    width: dimensions.width,
    height: dimensions.height,
    parent: 'game-container',
    backgroundColor: '#028af8',
    scale: {
        mode: isMobile() ? Scale.FIT : Scale.RESIZE,
        autoCenter: Scale.CENTER_BOTH,
        // 移动端全屏优化
        fullscreenTarget: 'game-container'
    },
    // 移动端输入优化
    input: {
        touch: true,
        mouse: true,
        keyboard: true
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
