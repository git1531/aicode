package com.aichat.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.WebClient;

@Configuration
@EnableConfigurationProperties({LlmProperties.class, UploadProperties.class})
public class AppConfig {

    @Bean
    public WebClient webClient() {
        return WebClient.builder().build();
    }
}
