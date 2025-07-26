// DialogueSystem.js

/**
 * [最终版] 负责管理基于模拟阅读时间的自动对话。
 * 该系统在游戏主循环中被调用，根据真实时间的流逝来触发对话，
 * 并能在游戏暂停时（如与LLM对话）自动暂停。
 */
export class DialogueSystem {
    /**
     * @param {Phaser.Scene} scene - 对话系统所依附的游戏场景实例 (Game.js)。
     */
    constructor(scene) {
        this.scene = scene;
        this.dialogueData = this.scene.cache.json.get('dialogue');
        this.CHARS_PER_SECOND = 15; // 模拟的阅读速度：每秒15个字符
        this.teamConversationState = new Map();
        
        // [新增] 预处理对话数据，计算累计token
        this.preprocessDialogueData();
    }
    
    /**
     * [新增] 预处理对话数据，为每条消息添加累计token，便于时间检查。
     */
    preprocessDialogueData() {
        if (!this.dialogueData) return;
        this.dialogueData.forEach(team => {
            let cumulativeToken = 0;
            team.conversation.forEach(message => {
                // 将累计token作为新属性存储，不修改原始token
                message.cumulativeToken = cumulativeToken;
                cumulativeToken += message.token || message.message.length;
            });
        });
    }

    /**
     * 初始化对话系统。
     * @param {Array} allNpcData - 包含所有NPC信息的数组。
     */
    init(allNpcData) {
        if (!this.dialogueData) {
            console.error("对话数据未加载，DialogueSystem无法初始化。");
            return;
        }

        const teamIds = [...new Set(allNpcData.map(d => d.teamId))];

        teamIds.forEach(teamId => {
            this.teamConversationState.set(teamId, {
                isConversationActive: false,
                conversationStartTime: 0,
                nextMessageIndex: 0,
            });
        });
        console.log(`对话系统已为 ${teamIds.length} 个团队初始化。`);
    }

    /**
     * 由 Game.js 的主 update 循环调用。
     * 负责检查并触发当前时间点应该发生的对话。
     */
    update() {
        const currentTime = this.scene.time.now;

        this.teamConversationState.forEach((state, teamId) => {
            if (!state.isConversationActive) return;

            const teamDialogueData = this.dialogueData.find(data => data.team_id === teamId);
            if (!teamDialogueData || state.nextMessageIndex >= teamDialogueData.conversation.length) {
                state.isConversationActive = false;
                return;
            }
            
            const elapsedSeconds = (currentTime - state.conversationStartTime) / 1000;
            const readableChars = elapsedSeconds * this.CHARS_PER_SECOND;

            const nextMessage = teamDialogueData.conversation[state.nextMessageIndex];

            if (nextMessage && readableChars >= nextMessage.cumulativeToken) {
                this.playDialogueMessage(teamId, nextMessage);
                state.nextMessageIndex++;

                if (state.nextMessageIndex >= teamDialogueData.conversation.length) {
                    console.log(`Team ${teamId} 的对话序列已完成。`);
                    state.isConversationActive = false;
                    // 随机延迟后可以再次开启新一轮对话
                    this.scene.time.delayedCall(Phaser.Math.Between(30000, 60000), () => {
                        this.tryStartTeamConversation(teamId);
                    });
                }
            }
        });
    }
    
    /**
     * 尝试为指定团队启动一套新的对话序列。
     * @param {number|string} teamId - 团队ID
     */
    tryStartTeamConversation(teamId) {
        const state = this.teamConversationState.get(teamId);
        if (!state || state.isConversationActive) return;

        // 检查团队成员是否都在工作状态
        const teamMembers = this.scene.allNpcData.filter(d => d.teamId === teamId);
        const workingMembers = teamMembers.filter(d => d.state === 'working');
        
        // [修改] 只有当团队所有成员都在工作时才开始对话
        if (teamMembers.length > 0 && workingMembers.length === teamMembers.length) {
            state.isConversationActive = true;
            state.nextMessageIndex = 0;
            state.conversationStartTime = this.scene.time.now;
            console.log(`Team ${teamId} 全员到齐，开始新的对话序列。`);
            this.update(); // 立即检查是否有 token: 0 的消息
        }
    }

    playDialogueMessage(teamId, dialogueEntry) {
        const speakerMemberId = dialogueEntry.id;
        const message = dialogueEntry.message;
        const tokenCount = dialogueEntry.token || message.length;

        let speakerNpc = null;
        const speakerData = this.scene.allNpcData.find(d => d.teamId === teamId && d.memberId === speakerMemberId);
        if (speakerData && speakerData.state === 'working') {
            speakerNpc = this.scene.npcFarmers.children.entries.find(sprite => sprite.getData('id') === speakerData.id);
        }

        // [改进] 气泡显示时长与内容长度(token)挂钩，提供充足的阅读时间。
        // 此处基于 CHARS_PER_SECOND 计算，确保时长动态变化。
        const dialogueDuration = Math.max(2000, (tokenCount / this.CHARS_PER_SECOND) * 1000);

        if (speakerNpc) {
            this.scene.showNPCChatBubble(speakerNpc, message, dialogueDuration);
        }
    }

    destroy() {
        this.teamConversationState.clear();
    }
}
