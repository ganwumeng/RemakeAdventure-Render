import { useEffect, useRef, useState, useCallback } from 'react';

const VirtualControls = ({ onKeyDown, onKeyUp }) => {
    const [pressedKeys, setPressedKeys] = useState(new Set());
    const touchRefs = useRef(new Map()); // 跟踪每个触摸点对应的按键
    const containerRef = useRef(null); // 指向主容器的Ref

    // 虚拟按键配置
    const virtualKeys = [
        { key: 'W', label: '↑', x: 65, y: 20 },
        { key: 'A', label: '←', x: 20, y: 65 },
        { key: 'S', label: '↓', x: 65, y: 65 },
        { key: 'D', label: '→', x: 110, y: 65 },
        { key: 'E', label: 'E', x: 170, y: 40, special: true },
        { key: 'REFRESH', label: '⟳', x: 220, y: 40, special: true, action: true }
    ];

    // 使用useCallback封装核心的按键操作逻辑，以稳定函数引用
    const pressKey = useCallback((key) => {
        if (!key) return;
        setPressedKeys(prev => {
            if (prev.has(key)) return prev; // 如果已经按下，则不重复触发
            const newSet = new Set(prev);
            newSet.add(key);
            onKeyDown?.(key);
            return newSet;
        });
    }, [onKeyDown]);

    const releaseKey = useCallback((key) => {
        if (!key) return;
        setPressedKeys(prev => {
            if (!prev.has(key)) return prev; // 如果未按下，则不触发
            const newSet = new Set(prev);
            newSet.delete(key);
            onKeyUp?.(key);
            return newSet;
        });
    }, [onKeyUp]);

    // --- 核心改动：使用useEffect手动绑定事件监听器 ---
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        // 定义触摸开始事件处理函数
        const handleTouchStart = (e) => {
            e.preventDefault(); // 现在可以安全调用，因为 passive: false
            Array.from(e.changedTouches).forEach(touch => {
                const target = touch.target.closest('[data-virtual-key]');
                if (target) {
                    const key = target.dataset.virtualKey;
                    touchRefs.current.set(touch.identifier, key); // 记录触摸点ID和按键的映射
                    pressKey(key);
                }
            });
        };

        // 定义触摸结束/取消事件处理函数
        const handleTouchEndOrCancel = (e) => {
            e.preventDefault();
            Array.from(e.changedTouches).forEach(touch => {
                const releasedKey = touchRefs.current.get(touch.identifier);
                if (releasedKey) {
                    touchRefs.current.delete(touch.identifier); // 移除映射
                    
                    // 检查是否还有其他手指按在该键上
                    let stillPressed = false;
                    for (const key of touchRefs.current.values()) {
                        if (key === releasedKey) {
                            stillPressed = true;
                            break;
                        }
                    }

                    if (!stillPressed) {
                        releaseKey(releasedKey);
                    }
                }
            });
        };

        // 定义触摸移动事件处理函数
        const handleTouchMove = (e) => {
            e.preventDefault();
            Array.from(e.changedTouches).forEach(touch => {
                const currentKey = touchRefs.current.get(touch.identifier);
                if (!currentKey) return;

                // 从当前触摸坐标获取元素
                const elementOver = document.elementFromPoint(touch.clientX, touch.clientY);
                const keyOver = elementOver?.closest('[data-virtual-key]')?.dataset.virtualKey;

                // 如果手指滑出了原来的按键区域
                if (keyOver !== currentKey) {
                    handleTouchEndOrCancel({ preventDefault: () => {}, changedTouches: [touch] });
                }
            });
        };

        // 绑定事件，并明确设置 passive 为 false
        container.addEventListener('touchstart', handleTouchStart, { passive: false });
        container.addEventListener('touchend', handleTouchEndOrCancel, { passive: false });
        container.addEventListener('touchcancel', handleTouchEndOrCancel, { passive: false });
        container.addEventListener('touchmove', handleTouchMove, { passive: false });

        // 组件卸载时清理事件监听器
        return () => {
            container.removeEventListener('touchstart', handleTouchStart);
            container.removeEventListener('touchend', handleTouchEndOrCancel);
            container.removeEventListener('touchcancel', handleTouchEndOrCancel);
            container.removeEventListener('touchmove', handleTouchMove);
        };
    }, [pressKey, releaseKey]); // 依赖于稳定版的 pressKey 和 releaseKey

    // --- 修复: 修改 clearAllKeys 的定义 ---
    // 使用 setState 的函数式更新形式，避免依赖 pressedKeys
    const clearAllKeys = useCallback(() => {
        setPressedKeys(currentPressedKeys => {
            currentPressedKeys.forEach(key => {
                onKeyUp?.(key);
            });
            return new Set(); // 返回一个新的空Set来清空状态
        });
        touchRefs.current.clear();
    }, [onKeyUp]); // 现在只依赖 onKeyUp，函数变得稳定

    useEffect(() => {
        const handleBlur = () => clearAllKeys();
        const handleVisibilityChange = () => {
            if (document.hidden) clearAllKeys();
        };

        window.addEventListener('blur', handleBlur);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('blur', handleBlur);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            // 在组件卸载时也清理按键，以防万一
            clearAllKeys();
        };
    }, [clearAllKeys]); // 依赖于稳定版的 clearAllKeys

    return (
        <div 
            ref={containerRef} // 挂载Ref到主容器
            style={{
                position: 'fixed',
                bottom: 'env(safe-area-inset-bottom, 20px)',
                left: 'env(safe-area-inset-left, 20px)',
                width: '270px',
                height: '110px',
                zIndex: 1000,
                userSelect: 'none',
                WebkitUserSelect: 'none', // 兼容旧版Safari
                touchAction: 'none' // 禁用默认触摸行为
            }}
        >
            {virtualKeys.map(({ key, label, x, y, special, action }) => {
                const isPressed = pressedKeys.has(key);
                let bgColor, borderColor;
                if (action) {
                    bgColor = isPressed ? 'rgba(34, 197, 94, 0.8)' : 'rgba(34, 197, 94, 0.4)';
                    borderColor = '#22c55e';
                } else if (special) {
                    bgColor = isPressed ? 'rgba(255, 165, 0, 0.8)' : 'rgba(255, 165, 0, 0.4)';
                    borderColor = '#FFA500';
                } else {
                    bgColor = isPressed ? 'rgba(14, 195, 201, 0.8)' : 'rgba(255, 255, 255, 0.4)';
                    borderColor = '#0ec3c9';
                }

                return (
                    <div
                        key={key}
                        data-virtual-key={key} // 用于事件委托时识别按键
                        style={{
                            position: 'absolute',
                            left: `${x}px`,
                            top: `${y}px`,
                            width: special || action ? '40px' : '35px',
                            height: special || action ? '40px' : '35px',
                            backgroundColor: bgColor,
                            border: `2px solid ${borderColor}`,
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: isPressed ? '#000' : '#fff',
                            fontFamily: 'FusionPixel, monospace',
                            fontSize: special || action ? '18px' : '20px',
                            fontWeight: 'bold',
                            textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
                            cursor: 'pointer',
                            transition: 'all 0.1s ease',
                            transform: isPressed ? 'scale(0.95)' : 'scale(1)',
                            boxShadow: isPressed 
                                ? 'inset 0 2px 4px rgba(0,0,0,0.3)' 
                                : '0 2px 4px rgba(0,0,0,0.3)',
                            backdropFilter: 'blur(2px)',
                            pointerEvents: 'auto', // 确保按键可以接收鼠标事件
                        }}
                        // 鼠标事件可以保留在JSX中，因为它们没有passive的问题
                        onMouseDown={(e) => { e.preventDefault(); pressKey(key); }}
                        onMouseUp={(e) => { e.preventDefault(); releaseKey(key); }}
                        onMouseLeave={(e) => { e.preventDefault(); releaseKey(key); }}
                        onContextMenu={(e) => e.preventDefault()}
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
                    backdropFilter: 'blur(1px)',
                    pointerEvents: 'none' // 背景不接收任何指针事件
                }}
            />
        </div>
    );
};

export default VirtualControls;
