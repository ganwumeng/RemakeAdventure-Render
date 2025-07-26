import { useRef, useEffect, useState } from 'react';
import { PhaserGame } from './PhaserGame';
import { EventBus } from './game/EventBus';
import LoadingScreen from './components/LoadingScreen.jsx';
import AboutModal from './components/AboutModal.jsx';
import VirtualControls from './components/VirtualControls.jsx';

function App() {
    const phaserRef = useRef();
    const [useLLM, setUseLLM] = useState(true);
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [loadingStatus, setLoadingStatus] = useState('初始化中...');
    const [showAbout, setShowAbout] = useState(false);
    const [isLoadingLLM, setIsLoadingLLM] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [isFullscreenReady, setIsFullscreenReady] = useState(false);
    const [currentScene, setCurrentScene] = useState(null);
    const [showRemakeSelector, setShowRemakeSelector] = useState(false);

    // 文件选择器组件
    const RemakeFileSelectorComponent = ({ onFileLoaded, onCancel }) => {
        const fileInputRef = useRef(null);

        const handleFileChange = (event) => {
            const file = event.target.files[0];
            if (file) {
                onFileLoaded(file);
            }
        };

        const triggerFileSelect = () => fileInputRef.current.click();

        return (
            <div style={{
                position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                backgroundColor: 'rgba(0, 0, 0, 0.8)', zIndex: 1000,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
                <div style={{
                    background: '#2d3748', color: 'white', padding: '30px', borderRadius: '15px',
                    textAlign: 'center', fontFamily: 'FusionPixel, sans-serif', maxWidth: '400px',
                    border: '2px solid #4a5568', boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
                }}>
                    <h2 style={{ margin: '0 0 20px 0', fontSize: '24px', color: '#0ec3c9' }}>
                        加载游戏场景
                    </h2>
                    <p style={{ margin: '0 0 25px 0', fontSize: '16px', lineHeight: '1.5', color: '#a0aec0' }}>
                        请选择一个 .zip 或 .remake 文件来开始游戏。
                    </p>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept=".zip,.remake"
                        style={{ display: 'none' }}
                    />
                    <button
                        onClick={triggerFileSelect}
                        style={{
                            width: '100%', padding: '15px 20px', fontSize: '18px',
                            background: '#0ec3c9', color: '#1a202c', border: 'none',
                            borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold',
                            marginBottom: '15px', transition: 'background-color 0.2s'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2de5ed'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#0ec3c9'}
                    >
                        选择文件
                    </button>
                    <button
                        onClick={onCancel}
                        style={{
                            width: '100%', padding: '10px 20px', fontSize: '16px',
                            background: '#4a5568', color: '#e2e8f0', border: 'none',
                            borderRadius: '8px', cursor: 'pointer', transition: 'background-color 0.2s'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#718096'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#4a5568'}
                    >
                        取消
                    </button>
                </div>
            </div>
        );
    };

    // 处理启动游戏
    const handleStartGame = (withLLM) => {
        setUseLLM(withLLM);
        setShowRemakeSelector(true);
    };

    // 处理文件加载
    const handleRemakeFileLoaded = async (file) => {
        setShowRemakeSelector(false);
        setIsLoadingLLM(true);
        setLoadingStatus('正在读取场景文件...');

        try {
            const gameDataArrayBuffer = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (event) => resolve(event.target.result);
                reader.onerror = (error) => reject(error);
                reader.readAsArrayBuffer(file);
            });

            if (useLLM) {
                setLoadingStatus('正在加载大模型模块...');
                const { initializeLLM } = await import('./game/llm/runner.js');
                await initializeLLM((progress) => {
                    setLoadingProgress(progress.progress || 0);
                    setLoadingStatus('正在下载和初始化模型...');
                });
            }

            setLoadingStatus('加载完成！');
            setTimeout(() => {
                setIsLoadingLLM(false);
                if (phaserRef.current?.game) {
                    phaserRef.current.game.scene.start('Game', { remakeData: gameDataArrayBuffer });
                    phaserRef.current.game.scene.stop('TitleScene');
                }
            }, 500);
        } catch (error) {
            console.error('处理文件或加载大模型失败:', error);
            setLoadingStatus('加载失败，请刷新页面重试');
            setIsLoadingLLM(false);
        }
    };

    // 处理取消文件选择
    const handleCancelRemakeSelection = () => {
        setShowRemakeSelector(false);
        setUseLLM(false);
    };

    // [修改] 检测移动端，但不立即改变 isFullscreenReady 状态
    useEffect(() => {
        const checkIsMobile = () => /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (window.innerWidth <= 768 && window.innerHeight <= 1024);
        const mobile = checkIsMobile();
        setIsMobile(mobile);
        if (!mobile) {
            // 桌面端直接准备好游戏
            setIsFullscreenReady(true);
        }
        // 移动端 isFullscreenReady 保持 false，会触发全屏提示
    }, []);

    // [修改] 设置全屏功能，但不强制执行
    useEffect(() => {
        if (!isMobile) return;

        const enterFullscreen = async () => {
            try {
                const element = document.documentElement;
                if (element.requestFullscreen) await element.requestFullscreen({ navigationUI: "hide" });
                else if (element.webkitRequestFullscreen) await element.webkitRequestFullscreen();
                else if (element.mozRequestFullScreen) await element.mozRequestFullScreen();
                else if (element.msRequestFullscreen) await element.msRequestFullscreen();
            } catch (error) {
                console.log('全屏请求被拒绝或失败:', error.message);
            }
        };

        // 暴露给UI调用的函数
        window.manualEnterFullscreen = async () => {
            await enterFullscreen();
            setIsFullscreenReady(true); // 无论成功与否，都继续游戏
        };

        window.skipFullscreen = () => {
            setIsFullscreenReady(true); // 用户选择跳过
        };

        return () => {
            delete window.manualEnterFullscreen;
            delete window.skipFullscreen;
        };
    }, [isMobile]);

    // 游戏事件监听
    useEffect(() => {
        const startGameListener = (data) => handleStartGame(data.useLLM);
        const showAboutListener = () => setShowAbout(true);
        EventBus.on('title-start-game', startGameListener);
        EventBus.on('title-show-about', showAboutListener);

        const sceneReadyListener = (scene) => {
            setCurrentScene(scene);
        };
        EventBus.on('current-scene-ready', sceneReadyListener);

        return () => {
            EventBus.off('title-start-game', startGameListener);
            EventBus.off('title-show-about', showAboutListener);
            EventBus.off('current-scene-ready', sceneReadyListener);
        };
    }, [useLLM]);

    // 虚拟按键处理
    const handleVirtualKeyDown = (key) => {
        if (!phaserRef.current?.game) return;
        if (key === 'REFRESH') {
            window.location.reload();
            return;
        }
        const scene = phaserRef.current.game.scene.getScene('Game');
        if (!scene) return;
        if (key === 'W' && scene.wasd?.W) scene.wasd.W.isDown = true;
        else if (key === 'A' && scene.wasd?.A) scene.wasd.A.isDown = true;
        else if (key === 'S' && scene.wasd?.S) scene.wasd.S.isDown = true;
        else if (key === 'D' && scene.wasd?.D) scene.wasd.D.isDown = true;
        else if (key === 'E' && scene.interactKey) scene.checkNPCInteraction?.();
    };

    const handleVirtualKeyUp = (key) => {
        if (!phaserRef.current?.game || key === 'REFRESH' || key === 'E') return;
        const scene = phaserRef.current.game.scene.getScene('Game');
        if (!scene) return;
        if (key === 'W' && scene.wasd?.W) scene.wasd.W.isDown = false;
        else if (key === 'A' && scene.wasd?.A) scene.wasd.A.isDown = false;
        else if (key === 'S' && scene.wasd?.S) scene.wasd.S.isDown = false;
        else if (key === 'D' && scene.wasd?.D) scene.wasd.D.isDown = false;
    };

    return (
        <div id="app">
            {/* [修改] 游戏在用户对全屏提示做出选择后渲染 */}
            {isFullscreenReady && <PhaserGame ref={phaserRef} />}

            {/* [修改] 全屏建议提示框 */}
            {isMobile && !isFullscreenReady && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
                    <div style={{ background: '#2d3748', color: 'white', padding: '30px', borderRadius: '15px', textAlign: 'center', fontFamily: 'FusionPixel, sans-serif', maxWidth: '350px', border: '2px solid #0ec3c9', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
                        <div style={{ fontSize: '48px', marginBottom: '20px' }}>📱</div>
                        <h3 style={{ margin: '0 0 15px 0', fontSize: '20px', color: '#0ec3c9' }}>全屏体验更佳</h3>
                        <p style={{ margin: '0 0 25px 0', fontSize: '14px', lineHeight: '1.6', color: '#a0aec0' }}>
                            建议进入全屏模式以获得最佳游戏效果。
                        </p>
                        <button
                            onClick={() => window.manualEnterFullscreen()}
                            style={{
                                width: '100%', padding: '15px 20px', fontSize: '18px',
                                background: '#0ec3c9', color: '#1a202c', border: 'none',
                                borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold',
                                marginBottom: '15px', transition: 'background-color 0.2s'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2de5ed'}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#0ec3c9'}
                        >
                            进入全屏
                        </button>
                        <button
                            onClick={() => window.skipFullscreen()}
                            style={{
                                width: '100%', padding: '10px 20px', fontSize: '16px',
                                background: 'transparent', color: '#a0aec0', border: '1px solid #4a5568',
                                borderRadius: '8px', cursor: 'pointer', transition: 'background-color 0.2s, color 0.2s'
                            }}
                             onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#4a5568'; e.currentTarget.style.color = '#e2e8f0'; }}
                             onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#a0aec0'; }}
                        >
                            跳过
                        </button>
                    </div>
                </div>
            )}

            {showRemakeSelector && (
                <RemakeFileSelectorComponent
                    onFileLoaded={handleRemakeFileLoaded}
                    onCancel={handleCancelRemakeSelection}
                />
            )}

            {isLoadingLLM && <LoadingScreen progress={loadingProgress} status={loadingStatus} />}
            <AboutModal isOpen={showAbout} onClose={() => setShowAbout(false)} />

            {/* [修改] 虚拟摇杆在游戏准备好后显示 */}
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
