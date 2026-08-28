// @ts-nocheck
(function () {
  const vscode = acquireVsCodeApi();

  // Elements - View Containers
  const viewGroups = document.getElementById('view-groups');
  const viewRequestWorkbench = document.getElementById('view-request-workbench');
  const backToGroupsBtn = document.getElementById('back-to-groups-btn');
  const currentGroupBadge = document.getElementById('current-group-badge');
  const globalSaveBtns = document.querySelectorAll('.global-save-btn');

  // Elements - Page A (Groups)
  const newGroupInput = document.getElementById('new-group-input');
  const createGroupBtn = document.getElementById('create-group-btn');
  const groupsList = document.getElementById('groups-list');

  // Elements - Page B (Workbench)
  const requestTabsList = document.getElementById('request-tabs-list');
  const addTabBtn = document.getElementById('add-tab-btn');
  const requestNameInput = document.getElementById('request-name-input');
  const methodSelect = document.getElementById('method-select');
  const urlInput = document.getElementById('url-input');
  const sendBtn = document.getElementById('send-btn');
  const sendBtnText = document.getElementById('send-btn-text');
  const headersTableBody = document.getElementById('headers-tbody');
  const addHeaderBtn = document.getElementById('add-header-btn');
  const resetHeadersBtn = document.getElementById('reset-headers-btn');
  const headersCountBadge = document.getElementById('headers-count-badge');
  const bodyEditorWrapper = document.querySelector('.body-editor-wrapper');
  const bodyHighlightLayer = document.querySelector('.body-highlight-layer');
  const bodyHighlightCode = document.getElementById('body-highlight-code');
  const bodyTextarea = document.getElementById('body-textarea');
  const formatJsonBtn = document.getElementById('format-json-btn');
  const jsonErrorMsg = document.getElementById('json-error-msg');
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const statusBadge = document.getElementById('status-badge');
  const timeBadge = document.getElementById('time-badge');
  const responseBodyBox = document.getElementById('response-body');
  const copyResponseBtn = document.getElementById('copy-response-btn');

  // Postman 默认 Header 预设
  const DEFAULT_POSTMAN_HEADERS = [
    { enabled: true, key: 'Postman-Token', value: '<calculated when request is sent>' },
    { enabled: true, key: 'Content-Type', value: 'application/json' },
    { enabled: true, key: 'Content-Length', value: '<calculated when request is sent>' },
    { enabled: true, key: 'Host', value: '<calculated when request is sent>' },
    { enabled: true, key: 'User-Agent', value: 'PostmanRuntime/7.56.1' },
    { enabled: true, key: 'Accept', value: '*/*' },
    { enabled: true, key: 'Accept-Encoding', value: 'gzip, deflate, br' },
    { enabled: true, key: 'Connection', value: 'keep-alive' }
  ];

  function createNewTab(name = 'New Request', method = 'GET', url = 'https://jsonplaceholder.typicode.com/posts/1') {
    return {
      id: 'tab_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      name: name,
      method: method,
      url: url,
      headers: JSON.parse(JSON.stringify(DEFAULT_POSTMAN_HEADERS)),
      body: '',
      response: null
    };
  }

  function createNewGroup(name = 'New Collection') {
    const initialTab = createNewTab('Get Post 1', 'GET', 'https://jsonplaceholder.typicode.com/posts/1');
    return {
      id: 'grp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      name: name,
      createdAt: Date.now(),
      activeTabId: initialTab.id,
      tabs: [initialTab]
    };
  }

  // 状态维护
  let appState = {
    currentView: 'groups', // 'groups' (Page A) 或 'requestDetail' (Page B)
    activeGroupId: null,
    groups: [
      createNewGroup('Default API Collection')
    ]
  };
  appState.activeGroupId = appState.groups[0].id;

  let currentHeaders = [];

  // 获取当前激活的群组
  function getActiveGroup() {
    return appState.groups.find((g) => g.id === appState.activeGroupId) || appState.groups[0];
  }

  // 获取当前群组中激活的请求 Tab
  function getActiveTab() {
    const grp = getActiveGroup();
    if (!grp) return null;
    return grp.tabs.find((t) => t.id === grp.activeTabId) || grp.tabs[0];
  }

  // 剥离 JS 注释
  function stripJsonComments(str) {
    if (!str) return '';
    return str
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^\\])\/\/.*$/gm, '$1');
  }

  // 高亮 JSON 语法 Tokenizer
  function highlightJson(jsonStr) {
    if (!jsonStr) return '';
    let html = jsonStr
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const wildcards = [];
    html = html.replace(/\{\{[^}]+\}\}/g, (match) => {
      const id = `__WC_${wildcards.length}__`;
      wildcards.push(`<span class="token-wildcard">${match}</span>`);
      return id;
    });

    const comments = [];
    html = html.replace(/(\/\*[\s\S]*?\*\/|\/\/[^\n]*)/g, (match) => {
      const id = `__COMMENT_${comments.length}__`;
      comments.push(`<span class="token-comment">${match}</span>`);
      return id;
    });

    html = html.replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      function (match) {
        let cls = 'token-number';
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            cls = 'token-key';
          } else {
            cls = 'token-string';
          }
        } else if (/true|false/.test(match)) {
          cls = 'token-boolean';
        } else if (/null/.test(match)) {
          cls = 'token-null';
        }
        return '<span class="' + cls + '">' + match + '</span>';
      }
    );

    comments.forEach((cm, i) => {
      html = html.replace(`__COMMENT_${i}__`, cm);
    });

    wildcards.forEach((wc, i) => {
      html = html.replace(`__WC_${i}__`, wc);
    });

    return html;
  }

  function updateBodyHighlight() {
    if (bodyHighlightCode && bodyTextarea) {
      const text = bodyTextarea.value;
      bodyHighlightCode.innerHTML = highlightJson(text) + (text.endsWith('\n') ? ' ' : '');
    }
  }

  if (bodyTextarea && bodyHighlightLayer) {
    bodyTextarea.addEventListener('scroll', () => {
      bodyHighlightLayer.scrollTop = bodyTextarea.scrollTop;
      bodyHighlightLayer.scrollLeft = bodyTextarea.scrollLeft;
    });
  }

  // 保存当前 UI 输入到当前群组的当前 Tab
  function saveCurrentTabInputs() {
    const tab = getActiveTab();
    if (!tab) return;
    tab.name = requestNameInput.value.trim() || 'Untitled';
    tab.method = methodSelect.value;
    tab.url = urlInput.value.trim();
    tab.headers = JSON.parse(JSON.stringify(currentHeaders));
    tab.body = bodyTextarea.value;
  }

  // 持久化保存
  function persistState(flashBtn = false) {
    if (appState.currentView === 'requestDetail') {
      saveCurrentTabInputs();
    }
    vscode.setState(appState);
    vscode.postMessage({
      command: 'saveState',
      payload: appState
    });

    if (flashBtn) {
      globalSaveBtns.forEach((btn) => {
        btn.classList.add('saved');
        const textSpan = btn.querySelector('.save-text');
        if (textSpan) textSpan.textContent = 'Saved!';
        setTimeout(() => {
          btn.classList.remove('saved');
          if (textSpan) textSpan.textContent = 'Save';
        }, 1200);
      });
    }
  }

  // ==================== 视图切换逻辑 ====================
  function renderView() {
    if (appState.currentView === 'groups') {
      viewGroups.classList.add('active');
      viewRequestWorkbench.classList.remove('active');
      renderGroupsList();
    } else {
      viewGroups.classList.remove('active');
      viewRequestWorkbench.classList.add('active');
      const grp = getActiveGroup();
      if (currentGroupBadge && grp) {
        currentGroupBadge.textContent = grp.name || 'Untitled Group';
      }
      renderRequestTabs();
      loadTabIntoUI(getActiveTab());
    }
  }

  // ==================== 页面 A: 群组管理列表渲染 ====================
  function renderGroupsList() {
    groupsList.innerHTML = '';
    if (!appState.groups || appState.groups.length === 0) {
      groupsList.innerHTML = '<div class="empty-groups-box">No groups yet. Enter a name above to create your first API group!</div>';
      return;
    }

    appState.groups.forEach((group, index) => {
      const card = document.createElement('div');
      card.className = 'group-card';

      // 点击卡片进入群组
      card.addEventListener('click', (e) => {
        if (e.target.closest('.group-actions') || e.target.tagName === 'BUTTON') return;
        enterGroup(group.id);
      });

      // 群组信息
      const groupInfo = document.createElement('div');
      groupInfo.className = 'group-info';

      const folderIcon = document.createElement('span');
      folderIcon.className = 'group-folder-icon';
      folderIcon.innerHTML = '📁';
      groupInfo.appendChild(folderIcon);

      const groupText = document.createElement('div');
      groupText.className = 'group-text';

      const groupName = document.createElement('div');
      groupName.className = 'group-name';
      groupName.textContent = group.name;
      groupText.appendChild(groupName);

      const groupMeta = document.createElement('div');
      groupMeta.className = 'group-meta';
      const reqCount = group.tabs ? group.tabs.length : 0;
      groupMeta.innerHTML = `<span class="group-req-badge">${reqCount} ${reqCount === 1 ? 'Request' : 'Requests'}</span>`;
      groupText.appendChild(groupMeta);

      groupInfo.appendChild(groupText);
      card.appendChild(groupInfo);

      // 操作按钮区
      const actions = document.createElement('div');
      actions.className = 'group-actions';

      // 进入群组按钮
      const enterBtn = document.createElement('button');
      enterBtn.className = 'group-enter-btn';
      enterBtn.textContent = 'Open →';
      enterBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        enterGroup(group.id);
      });
      actions.appendChild(enterBtn);

      // 重命名按钮
      const renameBtn = document.createElement('button');
      renameBtn.className = 'icon-btn';
      renameBtn.title = 'Rename Group';
      renameBtn.innerHTML = '✏️';
      renameBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const newName = prompt('Enter new group name:', group.name);
        if (newName && newName.trim()) {
          group.name = newName.trim();
          renderGroupsList();
          persistState();
        }
      });
      actions.appendChild(renameBtn);

      // 删除群组按钮
      const delBtn = document.createElement('button');
      delBtn.className = 'icon-btn';
      delBtn.title = 'Delete Group';
      delBtn.innerHTML = '🗑️';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`Are you sure you want to delete group "${group.name}"?`)) {
          appState.groups.splice(index, 1);
          if (appState.groups.length === 0) {
            appState.groups = [createNewGroup('Default API Collection')];
          }
          if (appState.activeGroupId === group.id) {
            appState.activeGroupId = appState.groups[0].id;
          }
          renderGroupsList();
          persistState();
        }
      });
      actions.appendChild(delBtn);

      card.appendChild(actions);
      groupsList.appendChild(card);
    });
  }

  function enterGroup(groupId) {
    appState.activeGroupId = groupId;
    appState.currentView = 'requestDetail';
    renderView();
    persistState();
  }

  // 新建群组
  createGroupBtn.addEventListener('click', () => {
    const name = newGroupInput.value.trim();
    if (!name) {
      newGroupInput.focus();
      return;
    }
    const newGrp = createNewGroup(name);
    appState.groups.push(newGrp);
    newGroupInput.value = '';
    renderGroupsList();
    persistState();
  });

  newGroupInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      createGroupBtn.click();
    }
  });

  // 返回群组列表
  backToGroupsBtn.addEventListener('click', () => {
    saveCurrentTabInputs();
    appState.currentView = 'groups';
    renderView();
    persistState();
  });

  // ==================== 页面 B: 工作台请求渲染 ====================
  function renderRequestTabs() {
    requestTabsList.innerHTML = '';
    const grp = getActiveGroup();
    if (!grp || !grp.tabs) return;

    grp.tabs.forEach((tab) => {
      const tabEl = document.createElement('div');
      tabEl.className = 'request-tab-item' + (tab.id === grp.activeTabId ? ' active' : '');
      tabEl.title = `${tab.method} ${tab.url}`;

      const methodTag = document.createElement('span');
      methodTag.className = 'tab-method-tag';
      methodTag.setAttribute('data-method', tab.method);
      methodTag.textContent = tab.method;
      tabEl.appendChild(methodTag);

      const titleText = document.createElement('span');
      titleText.className = 'tab-title-text';
      titleText.textContent = tab.name || 'Untitled';
      tabEl.appendChild(titleText);

      // 关闭 Tab 按钮
      const closeBtn = document.createElement('button');
      closeBtn.className = 'tab-close-btn';
      closeBtn.innerHTML = '✕';
      closeBtn.title = 'Close Request';
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeTab(tab.id);
      });
      tabEl.appendChild(closeBtn);

      tabEl.addEventListener('click', () => {
        if (tab.id !== grp.activeTabId) {
          saveCurrentTabInputs();
          grp.activeTabId = tab.id;
          renderRequestTabs();
          loadTabIntoUI(tab);
          persistState();
        }
      });

      requestTabsList.appendChild(tabEl);
    });
  }

  function closeTab(tabId) {
    const grp = getActiveGroup();
    if (!grp || !grp.tabs) return;

    if (grp.tabs.length <= 1) {
      grp.tabs = [createNewTab('New Request', 'GET', 'https://jsonplaceholder.typicode.com/posts/1')];
      grp.activeTabId = grp.tabs[0].id;
    } else {
      const index = grp.tabs.findIndex((t) => t.id === tabId);
      if (index !== -1) {
        grp.tabs.splice(index, 1);
        if (grp.activeTabId === tabId) {
          const nextIndex = index >= grp.tabs.length ? grp.tabs.length - 1 : index;
          grp.activeTabId = grp.tabs[nextIndex].id;
        }
      }
    }
    renderRequestTabs();
    loadTabIntoUI(getActiveTab());
    persistState();
  }

  function loadTabIntoUI(tab) {
    if (!tab) return;
    requestNameInput.value = tab.name || '';
    methodSelect.value = tab.method || 'GET';
    updateMethodColor();
    urlInput.value = tab.url || '';
    currentHeaders = JSON.parse(JSON.stringify(tab.headers || DEFAULT_POSTMAN_HEADERS));
    renderHeaders();
    bodyTextarea.value = tab.body || '';
    updateBodyHighlight();
    clearJsonError();
    renderResponse(tab.response);
  }

  function renderResponse(resData) {
    if (!resData) {
      statusBadge.textContent = '-';
      statusBadge.className = 'status-badge';
      timeBadge.textContent = '';
      responseBodyBox.innerHTML = '<div class="empty-placeholder">Click \'Send\' to make a request</div>';
      return;
    }

    if (resData.success) {
      statusBadge.textContent = `${resData.status} ${resData.statusText}`;
      timeBadge.textContent = `${resData.timeMs} ms`;

      statusBadge.className = 'status-badge';
      if (resData.status >= 200 && resData.status < 300) {
        statusBadge.classList.add('status-2xx');
      } else if (resData.status >= 300 && resData.status < 400) {
        statusBadge.classList.add('status-3xx');
      } else {
        statusBadge.classList.add('status-4xx');
      }

      if (resData.body) {
        responseBodyBox.innerHTML = highlightJson(resData.body);
      } else {
        responseBodyBox.innerHTML = '<span style="color:var(--vscode-descriptionForeground)">(Empty Response)</span>';
      }
    } else {
      statusBadge.textContent = 'Error';
      statusBadge.className = 'status-badge status-err';
      timeBadge.textContent = `${resData.timeMs || 0} ms`;
      responseBodyBox.textContent = `Request Failed:\n${resData.error}`;
    }
  }

  function updateHeadersBadge() {
    const activeCount = currentHeaders.filter((h) => h.enabled && h.key.trim()).length;
    if (headersCountBadge) {
      headersCountBadge.textContent = activeCount > 0 ? activeCount : '';
    }
  }

  function renderHeaders() {
    headersTableBody.innerHTML = '';
    currentHeaders.forEach((header, index) => {
      const tr = document.createElement('tr');
      if (!header.enabled) {
        tr.classList.add('disabled');
      }

      const tdCheck = document.createElement('td');
      tdCheck.style.textAlign = 'center';
      const inputCheck = document.createElement('input');
      inputCheck.type = 'checkbox';
      inputCheck.checked = header.enabled;
      inputCheck.title = 'Enable / Disable Header';
      inputCheck.addEventListener('change', (e) => {
        currentHeaders[index].enabled = e.target.checked;
        if (e.target.checked) {
          tr.classList.remove('disabled');
        } else {
          tr.classList.add('disabled');
        }
        updateHeadersBadge();
        persistState();
      });
      tdCheck.appendChild(inputCheck);

      const tdKey = document.createElement('td');
      const inputKey = document.createElement('input');
      inputKey.type = 'text';
      inputKey.placeholder = 'Header Key (e.g. Authorization)';
      inputKey.value = header.key;
      inputKey.addEventListener('input', (e) => {
        currentHeaders[index].key = e.target.value;
        updateHeadersBadge();
      });
      inputKey.addEventListener('change', () => persistState());
      tdKey.appendChild(inputKey);

      const tdValue = document.createElement('td');
      const inputValue = document.createElement('input');
      inputValue.type = 'text';
      inputValue.placeholder = 'Header Value (支持 {{timestamp}})';
      inputValue.value = header.value;
      inputValue.addEventListener('input', (e) => {
        currentHeaders[index].value = e.target.value;
      });
      inputValue.addEventListener('change', () => persistState());
      tdValue.appendChild(inputValue);

      const tdAction = document.createElement('td');
      tdAction.style.width = '36px';
      tdAction.style.textAlign = 'center';
      const delBtn = document.createElement('button');
      delBtn.className = 'icon-btn';
      delBtn.title = 'Remove Header';
      delBtn.innerHTML = '✕';
      delBtn.addEventListener('click', () => {
        currentHeaders.splice(index, 1);
        renderHeaders();
        persistState();
      });
      tdAction.appendChild(delBtn);

      tr.appendChild(tdCheck);
      tr.appendChild(tdKey);
      tr.appendChild(tdValue);
      tr.appendChild(tdAction);
      headersTableBody.appendChild(tr);
    });

    updateHeadersBadge();
  }

  // 绑定新建请求 Tab
  addTabBtn.addEventListener('click', () => {
    saveCurrentTabInputs();
    const grp = getActiveGroup();
    if (!grp) return;
    const count = (grp.tabs ? grp.tabs.length : 0) + 1;
    const newTab = createNewTab(`Request ${count}`, 'GET', '');
    grp.tabs.push(newTab);
    grp.activeTabId = newTab.id;
    renderRequestTabs();
    loadTabIntoUI(newTab);
    persistState();
    setTimeout(() => urlInput.focus(), 50);
  });

  // 全局保存按钮
  globalSaveBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      persistState(true);
    });
  });

  // 监听 Tab 标题输入改变
  requestNameInput.addEventListener('input', () => {
    const tab = getActiveTab();
    if (tab) {
      tab.name = requestNameInput.value.trim() || 'Untitled';
      renderRequestTabs();
    }
  });
  requestNameInput.addEventListener('change', () => persistState());

  urlInput.addEventListener('change', () => persistState());

  addHeaderBtn.addEventListener('click', () => {
    currentHeaders.push({ enabled: true, key: '', value: '' });
    renderHeaders();
    persistState();
    setTimeout(() => {
      const textInputs = headersTableBody.querySelectorAll('input[type="text"]');
      if (textInputs.length > 0) {
        textInputs[textInputs.length - 2].focus();
      }
    }, 50);
  });

  if (resetHeadersBtn) {
    resetHeadersBtn.addEventListener('click', () => {
      currentHeaders = JSON.parse(JSON.stringify(DEFAULT_POSTMAN_HEADERS));
      renderHeaders();
      persistState();
    });
  }

  function updateMethodColor() {
    const val = methodSelect.value;
    methodSelect.setAttribute('data-method', val);
    const tab = getActiveTab();
    if (tab) {
      tab.method = val;
      renderRequestTabs();
    }
  }
  methodSelect.addEventListener('change', () => {
    updateMethodColor();
    persistState();
  });

  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabBtns.forEach((b) => b.classList.remove('active'));
      tabContents.forEach((c) => c.classList.remove('active'));

      btn.classList.add('active');
      const targetTab = btn.getAttribute('data-tab');
      const content = document.getElementById(targetTab);
      if (content) {
        content.classList.add('active');
      }
      if (targetTab === 'tab-body') {
        updateBodyHighlight();
      }
    });
  });

  // 格式化 JSON
  formatJsonBtn.addEventListener('click', () => {
    const text = bodyTextarea.value.trim();
    if (!text) return;
    try {
      const stripped = stripJsonComments(text);
      const wildcardMap = [];
      const safeForParse = stripped.replace(/\{\{[^}]+\}\}/g, (match) => {
        const id = `__WC_FMT_${wildcardMap.length}__`;
        wildcardMap.push({ id, original: match });
        return `"${id}"`;
      });

      const parsed = JSON.parse(safeForParse);
      let formatted = JSON.stringify(parsed, null, 2);

      wildcardMap.forEach(({ id, original }) => {
        formatted = formatted.replace(new RegExp(`"${id}"`, 'g'), original);
      });

      bodyTextarea.value = formatted;
      updateBodyHighlight();
      clearJsonError();
      persistState();
    } catch (err) {
      showJsonError('Invalid JSON: ' + err.message);
    }
  });

  // 校验 JSON
  function validateJsonBody() {
    const method = methodSelect.value;
    const body = bodyTextarea.value.trim();
    if (!['POST', 'PUT', 'PATCH'].includes(method) || !body) {
      clearJsonError();
      return true;
    }

    const stripped = stripJsonComments(body);
    const simulated = stripped.replace(/\{\{[^}]+\}\}/g, '123456');

    try {
      JSON.parse(simulated);
      clearJsonError();
      return true;
    } catch (err) {
      showJsonError('JSON 格式错误: ' + err.message);
      return false;
    }
  }

  function showJsonError(msg) {
    jsonErrorMsg.textContent = msg;
    jsonErrorMsg.classList.add('visible');
    if (bodyEditorWrapper) {
      bodyEditorWrapper.classList.add('invalid');
    }
  }

  function clearJsonError() {
    jsonErrorMsg.textContent = '';
    jsonErrorMsg.classList.remove('visible');
    if (bodyEditorWrapper) {
      bodyEditorWrapper.classList.remove('invalid');
    }
  }

  bodyTextarea.addEventListener('input', () => {
    updateBodyHighlight();
    if (jsonErrorMsg.classList.contains('visible')) {
      validateJsonBody();
    }
  });
  bodyTextarea.addEventListener('change', () => persistState());

  bodyTextarea.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = bodyTextarea.selectionStart;
      const end = bodyTextarea.selectionEnd;
      bodyTextarea.value = bodyTextarea.value.substring(0, start) + '  ' + bodyTextarea.value.substring(end);
      bodyTextarea.selectionStart = bodyTextarea.selectionEnd = start + 2;
      updateBodyHighlight();
    }
  });

  // 发送请求
  sendBtn.addEventListener('click', () => {
    const url = urlInput.value.trim();
    if (!url) {
      urlInput.focus();
      return;
    }

    const method = methodSelect.value;
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      if (!validateJsonBody()) {
        const bodyTabBtn = document.querySelector('[data-tab="tab-body"]');
        if (bodyTabBtn) bodyTabBtn.click();
        return;
      }
    }

    const headersMap = {};
    currentHeaders.forEach((h) => {
      if (h.enabled && h.key.trim()) {
        headersMap[h.key.trim()] = h.value;
      }
    });

    const activeTab = getActiveTab();
    const currentTabId = activeTab ? activeTab.id : null;

    sendBtn.disabled = true;
    sendBtnText.innerHTML = '<span class="spinner"></span> Sending...';
    statusBadge.textContent = 'Loading...';
    statusBadge.className = 'status-badge';
    timeBadge.textContent = '';
    responseBodyBox.textContent = 'Sending request...';

    vscode.postMessage({
      command: 'sendRequest',
      tabId: currentTabId,
      payload: {
        method: method,
        url: url,
        headers: headersMap,
        body: bodyTextarea.value
      }
    });
  });

  // 监听来自 Extension Host 的消息
  window.addEventListener('message', (event) => {
    const message = event.data;

    if (message.command === 'responseResult') {
      const data = message.payload;
      const grp = getActiveGroup();
      if (grp && grp.tabs) {
        const targetTab = grp.tabs.find((t) => t.id === message.tabId) || getActiveTab();
        if (targetTab) {
          targetTab.response = data;
        }
        if (targetTab && targetTab.id === grp.activeTabId) {
          renderResponse(data);
        }
      }

      sendBtn.disabled = false;
      sendBtnText.textContent = 'Send';
      persistState();
    } else if (message.command === 'stateLoaded') {
      if (message.payload) {
        loadStateData(message.payload);
      }
    }
  });

  copyResponseBtn.addEventListener('click', () => {
    const text = responseBodyBox.textContent;
    if (text && text !== '(Empty Response)' && !text.startsWith('Sending')) {
      navigator.clipboard.writeText(text).then(() => {
        const originalText = copyResponseBtn.textContent;
        copyResponseBtn.textContent = 'Copied!';
        setTimeout(() => {
          copyResponseBtn.textContent = originalText;
        }, 1500);
      });
    }
  });

  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      sendBtn.click();
    }
  });

  function loadStateData(data) {
    if (!data) return;
    // 兼容老数据结构
    if (Array.isArray(data.groups) && data.groups.length > 0) {
      appState = data;
    } else if (Array.isArray(data.tabs) && data.tabs.length > 0) {
      appState = {
        currentView: 'groups',
        activeGroupId: 'grp_default',
        groups: [
          {
            id: 'grp_default',
            name: 'Default Collection',
            createdAt: Date.now(),
            activeTabId: data.activeTabId || data.tabs[0].id,
            tabs: data.tabs
          }
        ]
      };
    }
    if (!appState.groups.some((g) => g.id === appState.activeGroupId)) {
      appState.activeGroupId = appState.groups[0].id;
    }
    renderView();
  }

  // 初始化加载
  const previousState = vscode.getState();
  if (previousState) {
    loadStateData(previousState);
  } else {
    renderView();
  }

  vscode.postMessage({ command: 'loadState' });
})();
