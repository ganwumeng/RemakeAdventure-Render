/**
 * A*寻路算法系统
 * 使用高效的最小堆优先队列和关闭列表进行优化。
 * [新增] 增加了概率性选择次优路径的功能，使路线更自然。
 */

// --- 一个高效的优先队列（最小堆）实现 ---
class PriorityQueue {
    constructor() {
        this.elements = [];
    }

    enqueue(element, priority) {
        this.elements.push({ element, priority });
        this.bubbleUp(this.elements.length - 1);
    }

    bubbleUp(index) {
        const element = this.elements[index];
        while (index > 0) {
            const parentIndex = Math.floor((index - 1) / 2);
            const parent = this.elements[parentIndex];
            if (element.priority >= parent.priority) break;
            this.elements[index] = parent;
            this.elements[parentIndex] = element;
            index = parentIndex;
        }
    }

    /**
     * [修改] 移除并返回优先级最高的节点（包括其优先级）
     * @returns {{element: any, priority: number} | null} 包含元素和优先级的对象，如果队列为空则返回 null
     */
    dequeue() {
        if (this.isEmpty()) return null;
        const min = this.elements[0];
        const end = this.elements.pop();
        if (this.elements.length > 0) {
            this.elements[0] = end;
            this.sinkDown(0);
        }
        // 返回完整的节点对象，而不仅仅是元素
        return min;
    }

    sinkDown(index) {
        const length = this.elements.length;
        const element = this.elements[index];
        const elementPriority = element.priority;

        while (true) {
            let leftChildIndex = 2 * index + 1;
            let rightChildIndex = 2 * index + 2;
            let leftChild, rightChild;
            let swap = null;

            if (leftChildIndex < length) {
                leftChild = this.elements[leftChildIndex];
                if (leftChild.priority < elementPriority) {
                    swap = leftChildIndex;
                }
            }

            if (rightChildIndex < length) {
                rightChild = this.elements[rightChildIndex];
                // --- [错误修复] ---
                // 将 'right.priority' 修改为 'rightChild.priority'
                if (
                    (swap === null && rightChild.priority < elementPriority) ||
                    (swap !== null && rightChild.priority < leftChild.priority)
                ) {
                    swap = rightChildIndex;
                }
            }

            if (swap === null) break;
            this.elements[index] = this.elements[swap];
            this.elements[swap] = element;
            index = swap;
        }
    }

    isEmpty() {
        return this.elements.length === 0;
    }
}


export class PathfindingSystem {
    constructor(scene) {
        this.scene = scene;
        // [关键改进] 减小网格尺寸以提高精度
        this.gridSize = 8;
        this.grid = null;
        this.width = 0;
        this.height = 0;

        // 用于调试的图形对象引用
        this.gridGraphics = null;
        this.pathGraphics = null;
    }

    /**
     * 初始化寻路网格
     */
    initializeGrid() {
        const { width, height } = this.scene.scale;
        this.width = Math.ceil(width / this.gridSize);
        this.height = Math.ceil(height / this.gridSize);

        this.grid = Array(this.height).fill(null).map(() => Array(this.width).fill(0));
        this.markObstacles();
        console.log(`寻路网格初始化完成: ${this.width}x${this.height} (格子大小: ${this.gridSize}px)`);
    }

    /**
     * 标记障碍物在网格中的位置
     */
    markObstacles() {
        let obstacleCount = 0;

        // 辅助函数，用于标记一组障碍物
        const markGroup = (obstacleGroup) => {
            if (!obstacleGroup) return;

            obstacleGroup.children.entries.forEach(obstacle => {
                const halfWidth = (obstacle.width * obstacle.scaleX) / 2;
                const halfHeight = (obstacle.height * obstacle.scaleY) / 2;
                const passableHeight = obstacle.getData('passableHeight') || 0;
                // [关键改进] 增加安全缓冲区，确保NPC身体不会进入障碍区
                const buffer = this.gridSize;

                const leftGrid = Math.floor((obstacle.x - halfWidth - buffer) / this.gridSize);
                const rightGrid = Math.ceil((obstacle.x + halfWidth + buffer) / this.gridSize);
                const topGrid = Math.floor((obstacle.y - halfHeight - buffer) / this.gridSize);
                const solidBottom = obstacle.y + halfHeight - passableHeight;
                const bottomGrid = Math.ceil((solidBottom + buffer) / this.gridSize);

                for (let y = Math.max(0, topGrid); y < Math.min(this.height, bottomGrid); y++) {
                    for (let x = Math.max(0, leftGrid); x < Math.min(this.width, rightGrid); x++) {
                        if (this.grid[y] && this.grid[y][x] === 0) {
                            this.grid[y][x] = 1; // Mark as obstacle
                            obstacleCount++;
                        }
                    }
                }
            });
        };

        // 标记所有桌子和箱子
        markGroup(this.scene.desks);
        markGroup(this.scene.boxes); // 新增：标记箱子

        console.log(`标记了 ${obstacleCount} 个障碍物网格点`);
    }


    /**
     * A*寻路算法
     * @param {object} start - 起始世界坐标 {x, y}
     * @param {object} end - 目标世界坐标 {x, y}
     * @param {object} [options] - 寻路选项
     * @param {number} [options.suboptimalChance=0.2] - 选择次优路径的概率 (0-1)，用于生成更自然的路径
     * @returns {Array} 路径点数组（世界坐标）
     */
    findPath(start, end, options = {}) {
        if (!this.grid) this.initializeGrid();

        const { suboptimalChance = 0.2 } = options; // 默认20%的几率选择次优路径

        const startGrid = this.worldToGrid(start.x, start.y);
        let endGrid = this.worldToGrid(end.x, end.y);

        if (!this.isWalkable(startGrid.x, startGrid.y)) {
            console.warn('起点在障碍物内，寻路失败');
            return [];
        }
        if (!this.isWalkable(endGrid.x, endGrid.y)) {
            console.warn('终点在障碍物内，正在寻找最近的可通行点...');
            const nearestEnd = this.findNearestWalkable(endGrid);
            if (!nearestEnd) {
                console.error('找不到终点附近的可通行点，寻路失败');
                return [];
            }
            endGrid = nearestEnd;
        }

        const openSet = new PriorityQueue();
        const closedSet = new Set();
        const cameFrom = new Map();
        const gScore = new Map();
        
        const startKey = `${startGrid.x},${startGrid.y}`;
        gScore.set(startKey, 0);
        const fScore = this.manhattanDistance(startGrid, endGrid);
        openSet.enqueue(startGrid, fScore);

        while (!openSet.isEmpty()) {
            let chosenNode;

            // --- [核心修改] ---
            // 概率性地选择次优节点，让路线看起来更自然。
            // 如果随机数小于设定的阈值，并且开放列表中有至少两个节点，则执行此操作。
            if (Math.random() < suboptimalChance && openSet.elements.length > 1) {
                // 1. 临时取出最优节点
                const bestNode = openSet.dequeue();
                // 2. 选择原本的“次优”节点作为当前要处理的节点
                chosenNode = openSet.dequeue();
                // 3. 将最优节点重新放回开放列表，它在后续的寻路中仍有机会被选中
                openSet.enqueue(bestNode.element, bestNode.priority);
                // console.log("选择了次优节点！"); // 用于调试
            } else {
                // 正常情况：选择最优节点
                chosenNode = openSet.dequeue();
            }

            if (!chosenNode) break; // 如果队列为空，则安全退出

            const current = chosenNode.element;
            const currentKey = `${current.x},${current.y}`;

            if (current.x === endGrid.x && current.y === endGrid.y) {
                const path = this.reconstructPath(cameFrom, current);
                this.visualizePath(path);
                return path;
            }

            closedSet.add(currentKey);

            const neighbors = this.getNeighbors(current);
            for (const neighbor of neighbors) {
                const neighborKey = `${neighbor.x},${neighbor.y}`;
                if (closedSet.has(neighborKey)) {
                    continue;
                }

                const tentativeGScore = gScore.get(currentKey) + 1;

                if (tentativeGScore < (gScore.get(neighborKey) || Infinity)) {
                    cameFrom.set(neighborKey, current);
                    gScore.set(neighborKey, tentativeGScore);
                    const heuristic = this.manhattanDistance(neighbor, endGrid);
                    const penalty = this.getObstaclePenalty(neighbor);
                    const neighborFScore = tentativeGScore + heuristic + penalty;
                    openSet.enqueue(neighbor, neighborFScore);
                }
            }
        }

        console.warn('A* 未找到路径');
        return [];
    }
    
    /**
     * 重构并简化路径
     */
    reconstructPath(cameFrom, current) {
        const totalPath = [];
        while (current) {
            totalPath.unshift(this.gridToWorld(current.x, current.y));
            const currentKey = `${current.x},${current.y}`;
            current = cameFrom.get(currentKey);
        }
        return this.simplifyPath(totalPath);
    }

    simplifyPath(path) {
        if (path.length < 3) return path;

        const newPath = [path[0]];
        for (let i = 2; i < path.length; i++) {
            if (!this.hasLineOfSight(newPath[newPath.length - 1], path[i])) {
                newPath.push(path[i - 1]);
            }
        }
        newPath.push(path[path.length - 1]);
        return newPath;
    }

    hasLineOfSight(start, end) {
        const startGrid = this.worldToGrid(start.x, start.y);
        const endGrid = this.worldToGrid(end.x, end.y);
        const dx = Math.abs(endGrid.x - startGrid.x);
        const dy = -Math.abs(endGrid.y - startGrid.y);
        const sx = startGrid.x < endGrid.x ? 1 : -1;
        const sy = startGrid.y < endGrid.y ? 1 : -1;
        let err = dx + dy;
        let x = startGrid.x;
        let y = startGrid.y;

        while (true) {
            if (!this.isWalkable(x, y)) return false;
            if (x === endGrid.x && y === endGrid.y) break;
            const e2 = 2 * err;
            if (e2 >= dy) {
                err += dy;
                x += sx;
            }
            if (e2 <= dx) {
                err += dx;
                y += sy;
            }
        }
        return true;
    }

    getNeighbors(node) {
        const neighbors = [];
        const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];
        for (const [dx, dy] of directions) {
            const x = node.x + dx;
            const y = node.y + dy;
            if (this.isWalkable(x, y)) {
                neighbors.push({ x, y });
            }
        }
        return neighbors;
    }

    findNearestWalkable(gridPos) {
        const queue = [gridPos];
        const visited = new Set([`${gridPos.x},${gridPos.y}`]);
        const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];

        while (queue.length > 0) {
            const current = queue.shift();
            if (this.isWalkable(current.x, current.y)) {
                return current;
            }
            for (const [dx, dy] of directions) {
                const next = { x: current.x + dx, y: current.y + dy };
                const key = `${next.x},${next.y}`;
                if (!visited.has(key) && next.x >= 0 && next.x < this.width && next.y >= 0 && next.y < this.height) {
                    visited.add(key);
                    queue.push(next);
                }
            }
        }
        return null;
    }

    getObstaclePenalty(gridPos) {
        let penalty = 0;
        const radius = 1;
        for (let y = -radius; y <= radius; y++) {
            for (let x = -radius; x <= radius; x++) {
                if (x === 0 && y === 0) continue;
                if (!this.isWalkable(gridPos.x + x, gridPos.y + y)) {
                    penalty += 5;
                }
            }
        }
        return penalty;
    }

    isWalkable(gridX, gridY) {
        return gridX >= 0 && gridX < this.width && gridY >= 0 && gridY < this.height && this.grid[gridY][gridX] === 0;
    }

    worldToGrid(x, y) {
        return { x: Math.floor(x / this.gridSize), y: Math.floor(y / this.gridSize) };
    }

    gridToWorld(gridX, gridY) {
        return { x: gridX * this.gridSize + this.gridSize / 2, y: gridY * this.gridSize + this.gridSize / 2 };
    }

    isWorldPointBlocked(worldX, worldY) {
        const gridPos = this.worldToGrid(worldX, worldY);
        return !this.isWalkable(gridPos.x, gridPos.y);
    }
    
    toggleVisualization() {
        if (!this.gridGraphics) {
            this.visualizeGrid();
        } else {
            this.gridGraphics.setVisible(!this.gridGraphics.visible);
        }
    }

    visualizeGrid() {
        if (!this.gridGraphics) {
            this.gridGraphics = this.scene.add.graphics({ z: 100 });
        }
        this.gridGraphics.clear();
        this.gridGraphics.fillStyle(0xff0000, 0.4);
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (!this.isWalkable(x, y)) {
                    this.gridGraphics.fillRect(x * this.gridSize, y * this.gridSize, this.gridSize, this.gridSize);
                }
            }
        }
    }

    visualizePath(path) {
        if (!this.pathGraphics) {
            this.pathGraphics = this.scene.add.graphics({ z: 101 });
        }
        this.pathGraphics.clear();
        if (path.length > 1) {
            this.pathGraphics.lineStyle(3, 0x00ff00, 0.8);
            this.pathGraphics.strokePoints(path);
        }
    }
    
    destroy() {
        if (this.gridGraphics) {
            this.gridGraphics.destroy();
            this.gridGraphics = null;
        }
        if (this.pathGraphics) {
            this.pathGraphics.destroy();
            this.pathGraphics = null;
        }
    }

    manhattanDistance(a, b) {
        return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    }
}
