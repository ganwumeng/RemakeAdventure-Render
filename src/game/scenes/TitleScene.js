import { Scene } from 'phaser';
import { EventBus } from '../EventBus';
// 1. 导入您的 NPCController
// 请确保路径正确，这里假设它在 'src/controllers/' 目录下
import { NPCController } from '../NPCController.js';

// 2. 创建一个模拟的寻路系统
// 因为标题界面的NPC只是随机移动，不需要复杂的寻路算法。
// 这个模拟系统会直接返回目标点作为路径，满足NPCController的接口要求。
const mockPathfindingSystem = {
    findPath: (startPos, endPos) => [endPos], // 总是返回一条包含终点的直接路径
    isWorldPointBlocked: (x, y) => false, // 假设标题界面没有任何障碍物
};


export class TitleScene extends Scene {
    constructor() {
        super('TitleScene');
    }

    preload() {
        this.load.setPath('assets');

        this.load.image('background', 'bg.png');
        // 新增：加载聊天气泡所需的图片
        this.load.image('chatBubble', 'chat_bubble_seamless.9.png');

        const farmerKeys = ['farmer0', 'farmer1', 'farmer2', 'farmer3'];
        farmerKeys.forEach(key => {
            this.load.spritesheet(key, `${key.replace(' ', '%20')}.png`, {
                frameWidth: 56 / 3,
                frameHeight: 83 / 4
            });
        });
    }

    create() {
        const { width, height } = this.scale;

        this.background = this.add.image(width / 2, height / 2, 'background');
        this.scaleBackgroundToFit();

        this.nightOverlay = this.add.rectangle(0, 0, width, height, 0x000000)
            .setOrigin(0, 0)
            .setAlpha(0.3);

        // 初始化NPC和气泡相关的属性
        this.npcControllers = [];
        this.npcChatBubbles = new Map();
        this.npcBubbleTimers = [];
        this.dialogueDepthCounter = 1000; // 用于确保新气泡总在最上层

        this.createDecorativeNPCs();

        this.createTitle();
        this.createButtons();

        EventBus.emit('current-scene-ready', this);
    }

    update(time, delta) {
        // 每帧更新聊天气泡的位置，使其跟随NPC移动
        this.updateChatBubbles();
    }

    scaleBackgroundToFit() {
        const { width, height } = this.scale;
        const scaleX = width / this.background.width;
        const scaleY = height / this.background.height;
        const scale = Math.max(scaleX, scaleY);
        this.background.setScale(scale);
    }

    createDecorativeNPCs() {
        const { width, height } = this.scale;
        const farmerKeys = ['farmer0', 'farmer1', 'farmer2', 'farmer3'];

        this.createFarmerAnimations();

        // 随机生成8到12个NPC
        const npcCount = Phaser.Math.Between(8, 12);

        for (let i = 0; i < npcCount; i++) {
            // 随机选择一个农民形象
            const randomFarmerKey = Phaser.Math.RND.pick(farmerKeys);
            // 在屏幕下半部分随机选择一个位置
            const pos = {
                x: Phaser.Math.Between(width * 0.1, width * 0.9),
                y: Phaser.Math.Between(height * 0.6, height * 0.9)
            };

            const npc = this.add.sprite(pos.x, pos.y, randomFarmerKey);

            npc.setScale(2.5);
            npc.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
            npc.setOrigin(0.5, 1);
            npc.setDepth(pos.y);

            // 为NPC设置控制器需要的数据
            npc.setData('id', `title_farmer_${i}`);
            npc.setData('spriteKey', randomFarmerKey);

            // 为每个NPC创建一个控制器实例
            const controller = new NPCController(this, npc, mockPathfindingSystem);
            controller.moveSpeed = Phaser.Math.Between(40, 70); // 调整移动速度

            this.npcControllers.push(controller);

            // 启动该NPC的AI闲逛循环
            this.startNpcWander(controller);
            // 启动该NPC的随机表情气泡循环
            this.startNpcEmojiBubbleLoop(npc);
        }
    }

    /**
     * 启动并管理一个NPC的持续闲逛行为
     * @param {NPCController} controller 
     */
    startNpcWander(controller) {
        const wander = () => {
            if (controller.isDestroyed || !controller.npc || !controller.npc.active) {
                return;
            }
            const { width, height } = this.scale;
            const targetX = Phaser.Math.Between(width * 0.1, width * 0.9);
            const targetY = Phaser.Math.Between(height * 0.6, height * 0.9);

            controller.moveTo(targetX, targetY, () => {
                const idleTime = Phaser.Math.Between(3000, 7000); // 增加闲逛等待时间
                this.time.delayedCall(idleTime, wander, [], this);
            });
        };
        wander();
    }

    /**
     * 启动NPC的随机表情气泡循环
     * @param {Phaser.GameObjects.Sprite} npc
     */
    startNpcEmojiBubbleLoop(npc) {
        const timer = this.time.addEvent({
            delay: Phaser.Math.Between(5000, 15000), // 5到15秒随机延迟
            callback: () => {
                // 再次随机化下一次的延迟
                timer.delay = Phaser.Math.Between(5000, 15000);
                this.showRandomEmojiBubble(npc);
            },
            callbackScope: this,
            loop: true
        });
        // 存储计时器以便后续清理
        this.npcBubbleTimers.push(timer);
    }

    /**
     * 为指定的NPC显示一个随机的表情符号气泡
     * @param {Phaser.GameObjects.Sprite} npc
     */
    showRandomEmojiBubble(npc) {
        if (!npc || !npc.active) return;

        const emojis = ['😊', '😂', '😭', '🥳'];
        const randomEmoji = Phaser.Math.RND.pick(emojis);

        // 显示气泡，持续2秒
        this.showChatBubble(npc, randomEmoji, 2000);
    }

    /**
     * 在指定的NPC头顶显示一个聊天气泡
     * @param {Phaser.GameObjects.Sprite} npc - 目标NPC
     * @param {string} message - 要显示的消息
     * @param {number} [duration=2000] - 气泡显示的毫秒数
     */
    showChatBubble(npc, message, duration = 2000) {
        const npcId = npc.getData('id');
        if (!npcId) return;

        this.hideChatBubble(npcId); // 确保移除该NPC的旧气泡

        // 表情符号使用较大的字体
        const chatText = this.add.text(0, 0, message, {
            fontSize: '24px',
            fill: '#000',
            fontFamily: 'sans-serif', // 使用通用字体以确保表情符号正确显示
            padding: { x: 4, y: 4 },
            align: 'center',
        }).setOrigin(0.5, 0.5);

        const textWidth = Math.max(chatText.width + 24, 50);
        const textHeight = Math.max(chatText.height + 20, 40);
        const chatBubble = this.add.nineslice(0, 0, 'chatBubble', null, textWidth, textHeight, 8, 8, 8, 8).setOrigin(0.5, 1);
        chatBubble.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);

        // 使用深度计数器解决遮挡问题
        chatBubble.setDepth(this.dialogueDepthCounter);
        chatText.setDepth(this.dialogueDepthCounter + 1);
        this.dialogueDepthCounter += 2;

        this.npcChatBubbles.set(npcId, { bubble: chatBubble, text: chatText });
        this.updateChatBubbles(); // 立即更新一次位置

        this.time.delayedCall(duration, () => this.hideChatBubble(npcId));
    }

    /**
     * 隐藏并销毁指定NPC的聊天气泡
     * @param {string} npcId 
     */
    hideChatBubble(npcId) {
        const bubbleData = this.npcChatBubbles.get(npcId);
        if (bubbleData) {
            if (bubbleData.bubble?.active) bubbleData.bubble.destroy();
            if (bubbleData.text?.active) bubbleData.text.destroy();
            this.npcChatBubbles.delete(npcId);
        }
    }

    /**
     * 在每帧更新所有聊天气泡的位置
     */
    updateChatBubbles() {
        this.npcChatBubbles.forEach((bubbleData, npcId) => {
            const controller = this.npcControllers.find(c => c.npc && c.npc.getData('id') === npcId);
            if (controller && controller.npc.active) {
                const npc = controller.npc;
                const bubbleX = npc.x;
                const bubbleY = npc.y - npc.displayHeight - 10; // 在头顶上方留出一些空隙
                bubbleData.bubble.setPosition(bubbleX, bubbleY);
                bubbleData.text.setPosition(bubbleX, bubbleData.bubble.y - bubbleData.bubble.height / 2);
            }
        });
    }

    createFarmerAnimations() {
        const farmerKeys = ['farmer0', 'farmer1', 'farmer2', 'farmer3'];
        farmerKeys.forEach(farmerKey => {
            if (!this.anims.exists(`${farmerKey}_walk`)) {
                this.anims.create({
                    key: `${farmerKey}_walk`,
                    frames: this.anims.generateFrameNumbers(farmerKey, { start: 0, end: 5 }),
                    frameRate: 8,
                    repeat: -1
                });
            }
            if (!this.anims.exists(`${farmerKey}_idle`)) {
                this.anims.create({
                    key: `${farmerKey}_idle`,
                    frames: this.anims.generateFrameNumbers(farmerKey, { start: 6, end: 7 }),
                    frameRate: 2,
                    repeat: -1
                });
            }
        });
    }

    createTitle() {
        const { width, height } = this.scale;

        this.titleText = this.add.text(width / 2, height * 0.25, 'Remake Adventure X', {
            fontSize: '72px',
            fontFamily: 'FusionPixel',
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4,
            resolution: 4
        }).setOrigin(0.5, 0.5).setDepth(100);

        this.titleGlow = this.add.text(width / 2, height * 0.25, 'Remake Adventure X', {
            fontSize: '74px',
            fontFamily: 'FusionPixel',
            fill: '#ffff00',
            resolution: 4
        }).setOrigin(0.5, 0.5).setDepth(99).setAlpha(0.3);

        this.tweens.add({
            targets: [this.titleText, this.titleGlow],
            scaleX: 1.05,
            scaleY: 1.05,
            duration: 2000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

    createButtons() {
        const { width, height } = this.scale;
        const buttonY = height * 0.6;
        const buttonSpacing = 80;

        const buttons = [
            { text: '启动', key: 'start-with-llm' },
            { text: '启动（无大模型）', key: 'start-without-llm' },
            { text: '关于', key: 'about' }
        ];

        this.buttons = [];

        buttons.forEach((buttonConfig, index) => {
            const y = buttonY + (index * buttonSpacing);
            const buttonBg = this.add.rectangle(width / 2, y, 300, 60, 0x333333)
                .setStrokeStyle(2, 0xffffff)
                .setDepth(50);
            const buttonText = this.add.text(width / 2, y, buttonConfig.text, {
                fontSize: '24px',
                fontFamily: 'FusionPixel',
                fill: '#ffffff',
                resolution: 4
            }).setOrigin(0.5, 0.5).setDepth(51);

            buttonBg.setInteractive({ useHandCursor: true });

            buttonBg.on('pointerover', () => {
                buttonBg.setFillStyle(0x555555);
                buttonText.setScale(1.1);
            });
            buttonBg.on('pointerout', () => {
                buttonBg.setFillStyle(0x333333);
                buttonText.setScale(1);
            });
            buttonBg.on('pointerdown', () => {
                this.handleButtonClick(buttonConfig.key);
            });

            this.buttons.push({ bg: buttonBg, text: buttonText });
        });
    }

    handleButtonClick(buttonKey) {
        // 在切换场景前，销毁所有NPC控制器和相关资源
        this.cleanupNPCsAndTimers();

        switch (buttonKey) {
            case 'start-with-llm':
                EventBus.emit('title-start-game', { useLLM: true });
                break;
            case 'start-without-llm':
                EventBus.emit('title-start-game', { useLLM: false });
                break;
            case 'about':
                EventBus.emit('title-show-about');
                break;
        }
    }

    /**
     * 清理所有NPC、控制器、气泡和计时器
     */
    cleanupNPCsAndTimers() {
        // 销毁所有NPC控制器，这也会销毁其控制的NPC精灵
        this.npcControllers.forEach(controller => controller.destroy());
        this.npcControllers = [];

        // 停止并销毁所有气泡计时器
        this.npcBubbleTimers.forEach(timer => timer.destroy());
        this.npcBubbleTimers = [];

        // 销毁所有当前显示的气泡
        this.npcChatBubbles.forEach(bubbleData => {
            if (bubbleData.bubble?.active) bubbleData.bubble.destroy();
            if (bubbleData.text?.active) bubbleData.text.destroy();
        });
        this.npcChatBubbles.clear();
    }

    shutdown() {
        console.log('标题场景正在关闭...');
        // 确保在场景关闭时也清理所有资源
        this.cleanupNPCsAndTimers();
        this.scale.off('resize', this.handleResize, this);
    }
}
