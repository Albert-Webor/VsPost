import * as vscode from 'vscode';
import { getWebviewHtml } from './webview/getWebviewHtml';
import { executeHttpRequest } from './httpClient';

export function activate(context: vscode.ExtensionContext) {
  // 1. 注册 Activity Bar 侧边栏 Webview Provider
  const sidebarProvider = new SimpleApiClientViewProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('simpleApiClient.sidebar', sidebarProvider)
  );

  // 2. 注册以主编辑器 Tab 形式打开面板的命令
  const openPanelCommand = vscode.commands.registerCommand('simpleApiClient.openPanel', () => {
    const panel = vscode.window.createWebviewPanel(
      'simpleApiClientPanel',
      'Simple API Client',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')]
      }
    );

    panel.webview.html = getWebviewHtml(panel.webview, context.extensionUri);
    setupWebviewMessageHandler(panel.webview, context);
  });

  context.subscriptions.push(openPanelCommand);
}

/**
 * Activity Bar 侧边栏 Webview Provider
 */
class SimpleApiClientViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;

  constructor(private readonly _context: vscode.ExtensionContext) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this._context.extensionUri, 'media')]
    };

    webviewView.webview.html = getWebviewHtml(webviewView.webview, this._context.extensionUri);
    setupWebviewMessageHandler(webviewView.webview, this._context);
  }
}

/**
 * 处理 Webview 发送的消息与状态持久化
 */
function setupWebviewMessageHandler(webview: vscode.Webview, context: vscode.ExtensionContext) {
  webview.onDidReceiveMessage(async (message) => {
    switch (message.command) {
      case 'sendRequest': {
        try {
          const result = await executeHttpRequest(message.payload);
          webview.postMessage({
            command: 'responseResult',
            tabId: message.tabId,
            payload: result
          });
        } catch (err: any) {
          webview.postMessage({
            command: 'responseResult',
            tabId: message.tabId,
            payload: {
              success: false,
              timeMs: 0,
              error: err?.message || String(err)
            }
          });
        }
        break;
      }

      case 'saveState': {
        try {
          await context.globalState.update('simpleApiClient.savedState', message.payload);
          webview.postMessage({
            command: 'stateSaved',
            success: true
          });
        } catch (err: any) {
          console.error('Failed to save state:', err);
        }
        break;
      }

      case 'loadState': {
        try {
          const savedState = context.globalState.get('simpleApiClient.savedState');
          webview.postMessage({
            command: 'stateLoaded',
            payload: savedState || null
          });
        } catch (err: any) {
          console.error('Failed to load state:', err);
        }
        break;
      }
    }
  });
}

export function deactivate() {}
