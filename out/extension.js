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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const getWebviewHtml_1 = require("./webview/getWebviewHtml");
const httpClient_1 = require("./httpClient");
function activate(context) {
    // 1. 注册 Activity Bar 侧边栏 Webview Provider
    const sidebarProvider = new SimpleApiClientViewProvider(context);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider('simpleApiClient.sidebar', sidebarProvider, {
        webviewOptions: {
            retainContextWhenHidden: true
        }
    }));
    // 2. 注册以主编辑器 Tab 形式打开面板的命令
    const openPanelCommand = vscode.commands.registerCommand('simpleApiClient.openPanel', () => {
        const panel = vscode.window.createWebviewPanel('simpleApiClientPanel', 'Simple API Client', vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')]
        });
        panel.webview.html = (0, getWebviewHtml_1.getWebviewHtml)(panel.webview, context.extensionUri);
        setupWebviewMessageHandler(panel.webview, context);
    });
    context.subscriptions.push(openPanelCommand);
}
/**
 * 跨 Webview 跟踪在途与未消费结果的请求管理器
 */
const inFlightRequests = new Set();
const completedResults = new Map();
/**
 * Activity Bar 侧边栏 Webview Provider
 */
class SimpleApiClientViewProvider {
    constructor(_context) {
        this._context = _context;
    }
    resolveWebviewView(webviewView, _context, _token) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(this._context.extensionUri, 'media')]
        };
        webviewView.webview.html = (0, getWebviewHtml_1.getWebviewHtml)(webviewView.webview, this._context.extensionUri);
        if (this._messageDisposable) {
            this._messageDisposable.dispose();
        }
        this._messageDisposable = setupWebviewMessageHandler(webviewView.webview, this._context);
    }
}
/**
 * 处理 Webview 发送的消息与状态持久化
 */
function setupWebviewMessageHandler(webview, context) {
    return webview.onDidReceiveMessage(async (message) => {
        switch (message.command) {
            case 'sendRequest': {
                const tabId = message.tabId;
                if (tabId) {
                    inFlightRequests.add(tabId);
                }
                try {
                    const result = await (0, httpClient_1.executeHttpRequest)(message.payload);
                    if (tabId) {
                        inFlightRequests.delete(tabId);
                        completedResults.set(tabId, result);
                    }
                    webview.postMessage({
                        command: 'responseResult',
                        tabId: tabId,
                        payload: result
                    });
                }
                catch (err) {
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
                }
                catch (err) {
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
                }
                catch (err) {
                    console.error('Failed to load state:', err);
                }
                break;
            }
        }
    });
}
function deactivate() { }
//# sourceMappingURL=extension.js.map