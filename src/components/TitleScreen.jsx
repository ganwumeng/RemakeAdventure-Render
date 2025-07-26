import React from 'react';
import './TitleScreen.css';
import TitleNPCManager from './TitleNPCManager';

const TitleScreen = ({ onStartWithLLM, onStartWithoutLLM, onAbout }) => {
    return (
        <div className="title-screen">
            {/* NPC装饰层 */}
            <TitleNPCManager />
            
            <div className="title-container">
                <h1 className="game-title">Remake Adventure X</h1>
                <div className="button-container">
                    <button className="title-button" onClick={onStartWithLLM}>
                        启动
                    </button>
                    <button className="title-button" onClick={onStartWithoutLLM}>
                        启动（无大模型）
                    </button>
                    <button className="title-button" onClick={onAbout}>
                        关于
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TitleScreen;