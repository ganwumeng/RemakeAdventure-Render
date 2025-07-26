import React from 'react';

const LoadingScreen = ({ progress, status }) => {
    const progressPercentage = Math.round((progress || 0) * 100);
    
    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: '#1a1a2e',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
            fontFamily: 'FusionPixel, sans-serif',
            color: '#ffffff'
        }}>
            <div style={{
                textAlign: 'center',
                maxWidth: '400px',
                padding: '20px'
            }}>
                <h1 style={{
                    fontSize: '32px',
                    marginBottom: '20px',
                    color: '#4a9eff'
                }}>
                    Remake AdventureX
                </h1>
                
                <div style={{
                    fontSize: '18px',
                    marginBottom: '30px',
                    color: '#cccccc'
                }}>
                    正在加载大模型...
                </div>
                
                {/* 进度条容器 */}
                <div style={{
                    width: '100%',
                    height: '20px',
                    backgroundColor: '#333366',
                    borderRadius: '10px',
                    overflow: 'hidden',
                    marginBottom: '15px',
                    border: '2px solid #4a9eff'
                }}>
                    {/* 进度条填充 */}
                    <div style={{
                        width: `${progressPercentage}%`,
                        height: '100%',
                        backgroundColor: '#4a9eff',
                        transition: 'width 0.3s ease',
                        background: 'linear-gradient(90deg, #4a9eff, #66b3ff)'
                    }} />
                </div>
                
                {/* 进度文本 */}
                <div style={{
                    fontSize: '16px',
                    color: '#4a9eff',
                    marginBottom: '10px'
                }}>
                    {progressPercentage}%
                </div>
                
                {/* 状态文本 */}
                {status && (
                    <div style={{
                        fontSize: '14px',
                        color: '#999999',
                        fontStyle: 'italic'
                    }}>
                        {status}
                    </div>
                )}
                
                {/* 加载动画点 */}
                <div style={{
                    marginTop: '20px',
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '8px'
                }}>
                    {[0, 1, 2].map((i) => (
                        <div
                            key={i}
                            style={{
                                width: '8px',
                                height: '8px',
                                backgroundColor: '#4a9eff',
                                borderRadius: '50%',
                                animation: `pulse 1.5s ease-in-out ${i * 0.2}s infinite`
                            }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default LoadingScreen;