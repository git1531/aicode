package com.aichat.model;

import java.util.ArrayList;
import java.util.List;

public class ProviderView {

    private String id;
    private String name;
    private String defaultModel;
    private List<ModelOptionView> models = new ArrayList<>();

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDefaultModel() {
        return defaultModel;
    }

    public void setDefaultModel(String defaultModel) {
        this.defaultModel = defaultModel;
    }

    public List<ModelOptionView> getModels() {
        return models;
    }

    public void setModels(List<ModelOptionView> models) {
        this.models = models;
    }

    public static class ModelOptionView {

        private String id;
        private String label;
        private boolean vision;

        public ModelOptionView() {
        }

        public ModelOptionView(String id, String label, boolean vision) {
            this.id = id;
            this.label = label;
            this.vision = vision;
        }

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
