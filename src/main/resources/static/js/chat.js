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
    const fileDocInput = document.getElementById('fileDocInput');
    const fileImageInput = document.getElementById('fileImageInput');
    const uploadDocBtn = document.getElementById('uploadDocBtn');
    const uploadImageBtn = document.getElementById('uploadImageBtn');
    const uploadHint = document.getElementById('uploadHint');
    const attachmentList = document.getElementById('attachmentList');

    const DOC_ACCEPT = '.pdf,.doc,.docx,.txt,.md,.csv,.json';
    const IMAGE_ACCEPT = '.png,.jpg,.jpeg,.gif,.webp,.bmp';
    const IMAGE_EXT_PATTERN = /\.(png|jpe?g|gif|webp|bmp)$/i;

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
        updateUploadPanel();
    }

    function isImageFile(file) {
        if (file.type && file.type.startsWith('image/')) {
            return true;
        }
        return IMAGE_EXT_PATTERN.test(file.name || '');
    }

    function supportsDocumentUpload() {
        return true;
    }

    function supportsImageUpload() {
        return supportsVision();
    }

    function setButtonDisabled(button, disabled) {
        button.disabled = disabled;
        button.classList.toggle('is-disabled', disabled);
        button.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    }

    function updateUploadPanel() {
        const canUploadDoc = supportsDocumentUpload();
        const canUploadImage = supportsImageUpload();

        fileDocInput.accept = DOC_ACCEPT;
        fileImageInput.accept = IMAGE_ACCEPT;

        setButtonDisabled(uploadDocBtn, !canUploadDoc || sending);
        setButtonDisabled(uploadImageBtn, !canUploadImage || sending);

        uploadDocBtn.title = canUploadDoc && !sending
            ? '上传 PDF、Word、TXT 等文档'
            : '文档上传暂不可用';
        uploadImageBtn.title = canUploadImage && !sending
            ? '上传 PNG、JPG 等图片'
            : '当前模型不支持图片，请切换到 GPT-4o 或 Qwen-VL';

        if (canUploadImage) {
            uploadHint.textContent = '文档与图片均支持';
        } else {
            uploadHint.textContent = '当前模型不支持图片，「上传图片」按钮已禁用';
        }

        if (!canUploadImage && hasImageAttachment(pendingAttachments)) {
            const removedCount = pendingAttachments.filter(item => item.fileType === 'image').length;
            pendingAttachments = pendingAttachments.filter(item => item.fileType !== 'image');
            renderAttachmentList();
            if (removedCount > 0) {
                setStatus('已移除 ' + removedCount + ' 个图片附件（当前模型不支持图片）');
            }
        }
    }

    function supportsThinking() {
        return providerSelect.value === 'deepseek'
            && modelSelect.value.startsWith('deepseek-v4');
    }

    function supportsVision() {
        const provider = getProvider(providerSelect.value);
        if (!provider) {
            return false;
        }
        const model = provider.models.find(item => item.id === modelSelect.value);
        return model ? !!model.vision : false;
    }

    function hasImageAttachment(attachments) {
        return attachments.some(item => item.fileType === 'image');
    }

    function validateBeforeSend(attachments) {
        if (hasImageAttachment(attachments) && !supportsVision()) {
            throw new Error('当前模型不支持图片理解。请切换到 OpenAI 的 GPT-4o 或通义千问的 Qwen-VL 模型。');
        }
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

    async function uploadFiles(fileList, type) {
        if (!fileList || fileList.length === 0) {
            return;
        }

        const files = Array.from(fileList);
        if (type === 'image' && !supportsImageUpload()) {
            return;
        }
        if (type === 'doc' && !supportsDocumentUpload()) {
            return;
        }

        const invalidFiles = files.filter(file => {
            const isImage = isImageFile(file);
            if (type === 'doc') {
                return isImage;
            }
            return !isImage;
        });
        if (invalidFiles.length > 0) {
            alert(type === 'doc' ? '请仅上传 PDF / Word / 文本文档' : '请仅上传图片文件');
            return;
        }

        const formData = new FormData();
        files.forEach(file => formData.append('files', file));

        setStatus('解析文件中...');
        setButtonDisabled(uploadDocBtn, true);
        setButtonDisabled(uploadImageBtn, true);
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
            updateUploadPanel();
            fileDocInput.value = '';
            fileImageInput.value = '';
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

        try {
            validateBeforeSend(attachments);
        } catch (error) {
            alert(error.message);
            return;
        }

        sending = true;
        sendBtn.disabled = true;
        setButtonDisabled(uploadDocBtn, true);
        setButtonDisabled(uploadImageBtn, true);
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
                let message = errText || ('请求失败: ' + response.status);
                try {
                    const errJson = JSON.parse(errText);
                    message = errJson.message || message;
                } catch (ignored) {
                }
                throw new Error(message);
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
            updateUploadPanel();
            userInput.focus();
        }
    }

    function onModelChange() {
        updateTitle();
        updateThinkingPanel();
        updateUploadPanel();
    }

    providerSelect.addEventListener('change', renderModels);
    modelSelect.addEventListener('change', onModelChange);

    uploadDocBtn.addEventListener('click', () => {
        if (uploadDocBtn.disabled) {
            return;
        }
        fileDocInput.click();
    });
    uploadImageBtn.addEventListener('click', () => {
        if (uploadImageBtn.disabled) {
            return;
        }
        fileImageInput.click();
    });
    fileDocInput.addEventListener('change', () => uploadFiles(fileDocInput.files, 'doc'));
    fileImageInput.addEventListener('change', () => uploadFiles(fileImageInput.files, 'image'));

    sendBtn.addEventListener('click', sendMessage);
    clearBtn.addEventListener('click', () => {
        conversation = [];
        pendingAttachments = [];
        renderAttachmentList();
        messagesEl.innerHTML = '';
        appendMessage('assistant', '对话已清空，可以继续提问。', 'welcome');
        setStatus('就绪');
        updateUploadPanel();
    });

    userInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    });

    renderModels();
    updateUploadPanel();
    userInput.focus();
})();
