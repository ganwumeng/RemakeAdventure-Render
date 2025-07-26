import React, { useState, useEffect, useRef } from 'react';
import TitleNPC from './TitleNPC';
import { PathfindingSystem } from '../game/PathfindingSystem';
import { NPCController } from '../game/NPCController';

const TitleNPCManager = () => {
    const [npcs, setNpcs] = useState([]);
    const mockSceneRef = useRef(null);
    const pathfindingRef = useRef(null);
    const npcControllersRef = useRef(new Map());

    // 可用的NPC精灵
    const availableSprites = ['farmer0', 'farmer1', 'farmer2', 'farmer3'];

    // 创建模拟的Phaser场景环境
    const createMockScene = () => {
        // 基于scene1_objects.json创建障碍物数据
        const mockDesks = {
            children: {
                entries: [
                    // 简化的桌子数据，转换为标题界面的百分比坐标系统
                    { x: 150, y: 370, width: 80, height: 60, scaleX: 1.5, scaleY: 1.5, getData: (key) => key === 'passableHeight' ? 30 : null },
                    { x: 350, y: 370, width: 80, height: 60, scaleX: 1.5, scaleY: 1.5, getData: (key) => key === 'passableHeight' ? 30 : null },
                    { x: 550, y: 370, width: 80, height: 60, scaleX: 1.5, scaleY: 1.5, getData: (key) => key === 'passableHeight' ? 30 : null },
                    { x: 750, y: 370, width: 80, height: 60, scaleX: 1.5, scaleY: 1.5, getData: (key) => key === 'passableHeight' ? 30 : null },
                    { x: 950, y: 370, width: 80, height: 60, scaleX: 1.5, scaleY: 1.5, getData: (key) => key === 'passableHeight' ? 30 : null },
                    { x: 150, y: 530, width: 80, height: 60, scaleX: 1.5, scaleY: 1.5, getData: (key) => key === 'passableHeight' ? 30 : null },
                    { x: 350, y: 530, width: 80, height: 60, scaleX: 1.5, scaleY: 1.5, getData: (key) => key === 'passableHeight' ? 30 : null },
                    { x: 550, y: 530, width: 80, height: 60, scaleX: 1.5, scaleY: 1.5, getData: (key) => key === 'passableHeight' ? 30 : null },
                    { x: 750, y: 530, width: 80, height: 60, scaleX: 1.5, scaleY: 1.5, getData: (key) => key === 'passableHeight' ? 30 : null },
                    { x: 950, y: 530, width: 80, height: 60, scaleX: 1.5, scaleY: 1.5, getData: (key) => key === 'passableHeight' ? 30 : null },
                ]
            }
        };

        const mockBoxes = {
            children: {
                entries: [
                    // 简化的箱子数据
                    { x: 400, y: 230, width: 40, height: 40, scaleX: 1.5, scaleY: 1.5, getData: (key) => key === 'passableHeight' ? 0 : null },
                    { x: 500, y: 230, width: 40, height: 40, scaleX: 1.5, scaleY: 1.5, getData: (key) => key === 'passableHeight' ? 0 : null },
                    { x: 600, y: 230, width: 40, height: 40, scaleX: 1.5, scaleY: 1.5, getData: (key) => key === 'passableHeight' ? 0 : null },
                    { x: 700, y: 230, width: 40, height: 40, scaleX: 1.5, scaleY: 1.5, getData: (key) => key === 'passableHeight' ? 0 : null },
                ]
            }
        };

        return {
            scale: { width: 1600, height: 900 }, // 标题界面的虚拟尺寸
            desks: mockDesks,
            boxes: mockBoxes
        };
    };

    // 生成随机的可行走位置
    const generateRandomWalkablePosition = () => {
        const pathfinding = pathfindingRef.current;
        if (!pathfinding) return { x: 50, y: 50 };

        let attempts = 0;
        while (attempts < 50) {
            const x = 100 + Math.random() * 1400; // 像素坐标
            const y = 100 + Math.random() * 700;
            
            if (!pathfinding.isWorldPointBlocked(x, y)) {
                return { x, y };
            }
            attempts++;
        }
        return { x: 800, y: 450 }; // 默认中心位置
    };

    // 生成随机NPC数据
    const generateRandomNPC = (id) => {
        const sprite = availableSprites[Math.floor(Math.random() * availableSprites.length)];
        const startPos = generateRandomWalkablePosition();
        
        return {
            id,
            sprite,
            startX: startPos.x,
            startY: startPos.y,
            flipX: Math.random() > 0.5
        };
    };

    useEffect(() => {
        // 创建模拟场景环境
        const mockScene = createMockScene();
        mockSceneRef.current = mockScene;

        // 初始化寻路系统（复用游戏中的PathfindingSystem）
        const pathfindingSystem = new PathfindingSystem(mockScene);
        pathfindingSystem.initializeGrid();
        pathfindingRef.current = pathfindingSystem;

        // 生成4-7个随机NPC
        const npcCount = 4 + Math.floor(Math.random() * 4);
        const newNpcs = [];
        
        for (let i = 0; i < npcCount; i++) {
            newNpcs.push(generateRandomNPC(i));
        }
        
        setNpcs(newNpcs);

        return () => {
            // 清理寻路系统
            if (pathfindingRef.current) {
                pathfindingRef.current.destroy();
            }
            // 清理NPC控制器
            npcControllersRef.current.forEach(controller => {
                if (controller && !controller.isDestroyed) {
                    controller.destroy();
                }
            });
            npcControllersRef.current.clear();
        };
    }, []);

    return (
        <div className="title-npc-container">
            {pathfindingRef.current && npcs.map(npc => (
                <TitleNPC
                    key={npc.id}
                    npcData={npc}
                    pathfinding={pathfindingRef.current}
                    mockScene={mockSceneRef.current}
                    npcControllers={npcControllersRef.current}
                />
            ))}
        </div>
    );
};

export default TitleNPCManager;