import { Scene } from 'phaser';
import { EventBus } from '../EventBus';
import { PathfindingSystem } from '../PathfindingSystem';
import { NPCController } from '../NPCController';
import { DialogueSystem } from '../DialogueSystem.js';
import { streamMessage, createDialogueConversation, isLLMLoaded } from '../llm/runner.js';
// 导入 JSZip。请确保在 index.html 中已添加 JSZip 脚本
// 例如：<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
import JSZip from 'jszip';

const PLAYER_SPEED = 200;
const INTERACTION_DISTANCE = 50;

export class Game extends Scene {
    constructor() {
        super('Game');
        this.dialogueSystem = null;
    }

    init(data) {
        this.events.on('shutdown', this.shutdown, this);
        // 从 App.jsx 接收 remake 数据 (zip 文件 blob/arraybuffer)
        this.remakeData = data?.remakeData || null;
    }

    // 将 preload 改为异步函数以处理 zip 文件解压
    async preload() {
        // --- 标准资源加载 ---
        this.load.setPath('assets');
        this.load.image('background', 'bg.png');
        this.load.image('desk', 'desk.png');
        this.load.image('box', 'box.png');
        this.load.image('chatBubble', 'chat_bubble_seamless.9.png');
        this.load.image('phone', 'phone.png');
        this.load.image('laptop', 'laptop.png');

        const farmerKeys = ['farmer0', 'farmer1', 'farmer2', 'farmer3'];
        farmerKeys.forEach(key => {
            this.load.spritesheet(key, `${key.replace(' ', '%20')}.png`, {
                frameWidth: 56 / 3,
                frameHeight: 83 / 4
            });
        });

        // --- 从 .remake (zip) 文件条件性加载数据 ---
        if (this.remakeData) {
            console.log("发现 Remake 数据，正在尝试处理 zip 文件...");
            try {
                // 使用 JSZip 加载 zip 文件内容
                const zip = await JSZip.loadAsync(this.remakeData);
                
                // 定义我们期望在 zip 中找到的 JSON 文件
                const requiredFiles = ['sceneObjects.json', 'dialogue.json', 'members.json'];

                for (const fileName of requiredFiles) {
                    const file = zip.file(fileName);
                    if (file) {
                        // 将文件内容作为字符串获取
                        const content = await file.async('string');
                        // 将字符串解析为 JSON 对象
                        const jsonData = JSON.parse(content);
                        // 使用不带扩展名的文件名作为键，将解析后的 JSON 添加到 Phaser 的缓存中
                        const cacheKey = fileName.replace('.json', '');
                        this.cache.json.add(cacheKey, jsonData);
                        console.log(`成功加载并缓存 ${fileName} 为 '${cacheKey}'.`);
                    } else {
                        console.error(`错误: 在提供的 .remake 文件中未找到 ${fileName}。`);
                    }
                }
            } catch (error) {
                console.error("加载或解析 .remake zip 文件失败:", error);
                // 这里可以添加后备或错误处理逻辑
            }
        } else {
            console.log("未提供 Remake 数据。正在加载默认文件 (如果有)。");
            // 如果在没有提供 remake 文件时需要加载默认 JSON 文件，
            // 你可以在这里加载它们。例如：
            // this.load.json('sceneObjects', 'data/sceneObjects.json');
            // this.load.json('dialogue', 'data/dialogue.json');
            // this.load.json('members', 'data/members.json');
        }
    }


    create() {
        const { width, height } = this.scale;

        this.background = this.add.image(width / 2, height / 2, 'background');
        this.scaleBackgroundToFit();
        this.loadAndCreateDesks();
        this.loadAndCreateBoxes();
        this.createFarmerAnimations();

        // NPC 和寻路系统设置
        this.prepareNPCs();
        this.initializePathfinding();
        this.laptops = this.add.group(); // 新增：创建笔记本电脑组

        this.setPlayerStartPosition();
        this.player = this.add.sprite(this.playerStartX, this.playerStartY, 'farmer0');
        this.player.setScale(2.5).texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
        this.player.setOrigin(0.5, 1).play('farmer0_idle');

        this.nightOverlay = this.add.rectangle(0, 0, width, height, 0x000000)
            .setOrigin(0, 0)
            .setDepth(199)
            .setAlpha(0);

        // 输入和UI设置
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys('W,S,A,D');
        this.debugKeys = this.input.keyboard.addKeys('G');
        this.interactKey = this.input.keyboard.addKey('E');
        this.input.on('pointerdown', this.handleMouseClick, this);
        this.scale.on('resize', this.handleResize, this);
        this.originDebugGraphics = this.add.graphics({ z: 200 });
        this.mouseCoordsText = this.add.text(width - 10, 10, 'Click for Coords', {
            fontSize: '16px', fontFamily: 'FusionPixel', fill: '#ffffff', backgroundColor: 'rgba(0,0,0,0.5)', padding: { x: 5, y: 3 }
        }).setOrigin(1, 0).setDepth(300);
        this.phoneIcon = this.add.image(10, 10, 'phone').setOrigin(0, 0).setDepth(250);
        this.phoneNumberText = this.add.text(this.phoneIcon.x + 125, this.phoneIcon.y + 68, '', {
            fontSize: '48px', fill: '#ffffff', fontFamily: 'FusionPixel', fontStyle: 'bold', stroke: '#000000', strokeThickness: 1, resolution: 2
        }).setOrigin(0.5, 0.5).setDepth(251);
        this.playerChatBubble = null;
        this.dialogueDepthCounter = 1000;

        // --- 对话系统设置 (已修改) ---
        this.initializeDialogueSystem();

        // --- LLM对话系统设置 ---
        this.isInLLMDialogue = false;
        this.currentDialogueNPC = null;
        this.dialogueInputElement = null;
        this.llmPreloadCache = new Map(); // 预加载缓存

        // --- 系统启动 ---
        this.initTimeSystem();

        EventBus.emit('current-scene-ready', this);
    }

    /**
     * [新增] 初始化对话系统，包含等待数据加载的逻辑。
     */
    initializeDialogueSystem() {
        // [新增] 关键防御代码：如果场景已经不在运行状态（例如被React销毁重建），
        // 则立即停止后续初始化，防止在无效的场景上调用 this.time 等属性而报错。
        if (!this.sys.isActive()) {
            console.log("场景已关闭，中断 DialogueSystem 初始化。");
            return;
        }

        // 检查 'dialogue' JSON 数据是否已加载到缓存中。
        // 这是解决异步加载（例如从zip文件）可能比 `create` 方法的执行晚完成的关键。
        if (!this.cache.json.get('dialogue')) {
            // 如果数据尚未准备好，则短暂延迟后重试此方法。
            // 这种轮询机制确保我们不会在数据可用前继续。
            console.log("正在等待对话数据加载...");
            this.time.delayedCall(100, this.initializeDialogueSystem, [], this);
            return;
        }

        // 同样，确保 `prepareNPCs` 方法已经成功执行并生成了 `allNpcData`。
        // `DialogueSystem.init` 方法依赖此数据。
        if (!this.allNpcData) {
            console.log("正在等待NPC数据准备...");
            this.time.delayedCall(100, this.initializeDialogueSystem, [], this);
            return;
        }

        // 只有当所有必需数据都准备好时，才创建和初始化 DialogueSystem。
        console.log("对话数据已加载，正在初始化 DialogueSystem...");
        this.dialogueSystem = new DialogueSystem(this);
        this.dialogueSystem.init(this.allNpcData);
    }

    update(time, delta) {
        // 如果在LLM对话中，暂停游戏逻辑
        if (!this.isInLLMDialogue) {
            this.handlePlayerMovement(delta);
            this.updateNPCControllers();
            this.checkNearbyNPCsForPreload();
            
            // [恢复] 在主循环中更新对话系统，使其可以被暂停
            if (this.dialogueSystem) {
                this.dialogueSystem.update();
            }
        }

        this.updateAllChatBubbles();
        this.visualizeOrigins();

        if (Phaser.Input.Keyboard.JustDown(this.debugKeys.G)) {
            this.togglePathfindingGrid();
        }

        // 检测E键交互
        if (Phaser.Input.Keyboard.JustDown(this.interactKey) && !this.isInLLMDialogue) {
            this.checkNPCInteraction();
        }
    }

    checkNearbyNPCsForPreload() {
        if (!this.player || !this.npcFarmers || !isLLMLoaded()) return;

        const PRELOAD_DISTANCE = INTERACTION_DISTANCE * 2; // 在交互距离的2倍范围内预加载

        this.npcFarmers.children.entries.forEach(npc => {
            if (!npc.active) return;

            const distance = Phaser.Math.Distance.Between(
                this.player.x, this.player.y,
                npc.x, npc.y
            );

            if (distance <= PRELOAD_DISTANCE) {
                this.preloadNPCDialogue(npc);
            }
        });
    }

    // --- NPC 调度系统 ---

    prepareNPCs() {
        if (!this.desks || !this.cache.json.get('members')) {
            this.time.delayedCall(100, this.prepareNPCs, [], this);
            return;
        }

        this.allNpcData = [];
        this.npcFarmers = this.add.group();
        this.farmerChatBubbles = new Map();

        const membersData = this.cache.json.get('members');
        const farmerKeys = ['farmer0', 'farmer1', 'farmer2', 'farmer3'];
        let npcIdCounter = 0;

        const availableDesks = [...this.desks.children.entries];
        Phaser.Math.RND.shuffle(availableDesks);

        for (const team of membersData) {
            if (availableDesks.length === 0) break;
            const assignedDesk = availableDesks.pop();
            const deskBounds = assignedDesk.getBounds();
            const offsetX = 20;
            const offsetY = 30;
            const spawnPoints = [
                { x: deskBounds.left - offsetX, y: deskBounds.top + offsetY + 20, faceLeft: false },
                { x: deskBounds.left - offsetX, y: deskBounds.bottom - offsetY + 20, faceLeft: false },
                { x: deskBounds.right + offsetX, y: deskBounds.top + offsetY + 20, faceLeft: true },
                { x: deskBounds.right + offsetX, y: deskBounds.bottom - offsetY + 20, faceLeft: true }
            ];
            Phaser.Math.RND.shuffle(spawnPoints);

            for (const member of team.member) {
                if (spawnPoints.length === 0) break;
                const assignedPoint = spawnPoints.pop();
                const randomSpriteKey = Phaser.Math.RND.pick(farmerKeys);
                this.allNpcData.push({
                    id: `npc_${npcIdCounter++}`,
                    teamId: team.team_id,
                    memberId: member.id,
                    memberType: member.type,
                    memberIntro: member.introduction,
                    spriteKey: randomSpriteKey,
                    deskPos: { x: assignedPoint.x, y: assignedPoint.y },
                    faceLeft: assignedPoint.faceLeft,
                    state: 'inactive'
                });
            }
        }
        console.log(`根据 members.json 准备了 ${this.allNpcData.length} 个NPC, 分布在 ${membersData.length} 个队伍中。`);
    }

    spawnAndMoveNpc() {
        const inactiveNpcs = this.allNpcData.filter(npc => npc.state === 'inactive');
        if (inactiveNpcs.length === 0) return;

        const npcData = Phaser.Math.RND.pick(inactiveNpcs);
        npcData.state = 'arriving';
        const entryPoint = { x: this.scale.width / 2, y: 194 };
        const farmer = this.add.sprite(entryPoint.x, entryPoint.y, npcData.spriteKey);
        farmer.setScale(2.5).texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
        farmer.setOrigin(0.5, 1);
        farmer.setData('id', npcData.id);
        farmer.setData('spriteKey', npcData.spriteKey);
        this.npcFarmers.add(farmer);

        const controller = new NPCController(this, farmer, this.pathfindingSystem);
        this.npcControllers.set(npcData.id, controller);

        controller.moveTo(npcData.deskPos.x, npcData.deskPos.y, () => {
            npcData.state = 'working';
            farmer.play(`${npcData.spriteKey}_idle`);
            if (npcData.faceLeft) farmer.setFlipX(true);
            else farmer.setFlipX(false);

            this.addLaptopForNpc(farmer, npcData); // 新增：添加笔记本电脑

            // [新增] 当NPC到达工位后，检查是否可以开始团队对话
            if (this.dialogueSystem) {
                this.dialogueSystem.tryStartTeamConversation(npcData.teamId);
            }
        });
    }

    makeOneNpcLeave(npcData = null) {
        if (!npcData) {
            const workingNpcs = this.allNpcData.filter(npc => npc.state === 'working');
            if (workingNpcs.length === 0) return;
            npcData = Phaser.Math.RND.pick(workingNpcs);
        }

        if (npcData.state !== 'working') {
            return;
        }

        npcData.state = 'leaving';
        const controller = this.npcControllers.get(npcData.id);

        if (controller && !controller.isDestroyed) {
            this.removeLaptopForNpc(controller.npc); // 新增：移除笔记本电脑
            const exitPoint = { x: 731, y: 194 };
            controller.moveTo(exitPoint.x, exitPoint.y, () => this.cleanupNpc(npcData.id));
        } else {
            this.cleanupNpc(npcData.id);
        }
    }

    makeAllRemainingNpcsLeave() {
        const activeNpcs = this.allNpcData.filter(npc => npc.state === 'working' || npc.state === 'arriving');
        if (activeNpcs.length === 0) {
            this.resetAllNpcs();
            return;
        }

        console.log(`[Time System] 强制清理时间。命令所有 ${activeNpcs.length} 个剩余NPC离开。`);

        for (const npcData of activeNpcs) {
            if (npcData.state !== 'leaving') {
                this.makeOneNpcLeave(npcData);
            }
        }
    }

    cleanupNpc(npcId) {
        const npcData = this.allNpcData.find(d => d.id === npcId);
        if (npcData) npcData.state = 'inactive';

        const controller = this.npcControllers.get(npcId);
        if (controller) {
            if (controller.npc) {
                this.removeLaptopForNpc(controller.npc); // 新增：清理笔记本电脑（保险措施）
                controller.npc.destroy();
            }
            controller.destroy();
            this.npcControllers.delete(npcId);
        }

        const activeNpcs = this.allNpcData.some(npc => npc.state !== 'inactive');
        if (!activeNpcs) {
            console.log("所有NPC都已离开场景。系统为新的一天重置。");
            this.npcControllers.forEach(c => c.destroy());
            this.npcControllers.clear();
        }
    }

    resetAllNpcs() {
        console.log("执行硬重置：将所有NPC状态设为 'inactive' 并清理控制器。");
        this.allNpcData.forEach(npc => npc.state = 'inactive');
        this.npcControllers.forEach(controller => controller.destroy());
        this.npcControllers.clear();
        this.npcFarmers.clear(true, true);
        this.laptops.clear(true, true); // 新增：清空所有笔记本电脑
    }


    // --- 新增：笔记本电脑管理 ---

    /**
     * 在NPC到达工位时为其添加一台笔记本电脑。
     * @param {Phaser.GameObjects.Sprite} npc - NPC精灵对象。
     * @param {object} npcData - NPC的数据对象。
     */
    addLaptopForNpc(npc, npcData) {
        if (!npc || !npcData) return;

        // 笔记本电脑应放置在NPC面前，基于其朝向。
        // 这个位置应该看起来像是在附近的桌子上。
        const laptopOffsetX = npcData.faceLeft ? -43 : 43; // 调整：距NPC中心的水平偏移增加8像素
        const laptopOffsetY = -25; // 距NPC脚部(origin y=1)的垂直偏移

        const laptopX = npc.x + laptopOffsetX;
        const laptopY = npc.y + laptopOffsetY;

        const laptop = this.laptops.create(laptopX, laptopY, 'laptop');
        laptop.setScale(1.2).setOrigin(0.5, 1);
        laptop.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);

        // 调整：根据NPC朝向翻转笔记本电脑
        // 如果NPC朝右 (faceLeft=false)，则翻转笔记本 (setFlipX=true)，使其朝左。
        // 如果NPC朝左 (faceLeft=true)，则不翻转笔记本 (setFlipX=false)，使其朝右。
        laptop.setFlipX(!npcData.faceLeft);

        // 根据Y坐标设置深度，以保证与其他对象的正确渲染顺序
        laptop.setDepth(laptopY);

        // 将笔记本电脑与NPC关联，以便之后轻松移除
        npc.setData('laptop', laptop);
    }

    /**
     * 为离开的NPC移除笔记本电脑。
     * @param {Phaser.GameObjects.Sprite} npc - NPC精灵对象。
     */
    removeLaptopForNpc(npc) {
        if (!npc) return;
        const laptop = npc.getData('laptop');
        if (laptop) {
            // 从组中移除并销毁游戏对象
            this.laptops.remove(laptop, true, true);
            // 清除NPC上的数据
            npc.setData('laptop', null);
        }
    }


    // --- 时间系统 ---

    initTimeSystem() {
        this.gameTime = { hours: 6, minutes: 0 };
        this.updateClockDisplay();
        this.gameTimeEvent = this.time.addEvent({
            delay: 100,
            callback: this.advanceGameTime,
            callbackScope: this,
            loop: true
        });
    }

    advanceGameTime() {
        this.gameTime.minutes += 1;
        if (this.gameTime.minutes >= 60) {
            this.gameTime.hours += Math.floor(this.gameTime.minutes / 60);
            this.gameTime.minutes %= 60;
            if (this.gameTime.hours >= 24) this.gameTime.hours %= 24;
        }
        this.updateClockDisplay();

        const currentHour = this.gameTime.hours;
        this.nightOverlay.setAlpha((currentHour >= 0 && currentHour < 6) ? 0.5 : 0);

        const { hours, minutes } = this.gameTime;
        const totalNpcs = this.allNpcData.length;

        if (hours >= 6 && hours < 11) {
            const inactiveNpcs = this.allNpcData.filter(n => n.state === 'inactive');
            if (inactiveNpcs.length > 0) {
                const elapsedWindowMinutes = (hours - 6) * 60 + minutes;
                const totalWindowMinutes = 5 * 60;
                const arrivalKeyframes = [
                    { time: 0, percent: 0 }, { time: 60, percent: 0.05 }, { time: 120, percent: 0.15 },
                    { time: 180, percent: 0.40 }, { time: 240, percent: 0.80 }, { time: 300, percent: 1.00 }
                ];
                let progress = 0;
                if (elapsedWindowMinutes >= totalWindowMinutes) progress = 1.0;
                else {
                    let startFrame, endFrame;
                    for (let i = 0; i < arrivalKeyframes.length - 1; i++) {
                        if (elapsedWindowMinutes >= arrivalKeyframes[i].time && elapsedWindowMinutes < arrivalKeyframes[i + 1].time) {
                            startFrame = arrivalKeyframes[i]; endFrame = arrivalKeyframes[i + 1]; break;
                        }
                    }
                    if (startFrame && endFrame) {
                        const segmentDuration = endFrame.time - startFrame.time;
                        const timeIntoSegment = elapsedWindowMinutes - startFrame.time;
                        progress = startFrame.percent + ((timeIntoSegment / segmentDuration) * (endFrame.percent - startFrame.percent));
                    }
                }
                const targetArrivedCount = Math.ceil(progress * totalNpcs);
                const currentArrivedCount = totalNpcs - inactiveNpcs.length;
                const deficit = targetArrivedCount - currentArrivedCount;
                if (deficit > 0) for (let i = 0; i < Math.min(deficit, inactiveNpcs.length); i++) this.spawnAndMoveNpc();
            }
        }

        const workingNpcs = this.allNpcData.filter(n => n.state === 'working');
        if (workingNpcs.length > 0 && (hours >= 22 || hours < 4)) {
            let minutesUntil4AM;
            if (hours >= 22) {
                minutesUntil4AM = ((24 - hours) * 60) - minutes + (4 * 60);
            } else { 
                minutesUntil4AM = ((4 - hours) * 60) - minutes;
            }

            const remainingTicks = Math.max(1, minutesUntil4AM);
            const leaveProbability = 1 / remainingTicks;

            for (const npc of workingNpcs) {
                if (Math.random() < leaveProbability) {
                    this.makeOneNpcLeave(npc);
                }
            }
        }
    }

    updateClockDisplay() {
        if (!this.phoneNumberText) return;
        const hours = String(this.gameTime.hours).padStart(2, '0');
        const minutes = String(this.gameTime.minutes).padStart(2, '0');
        this.phoneNumberText.setText(`${hours}:${minutes}`);
    }


    // --- 核心逻辑和生命周期 ---

    shutdown() {
        console.log('游戏场景正在关闭...');
        if (this.gameTimeEvent) this.gameTimeEvent.destroy();
        if (this.pathfindingSystem) this.pathfindingSystem.destroy();
        if (this.npcControllers) {
            this.npcControllers.forEach(controller => controller.destroy());
            this.npcControllers.clear();
        }
        if (this.dialogueSystem) {
            this.dialogueSystem.destroy();
        }
        this.endLLMDialogue();
    }

    initializePathfinding() {
        this.pathfindingSystem = new PathfindingSystem(this);
        this.pathfindingSystem.initializeGrid();
        this.npcControllers = new Map();
    }

    updateNPCControllers() {
        if (this.npcControllers) {
            this.npcControllers.forEach(c => {
                if (c && !c.isDestroyed && c.sprite && c.sprite.active) {
                    c.update();
                    c.sprite.setDepth(c.sprite.y);
                }
            });
        }
    }

    handleMouseClick(pointer) {
        this.mouseCoordsText.setText(`Mouse Coords: (${Math.round(pointer.x)}, ${Math.round(pointer.y)})`);
    }

    // --- 辅助函数 ---

    visualizeOrigins() {
        this.originDebugGraphics.clear();
        this.originDebugGraphics.fillStyle(0xff00ff, 0.8);
        if (this.player && this.player.active) {
            this.originDebugGraphics.fillCircle(this.player.x, this.player.y, 3);
        }
        if (this.npcFarmers) {
            this.npcFarmers.children.entries.forEach(farmer => {
                if (farmer.active) this.originDebugGraphics.fillCircle(farmer.x, farmer.y, 3);
            });
        }
    }

    togglePathfindingGrid() {
        if (this.pathfindingSystem) this.pathfindingSystem.toggleVisualization();
    }

    handlePlayerMovement(delta) {
        if (!this.player || !this.player.active) return;
        let velocityX = 0, velocityY = 0;
        if (this.cursors.left.isDown || this.wasd.A.isDown) velocityX = -1;
        else if (this.cursors.right.isDown || this.wasd.D.isDown) velocityX = 1;
        if (this.cursors.up.isDown || this.wasd.W.isDown) velocityY = -1;
        else if (this.cursors.down.isDown || this.wasd.S.isDown) velocityY = 1;

        if (velocityX < 0) this.player.setFlipX(true);
        else if (velocityX > 0) this.player.setFlipX(false);

        const isMoving = velocityX !== 0 || velocityY !== 0;
        if (isMoving) this.player.play('farmer0_walk', true);
        else this.player.play('farmer0_idle', true);

        const length = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
        if (isMoving) {
            velocityX = (velocityX / length) * PLAYER_SPEED;
            velocityY = (velocityY / length) * PLAYER_SPEED;
        }

        const newX = this.player.x + velocityX * (delta / 1000);
        const newY = this.player.y + velocityY * (delta / 1000);
        if (!this.checkCollisionWithObjects(newX, newY)) {
            this.player.x = newX;
            this.player.y = newY;
        } else {
            if (!this.checkCollisionWithObjects(newX, this.player.y)) this.player.x = newX;
            else if (!this.checkCollisionWithObjects(this.player.x, newY)) this.player.y = newY;
        }
        const { width, height } = this.scale;
        this.player.x = Phaser.Math.Clamp(this.player.x, this.player.displayWidth / 2, width - this.player.displayWidth / 2);
        this.player.y = Phaser.Math.Clamp(this.player.y, this.player.displayHeight, height);
        this.player.setDepth(this.player.y);
    }

    updateAllChatBubbles() {
        this.updateNPCChatBubbles();
        this.updatePlayerChatBubble();
    }

    createFarmerAnimations() {
        const farmerKeys = ['farmer0', 'farmer1', 'farmer2', 'farmer3'];
        farmerKeys.forEach(farmerKey => {
            if (!this.anims.exists(`${farmerKey}_walk`)) this.anims.create({ key: `${farmerKey}_walk`, frames: this.anims.generateFrameNumbers(farmerKey, { start: 0, end: 5 }), frameRate: 12, repeat: -1 });
            if (!this.anims.exists(`${farmerKey}_idle`)) this.anims.create({ key: `${farmerKey}_idle`, frames: this.anims.generateFrameNumbers(farmerKey, { start: 6, end: 7 }), frameRate: 2, repeat: -1 });
        });
    }

    loadAndCreateDesks() {
        const sceneData = this.cache.json.get('sceneObjects');
        if (!sceneData?.objects?.desks) return;
        this.desks = this.add.group();
        sceneData.objects.desks.forEach(d => {
            const desk = this.add.image(d.x, d.y, 'desk').setOrigin(0.5, 0.5).setRotation(d.rotation || 0).setScale(1.5);
            desk.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
            desk.setData('id', d.id).setData('passableHeight', d.passableHeight || 0);
            this.desks.add(desk);
        });
    }

    loadAndCreateBoxes() {
        const sceneData = this.cache.json.get('sceneObjects');
        if (!sceneData?.objects?.boxes) return;
        this.boxes = this.add.group();
        sceneData.objects.boxes.forEach(b => {
            const box = this.add.image(b.x, b.y, 'box').setOrigin(0.5, 0.5).setRotation(b.rotation || 0).setScale(1.5);
            box.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
            box.setData('id', b.id).setData('passableHeight', b.passableHeight || 0);
            this.boxes.add(box);
        });
    }

    checkCollisionWithObjects(x, y) {
        if (!this.player) return false;
        const playerBounds = new Phaser.Geom.Rectangle(x - this.player.displayWidth / 4, y - this.player.displayHeight / 2, this.player.displayWidth / 2, this.player.displayHeight / 2);
        const checkGroup = (group) => {
            if (!group) return false;
            for (const item of group.children.entries) {
                const halfWidth = (item.width * item.scaleX) / 2;
                const halfHeight = (item.height * item.scaleY) / 2;
                const passableHeight = item.getData('passableHeight') || 0;
                const solidBounds = new Phaser.Geom.Rectangle(item.x - halfWidth, item.y - halfHeight, halfWidth * 2, halfHeight * 2 - passableHeight);
                if (Phaser.Geom.Intersects.RectangleToRectangle(playerBounds, solidBounds)) return true;
            }
            return false;
        };
        return checkGroup(this.desks) || checkGroup(this.boxes);
    }

    /**
     * [改进] 显示或更新NPC的气泡。可平滑更新内容，避免闪烁。
     */
    showNPCChatBubble(npc, message, duration = 3000) {
        const bubbleKey = npc.getData('id');
        if (!bubbleKey) return;
    
        let bubbleData = this.farmerChatBubbles.get(bubbleKey);
    
        if (bubbleData && bubbleData.bubble.active) {
            // 气泡已存在，直接更新内容和计时器
            bubbleData.text.setText(message);
            const textWidth = Math.max(bubbleData.text.width + 24, 50);
            const textHeight = Math.max(bubbleData.text.height + 20, 30);
            // [修复] 使用 .width 和 .height 属性代替 .resize() 方法
            bubbleData.bubble.width = textWidth;
            bubbleData.bubble.height = textHeight;
    
            if (bubbleData.timer) bubbleData.timer.remove();
            bubbleData.timer = this.time.delayedCall(duration, () => this.hideChatBubbleForFarmer(bubbleKey));
        } else {
            // 气泡不存在，创建新的
            this.hideChatBubbleForFarmer(bubbleKey); // 以防万一，先清理
    
            const chatText = this.add.text(0, 0, message, {
                fontSize: '12px', fill: '#000', fontFamily: 'FusionPixel', fontStyle: 'bold',
                stroke: '#ffffff', strokeThickness: 2, resolution: 2,
                padding: { x: 2, y: 2 }, align: 'center',
                wordWrap: { width: 220, useAdvancedWrap: true }
            }).setOrigin(0.5, 0.5);
    
            const textWidth = Math.max(chatText.width + 24, 50);
            const textHeight = Math.max(chatText.height + 20, 30);
            
            const chatBubble = this.add.nineslice(0, 0, 'chatBubble', null, textWidth, textHeight, 8, 8, 8, 8).setOrigin(0.5, 1);
            chatBubble.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    
            chatBubble.setDepth(this.dialogueDepthCounter);
            chatText.setDepth(this.dialogueDepthCounter + 1);
            this.dialogueDepthCounter = 1000 + ((this.dialogueDepthCounter + 2) % 1000);
    
            const timer = this.time.delayedCall(duration, () => this.hideChatBubbleForFarmer(bubbleKey));
            
            this.farmerChatBubbles.set(bubbleKey, { bubble: chatBubble, text: chatText, timer: timer });
        }
        
        this.updateNPCChatBubbles();
    }
    
    /**
     * [新增] 隐藏玩家气泡的辅助函数。
     */
    hidePlayerChatBubble() {
        if (this.playerChatBubble) {
            if (this.playerChatBubble.bubble?.active) this.playerChatBubble.bubble.destroy();
            if (this.playerChatBubble.text?.active) this.playerChatBubble.text.destroy();
            if (this.playerChatBubble.timer) this.playerChatBubble.timer.remove();
            this.playerChatBubble = null;
        }
    }

    /**
     * [改进] 显示或更新玩家的气泡，并使其时长与内容挂钩。
     */
    showPlayerChatBubble(message, duration = 2000) {
        if (this.playerChatBubble && this.playerChatBubble.bubble.active) {
            // 更新现有气泡
            this.playerChatBubble.text.setText(message);
            const textWidth = Math.max(this.playerChatBubble.text.width + 24, 50);
            const textHeight = Math.max(this.playerChatBubble.text.height + 20, 30);
            // [修复] 使用 .width 和 .height 属性代替 .resize() 方法
            this.playerChatBubble.bubble.width = textWidth;
            this.playerChatBubble.bubble.height = textHeight;
    
            if (this.playerChatBubble.timer) this.playerChatBubble.timer.remove();
            this.playerChatBubble.timer = this.time.delayedCall(duration, () => {
                this.hidePlayerChatBubble();
            });
        } else {
            // 创建新气泡
            this.hidePlayerChatBubble();
    
            const chatText = this.add.text(0, 0, message, {
                fontSize: '16px', fill: '#000', fontFamily: 'FusionPixel', fontStyle: 'bold',
                stroke: '#ffffff', strokeThickness: 2, resolution: 2,
                padding: { x: 4, y: 4 }, align: 'center'
            }).setOrigin(0.5, 0.5);
            const textWidth = Math.max(chatText.width + 24, 50);
            const textHeight = Math.max(chatText.height + 20, 30);
            const chatBubble = this.add.nineslice(0, 0, 'chatBubble', null, textWidth, textHeight, 8, 8, 8, 8).setOrigin(0.5, 1);
            chatBubble.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
            chatBubble.setDepth(this.dialogueDepthCounter);
            chatText.setDepth(this.dialogueDepthCounter + 1);
            this.dialogueDepthCounter = 1000 + ((this.dialogueDepthCounter + 2) % 1000);
    
            const timer = this.time.delayedCall(duration, () => {
                this.hidePlayerChatBubble();
            });
            this.playerChatBubble = { bubble: chatBubble, text: chatText, timer: timer };
        }
        this.updatePlayerChatBubble();
    }

    hideChatBubbleForFarmer(farmerKey) {
        const bubbleData = this.farmerChatBubbles.get(farmerKey);
        if (bubbleData) {
            if (bubbleData.bubble?.active) bubbleData.bubble.destroy();
            if (bubbleData.text?.active) bubbleData.text.destroy();
            if (bubbleData.timer) bubbleData.timer.remove();
            this.farmerChatBubbles.delete(farmerKey);
        }
    }

    updateNPCChatBubbles() {
        if (!this.farmerChatBubbles) return;
        this.farmerChatBubbles.forEach((bubbleData, farmerId) => {
            const farmer = this.npcFarmers?.children.entries.find(f => f.getData('id') === farmerId);
            if (farmer && farmer.active && bubbleData.bubble && bubbleData.text && bubbleData.bubble.active) {
                const bubbleX = farmer.x;
                const bubbleY = farmer.y - farmer.displayHeight;
                bubbleData.bubble.setPosition(bubbleX, bubbleY);
                bubbleData.text.setPosition(bubbleX, bubbleData.bubble.y - bubbleData.bubble.height / 2);
            }
        });
    }

    updatePlayerChatBubble() {
        if (this.playerChatBubble && this.player && this.player.active && this.playerChatBubble.bubble.active) {
            const bubbleX = this.player.x;
            const bubbleY = this.player.y - this.player.displayHeight;
            this.playerChatBubble.bubble.setPosition(bubbleX, bubbleY);
            this.playerChatBubble.text.setPosition(bubbleX, this.playerChatBubble.bubble.y - this.playerChatBubble.bubble.height / 2);
        }
    }

    scaleBackgroundToFit() {
        if (!this.background) return;
        const { width, height } = this.scale;
        const scale = Math.max(width / this.background.width, height / this.background.height);
        this.background.setScale(scale).setPosition(width / 2, height / 2);
    }

    handleResize() {
        this.scaleBackgroundToFit();
        if (this.mouseCoordsText) this.mouseCoordsText.setPosition(this.scale.width - 10, 10);
        if (this.phoneNumberText && this.phoneIcon) this.phoneNumberText.setPosition(this.phoneIcon.x + 125, this.phoneIcon.y + 68);
        if (this.nightOverlay) this.nightOverlay.setSize(this.scale.width, this.scale.height);
    }

    setPlayerStartPosition() {
        const sceneData = this.cache.json.get('sceneObjects');
        const { width, height } = this.scale;
        this.playerStartX = sceneData?.player?.startX || width / 2;
        this.playerStartY = sceneData?.player?.startY || height / 2;
    }

    // --- LLM对话系统 ---

    checkNPCInteraction() {
        if (!this.player || !this.npcFarmers) return;

        const playerFacingLeft = this.player.flipX;

        const nearbyNPC = this.npcFarmers.children.entries.find(npc => {
            if (!npc.active) return false;

            const distance = Phaser.Math.Distance.Between(
                this.player.x, this.player.y,
                npc.x, npc.y
            );

            if (distance > INTERACTION_DISTANCE) return false;

            const npcIsOnLeft = npc.x < this.player.x;
            const npcIsOnRight = npc.x > this.player.x;

            if (playerFacingLeft && !npcIsOnLeft) return false;
            if (!playerFacingLeft && !npcIsOnRight) return false;

            return true;
        });

        if (nearbyNPC) {
            this.preloadNPCDialogue(nearbyNPC);
            this.startLLMDialogue(nearbyNPC);
        }
    }

    preloadNPCDialogue(npc) {
        const npcId = npc.getData('id');
        const sessionId = `npc_${npcId}`;

        if (this.llmPreloadCache.has(sessionId)) return;

        const npcData = this.allNpcData.find(data => data.id === npcId);
        if (npcData) {
            createDialogueConversation(sessionId, {
                name: npcData.memberType || "同事",
                description: npcData.memberIntro || ""
            });

            this.llmPreloadCache.set(sessionId, true);
        }
    }

    startLLMDialogue(npc) {
        if (!isLLMLoaded()) {
            this.showPlayerChatBubble("大模型还未加载完成，请稍后再试", 3000);
            return;
        }

        this.isInLLMDialogue = true;
        this.currentDialogueNPC = npc;

        if (this.gameTimeEvent) {
            this.gameTimeEvent.paused = true;
        }

        const npcId = npc.getData('id');
        const npcData = this.allNpcData.find(data => data.id === npcId);

        if (npcData) {
            const sessionId = `npc_${npcId}`;
            createDialogueConversation(sessionId, {
                name: npcData.memberType || "同事",
                description: npcData.memberIntro || ""
            });
        }

        this.createDialogueInput();
    }

    createDialogueInput() {
        const inputContainer = document.createElement('div');
        inputContainer.style.position = 'fixed';
        inputContainer.style.top = '50%';
        inputContainer.style.left = '50%';
        inputContainer.style.transform = 'translate(-50%, -50%)';
        inputContainer.style.zIndex = '1000';
        inputContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        inputContainer.style.padding = '20px';
        inputContainer.style.borderRadius = '10px';
        inputContainer.style.border = '2px solid #fff';

        const title = document.createElement('div');
        title.textContent = '与NPC对话';
        title.style.color = 'white';
        title.style.fontSize = '18px';
        title.style.marginBottom = '10px';
        title.style.textAlign = 'center';
        title.style.fontFamily = 'FusionPixel, monospace';

        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = '输入你想说的话...';
        input.style.width = '300px';
        input.style.padding = '10px';
        input.style.fontSize = '16px';
        input.style.border = '1px solid #ccc';
        input.style.borderRadius = '5px';
        input.style.fontFamily = 'FusionPixel, monospace';

        const buttonContainer = document.createElement('div');
        buttonContainer.style.marginTop = '10px';
        buttonContainer.style.textAlign = 'center';

        const sendButton = document.createElement('button');
        sendButton.textContent = '发送';
        sendButton.style.padding = '8px 16px';
        sendButton.style.marginRight = '10px';
        sendButton.style.fontSize = '14px';
        sendButton.style.backgroundColor = '#4CAF50';
        sendButton.style.color = 'white';
        sendButton.style.border = 'none';
        sendButton.style.borderRadius = '5px';
        sendButton.style.cursor = 'pointer';
        sendButton.style.fontFamily = 'FusionPixel, monospace';

        const cancelButton = document.createElement('button');
        cancelButton.textContent = '取消';
        cancelButton.style.padding = '8px 16px';
        cancelButton.style.fontSize = '14px';
        cancelButton.style.backgroundColor = '#f44336';
        cancelButton.style.color = 'white';
        cancelButton.style.border = 'none';
        cancelButton.style.borderRadius = '5px';
        cancelButton.style.cursor = 'pointer';
        cancelButton.style.fontFamily = 'FusionPixel, monospace';

        const handleSend = () => {
            const message = input.value.trim();
            if (message) {
                this.removeDialogueInput();
                this.sendPlayerMessage(message);
            }
        };

        const handleCancel = () => {
            this.endLLMDialogue();
        };

        sendButton.addEventListener('click', handleSend);
        cancelButton.addEventListener('click', handleCancel);

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                handleSend();
            } else if (e.key === 'Escape') {
                handleCancel();
            }
        });

        buttonContainer.appendChild(sendButton);
        buttonContainer.appendChild(cancelButton);
        inputContainer.appendChild(title);
        inputContainer.appendChild(input);
        inputContainer.appendChild(buttonContainer);

        document.body.appendChild(inputContainer);
        this.dialogueInputElement = inputContainer;

        setTimeout(() => input.focus(), 100);
    }

    removeDialogueInput() {
        if (this.dialogueInputElement) {
            document.body.removeChild(this.dialogueInputElement);
            this.dialogueInputElement = null;
        }
    }

    /**
     * [改进] 发送玩家消息并处理LLM的流式响应。
     * - 实现了思考状态(...)到正式内容的平滑过渡。
     * - 所有气泡时长都与内容长度动态挂钩。
     */
    async sendPlayerMessage(message) {
        if (!this.currentDialogueNPC) return;
    
        const npcId = this.currentDialogueNPC.getData('id');
        const sessionId = `npc_${npcId}`;
    
        try {
            // 根据消息长度动态计算玩家气泡的显示时间
            const playerBubbleDuration = Math.max(2000, message.length * 80);
            this.showPlayerChatBubble(message, playerBubbleDuration);
            
            // 立即为NPC显示 "..." 思考气泡，此气泡会在后续流式响应中被平滑更新
            this.showNPCChatBubble(this.currentDialogueNPC, "...", 60000); // 使用一个长持续时间，确保在流式输出完成前不会消失
    
            const streamOptions = {
                temperature: 0.3,
                maxTokens: 1000,
                maxMessages: 6,
            };
    
            const stream = streamMessage(sessionId, message, streamOptions);
    
            for await (const chunk of stream) {
                let displayContent = "...";
                const thinkingEndTag = '</think>';
                let fullContent = chunk.fullContent;
                const thinkingEndIndex = fullContent.indexOf(thinkingEndTag);
    
                if (thinkingEndIndex !== -1) {
                    // 如果找到</thinking>标签，则截取并显示其后的真实内容
                    displayContent = fullContent.substring(thinkingEndIndex + thinkingEndTag.length).trim();
                }
                
                // 如果剥离标签后内容为空（例如，刚结束thinking），则继续显示 "..."
                if (displayContent === "") {
                    displayContent = "...";
                }
    
                // 平滑更新NPC气泡内容。对于未完成的流，使用长持续时间；完成后根据内容计算最终时长。
                const npcBubbleDuration = chunk.isComplete ? Math.max(3000, displayContent.length * 80) : 60000;
                this.showNPCChatBubble(this.currentDialogueNPC, displayContent, npcBubbleDuration);
    
                if (chunk.isComplete) {
                    const finalResponse = displayContent;
                    if (!finalResponse.trim()) {
                        this.showNPCChatBubble(this.currentDialogueNPC, "嗯...", 2000);
                    }
                    
                    // 对话结束的最终延迟，也与内容长度挂钩
                    const endDelay = Math.max(3000, finalResponse.length * 80);
                    this.time.delayedCall(endDelay, this.endLLMDialogue, [], this);
                    return; // 完成后退出循环
                }
            }
            
            // 以防流异常结束
            this.time.delayedCall(2000, this.endLLMDialogue, [], this);
    
        } catch (error) {
            console.error('LLM对话失败:', error);
            this.hideChatBubbleForFarmer(npcId);
            this.showNPCChatBubble(this.currentDialogueNPC, "抱歉，我现在有点忙...", 3000);
            this.time.delayedCall(3500, this.endLLMDialogue, [], this);
        }
    }

    endLLMDialogue() {
        this.removeDialogueInput();

        this.isInLLMDialogue = false;
        this.currentDialogueNPC = null;

        if (this.gameTimeEvent) {
            this.gameTimeEvent.paused = false;
        }
    }
}
