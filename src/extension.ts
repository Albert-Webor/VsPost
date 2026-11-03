import * as vscode from 'vscode';
import { getWebviewHtml } from './webview/getWebviewHtml';
import { executeHttpRequest } from './httpClient';

export function activate(context: vscode.ExtensionContext) {
  // 1. 注册 Activity Bar 侧边栏 Webview Provider
  const sidebarProvider = new SimpleApiClientViewProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('simpleApiClient.sidebar', sidebarProvider, {
      webviewOptions: {
        retainContextWhenHidden: true
      }
    })
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
 * 跨 Webview 跟踪在途与未消费结果的请求管理器
 */
const inFlightRequests = new Set<string>();
const completedResults = new Map<string, any>();

/**
 * Activity Bar 侧边栏 Webview Provider
 */
class SimpleApiClientViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private _messageDisposable?: vscode.Disposable;

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

    if (this._messageDisposable) {
      this._messageDisposable.dispose();
    }
    this._messageDisposable = setupWebviewMessageHandler(webviewView.webview, this._context);
  }
}

/**
 * 处理 Webview 发送的消息与状态持久化
 */
function setupWebviewMessageHandler(webview: vscode.Webview, context: vscode.ExtensionContext): vscode.Disposable {
  return webview.onDidReceiveMessage(async (message) => {
    switch (message.command) {
      case 'sendRequest': {
        const tabId = message.tabId;
        if (tabId) {
          inFlightRequests.add(tabId);
        }
        try {
          const result = await executeHttpRequest(message.payload);
          if (tabId) {
            inFlightRequests.delete(tabId);
            completedResults.set(tabId, result);
          }
          webview.postMessage({
            command: 'responseResult',
            tabId: tabId,
            payload: result
          });
        } catch (err: any) {
          if (tabId) {
            inFlightRequests.delete(tabId);
          }
          const errorResult = {
            success: false,
            timeMs: 0,
            error: err?.message || String(err)
          };
          if (tabId) {
            completedResults.set(tabId, errorResult);
          }
          webview.postMessage({
            command: 'responseResult',
            tabId: tabId,
            payload: errorResult
          });
        }
        break;
      }

      case 'ackResponse': {
        if (message.tabId) {
          completedResults.delete(message.tabId);
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
            payload: savedState || null,
            activeInFlight: Array.from(inFlightRequests)
          });
          // 如果有已完成但尚未确认的结果，同步给 webview
          for (const [tabId, result] of completedResults.entries()) {
            webview.postMessage({
              command: 'responseResult',
              tabId: tabId,
              payload: result
            });
          }
        } catch (err: any) {
          console.error('Failed to load state:', err);
        }
        break;
      }
    }
  });
}

export function deactivate() {}
