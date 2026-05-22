package com.aichat.service;

import com.aichat.config.UploadProperties;
import com.aichat.model.FileAttachment;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.hwpf.HWPFDocument;
import org.apache.poi.hwpf.extractor.WordExtractor;
import org.apache.poi.xwpf.extractor.XWPFWordExtractor;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
public class FileParseService {

    private static final Set<String> IMAGE_EXTENSIONS = Set.of("png", "jpg", "jpeg", "gif", "webp", "bmp");

    private final UploadProperties uploadProperties;

    public FileParseService(UploadProperties uploadProperties) {
        this.uploadProperties = uploadProperties;
    }

    public List<FileAttachment> parseFiles(MultipartFile[] files) {
        if (files == null || files.length == 0) {
            throw new IllegalArgumentException("请选择至少一个文件");
        }
        List<FileAttachment> attachments = new ArrayList<>();
        for (MultipartFile file : files) {
            if (file == null || file.isEmpty()) {
                continue;
            }
            attachments.add(parseFile(file));
        }
        if (attachments.isEmpty()) {
            throw new IllegalArgumentException("未检测到有效文件");
        }
        return attachments;
    }

    public FileAttachment parseFile(MultipartFile file) {
        String fileName = StringUtils.hasText(file.getOriginalFilename())
                ? file.getOriginalFilename()
                : "unknown";
        String extension = getExtension(fileName);
        validateExtension(extension);

        FileAttachment attachment = new FileAttachment();
        attachment.setFileName(fileName);

        try {
            if (IMAGE_EXTENSIONS.contains(extension)) {
                attachment.setFileType("image");
                attachment.setMimeType(resolveImageMime(extension, file.getContentType()));
                attachment.setBase64Data(Base64.getEncoder().encodeToString(file.getBytes()));
                return attachment;
            }

            attachment.setFileType("text");
            String text = extractText(file, extension);
            if (!StringUtils.hasText(text)) {
                throw new IllegalArgumentException("未能从文件中提取文本: " + fileName);
            }
            attachment.setTextContent(truncate(text));
            return attachment;
        } catch (IOException ex) {
            throw new IllegalArgumentException("文件解析失败: " + fileName + "，" + ex.getMessage(), ex);
        }
    }

    private String extractText(MultipartFile file, String extension) throws IOException {
        return switch (extension) {
            case "pdf" -> extractPdf(file);
            case "docx" -> extractDocx(file);
            case "doc" -> extractDoc(file);
            case "txt", "md", "csv", "json", "xml", "html" -> new String(file.getBytes(), StandardCharsets.UTF_8);
            default -> throw new IllegalArgumentException("暂不支持的文件类型: ." + extension);
        };
    }

    private String extractPdf(MultipartFile file) throws IOException {
        try (PDDocument document = Loader.loadPDF(file.getBytes())) {
            PDFTextStripper stripper = new PDFTextStripper();
            return stripper.getText(document);
        }
    }

    private String extractDocx(MultipartFile file) throws IOException {
        try (XWPFDocument document = new XWPFDocument(file.getInputStream());
             XWPFWordExtractor extractor = new XWPFWordExtractor(document)) {
            return extractor.getText();
        }
    }

    private String extractDoc(MultipartFile file) throws IOException {
        try (HWPFDocument document = new HWPFDocument(file.getInputStream());
             WordExtractor extractor = new WordExtractor(document)) {
            return extractor.getText();
        }
    }

    private void validateExtension(String extension) {
        if (!uploadProperties.allowedExtensionSet().contains(extension)) {
            throw new IllegalArgumentException("不支持的文件类型: ." + extension);
        }
    }

    private String truncate(String text) {
        int max = uploadProperties.getMaxTextLength();
        if (text.length() <= max) {
            return text.trim();
        }
        return text.substring(0, max).trim() + "\n...(内容过长，已截断)";
    }

    private String getExtension(String fileName) {
        int index = fileName.lastIndexOf('.');
        if (index < 0 || index == fileName.length() - 1) {
            throw new IllegalArgumentException("文件缺少扩展名: " + fileName);
        }
        return fileName.substring(index + 1).toLowerCase(Locale.ROOT);
    }

    private String resolveImageMime(String extension, String contentType) {
        if (StringUtils.hasText(contentType) && contentType.startsWith("image/")) {
            return contentType;
        }
        return switch (extension) {
            case "png" -> "image/png";
            case "jpg", "jpeg" -> "image/jpeg";
            case "gif" -> "image/gif";
            case "webp" -> "image/webp";
            case "bmp" -> "image/bmp";
            default -> "image/png";
        };
    }
}
