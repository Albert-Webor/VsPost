# Simple API Client for VS Code

一款专为 VS Code 打造的轻量级、类 Postman 的 HTTP API 请求客户端插件。

## ✨ 核心特性

1. **左侧 Activity Bar 快捷入口**：点击左侧小图标，即刻在侧边栏或主编辑器中打开请求面板。
2. **支持常见 HTTP Method**：`GET`、`POST`、`PUT`、`DELETE`、`PATCH`。
3. **HTTP Headers 便捷管理**：支持自定义添加、编辑与删除请求头。
4. **JSON Request Body & 校验**：支持编辑 JSON 请求体、一键格式化与实时格式校验提示。
5. **通配符 / 动态变量支持**：
   - `{{timestamp}}` / `{{$timestamp}}`：当前毫秒时间戳（例如 `1724830800000`）
   - `{{$iso}}`：ISO 8601 日期时间字符串（例如 `2026-08-28T...`）
   - `{{$date}}`：当前日期（`YYYY-MM-DD`）
   - `{{$guid}}`：随机 UUID / GUID
   - `{{$randomInt}}`：0~9999 随机整数
6. **响应视图**：
   - 状态码徽标（Status Code & Text）
   - 请求耗时（ms）
   - 响应体 JSON 自动美化与纯文本显示
   - 一键复制响应内容

---

## 🛠️ 快速启动与调试 (F5)

1. 在终端安装依赖并编译：
   ```bash
   npm install
   npm run compile
   ```
2. 在 VS Code 中按下 **F5**，启动 **Extension Development Host**。
3. 在新弹出的 VS Code 窗口左侧活动栏（Activity Bar）中点击 **Simple API Client** 图标即可使用！

---

## 📁 项目结构

```text
.
├── .vscode/
│   ├── launch.json           # F5 调试启动配置
│   └── tasks.json            # 编译任务配置
├── media/
│   ├── icon.svg              # Activity Bar 矢量图标
│   ├── styles.css            # Webview 自适应主题样式
│   └── webview.js            # 前端交互与通信逻辑
├── src/
│   ├── extension.ts          # 插件激活入口与 Webview Provider
│   ├── httpClient.ts         # HTTP 发送与耗时计算
│   ├── wildcardResolver.ts   # 通配符解析器
│   └── webview/
│       └── getWebviewHtml.ts # Webview HTML 构造器
├── package.json              # 插件清单与配置
├── tsconfig.json             # TypeScript 配置
└── README.md
```
