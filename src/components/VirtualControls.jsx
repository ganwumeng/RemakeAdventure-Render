import { useEffect, useRef, useState } from 'react';

const VirtualControls = ({ onKeyDown, onKeyUp }) => {
    const [pressedKeys, setPressedKeys] = useState(new Set());
    const touchRefs = useRef(new Map()); // 跟踪每个触摸点

    // 虚拟按键配置
    const virtualKeys = [
        { key: 'W', label: '↑', x: 60, y: 20 },
        { key: 'A', label: '←', x: 20, y: 60 },
        { key: 'S', label: '↓', x: 60, y: 60 },
        { key: 'D', label: '→', x: 100, y: 60 },
        { key: 'E', label: 'E', x: 160, y: 40, special: true }
    ];

    const handleTouchStart = (e, key) => {
        e.preventDefault();
        
        // 支持多点触控
        Array.from(e.changedTouches).forEach(touch => {
            touchRefs.current.set(touch.identifier, key);
        });

        if (!pressedKeys.has(key)) {
            setPressedKeys(prev => new Set([...prev, key]));
            onKeyDown?.(key);
        }
    };

    const handleTouchEnd = (e, key) => {
        e.preventDefault();
        
        // 检查是否还有其他触摸点在这个按键上
        let stillPressed = false;
        Array.from(e.changedTouches).forEach(touch => {
            if (touchRefs.current.get(touch.identifier) === key) {
                touchRefs.current.delete(touch.identifier);
            }
        });

        // 检查是否还有其他触摸点在按这个键
        for (const [touchId, touchKey] of touchRefs.current) {
            if (touchKey === key) {
                stillPressed = true;
                break;
            }
        }

        if (!stillPressed && pressedKeys.has(key)) {
            setPressedKeys(prev => {
                const newSet = new Set(prev);
                newSet.delete(key);
                return newSet;
            });
            onKeyUp?.(key);
        }
    };

    const handleMouseDown = (e, key) => {
        e.preventDefault();
        if (!pressedKeys.has(key)) {
            setPressedKeys(prev => new Set([...prev, key]));
            onKeyDown?.(key);
        }
    };

    const handleMouseUp = (e, key) => {
        e.preventDefault();
        if (pressedKeys.has(key)) {
            setPressedKeys(prev => {
                const newSet = new Set(prev);
                newSet.delete(key);
                return newSet;
            });
            onKeyUp?.(key);
        }
    };

    // 处理触摸移出按键区域
    const handleTouchMove = (e) => {
        e.preventDefault();
        
        Array.from(e.changedTouches).forEach(touch => {
            const element = document.elementFromPoint(touch.clientX, touch.clientY);
            const currentKey = touchRefs.current.get(touch.identifier);
            
            if (currentKey && (!element || !element.dataset.virtualKey || element.dataset.virtualKey !== currentKey)) {
                // 触摸点移出了按键区域
                touchRefs.current.delete(touch.identifier);
                
                // 检查是否还有其他触摸点在这个按键上
                let stillPressed = false;
                for (const [touchId, touchKey] of touchRefs.current) {
                    if (touchKey === currentKey) {
                        stillPressed = true;
                        break;
                    }
                }
                
                if (!stillPressed && pressedKeys.has(currentKey)) {
                    setPressedKeys(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(currentKey);
                        return newSet;
                    });
                    onKeyUp?.(currentKey);
                }
            }
        });
    };

    // 使用ref来跟踪当前按键状态，避免闭包问题
    const pressedKeysRef = useRef(new Set());
    
    // 更新ref当状态改变时
    useEffect(() => {
        pressedKeysRef.current = pressedKeys;
    }, [pressedKeys]);

    // 清理所有按键状态（当组件卸载或失去焦点时）
    const clearAllKeys = () => {
        pressedKeysRef.current.forEach(key => {
            onKeyUp?.(key);
        });
        setPressedKeys(new Set());
        touchRefs.current.clear();
    };

    useEffect(() => {
        // 监听页面失去焦点，清理按键状态
        const handleBlur = () => clearAllKeys();
        const handleVisibilityChange = () => {
            if (document.hidden) clearAllKeys();
        };

        window.addEventListener('blur', handleBlur);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('blur', handleBlur);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            clearAllKeys();
        };
    }, []); // 移除pressedKeys依赖，避免无限循环

    return (
        <div 
            style={{
                position: 'fixed',
                bottom: 'env(safe-area-inset-bottom, 20px)',
                left: 'env(safe-area-inset-left, 20px)',
                width: '200px',
                height: '100px',
                zIndex: 1000,
                userSelect: 'none',
                pointerEvents: 'auto',
                touchAction: 'manipulation'
            }}
            onTouchMove={handleTouchMove}
        >
            {virtualKeys.map(({ key, label, x, y, special }) => (
                <div
                    key={key}
                    data-virtual-key={key}
                    style={{
                        position: 'absolute',
                        left: `${x}px`,
                        top: `${y}px`,
                        width: special ? '35px' : '30px',
                        height: special ? '35px' : '30px',
                        backgroundColor: pressedKeys.has(key) 
                            ? (special ? 'rgba(255, 165, 0, 0.8)' : 'rgba(14, 195, 201, 0.8)')
                            : (special ? 'rgba(255, 165, 0, 0.4)' : 'rgba(255, 255, 255, 0.4)'),
                        border: `2px solid ${special ? '#FFA500' : '#0ec3c9'}`,
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: pressedKeys.has(key) ? '#000' : '#fff',
                        fontFamily: 'FusionPixel, monospace',
                        fontSize: special ? '16px' : '18px',
                        fontWeight: 'bold',
                        textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
                        cursor: 'pointer',
                        transition: 'all 0.1s ease',
                        transform: pressedKeys.has(key) ? 'scale(0.95)' : 'scale(1)',
                        boxShadow: pressedKeys.has(key) 
                            ? 'inset 0 2px 4px rgba(0,0,0,0.3)' 
                            : '0 2px 4px rgba(0,0,0,0.3)',
                        backdropFilter: 'blur(2px)'
                    }}
                    onTouchStart={(e) => handleTouchStart(e, key)}
                    onTouchEnd={(e) => handleTouchEnd(e, key)}
                    onTouchCancel={(e) => handleTouchEnd(e, key)}
                    onMouseDown={(e) => handleMouseDown(e, key)}
                    onMouseUp={(e) => handleMouseUp(e, key)}
                    onMouseLeave={(e) => handleMouseUp(e, key)}
                    onContextMenu={(e) => e.preventDefault()}
                >
                    {label}
                </div>
            ))}
            
            {/* 半透明背景 */}
            <div
                style={{
                    position: 'absolute',
                    top: '-10px',
                    left: '-10px',
                    right: '-10px',
                    bottom: '-10px',
                    backgroundColor: 'rgba(0, 0, 0, 0.2)',
                    borderRadius: '15px',
                    zIndex: -1,
                    backdropFilter: 'blur(1px)'
                }}
            />
        </div>
    );
};

export default VirtualControls;