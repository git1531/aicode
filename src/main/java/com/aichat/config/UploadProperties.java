package com.aichat.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

@ConfigurationProperties(prefix = "chat.upload")
public class UploadProperties {

    private int maxTextLength = 50000;
    private String allowedExtensions = "pdf,doc,docx,txt,md,png,jpg,jpeg";

    public int getMaxTextLength() {
        return maxTextLength;
    }

    public void setMaxTextLength(int maxTextLength) {
        this.maxTextLength = maxTextLength;
    }

    public String getAllowedExtensions() {
        return allowedExtensions;
    }

    public void setAllowedExtensions(String allowedExtensions) {
        this.allowedExtensions = allowedExtensions;
    }

    public Set<String> allowedExtensionSet() {
        Set<String> set = new HashSet<>();
        for (String ext : allowedExtensions.split(",")) {
            if (!ext.isBlank()) {
                set.add(ext.trim().toLowerCase());
            }
        }
        return set;
    }
}
