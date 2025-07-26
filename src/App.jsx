import { useRef, useEffect, useState } from 'react';
import { PhaserGame } from './PhaserGame';
import { EventBus } from './game/EventBus';
import LoadingScreen from './components/LoadingScreen.jsx';
import AboutModal from './components/AboutModal.jsx';
import VirtualControls from './components/VirtualControls.jsx';

function App() {
    //  References to the PhaserGame component (game and scene are exposed)
    const phaserRef = useRef();
    // 直接启动游戏，标题界面在游戏引擎中
    const [useLLM, setUseLLM] = useState(true);
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [loadingStatus, setLoadingStatus] = useState('初始化中...');
    const [showAbout, setShowAbout] = useState(false);
    const [isLoadingLLM, setIsLoadingLLM] = useState(false);
    const [showFullscreenButton, setShowFullscreenButton] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [isFullscreenReady, setIsFullscreenReady] = useState(false);
    // 当前场景状态（用于虚拟控制器显示逻辑）
    const [currentScene, setCurrentScene] = useState(null);

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

    // 检测移动端
    useEffect(() => {
        const checkIsMobile = () => {
            return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                (window.innerWidth <= 768 && window.innerHeight <= 1024);
        };

        const mobile = checkIsMobile();
        setIsMobile(mobile);

        // 如果不是移动端，直接设置全屏就绪
        if (!mobile) {
            setIsFullscreenReady(true);
        }
    }, []);

    // 移动端可选全屏功能
    useEffect(() => {
        if (!isMobile) return;

        const isFullscreenSupported = () => {
            return !!(document.documentElement.requestFullscreen ||
                document.documentElement.webkitRequestFullscreen ||
                document.documentElement.mozRequestFullScreen ||
                document.documentElement.msRequestFullscreen);
        };

        const isFullscreenActive = () => {
            return !!(document.fullscreenElement ||
                document.webkitFullscreenElement ||
                document.mozFullScreenElement ||
                document.msFullscreenElement);
        };

        const simulateFullscreen = () => {
            // 模拟全屏：隐藏地址栏并调整样式
            console.log('使用模拟全屏模式');

            // 隐藏地址栏的技巧
            window.scrollTo(0, 1);
            setTimeout(() => {
                window.scrollTo(0, 0);

                // 添加模拟全屏的CSS类
                document.body.classList.add('simulated-fullscreen');

                // 不调整游戏尺寸，保持固定的桌面端尺寸
                // 游戏会通过Scale.FIT模式自动适配到全屏容器中

                // 设置全屏就绪状态
                setIsFullscreenReady(true);
            }, 100);
        };

        const enterFullscreen = async () => {
            // 检查是否已经在全屏模式
            if (isFullscreenActive()) {
                console.log('已经在全屏模式');
                return;
            }

            // 检查浏览器是否支持全屏
            if (!isFullscreenSupported()) {
                console.log('浏览器不支持全屏模式，使用模拟全屏');
                simulateFullscreen();
                return;
            }

            try {
                const element = document.documentElement;

                // 按优先级尝试不同的全屏API
                if (element.requestFullscreen) {
                    await element.requestFullscreen({ navigationUI: "hide" });
                } else if (element.webkitRequestFullscreen) {
                    await element.webkitRequestFullscreen();
                } else if (element.mozRequestFullScreen) {
                    await element.mozRequestFullScreen();
                } else if (element.msRequestFullscreen) {
                    await element.msRequestFullscreen();
                }

                console.log('成功进入全屏模式');
                // 设置全屏就绪状态
                setIsFullscreenReady(true);
            } catch (error) {
                console.log('全屏请求被拒绝或失败:', error.message);

                // 如果全屏API失败，显示手动全屏按钮
                setShowFullscreenButton(true);

                // 同时使用模拟全屏
                simulateFullscreen();
            }
        };

        const handleUserInteraction = () => {
            if (!isFullscreenActive()) {
                // 延迟执行，确保用户交互事件完成
                setTimeout(() => {
                    enterFullscreen();
                }, 100);
            }
        };

        // 手动全屏函数
        window.manualEnterFullscreen = async () => {
            await enterFullscreen();
            setShowFullscreenButton(false);
        };

        console.log('检测到移动端设备，将在用户交互时尝试进入全屏');

        // 立即应用一些移动端优化
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';

        // 防止iOS Safari的弹跳效果
        document.addEventListener('touchmove', (e) => {
            e.preventDefault();
        }, { passive: false });

        // 使用多种事件类型确保能捕获到用户交互
        const events = ['touchstart', 'touchend', 'click', 'keydown'];
        events.forEach(eventType => {
            document.addEventListener(eventType, handleUserInteraction, {
                once: true,
                passive: true // 所有事件都设为被动，因为handleUserInteraction不需要preventDefault
            });
        });

        // 延迟尝试隐藏地址栏
        setTimeout(() => {
            window.scrollTo(0, 1);
            setTimeout(() => window.scrollTo(0, 0), 100);
        }, 500);


        // 监听全屏状态变化
        const handleFullscreenChange = () => {
            if (isFullscreenActive()) {
                console.log('已进入全屏模式');
                setIsFullscreenReady(true);
            } else {
                console.log('已退出全屏模式');
                // 如果是移动端且退出了全屏，需要重新进入
                if (isMobile) {
                    setIsFullscreenReady(false);
                }
            }
            // 不调整游戏尺寸，保持固定的桌面端尺寸
        };

        // 添加所有可能的全屏事件监听器
        const fullscreenEvents = [
            'fullscreenchange',
            'webkitfullscreenchange',
            'mozfullscreenchange',
            'MSFullscreenChange'
        ];

        fullscreenEvents.forEach(event => {
            document.addEventListener(event, handleFullscreenChange);
        });

        return () => {
            // 清理所有事件监听器
            const events = ['touchstart', 'touchend', 'click', 'keydown'];
            events.forEach(eventType => {
                document.removeEventListener(eventType, handleUserInteraction);
            });

            fullscreenEvents.forEach(event => {
                document.removeEventListener(event, handleFullscreenChange);
            });
        };
    }, [isMobile]);

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

            // 使用useRef来存储当前场景，避免触发重新渲染
            phaserRef.current.currentScene = scene;

            const controlPanel = document.getElementById('pathfinding-controls');
            if (controlPanel) {
                if (scene.scene.key === 'TitleScene') {
                    // 在标题界面隐藏调试控制面板
                    controlPanel.style.display = 'none';
                } else {
                    // 在游戏界面显示调试控制面板
                    // 移动端隐藏调试控制面板
                    const checkIsMobile = () => {
                        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                            (window.innerWidth <= 768 && window.innerHeight <= 1024);
                    };

                    if (checkIsMobile()) {
                        controlPanel.style.display = 'none';
                    } else {
                        controlPanel.style.display = 'block';
                    }
                }
            }

            // 将最新的 scene 对象传递给 setupControls
            setupControls(scene);

            // 只在场景真正改变时更新状态
            setCurrentScene(prevScene => {
                if (prevScene?.scene?.key !== scene.scene?.key) {
                    return scene;
                }
                return prevScene;
            });
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

    // 虚拟按键处理函数
    const handleVirtualKeyDown = (key) => {
        if (!phaserRef.current?.game) return;

        console.log(`虚拟按键按下: ${key}`);

        // 处理刷新按钮
        if (key === 'REFRESH') {
            console.log('刷新页面');
            window.location.reload();
            return;
        }

        const scene = phaserRef.current.game.scene.getScene('Game');
        if (!scene) return;

        // 直接设置按键状态，更可靠的方法
        try {
            if (key === 'W' && scene.wasd?.W) {
                scene.wasd.W.isDown = true;
                scene.wasd.W._justDown = true;
            } else if (key === 'A' && scene.wasd?.A) {
                scene.wasd.A.isDown = true;
                scene.wasd.A._justDown = true;
            } else if (key === 'S' && scene.wasd?.S) {
                scene.wasd.S.isDown = true;
                scene.wasd.S._justDown = true;
            } else if (key === 'D' && scene.wasd?.D) {
                scene.wasd.D.isDown = true;
                scene.wasd.D._justDown = true;
            } else if (key === 'E' && scene.interactKey) {
                // 对于E键，直接触发交互检查
                if (typeof scene.checkNPCInteraction === 'function') {
                    scene.checkNPCInteraction();
                }
            }
        } catch (error) {
            console.error('虚拟按键处理错误:', error);
        }
    };

    const handleVirtualKeyUp = (key) => {
        if (!phaserRef.current?.game) return;

        console.log(`虚拟按键释放: ${key}`);

        // 刷新按钮和E键不需要处理释放状态
        if (key === 'REFRESH' || key === 'E') {
            return;
        }

        const scene = phaserRef.current.game.scene.getScene('Game');
        if (!scene) return;

        // 重置按键状态
        try {
            if (key === 'W' && scene.wasd?.W) {
                scene.wasd.W.isDown = false;
                scene.wasd.W._justDown = false;
                scene.wasd.W._justUp = true;
            } else if (key === 'A' && scene.wasd?.A) {
                scene.wasd.A.isDown = false;
                scene.wasd.A._justDown = false;
                scene.wasd.A._justUp = true;
            } else if (key === 'S' && scene.wasd?.S) {
                scene.wasd.S.isDown = false;
                scene.wasd.S._justDown = false;
                scene.wasd.S._justUp = true;
            } else if (key === 'D' && scene.wasd?.D) {
                scene.wasd.D.isDown = false;
                scene.wasd.D._justDown = false;
                scene.wasd.D._justUp = true;
            }
        } catch (error) {
            console.error('虚拟按键释放处理错误:', error);
        }
    };

    return (
        <div id="app">
            {/* 只有在全屏就绪后才渲染游戏 */}
            {isFullscreenReady && <PhaserGame ref={phaserRef} />}

            {/* 移动端全屏等待提示 */}
            {isMobile && !isFullscreenReady && !showFullscreenButton && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100vw',
                        height: '100vh',
                        background: 'rgba(0,0,0,0.95)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 10000,
                        cursor: 'pointer'
                    }}
                    onClick={() => {
                        // 尝试进入全屏
                        const events = ['touchstart', 'click'];
                        events.forEach(eventType => {
                            document.dispatchEvent(new Event(eventType));
                        });
                    }}
                >
                    <div style={{
                        background: 'rgba(0,0,0,0.9)',
                        color: 'white',
                        padding: '30px',
                        borderRadius: '15px',
                        textAlign: 'center',
                        fontFamily: 'FusionPixel, sans-serif',
                        maxWidth: '300px',
                        border: '2px solid #0ec3c9'
                    }}>
                        <div style={{
                            fontSize: '48px',
                            marginBottom: '20px',
                            animation: 'pulse 2s infinite'
                        }}>
                            📱
                        </div>
                        <h3 style={{ margin: '0 0 15px 0', fontSize: '18px', color: '#0ec3c9' }}>
                            移动端优化
                        </h3>
                        <p style={{ margin: '0 0 20px 0', fontSize: '14px', lineHeight: '1.5' }}>
                            点击此处进入全屏模式<br />
                            以获得最佳游戏体验
                        </p>
                        <div style={{
                            fontSize: '12px',
                            color: '#ccc',
                            fontStyle: 'italic'
                        }}>
                            全屏模式可确保游戏正确获取屏幕尺寸
                        </div>
                        <div style={{
                            marginTop: '15px',
                            padding: '8px 16px',
                            background: '#0ec3c9',
                            color: '#000',
                            borderRadius: '5px',
                            fontSize: '14px',
                            fontWeight: 'bold'
                        }}>
                            点击进入全屏
                        </div>
                    </div>
                </div>
            )}

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

            {/* 手动全屏按钮 */}
            {showFullscreenButton && (
                <div style={{
                    position: 'fixed',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    zIndex: 10000,
                    background: 'rgba(0,0,0,0.9)',
                    color: 'white',
                    padding: '20px',
                    borderRadius: '10px',
                    textAlign: 'center',
                    fontFamily: 'FusionPixel, sans-serif'
                }}>
                    <p>为了更好的游戏体验，请点击下方按钮进入全屏模式</p>
                    <button
                        onClick={() => window.manualEnterFullscreen()}
                        style={{
                            padding: '10px 20px',
                            fontSize: '16px',
                            background: '#0ec3c9',
                            color: 'white',
                            border: 'none',
                            borderRadius: '5px',
                            cursor: 'pointer',
                            fontFamily: 'FusionPixel, sans-serif'
                        }}
                    >
                        进入全屏
                    </button>
                    <br />
                    <button
                        onClick={() => setShowFullscreenButton(false)}
                        style={{
                            marginTop: '10px',
                            padding: '5px 15px',
                            fontSize: '12px',
                            background: 'transparent',
                            color: '#ccc',
                            border: '1px solid #ccc',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            fontFamily: 'FusionPixel, sans-serif'
                        }}
                    >
                        跳过
                    </button>
                </div>
            )}

            {/* 移动端虚拟控制器 */}
            {isMobile && !isLoadingLLM && isFullscreenReady && (
                <VirtualControls
                    onKeyDown={handleVirtualKeyDown}
                    onKeyUp={handleVirtualKeyUp}
                />
            )}
        </div>
    )
}

export default App
