"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWebviewHtml = getWebviewHtml;
const vscode = __importStar(require("vscode"));
function getWebviewHtml(webview, extensionUri) {
    const stylesUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'styles.css'));
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'webview.js'));
    // Content Security Policy
    const nonce = getNonce();
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource};">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="${stylesUri}" rel="stylesheet">
  <title>Simple API Client</title>
</head>
<body>
  <div class="container">
    <!-- ==================== 页面 A: 群组管理列表 ==================== -->
    <div id="view-groups" class="view-page active">
      <div class="header-title">
        <h2>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          </svg>
          API Groups & Collections
        </h2>
        <div class="header-actions">
          <button class="small-btn save-btn global-save-btn" title="保存所有群组与请求">
            <span>💾</span> <span class="save-text">Save</span>
          </button>
        </div>
      </div>

      <!-- 新增群组操作栏 -->
      <div class="create-group-bar">
        <input 
          id="new-group-input" 
          type="text" 
          class="new-group-input" 
          placeholder="Enter new group name (e.g. Auth Service, User APIs)..." 
        />
        <button id="create-group-btn" class="primary-btn">
          + Create Group
        </button>
      </div>

      <!-- 群组卡片网格列表 -->
      <div id="groups-list" class="groups-grid"></div>
    </div>

    <!-- ==================== 页面 B: 群组内部 HTTP 请求工作台 ==================== -->
    <div id="view-request-workbench" class="view-page">
      <!-- 顶部导航栏 (返回群组 + 群组名面包屑 + 保存) -->
      <div class="workbench-nav-bar">
        <div class="nav-left">
          <button id="back-to-groups-btn" class="back-btn" title="返回群组列表">
            ← All Groups
          </button>
          <span class="nav-divider">/</span>
          <span id="current-group-badge" class="current-group-badge">Default Group</span>
        </div>
        <div class="header-actions">
          <button class="small-btn save-btn global-save-btn" title="保存所有群组与请求">
            <span>💾</span> <span class="save-text">Save</span>
          </button>
        </div>
      </div>

      <!-- Request Tabs Bar (当前群组内的多请求标签栏) -->
      <div class="request-tabs-bar">
        <div id="request-tabs-list" class="request-tabs-list"></div>
        <button id="add-tab-btn" class="add-tab-btn" title="新建请求页面 (New Request)">+</button>
      </div>

      <!-- Request Title / Rename Bar -->
      <div class="request-name-bar">
        <input id="request-name-input" class="request-name-input" type="text" placeholder="Request Name (e.g. Get User Info)" />
      </div>

      <!-- Request Bar (Method + URL + Send) -->
      <div class="request-bar">
        <select id="method-select" class="method-select" data-method="GET">
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="DELETE">DELETE</option>
          <option value="PATCH">PATCH</option>
        </select>

        <div class="url-input-container">
          <input 
            id="url-input" 
            type="text" 
            class="url-input" 
            placeholder="https://api.example.com/users/{{timestamp}}" 
            value="https://jsonplaceholder.typicode.com/posts/1" 
          />
        </div>

        <button id="send-btn" class="send-btn">
          <span id="send-btn-text">Send</span>
        </button>
      </div>

      <!-- Section Tabs Navigation (Headers / Body / Wildcards) -->
      <div class="tabs-nav">
        <button class="tab-btn active" data-tab="tab-headers">Headers <span id="headers-count-badge" class="badge"></span></button>
        <button class="tab-btn" data-tab="tab-body">Body (JSON)</button>
        <button class="tab-btn" data-tab="tab-wildcards">⚡ Wildcards</button>
      </div>

      <!-- Tab 1: Headers -->
      <div id="tab-headers" class="tab-content active">
        <div class="headers-toolbar">
          <span class="body-type-badge">Request Headers</span>
          <button id="reset-headers-btn" class="small-btn">Reset Postman Headers</button>
        </div>
        <table class="headers-table">
          <thead>
            <tr>
              <th style="width: 32px; text-align: center;"></th>
              <th style="width: 44%;">Key</th>
              <th style="width: 44%;">Value</th>
              <th style="width: 36px;"></th>
            </tr>
          </thead>
          <tbody id="headers-tbody"></tbody>
        </table>
        <button id="add-header-btn" class="add-header-btn">+ Add Header</button>
      </div>

      <!-- Tab 2: Body (Syntax Highlighted) -->
      <div id="tab-body" class="tab-content">
        <div class="body-toolbar">
          <span class="body-type-badge">JSON (application/json)</span>
          <div class="body-actions">
            <button id="format-json-btn" class="small-btn">Format JSON</button>
          </div>
        </div>
        <div class="body-editor-wrapper">
          <pre class="body-highlight-layer" aria-hidden="true"><code id="body-highlight-code"></code></pre>
          <textarea 
            id="body-textarea" 
            class="body-textarea" 
            spellcheck="false"
            placeholder='{\n  "title": "foo",\n  "body": "bar",\n  "userId": 1,\n  "created_at": {{timestamp}}\n}'
          ></textarea>
        </div>
        <div id="json-error-msg" class="json-error-msg"></div>
      </div>

      <!-- Tab 3: Wildcards -->
      <div id="tab-wildcards" class="tab-content">
        <div class="wildcard-box">
          <p>在 URL、Header 或 Body 中可直接使用以下动态变量占位符，发送时自动替换：</p>
          <table>
            <tbody>
              <tr>
                <td><code>{{timestamp}}</code> / <code>{{$timestamp}}</code></td>
                <td>当前时间戳毫秒数 (e.g. 1724830800000)</td>
              </tr>
              <tr>
                <td><code>{{$iso}}</code></td>
                <td>ISO 8601 日期时间字符串 (e.g. 2026-08-28T...)</td>
              </tr>
              <tr>
                <td><code>{{$date}}</code></td>
                <td>当前日期 YYYY-MM-DD</td>
              </tr>
              <tr>
                <td><code>{{$guid}}</code></td>
                <td>随机 UUID / GUID 字符串</td>
              </tr>
              <tr>
                <td><code>{{$randomInt}}</code></td>
                <td>0~9999 随机整数字符串</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Response Section -->
      <div class="response-section">
        <div class="response-header">
          <div class="response-meta">
            <strong>Response</strong>
            <span id="status-badge" class="status-badge">-</span>
            <span id="time-badge" class="time-badge"></span>
          </div>
          <button id="copy-response-btn" class="small-btn">Copy</button>
        </div>

        <pre id="response-body" class="response-box"><div class="empty-placeholder">Click 'Send' to make a request</div></pre>
      </div>
    </div>
  </div>

  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
//# sourceMappingURL=getWebviewHtml.js.map