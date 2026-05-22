package com.aichat.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@ConfigurationProperties(prefix = "llm")
public class LlmProperties {

    private Map<String, ProviderConfig> providers = new LinkedHashMap<>();

    public Map<String, ProviderConfig> getProviders() {
        return providers;
    }

    public void setProviders(Map<String, ProviderConfig> providers) {
        this.providers = providers;
    }

    public static class ProviderConfig {

        private String name;
        private String baseUrl;
        private String apiKey;
        private String defaultModel;
        private List<ModelOption> models = new ArrayList<>();

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getBaseUrl() {
            return baseUrl;
        }

        public void setBaseUrl(String baseUrl) {
            this.baseUrl = baseUrl;
        }

        public String getApiKey() {
            return apiKey;
        }

        public void setApiKey(String apiKey) {
            this.apiKey = apiKey;
        }

        public String getDefaultModel() {
            return defaultModel;
        }

        public void setDefaultModel(String defaultModel) {
            this.defaultModel = defaultModel;
        }

        public List<ModelOption> getModels() {
            return models;
        }

        public void setModels(List<ModelOption> models) {
            this.models = models;
        }
    }

    public static class ModelOption {

        private String id;
        private String label;
        private boolean vision;

        public String getId() {
            return id;
        }

        public void setId(String id) {
            this.id = id;
        }

        public String getLabel() {
            return label;
        }

        public void setLabel(String label) {
            this.label = label;
        }

        public boolean isVision() {
            return vision;
        }

        public void setVision(boolean vision) {
            this.vision = vision;
        }
    }
}
