/**
 * NPC控制器
 * 负责管理NPC的移动、动画和行为
 */
export class NPCController {
    constructor(scene, npc, pathfindingSystem) {
        this.scene = scene;
        this.npc = npc;
        this.pathfindingSystem = pathfindingSystem;

        this.movementSegments = [];
        this.currentPathIndex = 0;
        this.isMoving = false;
        this.moveSpeed = 120; // 移动速度（像素/秒）

        this.currentTween = null;
        this.isDestroyed = false;
        this.onCompleteCallback = null; // 用于存储移动完成后的回调
    }

    /**
     * 移动到指定位置
     * @param {number} x - 目标X坐标
     * @param {number} y - 目标Y坐标
     * @param {function} [onComplete] - 移动完成时调用的回调函数
     * @returns {boolean} 是否成功开始移动
     */
    moveTo(x, y, onComplete) {
        if (this.isDestroyed || !this.npc || !this.npc.active) {
            if (onComplete) onComplete(); // 如果无法移动，立即执行回调
            return false;
        }

        this.forceStop(); // 停止任何之前的移动

        // 存储回调函数，以便在移动结束后调用
        this.onCompleteCallback = onComplete || null;

        const startPos = { x: this.npc.x, y: this.npc.y };
        const endPos = { x, y };

        const path = this.pathfindingSystem.findPath(startPos, endPos);

        if (path.length === 0) {
            console.warn(`${this.npc.getData('id')} 无法找到路径`);
            this.onReachDestination(); // 即使没有路径，也触发完成逻辑
            return false;
        }

        this.movementSegments = this.convertPathToSegments(path);
        this.currentPathIndex = 0; // 重置路径索引

        if (this.movementSegments.length === 0) {
            console.warn(`${this.npc.getData('id')} 转换后的移动段落为空`);
            this.onReachDestination(); // 没有移动段，也触发完成逻辑
            return false;
        }

        this.isMoving = true;
        this.moveToNextSegment();
        return true;
    }

    /**
     * 强制停止当前所有移动和动画，并重置状态
     */
    forceStop() {
        if (this.isDestroyed) return;

        // 确保在场景和NPC存在时才操作tweens
        if (this.scene && this.scene.tweens && this.npc) {
            this.scene.tweens.killTweensOf(this.npc);
        }
        this.currentTween = null;

        if (this.isMoving) {
            this.isMoving = false;
            if (this.npc && this.npc.active) {
                this.startIdleAnimation();
            }
        }

        // 重置路径状态
        this.movementSegments = [];
        this.currentPathIndex = 0;
    }

    /**
     * 销毁控制器，清理所有引用和正在进行的操作
     */
    destroy() {
        this.isDestroyed = true;
        this.forceStop(); // 这会清理tweens和状态

        this.npc = null;
        this.scene = null;
        this.pathfindingSystem = null;
    }

    /**
     * 移动到路径的下一个片段
     */
    moveToNextSegment() {
        // 检查控制器或NPC是否已被销毁
        if (this.isDestroyed || !this.isMoving || !this.npc || !this.npc.active) {
            return;
        }

        // 使用同步循环跳过所有距离过小的路径点。
        while (this.currentPathIndex < this.movementSegments.length) {
            const segment = this.movementSegments[this.currentPathIndex];
            const dx = segment.to.x - this.npc.x;
            const dy = segment.to.y - this.npc.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance >= 1) {
                // 找到了一个需要实际移动的路径点，跳出循环
                break;
            }
            // 如果距离过小，则直接跳到下一个路径点
            this.currentPathIndex++;
        }

        // 检查在跳过无效路径点后，是否已经到达路径终点
        if (this.currentPathIndex >= this.movementSegments.length) {
            this.onReachDestination();
            return;
        }

        // 获取当前有效的路径片段并开始移动
        const segment = this.movementSegments[this.currentPathIndex];
        this.startWalkingAnimation();

        // 根据水平移动方向来翻转精灵
        if (segment.to.x !== this.npc.x) {
            this.npc.setFlipX(segment.to.x < this.npc.x);
        }

        const dx = segment.to.x - this.npc.x;
        const dy = segment.to.y - this.npc.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const moveTime = (distance / this.moveSpeed) * 1000;

        this.currentTween = this.scene.tweens.add({
            targets: this.npc,
            x: segment.to.x,
            y: segment.to.y,
            duration: moveTime,
            ease: 'Linear',
            onComplete: () => {
                if (this.isDestroyed || !this.isMoving) return;
                this.currentPathIndex++;
                this.moveToNextSegment(); // 移动完成后，递归调用以处理下一个路径点
            }
        });
    }

    /**
     * 当NPC到达最终目的地时调用
     */
    onReachDestination() {
        if (this.isDestroyed) return;

        this.isMoving = false;
        this.startIdleAnimation();

        if (this.npc && this.npc.active) {
             console.log(`${this.npc.getData('id')} 到达目标`);
        }

        // [关键修复] 在这里调用并清空回调函数
        if (this.onCompleteCallback) {
            this.onCompleteCallback();
            this.onCompleteCallback = null; // 防止重复调用
        }
    }

    /**
     * 播放行走动画
     */
    startWalkingAnimation() {
        if (!this.isDestroyed && this.npc?.anims?.currentAnim?.key !== `${this.npc.getData('spriteKey')}_walk`) {
            this.npc.play(`${this.npc.getData('spriteKey')}_walk`);
        }
    }

    /**
     * 播放站立动画
     */
    startIdleAnimation() {
        if (!this.isDestroyed && this.npc?.anims?.currentAnim?.key !== `${this.npc.getData('spriteKey')}_idle`) {
            this.npc.play(`${this.npc.getData('spriteKey')}_idle`);
        }
    }

    /**
     * 检查NPC当前是否正在移动
     * @returns {boolean}
     */
    isCurrentlyMoving() {
        return this.isMoving;
    }

    /**
     * 每帧更新函数（为未来扩展保留）
     */
    update() {
        // 本方法为未来扩展保留
    }

    /**
     * 将寻路算法返回的路径点数组转换为移动片段
     * @param {Array<object>} path - 路径点数组
     * @returns {Array<object>}
     */
    convertPathToSegments(path) {
        if (!path || path.length === 0 || !this.npc) return [];

        const segments = [];
        let currentPos = { x: this.npc.x, y: this.npc.y };

        for (const targetPos of path) {
            // 检查是否为斜线移动
            if (currentPos.x !== targetPos.x && currentPos.y !== targetPos.y) {
                // [关键修复] 这是一个由路径简化产生的斜线。
                // 我们需要将其分解为两个直角移动，但必须确保“拐角”是可通行的。

                // 方案1：先水平移动，再垂直移动
                const intermediatePoint1 = { x: targetPos.x, y: currentPos.y };
                // 方案2：先垂直移动，再水平移动
                const intermediatePoint2 = { x: currentPos.x, y: targetPos.y };

                // 检查哪个拐角点是可通行的
                const isPoint1Walkable = !this.pathfindingSystem.isWorldPointBlocked(intermediatePoint1.x, intermediatePoint1.y);
                const isPoint2Walkable = !this.pathfindingSystem.isWorldPointBlocked(intermediatePoint2.x, intermediatePoint2.y);

                if (isPoint1Walkable) {
                    // 如果方案1的拐角可通行，则采用方案1
                    segments.push({ from: { ...currentPos }, to: { ...intermediatePoint1 }, direction: 'horizontal' });
                    segments.push({ from: { ...intermediatePoint1 }, to: { ...targetPos }, direction: 'vertical' });
                } else if (isPoint2Walkable) {
                    // 否则，如果方案2的拐角可通行，则采用方案2
                    segments.push({ from: { ...currentPos }, to: { ...intermediatePoint2 }, direction: 'vertical' });
                    segments.push({ from: { ...intermediatePoint2 }, to: { ...targetPos }, direction: 'horizontal' });
                } else {
                    // 这是一个罕见的边缘情况，斜线路径有效，但两种L形走法都被阻塞。
                    // 在这种情况下我们在此处停止，以避免穿墙。
                    console.warn(`无法为 ${this.npc.getData('id')} 的斜线路径找到安全的直角走法。移动中止。`);
                    return segments; // 返回当前已经生成的安全路径
                }
            } else if (currentPos.y === targetPos.y && currentPos.x !== targetPos.x) {
                // 纯水平移动
                segments.push({ from: { ...currentPos }, to: { ...targetPos }, direction: 'horizontal' });
            } else if (currentPos.x === targetPos.x && currentPos.y !== targetPos.y) {
                // 纯垂直移动
                segments.push({ from: { ...currentPos }, to: { ...targetPos }, direction: 'vertical' });
            }

            currentPos = { ...targetPos };
        }
        return segments;
    }
}
