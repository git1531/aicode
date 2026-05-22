# AI Chat

基于 Spring Boot + Thymeleaf 的多模型 AI 对话平台。

## 功能

- 支持 DeepSeek、OpenAI、通义千问
- 流式对话输出
- DeepSeek V4 思考模式（可折叠）
- 文件上传：PDF、Word、图片等

## 快速开始

```bash
# 复制本地配置并填入 API Key
cp src/main/resources/application-local.yml.example src/main/resources/application-local.yml

# 启动
mvn spring-boot:run
```

访问：http://localhost:15888

## 配置

在 `application-local.yml` 或环境变量中配置 API Key：

- `DEEPSEEK_API_KEY`
- `OPENAI_API_KEY`
- `QWEN_API_KEY`

默认端口：`15888`（可通过环境变量 `SERVER_PORT` 修改）
