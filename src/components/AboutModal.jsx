import React from 'react';
import './AboutModal.css';

const AboutModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>关于 Remake Adventure X</h2>
                    <button className="close-button" onClick={onClose}>×</button>
                </div>
                <div className="modal-body">
                    <p>Remake Adventure X 是一个基于 Phaser 3 和 React 开发的冒险游戏。</p>
                    <p>游戏特色：</p>
                    <ul>
                        <li>🎮 经典的像素风格冒险游戏</li>
                        <li>🤖 集成大语言模型，提供智能NPC对话</li>
                        <li>🗺️ 丰富的场景和寻路系统</li>
                        <li>⚡ 现代化的Web技术栈</li>
                    </ul>
                    <p>技术栈：Phaser 3, React, Vite</p>
                    <p>版本：1.0.0</p>
                </div>
                <div className="modal-footer">
                    <button className="modal-button" onClick={onClose}>确定</button>
                </div>
            </div>
        </div>
    );
};

export default AboutModal;