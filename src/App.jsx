import { useRef, useEffect, useState } from 'react';
import { PhaserGame } from './PhaserGame';
import { EventBus } from './game/EventBus';
import LoadingScreen from './components/LoadingScreen.jsx';
import AboutModal from './components/AboutModal.jsx';

function App ()
{
    //  References to the PhaserGame component (game and scene are exposed)
    const phaserRef = useRef();
    const [gameState, setGameState] = useState('game'); // 直接启动游戏，标题界面在游戏引擎中
    const [useLLM, setUseLLM] = useState(true);
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [loadingStatus, setLoadingStatus] = useState('初始化中...');
    const [showAbout, setShowAbout] = useState(false);
    const [isLoadingLLM, setIsLoadingLLM] = useState(false);

    // 处理启动游戏
    const handleStartGame = async (withLLM) => {
        setUseLLM(withLLM);
        setIsLoadingLLM(true);
        
        if (withLLM) {
            // 动态导入大模型相关代码，只有在需要时才加载
            try {
                setLoadingStatus('正在加载大模型模块...');
                const { initializeLLM } = await import('./game/llm/runner.js');
                
                setLoadingStatus('正在下载模型文件...');
                
                await initializeLLM((progress) => {
                    setLoadingProgress(progress.progress || 0);
                    
                    // 根据进度更新状态文本
                    if (progress.progress < 0.3) {
                        setLoadingStatus('正在下载模型文件...');
                    } else if (progress.progress < 0.7) {
                        setLoadingStatus('正在加载模型到内存...');
                    } else if (progress.progress < 0.9) {
                        setLoadingStatus('正在初始化模型...');
                    } else {
                        setLoadingStatus('即将完成...');
                    }
                });
                
                setLoadingStatus('加载完成！');
                setTimeout(() => {
                    setIsLoadingLLM(false);
                    // 启动游戏场景
                    if (phaserRef.current && phaserRef.current.game) {
                        phaserRef.current.game.scene.start('Game');
                        phaserRef.current.game.scene.stop('TitleScene');
                    }
                }, 500);
                
            } catch (error) {
                console.error('大模型初始化失败:', error);
                setLoadingStatus('加载失败，请刷新页面重试');
                setIsLoadingLLM(false);
            }
        } else {
            // 不使用大模型，直接启动游戏
            setLoadingStatus('正在启动游戏...');
            setLoadingProgress(100);
            setTimeout(() => {
                setIsLoadingLLM(false);
                // 启动游戏场景
                if (phaserRef.current && phaserRef.current.game) {
                    phaserRef.current.game.scene.start('Game');
                    phaserRef.current.game.scene.stop('TitleScene');
                }
            }, 1000);
        }
    };

    useEffect(() => {
        // 监听来自标题场景的事件
        const startGameListener = (data) => handleStartGame(data.useLLM);
        const showAboutListener = () => setShowAbout(true);

        EventBus.on('title-start-game', startGameListener);
        EventBus.on('title-show-about', showAboutListener);

        // ======================= FIX START =======================
        // 关键修改：
        // 1. 将 setupControls 修改为接收一个 scene 参数，而不是依赖可能过时的 phaserRef。
        // 2. 在 'current-scene-ready' 事件监听器中，将接收到的最新 scene 对象直接传递给 setupControls。
        // 这确保了按钮的 onclick 事件总是绑定到当前活跃的场景实例上。

        const setupControls = (currentScene) => { // 接收当前场景作为参数
            const askLLMButton = document.getElementById('ask-llm');
            const toggleGridButton = document.getElementById('toggle-grid');
            const stopButton = document.getElementById('stop-all-npcs');

            if (askLLMButton) {
                if (!useLLM) {
                    askLLMButton.style.display = 'none';
                } else {
                    askLLMButton.style.display = 'block';
                    askLLMButton.onclick = async () => {
                        console.log("点击了询问大模型按钮");
                        try {
                            const { askLLM, isLLMLoaded } = await import('./game/llm/runner.js');
                            if (!isLLMLoaded()) {
                                console.log("大模型尚未加载完成");
                                return;
                            }
                            const result = await askLLM("你好");
                            console.log("大模型回复结果:", result);
                        } catch (error) {
                            console.error("询问大模型时出错:", error);
                        }
                    };
                }
            }

            if (toggleGridButton) {
                toggleGridButton.onclick = () => {
                    console.log("点击了显示/隐藏网格按钮");
                    // 直接使用传入的 currentScene，而不是 phaserRef.current.scene
                    if (currentScene) {
                        console.log("当前场景:", currentScene.scene?.key);
                        // 确保当前场景是Game场景且有togglePathfindingGrid方法
                        if (currentScene.scene?.key === 'Game' && 
                            typeof currentScene.togglePathfindingGrid === 'function') {
                            console.log("场景存在，调用togglePathfindingGrid");
                            currentScene.togglePathfindingGrid();
                        } else {
                            console.log("当前不是Game场景或方法不存在");
                        }
                    } else {
                        console.log("场景不存在或未准备好");
                    }
                };
            }

            if (stopButton) {
                stopButton.onclick = () => {
                    console.log("点击了停止NPC按钮");
                    // 直接使用传入的 currentScene
                    if (currentScene) {
                        // 确保当前场景是Game场景且有makeOneNpcLeave方法
                        if (currentScene.scene?.key === 'Game' && 
                            typeof currentScene.makeOneNpcLeave === 'function') {
                            currentScene.makeOneNpcLeave();
                        } else {
                            console.log("当前不是Game场景或方法不存在");
                        }
                    } else {
                        console.log("场景不存在或未准备好");
                    }
                };
            }
        };

        // 监听场景切换事件，控制调试面板的显示/隐藏并设置按钮
        const sceneReadyListener = (scene) => {
            console.log("场景准备就绪:", scene.scene?.key);
            
            const controlPanel = document.getElementById('pathfinding-controls');
            if (controlPanel) {
                if (scene.scene.key === 'TitleScene') {
                    // 在标题界面隐藏调试控制面板
                    controlPanel.style.display = 'none';
                } else {
                    // 在游戏界面显示调试控制面板
                    controlPanel.style.display = 'block';
                }
            }
            
            // 将最新的 scene 对象传递给 setupControls
            setupControls(scene);
        };

        EventBus.on('current-scene-ready', sceneReadyListener);
        // ======================= FIX END =========================

        return () => {
            EventBus.off('title-start-game', startGameListener);
            EventBus.off('title-show-about', showAboutListener);
            // 确保正确移除监听器
            EventBus.off('current-scene-ready', sceneReadyListener);
        };
    }, [useLLM]);

    return (
        <div id="app">
            <PhaserGame ref={phaserRef} />
            
            {/* 大模型加载时显示加载屏幕 */}
            {isLoadingLLM && (
                <LoadingScreen 
                    progress={loadingProgress} 
                    status={loadingStatus}
                />
            )}
            
            {/* 关于模态框 */}
            <AboutModal 
                isOpen={showAbout}
                onClose={() => setShowAbout(false)}
            />
        </div>
    )
}

export default App
