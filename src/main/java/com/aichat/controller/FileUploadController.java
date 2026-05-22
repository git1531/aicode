package com.aichat.controller;

import com.aichat.model.FileAttachment;
import com.aichat.service.FileParseService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/chat")
public class FileUploadController {

    private final FileParseService fileParseService;

    public FileUploadController(FileParseService fileParseService) {
        this.fileParseService = fileParseService;
    }

    @PostMapping("/attachments")
    public List<FileAttachment> upload(@RequestParam("files") MultipartFile[] files) {
        return fileParseService.parseFiles(files);
    }
}
