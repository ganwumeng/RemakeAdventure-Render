import * as webllm from "@mlc-ai/web-llm";

const selectedModel = "Qwen3-1.7B-q4f16_1-MLC";
let engine = null;
let isLoading = false;
let isLoaded = false;

// 对话上下文管理
class ConversationContext {
    constructor() {
        this.conversations = new Map(); // 存储多个对话会话
        this.defaultSystemPrompt = "你是一个智能助手，请根据用户的问题提供有用的回答。";
    }

    // 创建新的对话会话
    createSession(sessionId, systemPrompt = null) {
        const session = {
            id: sessionId,
            messages: [],
            systemPrompt: systemPrompt || this.defaultSystemPrompt,
            createdAt: new Date(),
            lastUpdated: new Date()
        };
        
        // 添加系统提示
        if (session.systemPrompt) {
            session.messages.push({
                role: "system",
                content: session.systemPrompt
            });
        }
        
        this.conversations.set(sessionId, session);
        return session;
    }

    // 获取对话会话
    getSession(sessionId) {
        return this.conversations.get(sessionId);
    }

    // 添加消息到会话
    addMessage(sessionId, role, content) {
        const session = this.conversations.get(sessionId);
        if (!session) {
            throw new Error(`会话 ${sessionId} 不存在`);
        }

        session.messages.push({
            role,
            content,
            timestamp: new Date()
        });
        session.lastUpdated = new Date();
    }

    // 获取会话的所有消息
    getMessages(sessionId) {
        const session = this.conversations.get(sessionId);
        return session ? session.messages : [];
    }

    // 清空会话历史（保留系统提示）
    clearSession(sessionId) {
        const session = this.conversations.get(sessionId);
        if (session) {
            const systemMessages = session.messages.filter(msg => msg.role === "system");
            session.messages = systemMessages;
            session.lastUpdated = new Date();
        }
    }

    // 删除会话
    deleteSession(sessionId) {
        return this.conversations.delete(sessionId);
    }

    // 获取所有会话ID
    getAllSessionIds() {
        return Array.from(this.conversations.keys());
    }

    // 限制会话消息数量（保留最近的N条消息，但始终保留系统提示）
    limitSessionMessages(sessionId, maxMessages = 20) {
        const session = this.conversations.get(sessionId);
        if (!session || session.messages.length <= maxMessages) return;

        const systemMessages = session.messages.filter(msg => msg.role === "system");
        const otherMessages = session.messages.filter(msg => msg.role !== "system");
        
        if (otherMessages.length > maxMessages - systemMessages.length) {
            const keepCount = maxMessages - systemMessages.length;
            const recentMessages = otherMessages.slice(-keepCount);
            session.messages = [...systemMessages, ...recentMessages];
        }
    }
}

// 全局对话上下文管理器
const contextManager = new ConversationContext();

// 初始化大模型引擎
export async function initializeLLM(onProgress) {
    if (isLoaded) return true;
    if (isLoading) return false;

    isLoading = true;

    try {
        // 创建引擎并监听进度
        engine = await webllm.CreateMLCEngine(
            selectedModel,
            {
                initProgressCallback: (progress) => {
                    if (onProgress) {
                        onProgress(progress);
                    }
                }
            }
        );

        isLoaded = true;
        isLoading = false;
        return true;
    } catch (error) {
        console.error("大模型初始化失败:", error);
        isLoading = false;
        throw error;
    }
}

// 单次问答（兼容旧版本）
export async function askLLM(prompt) {
    if (!isLoaded) {
        throw new Error("大模型尚未加载完成，请等待加载完成后再试");
    }

    const response = await engine.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        stream: true,
    });
    let fullResponse = "";
    for await (const chunk of response) {
        fullResponse += chunk.choices[0]?.delta?.content || "";
    }
    // [新增] 过滤掉返回内容中的标签
    return fullResponse.replace(/<thinking>[\s\S]*<\/thinking>/, '').trim();
}

// 多轮对话 - 发送消息到指定会话
export async function sendMessage(sessionId, message, options = {}) {
    if (!isLoaded) {
        throw new Error("大模型尚未加载完成，请等待加载完成后再试");
    }

    if (!contextManager.getSession(sessionId)) {
        contextManager.createSession(sessionId, options.systemPrompt);
    }

    contextManager.addMessage(sessionId, "user", message);

    if (options.maxMessages) {
        contextManager.limitSessionMessages(sessionId, options.maxMessages);
    }

    try {
        const messages = contextManager.getMessages(sessionId);
        
        const response = await engine.chat.completions.create({
            messages: messages.map(msg => ({
                role: msg.role,
                content: msg.content
            })),
            stream: options.stream !== false,
            temperature: options.temperature || 0.7,
            max_tokens: options.maxTokens || 2048,
        });

        let fullResponse = "";
        
        if (options.stream !== false) {
            for await (const chunk of response) {
                const content = chunk.choices[0]?.delta?.content || "";
                fullResponse += content;
                
                if (options.onStream) {
                    // [修改] 在回调前就过滤掉标签
                    const cleanFullResponse = fullResponse.replace(/<thinking>[\s\S]*<\/thinking>/, '').trim();
                    const cleanContent = cleanFullResponse.slice(options.lastCleanResponse?.length || 0);
                    options.lastCleanResponse = cleanFullResponse;

                    if(cleanContent) {
                       options.onStream(cleanContent, cleanFullResponse);
                    }
                }
            }
        } else {
            fullResponse = response.choices[0]?.message?.content || "";
        }

        const finalCleanResponse = fullResponse.replace(/<thinking>[\s\S]*<\/thinking>/, '').trim();
        contextManager.addMessage(sessionId, "assistant", finalCleanResponse);

        return {
            content: finalCleanResponse,
            sessionId: sessionId,
            messageCount: contextManager.getMessages(sessionId).length
        };

    } catch (error) {
        console.error("发送消息失败:", error);
        throw error;
    }
}

// 流式对话 - 支持实时输出
export async function* streamMessage(sessionId, message, options = {}) {
    if (!isLoaded) {
        throw new Error("大模型尚未加载完成，请等待加载完成后再试");
    }

    if (!contextManager.getSession(sessionId)) {
        contextManager.createSession(sessionId, options.systemPrompt);
    }

    contextManager.addMessage(sessionId, "user", message);

    if (options.maxMessages) {
        contextManager.limitSessionMessages(sessionId, options.maxMessages);
    }

    try {
        const messages = contextManager.getMessages(sessionId);
        
        const response = await engine.chat.completions.create({
            messages: messages.map(msg => ({
                role: msg.role,
                content: msg.content
            })),
            stream: true,
            temperature: options.temperature || 0.7,
            max_tokens: options.maxTokens || 2048,
        });

        let fullResponse = "";
        let cleanFullResponse = "";
        
        for await (const chunk of response) {
            const rawContent = chunk.choices[0]?.delta?.content || "";
            fullResponse += rawContent;
            
            // [修改] 过滤掉<thinking>标签
            const newCleanFullResponse = fullResponse.replace(/<thinking>[\s\S]*<\/thinking>/, '').trim();
            const cleanContentChunk = newCleanFullResponse.slice(cleanFullResponse.length);
            cleanFullResponse = newCleanFullResponse;

            if (cleanContentChunk) {
                 yield {
                    content: cleanContentChunk,
                    fullContent: cleanFullResponse,
                    sessionId: sessionId,
                    isComplete: false
                };
            }
        }

        contextManager.addMessage(sessionId, "assistant", cleanFullResponse);

        yield {
            content: "",
            fullContent: cleanFullResponse,
            sessionId: sessionId,
            isComplete: true,
            messageCount: contextManager.getMessages(sessionId).length
        };

    } catch (error) {
        console.error("流式消息发送失败:", error);
        throw error;
    }
}

// 上下文管理函数
export function createConversation(sessionId, systemPrompt = null) {
    return contextManager.createSession(sessionId, systemPrompt);
}

export function getConversation(sessionId) {
    return contextManager.getSession(sessionId);
}

export function getConversationHistory(sessionId) {
    return contextManager.getMessages(sessionId);
}

export function clearConversation(sessionId) {
    contextManager.clearSession(sessionId);
}

export function deleteConversation(sessionId) {
    return contextManager.deleteSession(sessionId);
}

export function getAllConversations() {
    return Array.from(contextManager.getAllSessionIds());
}

export function addContextMessage(sessionId, role, content) {
    contextManager.addMessage(sessionId, role, content);
}

// 预设对话模板
export function createGameConversation(sessionId, gameContext = {}) {
    const systemPrompt = `你是一个游戏中的智能NPC助手。当前游戏状态：
- 玩家位置: ${gameContext.playerPosition || "未知"}
- 当前场景: ${gameContext.currentScene || "未知"}
- 游戏进度: ${gameContext.gameProgress || "开始"}

请根据游戏情境提供合适的回应，保持角色扮演的沉浸感。`;

    return contextManager.createSession(sessionId, systemPrompt);
}

export function createDialogueConversation(sessionId, character = {}) {
    const systemPrompt = `你是${character.name || "同事"}。${character.description || ""}
回复要求：
1. 每次回复1-2句话，简短自然
2. 用日常对话的语气，不要过于正式
3. 避免长篇大论和重复内容
4. 直接回答问题，不要过多解释`;

    return contextManager.createSession(sessionId, systemPrompt);
}

// 状态检查函数
export function isLLMLoaded() {
    return isLoaded;
}

export function isLLMLoading() {
    return isLoading;
}

// 获取引擎信息
export function getEngineInfo() {
    return {
        model: selectedModel,
        isLoaded,
        isLoading,
        conversationCount: contextManager.getAllSessionIds().length
    };
}
