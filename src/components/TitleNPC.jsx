import React, { useState, useEffect, useRef } from 'react';
import { NPCController } from '../game/NPCController';

const TitleNPC = ({ npcData, pathfinding, mockScene, npcControllers, onPositionUpdate }) => {
    const [currentFrame, setCurrentFrame] = useState(0);
    const [spriteFrames, setSpriteFrames] = useState([]);
    const [currentPosition, setCurrentPosition] = useState({ 
        x: npcData.startX, 
        y: npcData.startY 
    });
    const [isMoving, setIsMoving] = useState(false);
    const [direction, setDirection] = useState(1); // 1 for right, -1 for left
    
    const frameIntervalRef = useRef(null);
    const patrolTimeoutRef = useRef(null);
    const mockSpriteRef = useRef(null);
    const npcControllerRef = useRef(null);

    // 简化的精灵动画处理
    useEffect(() => {
        // 直接使用原始精灵图，不进行复杂的帧裁剪
        setSpriteFrames([`/assets/${npcData.sprite}.png`]);
    }, [npcData.sprite]);

    // 创建模拟的Phaser精灵对象
    useEffect(() => {
        if (!pathfinding || !mockScene) return;

        // 创建一个模拟的精灵对象，兼容NPCController的接口
        const mockSprite = {
            x: currentPosition.x,
            y: currentPosition.y,
            active: true,
            setFlipX: (flip) => {
                setDirection(flip ? -1 : 1);
            },
            getData: (key) => {
                if (key === 'id') return npcData.id;
                if (key === 'spriteKey') return npcData.sprite;
                return null;
            },
            play: (animKey) => {
                // 模拟动画播放
                if (animKey.includes('walk')) {
                    setIsMoving(true);
                } else {
                    setIsMoving(false);
                }
            },
            anims: {
                currentAnim: { key: `${npcData.sprite}_idle` }
            }
        };

        mockSpriteRef.current = mockSprite;

        // 创建NPC控制器（复用游戏中的NPCController）
        const controller = new NPCController(mockScene, mockSprite, pathfinding);
        npcControllerRef.current = controller;
        npcControllers.set(npcData.id, controller);

        // 开始巡逻
        const startPatrol = () => {
            findNewDestination();
        };

        const findNewDestination = () => {
            if (!controller || controller.isDestroyed) return;

            // 生成随机目标点
            let targetX, targetY;
            let attempts = 0;
            do {
                targetX = 100 + Math.random() * 1400;
                targetY = 100 + Math.random() * 700;
                attempts++;
            } while (pathfinding.isWorldPointBlocked(targetX, targetY) && attempts < 50);

            // 使用NPCController移动到目标位置
            controller.moveTo(targetX, targetY, () => {
                // 到达目的地后，短暂停留再寻找新目标
                patrolTimeoutRef.current = setTimeout(findNewDestination, 2000 + Math.random() * 3000);
            });
        };

        // 延迟开始，避免所有NPC同时移动
        const delay = Math.random() * 3000;
        patrolTimeoutRef.current = setTimeout(startPatrol, delay);

        return () => {
            if (patrolTimeoutRef.current) {
                clearTimeout(patrolTimeoutRef.current);
            }
            if (controller && !controller.isDestroyed) {
                controller.destroy();
            }
            npcControllers.delete(npcData.id);
        };
    }, [pathfinding, mockScene]);

    // 监听模拟精灵的位置变化并更新React状态
    useEffect(() => {
        if (!mockSpriteRef.current) return;

        const updateInterval = setInterval(() => {
            const mockSprite = mockSpriteRef.current;
            if (mockSprite && mockSprite.active) {
                const newPosition = { x: mockSprite.x, y: mockSprite.y };
                setCurrentPosition(newPosition);
                
                if (onPositionUpdate) {
                    onPositionUpdate(npcData.id, newPosition);
                }
            }
        }, 50); // 每50ms更新一次位置

        return () => {
            clearInterval(updateInterval);
        };
    }, [onPositionUpdate]);

    // 简化的动画处理 - 只是简单的显示/隐藏效果
    useEffect(() => {
        // 保持简单，不做复杂的帧动画
        setCurrentFrame(0);
    }, [isMoving]);

    // 清理函数
    useEffect(() => {
        return () => {
            if (frameIntervalRef.current) {
                clearInterval(frameIntervalRef.current);
            }
            if (patrolTimeoutRef.current) {
                clearTimeout(patrolTimeoutRef.current);
            }
        };
    }, []);

    const currentSpriteFrame = spriteFrames[currentFrame];

    // 将像素坐标转换为百分比坐标
    const positionPercent = {
        x: (currentPosition.x / 1600) * 100, // 基于1600px的虚拟宽度
        y: (currentPosition.y / 900) * 100   // 基于900px的虚拟高度
    };

    return (
        <div
            className="title-npc"
            style={{
                position: 'absolute',
                left: `${positionPercent.x}%`,
                top: `${positionPercent.y}%`,
                width: '28px',
                height: '41px',
                backgroundImage: currentSpriteFrame ? `url(${currentSpriteFrame})` : `url(/assets/${npcData.sprite}.png)`,
                backgroundSize: 'contain',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'center',
                imageRendering: 'pixelated',
                zIndex: 1,
                opacity: 0.7,
                filter: 'drop-shadow(1px 1px 2px rgba(0,0,0,0.4))',
                transform: `scaleX(${direction}) translateX(${direction === -1 ? '100%' : '0'})`,
                transition: 'opacity 0.3s ease',
                pointerEvents: 'none'
            }}
        />
    );
};

export default TitleNPC;