import { useEffect, useRef, useState } from 'react';

const VirtualControls = ({ onKeyDown, onKeyUp }) => {
    const [pressedKeys, setPressedKeys] = useState(new Set());
    const touchRefs = useRef(new Map()); // 跟踪每个触摸点

    // 虚拟按键配置
    const virtualKeys = [
        { key: 'W', label: '↑', x: 65, y: 20 },
        { key: 'A', label: '←', x: 20, y: 65 },
        { key: 'S', label: '↓', x: 65, y: 65 },
        { key: 'D', label: '→', x: 110, y: 65 },
        { key: 'E', label: 'E', x: 170, y: 40, special: true },
        { key: 'REFRESH', label: '⟳', x: 220, y: 40, special: true, action: true }
    ];

    const handleTouchStart = (e, key) => {
        // 安全地调用preventDefault
        if (e.cancelable) {
            e.preventDefault();
        }
        
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
        // 安全地调用preventDefault
        if (e.cancelable) {
            e.preventDefault();
        }
        
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
        // 安全地调用preventDefault
        if (e.cancelable) {
            e.preventDefault();
        }
        if (!pressedKeys.has(key)) {
            setPressedKeys(prev => new Set([...prev, key]));
            onKeyDown?.(key);
        }
    };

    const handleMouseUp = (e, key) => {
        // 安全地调用preventDefault
        if (e.cancelable) {
            e.preventDefault();
        }
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
        // 安全地调用preventDefault
        if (e.cancelable) {
            e.preventDefault();
        }
        
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
                width: '270px',
                height: '110px',
                zIndex: 1000,
                userSelect: 'none',
                pointerEvents: 'auto',
                touchAction: 'none' // 完全禁用默认触摸行为
            }}
            onTouchMove={handleTouchMove}
        >
            {virtualKeys.map(({ key, label, x, y, special, action }) => {
                // 根据按键类型确定颜色
                let bgColor, borderColor;
                if (action) {
                    // 刷新按钮使用绿色
                    bgColor = pressedKeys.has(key) ? 'rgba(34, 197, 94, 0.8)' : 'rgba(34, 197, 94, 0.4)';
                    borderColor = '#22c55e';
                } else if (special) {
                    // E键使用橙色
                    bgColor = pressedKeys.has(key) ? 'rgba(255, 165, 0, 0.8)' : 'rgba(255, 165, 0, 0.4)';
                    borderColor = '#FFA500';
                } else {
                    // WASD使用青色
                    bgColor = pressedKeys.has(key) ? 'rgba(14, 195, 201, 0.8)' : 'rgba(255, 255, 255, 0.4)';
                    borderColor = '#0ec3c9';
                }

                return (
                    <div
                        key={key}
                        data-virtual-key={key}
                        style={{
                            position: 'absolute',
                            left: `${x}px`,
                            top: `${y}px`,
                            width: special || action ? '40px' : '35px', // 稍微大一点
                            height: special || action ? '40px' : '35px',
                            backgroundColor: bgColor,
                            border: `2px solid ${borderColor}`,
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: pressedKeys.has(key) ? '#000' : '#fff',
                            fontFamily: 'FusionPixel, monospace',
                            fontSize: special || action ? '18px' : '20px', // 稍微大一点
                            fontWeight: 'bold',
                            textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
                            cursor: 'pointer',
                            transition: 'all 0.1s ease',
                            transform: pressedKeys.has(key) ? 'scale(0.95)' : 'scale(1)',
                            boxShadow: pressedKeys.has(key) 
                                ? 'inset 0 2px 4px rgba(0,0,0,0.3)' 
                                : '0 2px 4px rgba(0,0,0,0.3)',
                            backdropFilter: 'blur(2px)',
                            touchAction: 'none' // 禁用默认触摸行为
                        }}
                        onTouchStart={(e) => handleTouchStart(e, key)}
                        onTouchEnd={(e) => handleTouchEnd(e, key)}
                        onTouchCancel={(e) => handleTouchEnd(e, key)}
                        onMouseDown={(e) => handleMouseDown(e, key)}
                        onMouseUp={(e) => handleMouseUp(e, key)}
                        onMouseLeave={(e) => handleMouseUp(e, key)}
                        onContextMenu={(e) => {
                            if (e.cancelable) {
                                e.preventDefault();
                            }
                        }}
                    >
                        {label}
                    </div>
                );
            })}
            
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