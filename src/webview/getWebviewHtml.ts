import * as vscode from 'vscode';

export function getWebviewHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
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
    <!-- Toast 通知浮层 -->
    <div id="toast" class="toast-notification"></div>

    <!-- ==================== 页面 A: 群组下拉折叠列表 ==================== -->
    <div id="view-groups" class="view-page active">
      <div class="header-title">
        <h2>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          </svg>
          API Collections & Groups
        </h2>
        <div class="header-actions">
          <button id="expand-all-btn" class="icon-btn-secondary" title="Expand All Groups">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </button>
          <button id="collapse-all-btn" class="icon-btn-secondary" title="Collapse All Groups">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"></polyline></svg>
          </button>
          <button class="small-btn save-btn global-save-btn" title="Save all groups and requests (⌘S / Ctrl+S)">
            <span>💾</span> <span class="save-text">Save</span>
          </button>
        </div>
      </div>

      <!-- 新增群组操作栏与搜索栏 -->
      <div class="group-toolbar">
        <div class="create-group-bar">
          <input 
            id="new-group-input" 
            type="text" 
            class="new-group-input" 
            placeholder="Enter new group name (e.g. Auth Service, User APIs)..." 
          />
          <button id="create-group-btn" class="primary-btn">
            + New Group
          </button>
        </div>
      </div>

      <!-- 群组下拉手风琴列表 -->
      <div id="groups-list" class="groups-accordion-list"></div>
    </div>

    <!-- ==================== 页面 B: 群组内部 HTTP 请求工作台 ==================== -->
    <div id="view-request-workbench" class="view-page">
      <!-- 顶部导航栏 (返回群组 + 群组名面包屑 + 保存 + 快捷键提示 + 独立关闭按钮) -->
      <div class="workbench-nav-bar">
        <div class="nav-left">
          <button id="back-to-groups-btn" class="back-btn" title="Close editor and return to groups list (Request is preserved)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
            <span>Close & Back</span>
          </button>
          <span class="nav-divider">/</span>
          <span id="current-group-badge" class="current-group-badge">Default Group</span>
        </div>
        <div class="header-actions">
          <span class="shortcut-tip" title="Shortcut to save">⌘S / Ctrl+S to save</span>
          <button class="small-btn save-btn global-save-btn" title="Save current request (⌘S / Ctrl+S)">
            <span>💾</span> <span class="save-text">Save (⌘S)</span>
          </button>
          <button id="close-workbench-btn" class="icon-btn-secondary close-nav-btn" title="Close editor (Request is preserved in dropdown)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      </div>

      <!-- Request Tabs Bar (当前群组内的多请求标签栏) -->
      <div class="request-tabs-bar">
        <div id="request-tabs-list" class="request-tabs-list"></div>
        <button id="add-tab-btn" class="add-tab-btn" title="New Request in this Group">+</button>
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
          <option value="HEAD">HEAD</option>
          <option value="OPTIONS">OPTIONS</option>
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

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
