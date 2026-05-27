# AI 画布节点类型（对齐 modeconfig.json）

## 素材节点 BASE_*

| Flow type | Config | 作用 |
|-----------|--------|------|
| base_text | BASE_TEXT | 文本素材，可连到生成节点 |
| base_image | BASE_IMAGE | 图片素材（拖入资源库） |
| base_video | BASE_VIDEO | 视频素材 |
| base_audio | BASE_AUDIO | 音频素材 |

## 生成节点 GENERATE_*

| Flow type | Config | 模型来源 |
|-----------|--------|----------|
| generate_text | GENERATE_TEXT | modeconfig → nodeConfig |
| generate_image | GENERATE_IMAGE | 同上 |
| generate_video | GENERATE_VIDEO | 同上 |
| generate_audio | GENERATE_AUDIO | 同上 |
| generate_storyboard | GENERATE_STORYBOARD | 同上 |

节点数据：`modelCode` + `params`（由 modelConfig.params 驱动 UI）

## 网关对接

完整 API、inputs 校验、积分与 IPC 规划见 **[AI_GATEWAY_SPEC.md](./AI_GATEWAY_SPEC.md)**。
