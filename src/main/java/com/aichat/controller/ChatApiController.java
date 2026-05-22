package com.aichat.controller;

import com.aichat.model.ChatRequest;
import com.aichat.model.ChatResponse;
import com.aichat.model.ProviderView;
import com.aichat.service.LlmChatService;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;

import java.util.List;

@RestController
@RequestMapping("/api/chat")
public class ChatApiController {

    private final LlmChatService llmChatService;

    public ChatApiController(LlmChatService llmChatService) {
        this.llmChatService = llmChatService;
    }

    @GetMapping("/providers")
    public List<ProviderView> providers() {
        return llmChatService.listProviders();
    }

    @PostMapping
    public ResponseEntity<ChatResponse> chat(@Valid @RequestBody ChatRequest request) {
        return ResponseEntity.ok(llmChatService.chat(request));
    }

    @PostMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<String> chatStream(@Valid @RequestBody ChatRequest request) {
        return llmChatService.chatStream(request)
                .onErrorResume(ex -> Flux.just("[ERROR] " + ex.getMessage()))
                .concatWith(Flux.just("[DONE]"));
    }
}
