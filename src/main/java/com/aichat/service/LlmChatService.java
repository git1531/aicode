package com.aichat.service;

import com.aichat.config.LlmProperties;
import com.aichat.model.ChatMessage;
import com.aichat.model.ChatRequest;
import com.aichat.model.ChatResponse;
import com.aichat.model.FileAttachment;
import com.aichat.model.ProviderView;
import com.aichat.model.StreamChunk;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Flux;

import java.util.ArrayList;
import java.util.List;

@Service
public class LlmChatService {

    private final LlmProperties llmProperties;
    private final WebClient webClient;
    private final ObjectMapper objectMapper;

    public LlmChatService(LlmProperties llmProperties, WebClient webClient, ObjectMapper objectMapper) {
        this.llmProperties = llmProperties;
        this.webClient = webClient;
        this.objectMapper = objectMapper;
    }

    public List<ProviderView> listProviders() {
        List<ProviderView> views = new ArrayList<>();
        llmProperties.getProviders().forEach((id, config) -> {
            ProviderView view = new ProviderView();
            view.setId(id);
            view.setName(config.getName());
            view.setDefaultModel(config.getDefaultModel());
            config.getModels().forEach(model -> view.getModels().add(
                    new ProviderView.ModelOptionView(model.getId(), model.getLabel())));
            views.add(view);
        });
        return views;
    }

    public ChatResponse chat(ChatRequest request) {
        LlmProperties.ProviderConfig provider = requireProvider(request.getProvider());
        ObjectNode body = buildRequestBody(request, false);
        JsonNode response = postChat(provider, body);
        return extractResponse(response);
    }

    public Flux<String> chatStream(ChatRequest request) {
        LlmProperties.ProviderConfig provider = requireProvider(request.getProvider());
        ObjectNode body = buildRequestBody(request, true);

        return webClient.post()
                .uri(normalizeUrl(provider.getBaseUrl()) + "/chat/completions")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + provider.getApiKey())
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.TEXT_EVENT_STREAM)
                .bodyValue(body)
                .retrieve()
                .bodyToFlux(String.class)
                .flatMap(this::parseSseChunk)
                .filter(chunk -> StringUtils.hasText(chunk.getText()))
                .map(this::toJson)
                .onErrorMap(this::wrapError);
    }

    private LlmProperties.ProviderConfig requireProvider(String providerId) {
        LlmProperties.ProviderConfig provider = llmProperties.getProviders().get(providerId);
        if (provider == null) {
            throw new IllegalArgumentException("未知模型提供商: " + providerId);
        }
        if (!StringUtils.hasText(provider.getApiKey())) {
            throw new IllegalStateException(provider.getName() + " 未配置 API Key，请在 application-local.yml 或环境变量中设置");
        }
        return provider;
    }

    private ObjectNode buildRequestBody(ChatRequest request, boolean stream) {
        ObjectNode body = objectMapper.createObjectNode();
        body.put("model", request.getModel());
        body.put("stream", stream);

        ArrayNode messages = body.putArray("messages");
        String systemPrompt = request.getSystemPrompt();
        if (hasAttachments(request)) {
            systemPrompt = systemPrompt + "\n\n用户上传了文件，请优先基于文件内容回答问题。若文件信息不足，请如实说明。";
        }
        if (StringUtils.hasText(systemPrompt)) {
            ObjectNode system = messages.addObject();
            system.put("role", "system");
            system.put("content", systemPrompt);
        }

        List<ChatMessage> chatMessages = request.getMessages();
        for (int i = 0; i < chatMessages.size(); i++) {
            ChatMessage message = chatMessages.get(i);
            boolean lastUserWithAttachments = i == chatMessages.size() - 1
                    && "user".equals(message.getRole())
                    && hasAttachments(request);
            if (lastUserWithAttachments) {
                appendUserMessageWithAttachments(messages, message, request.getAttachments());
            } else {
                ObjectNode item = messages.addObject();
                item.put("role", message.getRole());
                item.put("content", message.getContent());
            }
        }

        if ("deepseek".equals(request.getProvider()) && request.getModel().startsWith("deepseek-v4")) {
            ObjectNode thinking = body.putObject("thinking");
            if (request.isThinkingEnabled()) {
                thinking.put("type", "enabled");
                body.put("reasoning_effort", "high");
            } else {
                thinking.put("type", "disabled");
            }
        }

        return body;
    }

    private boolean hasAttachments(ChatRequest request) {
        return request.getAttachments() != null && !request.getAttachments().isEmpty();
    }

    private void appendUserMessageWithAttachments(ArrayNode messages, ChatMessage message, List<FileAttachment> attachments) {
        ObjectNode item = messages.addObject();
        item.put("role", "user");

        boolean hasImage = attachments.stream().anyMatch(att -> "image".equals(att.getFileType()));
        if (hasImage) {
            ArrayNode content = item.putArray("content");
            ObjectNode textPart = content.addObject();
            textPart.put("type", "text");
            textPart.put("text", buildTextWithAttachments(message.getContent(), attachments));
            for (FileAttachment attachment : attachments) {
                if ("image".equals(attachment.getFileType())) {
                    ObjectNode imagePart = content.addObject();
                    imagePart.put("type", "image_url");
                    ObjectNode imageUrl = imagePart.putObject("image_url");
                    imageUrl.put("url", "data:" + attachment.getMimeType() + ";base64," + attachment.getBase64Data());
                }
            }
            return;
        }

        item.put("content", buildTextWithAttachments(message.getContent(), attachments));
    }

    private String buildTextWithAttachments(String userText, List<FileAttachment> attachments) {
        StringBuilder builder = new StringBuilder();
        if (StringUtils.hasText(userText)) {
            builder.append(userText.trim());
        }
        for (FileAttachment attachment : attachments) {
            if (!"text".equals(attachment.getFileType())) {
                continue;
            }
            if (builder.length() > 0) {
                builder.append("\n\n");
            }
            builder.append("【文件：").append(attachment.getFileName()).append("】\n");
            builder.append(attachment.getTextContent());
        }
        if (builder.length() == 0) {
            return "请基于上传的文件内容回答。";
        }
        return builder.toString();
    }

    private JsonNode postChat(LlmProperties.ProviderConfig provider, ObjectNode body) {
        try {
            return webClient.post()
                    .uri(normalizeUrl(provider.getBaseUrl()) + "/chat/completions")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + provider.getApiKey())
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(JsonNode.class)
                    .block();
        } catch (WebClientResponseException ex) {
            throw wrapError(ex);
        }
    }

    private ChatResponse extractResponse(JsonNode response) {
        if (response == null) {
            throw new IllegalStateException("模型返回为空");
        }
        JsonNode message = response.path("choices").path(0).path("message");
        String content = readText(message.path("content"));
        String reasoning = readText(message.path("reasoning_content"));
        if (!StringUtils.hasText(content) && !StringUtils.hasText(reasoning)) {
            throw new IllegalStateException("模型未返回有效内容: " + response);
        }
        return new ChatResponse(content, reasoning);
    }

    private Flux<StreamChunk> parseSseChunk(String chunk) {
        List<StreamChunk> parts = new ArrayList<>();
        for (String line : chunk.split("\n")) {
            parseSseLine(parts, line);
        }
        return Flux.fromIterable(parts);
    }

    private void parseSseLine(List<StreamChunk> parts, String line) {
        String data = line.trim();
        if (!StringUtils.hasText(data)) {
            return;
        }
        if (data.startsWith("data:")) {
            data = data.substring(5).trim();
        }
        if ("[DONE]".equals(data) || !StringUtils.hasText(data)) {
            return;
        }
        try {
            JsonNode node = objectMapper.readTree(data);
            JsonNode delta = node.path("choices").path(0).path("delta");
            appendDeltaText(parts, "reasoning", delta.path("reasoning_content"));
            appendDeltaText(parts, "content", delta.path("content"));
        } catch (Exception ignored) {
            // 忽略无法解析的 SSE 片段
        }
    }

    private void appendDeltaText(List<StreamChunk> parts, String type, JsonNode field) {
        if (field.isTextual() && StringUtils.hasText(field.asText())) {
            parts.add(new StreamChunk(type, field.asText()));
        }
    }

    private String toJson(StreamChunk chunk) {
        try {
            return objectMapper.writeValueAsString(chunk);
        } catch (Exception ex) {
            throw new RuntimeException("序列化流式片段失败", ex);
        }
    }

    private String readText(JsonNode field) {
        return field.isTextual() ? field.asText() : "";
    }

    private String normalizeUrl(String baseUrl) {
        if (baseUrl.endsWith("/")) {
            return baseUrl.substring(0, baseUrl.length() - 1);
        }
        return baseUrl;
    }

    private RuntimeException wrapError(Throwable ex) {
        if (ex instanceof WebClientResponseException webEx) {
            String body = webEx.getResponseBodyAsString();
            return new RuntimeException("调用模型失败 (" + webEx.getStatusCode().value() + "): " + body, ex);
        }
        if (ex instanceof RuntimeException runtimeException) {
            return runtimeException;
        }
        return new RuntimeException(ex.getMessage(), ex);
    }
}
