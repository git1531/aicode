package com.aichat.controller;

import com.aichat.model.ProviderView;
import com.aichat.service.LlmChatService;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;

import java.util.List;

@Controller
public class ChatPageController {

    private final LlmChatService llmChatService;

    public ChatPageController(LlmChatService llmChatService) {
        this.llmChatService = llmChatService;
    }

    @GetMapping("/")
    public String index(Model model) {
        List<ProviderView> providers = llmChatService.listProviders();
        model.addAttribute("providers", providers);
        model.addAttribute("defaultProvider", providers.isEmpty() ? "" : providers.get(0).getId());
        return "chat/index";
    }
}
