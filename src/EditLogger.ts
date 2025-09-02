import * as vscode from 'vscode';
import * as path from 'path';
import { ConfigManager, LoggerConfig } from './config/ConfigManager';
import { ConfigHandler } from './config/ConfigHandler';
import { EventManager } from './events/EventManager';
import { FileUtils } from './utils/FileUtils';
import { ErrorHandler } from './utils/ErrorHandler';
import { COMMANDS, MESSAGES } from './constants';

export class EditLogger {
    private disposable: vscode.Disposable;
    private configManager: ConfigManager;
    private configHandler: ConfigHandler;
    private eventManager: EventManager;
    private fileUtils: FileUtils;
    public isEnabled: boolean = false;
    private _onStatusChange: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onStatusChange: vscode.Event<void> = this._onStatusChange.event;
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        try {
            this.configManager = new ConfigManager();
            this.configHandler = new ConfigHandler(this.configManager);
            this.fileUtils = new FileUtils();
            const config = this.configManager.loadConfig();
            this.eventManager = new EventManager(config, undefined, undefined, this.fileUtils);
            
            const subscriptions = [];
            
            subscriptions.push(
                vscode.workspace.onDidChangeTextDocument(this.onDidChangeTextDocument.bind(this)),
                vscode.workspace.onDidSaveTextDocument(this.onDidSaveTextDocument.bind(this)),
                vscode.commands.registerCommand(COMMANDS.TOGGLE_LOGGING, this.toggleLogging.bind(this)),
                vscode.commands.registerCommand(COMMANDS.SHOW_STATUS, this.showStatus.bind(this)),
                vscode.commands.registerCommand(COMMANDS.OPEN_DATASET_FOLDER, this.openDatasetFolder.bind(this)),
                vscode.commands.registerCommand(COMMANDS.SET_CONTEXT_FILES, this.setContextFiles.bind(this)),
                vscode.commands.registerCommand(COMMANDS.CONFIGURE, this.configure.bind(this)),
                this.configManager.onDidChangeConfiguration(this.onDidChangeConfiguration.bind(this))
            );

            this.disposable = vscode.Disposable.from(...subscriptions);
            this.updateContext();
        } catch (error) {
            ErrorHandler.handle(error, 'EditLogger initialization');
            throw error;
        }
    }

    private onDidChangeConfiguration(e: vscode.ConfigurationChangeEvent) {
        const config = this.configManager.loadConfig();
        this.eventManager.updateConfig(config);
        this._onStatusChange.fire();
    }

    private shouldTrackFile(document: vscode.TextDocument): boolean {
        if (document.uri.scheme !== 'file') {
            return false;
        }

        const filePath = document.uri.fsPath;
        const config = this.configManager.loadConfig();
        
        for (const pattern of config.excludePatterns) {
            if (this.fileUtils.matchPattern(filePath, pattern)) {
                return false;
            }
        }

        if (config.includePatterns.length === 0) {
            return true;
        }

        for (const pattern of config.includePatterns) {
            if (this.fileUtils.matchPattern(filePath, pattern)) {
                return true;
            }
        }

        return false;
    }

    private onDidChangeTextDocument(e: vscode.TextDocumentChangeEvent) {
        try {
            if (!this.isEnabled || !this.shouldTrackFile(e.document)) {
                return;
            }

            this.eventManager.addEvents(e.document, e.contentChanges);
        } catch (error) {
            ErrorHandler.handle(error, 'Text document change handler');
        }
    }

    private onDidSaveTextDocument(document: vscode.TextDocument) {
        if (!this.isEnabled || !this.shouldTrackFile(document)) {
            return;
        }

        // 保存時に現在のカーソル位置を取得
        const activeEditor = vscode.window.activeTextEditor;
        let currentLine = 1;
        
        if (activeEditor && activeEditor.document === document) {
            currentLine = activeEditor.selection.active.line + 1; // 1-based行番号
        }

        // 保存されたファイルの情報を記録
        const saveInfo = {
            filePath: document.uri.fsPath,
            fileName: path.basename(document.uri.fsPath),
            timestamp: Date.now(),
            currentLine,
            totalLines: document.lineCount
        };

        // この情報を保存イベントとして記録（必要に応じて実装）
        console.log('File saved:', saveInfo);
    }

    private toggleLogging() {
        this.isEnabled = !this.isEnabled;
        this._onStatusChange.fire();
        this.updateContext();
        const message = this.isEnabled ? MESSAGES.TOGGLE_ON : MESSAGES.TOGGLE_OFF;
        vscode.window.showInformationMessage(message);
    }

    private updateContext() {
        vscode.commands.executeCommand('setContext', 'editLoggerEnabled', this.isEnabled);
    }

    private showStatus() {
        const status = this.isEnabled ? '有効' : '無効';
        const config = this.configManager.loadConfig();
        const message = MESSAGES.STATUS_TEMPLATE(status, this.eventManager.getSavedEventCount(), config.datasetRoot);
        vscode.window.showInformationMessage(message);
    }

    private async openDatasetFolder() {
        const config = this.configManager.loadConfig();
        const folderPath = path.resolve(config.datasetRoot);
        
        if (!(this.fileUtils as any)['ensureDirectoryExists']) {
            if (!require('fs').existsSync(folderPath)) {
                const createFolder = await vscode.window.showErrorMessage(
                    MESSAGES.FOLDER_NOT_FOUND(folderPath),
                    { modal: true },
                    'フォルダを作成して開く',
                    'キャンセル'
                );
                
                if (createFolder === 'フォルダを作成して開く') {
                    try {
                        require('fs').mkdirSync(folderPath, { recursive: true });
                        vscode.window.showInformationMessage(MESSAGES.FOLDER_CREATED(folderPath));
                    } catch (error) {
                        vscode.window.showErrorMessage(MESSAGES.FOLDER_CREATE_FAILED(error instanceof Error ? error.message : String(error)));
                        return;
                    }
                } else {
                    return;
                }
            }
        }
        
        try {
            await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(folderPath), true);
        } catch (error) {
            vscode.env.openExternal(vscode.Uri.file(folderPath));
        }
    }

    public getSavedEventCount(): number {
        return this.eventManager.getSavedEventCount();
    }

    public getConfig(): LoggerConfig {
        return this.configManager.loadConfig();
    }

    dispose() {
        this.disposable.dispose();
        this.eventManager.clearPendingEvents();
    }

    private async setContextFiles() {
        const config = this.configManager.loadConfig();
        const currentFiles = config.contextFiles;
        
        const input = await vscode.window.showInputBox({
            placeHolder: 'ファイル名をカンマ区切りで入力 (例: package.json, README.md, .env)',
            prompt: 'コンテキストとして保存するファイル名を入力してください',
            value: currentFiles.join(', ')
        });
        
        if (input !== undefined) {
            const files = input.split(',').map(f => f.trim()).filter(f => f.length > 0);
            await this.configManager.updateContextFiles(files);
            vscode.window.showInformationMessage(MESSAGES.CONTEXT_FILES_SET(files.join(', ')));
        }
    }

    private async configure() {
        await this.configHandler.showConfigDialog();
    }
}