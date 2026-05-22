(function () {
    const providers = window.CHAT_CONFIG?.providers || [];
    const providerSelect = document.getElementById('providerSelect');
    const modelSelect = document.getElementById('modelSelect');
    const systemPrompt = document.getElementById('systemPrompt');
    const messagesEl = document.getElementById('messages');
    const userInput = document.getElementById('userInput');
    const sendBtn = document.getElementById('sendBtn');
    const clearBtn = document.getElementById('clearBtn');
    const statusText = document.getElementById('statusText');
    const currentModelTitle = document.getElementById('currentModelTitle');
    const thinkingPanel = document.getElementById('thinkingPanel');
    const thinkingEnabled = document.getElementById('thinkingEnabled');
    const fileInput = document.getElementById('fileInput');
    const uploadBtn = document.getElementById('uploadBtn');
    const attachmentList = document.getElementById('attachmentList');

    let conversation = [];
    let pendingAttachments = [];
    let sending = false;

    function getProvider(id) {
        return providers.find(p => p.id === id);
    }

    function renderModels() {
        const provider = getProvider(providerSelect.value);
        modelSelect.innerHTML = '';
        if (!provider) {
            return;
        }
        provider.models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = model.label;
            if (model.id === provider.defaultModel) {
                option.selected = true;
            }
            modelSelect.appendChild(option);
        });
        updateTitle();
        updateThinkingPanel();
    }

    function supportsThinking() {
        return providerSelect.value === 'deepseek'
            && modelSelect.value.startsWith('deepseek-v4');
    }

    function updateThinkingPanel() {
        const supported = supportsThinking();
        thinkingPanel.hidden = !supported;
        if (!supported) {
            thinkingEnabled.checked = false;
        }
    }

    function updateTitle() {
        const provider = getProvider(providerSelect.value);
        const modelLabel = modelSelect.selectedOptions[0]?.textContent || '';
        currentModelTitle.textContent = provider ? `${provider.name} · ${modelLabel}` : 'AI 对话';
    }

    function renderAttachmentList() {
        attachmentList.innerHTML = '';
        pendingAttachments.forEach((attachment, index) => {
            const item = document.createElement('div');
            item.className = 'attachment-item';

            const name = document.createElement('span');
            name.className = 'name';
            name.textContent = attachment.fileName;

            const tag = document.createElement('span');
            tag.className = 'tag';
            tag.textContent = attachment.fileType === 'image' ? '图片' : '文档';

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.textContent = '×';
            removeBtn.title = '移除';
            removeBtn.addEventListener('click', () => {
                pendingAttachments.splice(index, 1);
                renderAttachmentList();
            });

            item.appendChild(name);
            item.appendChild(tag);
            item.appendChild(removeBtn);
            attachmentList.appendChild(item);
        });
    }

    async function uploadFiles(fileList) {
        if (!fileList || fileList.length === 0) {
            return;
        }
        const formData = new FormData();
        Array.from(fileList).forEach(file => formData.append('files', file));

        setStatus('解析文件中...');
        uploadBtn.disabled = true;
        try {
            const response = await fetch('/api/chat/attachments', {
                method: 'POST',
                body: formData
            });
            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.message || ('上传失败: ' + response.status));
            }
            const attachments = await response.json();
            pendingAttachments.push(...attachments);
            renderAttachmentList();
            setStatus('就绪');
        } catch (error) {
            setStatus('上传失败');
            alert(error.message);
        } finally {
            uploadBtn.disabled = false;
            fileInput.value = '';
        }
    }

    function appendMessage(role, content, extraClass, attachments) {
        const wrapper = document.createElement('div');
        wrapper.className = `message ${role}${extraClass ? ' ' + extraClass : ''}`;

        const avatar = document.createElement('div');
        avatar.className = 'avatar';
        avatar.textContent = role === 'user' ? '我' : 'AI';

        const bubble = document.createElement('div');
        bubble.className = 'bubble';
        if (content) {
            bubble.textContent = content;
        }

        if (attachments && attachments.length > 0) {
            const filesEl = document.createElement('div');
            filesEl.className = 'message-files';
            attachments.forEach(item => {
                const tag = document.createElement('span');
                tag.textContent = '📎 ' + item.fileName;
                filesEl.appendChild(tag);
            });
            bubble.appendChild(filesEl);
        }

        wrapper.appendChild(avatar);
        wrapper.appendChild(bubble);
        messagesEl.appendChild(wrapper);
        messagesEl.scrollTop = messagesEl.scrollHeight;
        return bubble;
    }

    function appendAssistantMessage() {
        const wrapper = document.createElement('div');
        wrapper.className = 'message assistant';

        const avatar = document.createElement('div');
        avatar.className = 'avatar';
        avatar.textContent = 'AI';

        const bubble = document.createElement('div');
        bubble.className = 'bubble assistant-bubble';

        const thinkingBlock = document.createElement('details');
        thinkingBlock.className = 'thinking-block';
        thinkingBlock.open = true;
        thinkingBlock.hidden = true;

        const thinkingSummary = document.createElement('summary');
        thinkingSummary.className = 'thinking-summary';
        thinkingSummary.textContent = '思考过程';

        const thinkingText = document.createElement('div');
        thinkingText.className = 'thinking-text';

        const answerText = document.createElement('div');
        answerText.className = 'answer-text';

        thinkingBlock.appendChild(thinkingSummary);
        thinkingBlock.appendChild(thinkingText);
        bubble.appendChild(thinkingBlock);
        bubble.appendChild(answerText);

        wrapper.appendChild(avatar);
        wrapper.appendChild(bubble);
        messagesEl.appendChild(wrapper);
        messagesEl.scrollTop = messagesEl.scrollHeight;

        return { wrapper, thinkingBlock, thinkingText, answerText };
    }

    function setStatus(text) {
        statusText.textContent = text;
    }

    function parseStreamEvent(raw) {
        if (raw.startsWith('[ERROR]')) {
            throw new Error(raw.replace('[ERROR]', '').trim());
        }
        try {
            return JSON.parse(raw);
        } catch (error) {
            return { type: 'content', text: raw };
        }
    }

    async function sendMessage() {
        const text = userInput.value.trim();
        const attachments = pendingAttachments.slice();
        if ((!text && attachments.length === 0) || sending) {
            return;
        }

        sending = true;
        sendBtn.disabled = true;
        userInput.value = '';
        pendingAttachments = [];
        renderAttachmentList();
        setStatus(thinkingEnabled.checked && supportsThinking() ? '思考中...' : '生成中...');

        const displayText = text || '请基于上传的文件回答';
        appendMessage('user', text, null, attachments);
        conversation.push({ role: 'user', content: displayText });

        const assistant = appendAssistantMessage();
        let reasoningText = '';
        let answerText = '';
        let hasReasoning = false;
        let hasAnswer = false;

        const payload = {
            provider: providerSelect.value,
            model: modelSelect.value,
            systemPrompt: systemPrompt.value,
            messages: conversation,
            stream: true,
            thinkingEnabled: thinkingEnabled.checked && supportsThinking(),
            attachments: attachments
        };

        try {
            const response = await fetch('/api/chat/stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(errText || ('请求失败: ' + response.status));
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    break;
                }
                buffer += decoder.decode(value, { stream: true });
                const events = buffer.split('\n\n');
                buffer = events.pop() || '';

                for (const event of events) {
                    const lines = event.split('\n');
                    for (const rawLine of lines) {
                        const line = rawLine.trim();
                        if (!line.startsWith('data:')) {
                            continue;
                        }
                        const data = line.slice(5).trim();
                        if (!data || data === '[DONE]') {
                            continue;
                        }

                        const chunk = parseStreamEvent(data);
                        if (chunk.type === 'reasoning') {
                            hasReasoning = true;
                            reasoningText += chunk.text || '';
                            assistant.thinkingBlock.hidden = false;
                            assistant.thinkingText.textContent = reasoningText;
                        } else {
                            if (hasReasoning && !hasAnswer) {
                                assistant.thinkingBlock.open = false;
                            }
                            hasAnswer = true;
                            answerText += chunk.text || '';
                            assistant.answerText.textContent = answerText;
                        }
                        messagesEl.scrollTop = messagesEl.scrollHeight;
                    }
                }
            }

            if (!hasAnswer && !hasReasoning) {
                assistant.answerText.textContent = '模型未返回内容';
            } else if (hasAnswer) {
                conversation.push({ role: 'assistant', content: answerText });
            } else {
                assistant.thinkingBlock.open = false;
                assistant.answerText.textContent = reasoningText;
                conversation.push({ role: 'assistant', content: reasoningText });
            }
            setStatus('就绪');
        } catch (error) {
            assistant.wrapper.classList.add('error');
            assistant.answerText.textContent = '错误: ' + error.message;
            assistant.thinkingBlock.hidden = true;
            setStatus('出错');
        } finally {
            sending = false;
            sendBtn.disabled = false;
            userInput.focus();
        }
    }

    providerSelect.addEventListener('change', renderModels);
    modelSelect.addEventListener('change', () => {
        updateTitle();
        updateThinkingPanel();
    });

    uploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => uploadFiles(fileInput.files));

    sendBtn.addEventListener('click', sendMessage);
    clearBtn.addEventListener('click', () => {
        conversation = [];
        pendingAttachments = [];
        renderAttachmentList();
        messagesEl.innerHTML = '';
        appendMessage('assistant', '对话已清空，可以继续提问。', 'welcome');
        setStatus('就绪');
    });

    userInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    });

    renderModels();
    userInput.focus();
})();
