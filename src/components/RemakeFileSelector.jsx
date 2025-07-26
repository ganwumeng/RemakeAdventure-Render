import { useState } from 'react';
import JSZip from 'jszip';

const RemakeFileSelector = ({ onFileLoaded, onCancel }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleFileSelect = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        // 检查文件扩展名
        if (!file.name.toLowerCase().endsWith('.remake')) {
            setError('请选择.remake文件');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            // 读取文件内容
            const arrayBuffer = await file.arrayBuffer();
            
            // 使用JSZip解压
            const zip = new JSZip();
            const zipContent = await zip.loadAsync(arrayBuffer);

            // 解析需要的文件
            const gameData = {
                sceneObjects: null,
                dialogue: null,
                members: null
            };

            // 查找并解析scene1_objects.json
            const sceneFile = zipContent.file('scene1_objects.json');
            if (sceneFile) {
                const sceneContent = await sceneFile.async('text');
                gameData.sceneObjects = JSON.parse(sceneContent);
            }

            // 查找并解析dialogue.json
            const dialogueFile = zipContent.file('dialogue.json');
            if (dialogueFile) {
                const dialogueContent = await dialogueFile.async('text');
                gameData.dialogue = JSON.parse(dialogueContent);
            }

            // 查找并解析members.json
            const membersFile = zipContent.file('members.json');
            if (membersFile) {
                const membersContent = await membersFile.async('text');
                gameData.members = JSON.parse(membersContent);
            }

            // 验证必要文件是否存在
            if (!gameData.sceneObjects || !gameData.dialogue || !gameData.members) {
                throw new Error('Remake文件缺少必要的数据文件');
            }

            // 回调传递解析后的数据
            onFileLoaded(gameData);

        } catch (err) {
            console.error('解析Remake文件失败:', err);
            setError('解析文件失败: ' + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={{
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
            fontFamily: 'FusionPixel, sans-serif'
        }}>
            <div style={{
                background: 'rgba(0,0,0,0.9)',
                color: 'white',
                padding: '40px',
                borderRadius: '15px',
                textAlign: 'center',
                maxWidth: '400px',
                border: '2px solid #0ec3c9'
            }}>
                <h2 style={{ 
                    margin: '0 0 20px 0', 
                    fontSize: '24px', 
                    color: '#0ec3c9' 
                }}>
                    选择Remake文件
                </h2>
                
                <p style={{ 
                    margin: '0 0 30px 0', 
                    fontSize: '14px', 
                    lineHeight: '1.5',
                    color: '#ccc'
                }}>
                    请选择包含游戏数据的.remake文件
                </p>

                {!isLoading && (
                    <>
                        <input
                            type="file"
                            accept=".remake"
                            onChange={handleFileSelect}
                            style={{
                                display: 'none'
                            }}
                            id="remake-file-input"
                        />
                        <label
                            htmlFor="remake-file-input"
                            style={{
                                display: 'inline-block',
                                padding: '12px 24px',
                                background: '#0ec3c9',
                                color: '#000',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '16px',
                                fontWeight: 'bold',
                                marginBottom: '20px',
                                transition: 'background-color 0.3s'
                            }}
                        >
                            选择文件
                        </label>
                        
                        <br />
                        
                        <button
                            onClick={onCancel}
                            style={{
                                padding: '8px 16px',
                                background: 'transparent',
                                color: '#ccc',
                                border: '1px solid #ccc',
                                borderRadius: '5px',
                                cursor: 'pointer',
                                fontSize: '14px'
                            }}
                        >
                            取消
                        </button>
                    </>
                )}

                {isLoading && (
                    <div>
                        <div style={{
                            fontSize: '48px',
                            marginBottom: '20px',
                            animation: 'pulse 2s infinite'
                        }}>
                            📦
                        </div>
                        <p style={{ fontSize: '16px', color: '#0ec3c9' }}>
                            正在解析文件...
                        </p>
                    </div>
                )}

                {error && (
                    <div style={{
                        background: 'rgba(255, 0, 0, 0.2)',
                        border: '1px solid #ff4444',
                        borderRadius: '5px',
                        padding: '10px',
                        marginTop: '20px',
                        color: '#ff4444',
                        fontSize: '14px'
                    }}>
                        {error}
                    </div>
                )}
            </div>
        </div>
    );
};

export default RemakeFileSelector;