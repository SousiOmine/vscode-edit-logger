import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

interface EditEvent {
    timestamp: number;
    type: 'text_input' | 'text_delete' | 'text_replace';
    text?: string;
    position: {
        line: number;
        character: number;
    };
    diff?: {
        before: string;
        after: string;
    };
}

interface DiffLine {
    op: 'context' | 'delete' | 'insert';
    text: string;
    line_number?: number;
}

interface DiffHunk {
    old_start: number;
    old_lines: number;
    new_start: number;
    new_lines: number;
    lines: DiffLine[];
}

interface HistoryEntry {
    timestamp: number;
    fileName: string;
    fileContent: string;
    fileContentWithLines: string;
    eventType: EditEvent['type'];
    eventText?: string;
    lineNumbers?: {
        start: number;
        end: number;
        current: number;
    };
    hunks?: DiffHunk[];
}

interface LoggerConfig {
    datasetRoot: string;
    historySize: number;
    debounceMs: number;
    includePatterns: string[];
    excludePatterns: string[];
    enableMasking: boolean;
    maskPatterns: string[];
    contextFiles: string[];
}

export class EditLogger {
    private disposable: vscode.Disposable;
    private config: LoggerConfig;
    private isEnabled: boolean = false;
    private savedEventCount: number = 0;
    private _onStatusChange: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onStatusChange: vscode.Event<void> = this._onStatusChange.event;
    private context: vscode.ExtensionContext;
    private eventHistory: HistoryEntry[] = [];
    private debounceTimer: NodeJS.Timeout | null = null;
    private pendingEvents: {
        filePath: string;
        fileName: string;
        events: EditEvent[];
        initialContent: string;
    } | null = null;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.config = this.loadConfig();
        
        const subscriptions = [];
        
        subscriptions.push(
            vscode.workspace.onDidChangeTextDocument(this.onDidChangeTextDocument.bind(this)),
            vscode.workspace.onDidSaveTextDocument(this.onDidSaveTextDocument.bind(this)),
            vscode.commands.registerCommand('editLogger.toggleLogging', this.toggleLogging.bind(this)),
            vscode.commands.registerCommand('editLogger.showStatus', this.showStatus.bind(this)),
            vscode.commands.registerCommand('editLogger.openDatasetFolder', this.openDatasetFolder.bind(this)),
            vscode.commands.registerCommand('editLogger.setContextFiles', this.setContextFiles.bind(this)),
            vscode.commands.registerCommand('editLogger.configure', this.configure.bind(this)),
            vscode.workspace.onDidChangeConfiguration(this.onDidChangeConfiguration.bind(this))
        );

        this.disposable = vscode.Disposable.from(...subscriptions);
        this.updateContext();
    }

    private loadConfig(): LoggerConfig {
        const config = vscode.workspace.getConfiguration('editLogger');
        return {
            datasetRoot: config.get<string>('datasetRoot', 'dataset'),
            historySize: config.get<number>('historySize', 5),
            debounceMs: config.get<number>('debounceMs', 1000),
            includePatterns: config.get<string[]>('includePatterns', []),
            excludePatterns: config.get<string[]>('excludePatterns', ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**', '**/venv/**']),
            enableMasking: config.get<boolean>('enableMasking', true),
            maskPatterns: config.get<string[]>('maskPatterns', [
                'api[_-]?key',
                'secret[_-]?key',
                'password',
                'token',
                'auth[_-]?token',
                'bearer[_-]?token',
                'access[_-]?token',
                'refresh[_-]?token'
            ]),
            contextFiles: config.get<string[]>('contextFiles', [])
        };
    }

    private onDidChangeConfiguration(e: vscode.ConfigurationChangeEvent) {
        if (e.affectsConfiguration('editLogger')) {
            this.config = this.loadConfig();
        }
    }

    private shouldTrackFile(document: vscode.TextDocument): boolean {
        if (document.uri.scheme !== 'file') {
            return false;
        }

        const filePath = document.uri.fsPath;
        
        for (const pattern of this.config.excludePatterns) {
            if (this.matchPattern(filePath, pattern)) {
                return false;
            }
        }

        if (this.config.includePatterns.length === 0) {
            return true;
        }

        for (const pattern of this.config.includePatterns) {
            if (this.matchPattern(filePath, pattern)) {
                return true;
            }
        }

        return false;
    }

    private matchPattern(filePath: string, pattern: string): boolean {
        const normalizedPath = filePath.replace(/\\/g, '/');
        const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'));
        return regex.test(normalizedPath);
    }

    private onDidChangeTextDocument(e: vscode.TextDocumentChangeEvent) {
        if (!this.isEnabled || !this.shouldTrackFile(e.document)) {
            return;
        }

        const filePath = e.document.uri.fsPath;
        const fileName = path.basename(filePath);

        // 既存のタイマーをクリア
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        // 初めてのイベントか、別ファイルへの切り替えの場合
        if (!this.pendingEvents || this.pendingEvents.filePath !== filePath) {
            // 前のファイルのイベントがあれば保存
            if (this.pendingEvents && this.pendingEvents.events.length > 0) {
                this.savePendingEvents();
            }
            
            this.pendingEvents = {
                filePath,
                fileName,
                events: [],
                initialContent: e.document.getText()
            };
        }

        // 変更をイベントとして追加
        for (const change of e.contentChanges) {
            let eventType: EditEvent['type'];
            let eventText = change.text;

            // イベントタイプの判定
            if (change.rangeLength > 0 && change.text === '') {
                eventType = 'text_delete';
                eventText = e.document.getText(change.range);
            } else if (change.rangeLength > 0) {
                eventType = 'text_replace';
            } else if (change.text.length > 0) {
                eventType = 'text_input';
            } else {
                continue;
            }

            // 変更前のテキストを取得
            const beforeText = e.document.getText(change.range);
            
            const event: EditEvent = {
                timestamp: Date.now(),
                type: eventType,
                text: eventText,
                position: {
                    line: change.range.start.line,
                    character: change.range.start.character
                },
                diff: {
                    before: beforeText,
                    after: change.text
                }
            };

            this.pendingEvents.events.push(event);
        }

        // デバウンスタイマーを設定
        this.debounceTimer = setTimeout(() => {
            this.savePendingEvents();
        }, this.config.debounceMs);
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

    private generateUnifiedDiff(oldContent: string, newContent: string): DiffHunk[] {
        const oldLines = oldContent.split('\n');
        const newLines = newContent.split('\n');
        const hunks: DiffHunk[] = [];
        
        let i = 0, j = 0;
        let hunkStartOld = 1;
        let hunkStartNew = 1;
        let hunkLines: DiffLine[] = [];
        let contextLines: DiffLine[] = [];
        
        const CONTEXT_LINES = 3;
        
        while (i < oldLines.length || j < newLines.length) {
            if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
                // 一致する行（コンテキスト）
                if (hunkLines.length > 0) {
                    contextLines.push({
                        op: 'context',
                        text: oldLines[i],
                        line_number: i + 1
                    });
                }
                i++;
                j++;
                
                // 十分なコンテキストがあればhunkを完了
                if (contextLines.length >= CONTEXT_LINES && hunkLines.length > 0) {
                    this.finishHunk(hunks, hunkStartOld, hunkStartNew, hunkLines, contextLines, CONTEXT_LINES);
                    hunkLines = [];
                    contextLines = [];
                }
            } else {
                // 差分を検出
                if (hunkLines.length === 0 && contextLines.length > 0) {
                    // 最初の差分の前にコンテキストを保持
                    const keepContext = contextLines.slice(-CONTEXT_LINES);
                    hunkStartOld = Math.max(1, i - CONTEXT_LINES + 1);
                    hunkStartNew = Math.max(1, j - CONTEXT_LINES + 1);
                    hunkLines.push(...contextLines.slice(0, -CONTEXT_LINES));
                    contextLines = keepContext;
                }
                
                if (i < oldLines.length && (j >= newLines.length || oldLines[i] !== newLines[j])) {
                    // 削除された行
                    hunkLines.push({
                        op: 'delete',
                        text: oldLines[i],
                        line_number: i + 1
                    });
                    i++;
                } else if (j < newLines.length) {
                    // 追加された行
                    hunkLines.push({
                        op: 'insert',
                        text: newLines[j],
                        line_number: j + 1
                    });
                    j++;
                }
            }
        }
        
        // 最後のhunkを処理
        if (hunkLines.length > 0) {
            this.finishHunk(hunks, hunkStartOld, hunkStartNew, hunkLines, contextLines, 0);
        }
        
        return hunks;
    }
    
    private finishHunk(hunks: DiffHunk[], oldStart: number, newStart: number, hunkLines: DiffLine[], contextLines: DiffLine[], contextKeep: number) {
        const allLines = [...hunkLines, ...contextLines];
        const oldLineCount = allLines.filter(l => l.op !== 'insert').length;
        const newLineCount = allLines.filter(l => l.op !== 'delete').length;
        
        hunks.push({
            old_start: oldStart,
            old_lines: oldLineCount,
            new_start: newStart,
            new_lines: newLineCount,
            lines: allLines
        });
    }
    
    private addLineNumbers(content: string): string {
        const lines = content.split('\n');
        const maxLineNumber = lines.length;
        const lineNumberWidth = Math.max(4, maxLineNumber.toString().length + 1);
        
        return lines.map((line, index) => {
            const lineNumber = (index + 1).toString().padStart(lineNumberWidth);
            return `${lineNumber} | ${line}`;
        }).join('\n');
    }

    private savePendingEvents() {
        if (!this.pendingEvents || this.pendingEvents.events.length === 0) {
            return;
        }

        try {
            // 現在のファイル内容を取得
            const document = vscode.workspace.textDocuments.find(
                doc => doc.uri.fsPath === this.pendingEvents!.filePath
            );
            
            if (!document) {
                return;
            }

            const fileContent = document.getText();
            const maskedContent = this.config.enableMasking ? this.maskSensitiveInfo(fileContent) : fileContent;
            
            // 行番号付きのコンテンツを生成
            const fileContentWithLines = this.addLineNumbers(maskedContent);

            // 変更があった行番号の範囲を計算
            let minLine = Infinity;
            let maxLine = 0;
            
            for (const event of this.pendingEvents.events) {
                minLine = Math.min(minLine, event.position.line + 1); // 1-basedに変換
                maxLine = Math.max(maxLine, event.position.line + (event.diff?.before?.split('\n').length || 1));
            }

            // 現在のカーソル位置も取得
            const activeEditor = vscode.window.activeTextEditor;
            let currentLine = 1;
            
            if (activeEditor && activeEditor.document === document) {
                currentLine = activeEditor.selection.active.line + 1;
            }

            const lineNumbers = {
                start: minLine === Infinity ? 1 : minLine,
                end: Math.max(maxLine, document.lineCount),
                current: currentLine
            };

            // unified diffを生成
            const hunks = this.generateUnifiedDiff(this.pendingEvents.initialContent, fileContent);

            // 最後のイベントを代表イベントとして使用
            const lastEvent = this.pendingEvents.events[this.pendingEvents.events.length - 1];

            // 履歴エントリを作成
            const historyEntry: HistoryEntry = {
                timestamp: lastEvent.timestamp,
                fileName: this.pendingEvents.fileName,
                fileContent: maskedContent,
                fileContentWithLines,
                eventType: lastEvent.type,
                eventText: lastEvent.text,
                lineNumbers,
                hunks
            };

            // 履歴に追加
            this.eventHistory.push(historyEntry);

            // 履歴サイズを制限
            if (this.eventHistory.length > this.config.historySize) {
                this.eventHistory.shift();
            }

            // JSONファイルを保存
            this.saveEventJson(historyEntry);

            // ペンディング状態をクリア
            this.pendingEvents = null;

        } catch (error) {
            console.error('Failed to save pending events:', error);
        }
    }

    private loadContextFiles(): { [fileName: string]: string } {
        const context: { [fileName: string]: string } = {};
        
        for (const fileName of this.config.contextFiles) {
            try {
                // ワークスペースルートからファイルを検索
                const workspaceFolders = vscode.workspace.workspaceFolders;
                if (!workspaceFolders) {
                    continue;
                }

                let filePath = '';
                for (const folder of workspaceFolders) {
                    const possiblePath = path.join(folder.uri.fsPath, fileName);
                    if (fs.existsSync(possiblePath)) {
                        filePath = possiblePath;
                        break;
                    }
                }

                if (filePath && fs.existsSync(filePath)) {
                    const content = fs.readFileSync(filePath, 'utf8');
                    context[fileName] = content;
                }
            } catch (error) {
                console.error(`Failed to load context file ${fileName}:`, error);
            }
        }

        return context;
    }

    private saveEventJson(entry: HistoryEntry) {
        try {
            const outputPath = this.getOutputPath();
            
            const dir = path.dirname(outputPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            // 過去のイベント履歴を含むJSONデータを作成
            const jsonData = {
                fileContent: entry.fileContent,
                fileContentWithLines: entry.fileContentWithLines,
                context: this.loadContextFiles(),
                history: this.eventHistory.map(h => ({
                    timestamp: h.timestamp,
                    eventType: h.eventType,
                    eventText: h.eventText,
                    fileName: h.fileName,
                    lineNumbers: h.lineNumbers,
                    hunks: h.hunks
                }))
            };

            fs.writeFileSync(outputPath, JSON.stringify(jsonData, null, 2), 'utf8');
            this.savedEventCount++;
            this._onStatusChange.fire();
            
        } catch (error) {
            console.error('Failed to save event JSON:', error);
        }
    }

    private maskSensitiveInfo(text: string): string {
        let maskedText = text;
        
        for (const pattern of this.config.maskPatterns) {
            const regex = new RegExp(pattern, 'gi');
            maskedText = maskedText.replace(regex, '[REDACTED]');
        }

        maskedText = maskedText.replace(/['"`][^'"`]*['"`]/g, match => {
            const lowerMatch = match.toLowerCase();
            if (lowerMatch.includes('key') || lowerMatch.includes('secret') || lowerMatch.includes('password') || lowerMatch.includes('token')) {
                return '[REDACTED]';
            }
            return match;
        });

        return maskedText;
    }

    private getOutputPath(): string {
        const now = new Date();
        
        let folderName = 'unknown';
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            folderName = path.basename(vscode.workspace.workspaceFolders[0].uri.fsPath);
        }
        
        const escapedFolderName = folderName.replace(/\s+/g, '-');
        
        const dateStr = now.getFullYear().toString().padStart(4, '0') +
                      (now.getMonth() + 1).toString().padStart(2, '0') +
                      now.getDate().toString().padStart(2, '0');
        const timeStr = now.getHours().toString().padStart(2, '0') +
                      now.getMinutes().toString().padStart(2, '0') +
                      now.getSeconds().toString().padStart(2, '0');
        const millisStr = now.getMilliseconds().toString().padStart(3, '0');
        const fileName = `${dateStr}-${timeStr}-${millisStr}.json`;
        
        const datasetFolder = path.join(this.config.datasetRoot, escapedFolderName);
        
        return path.join(datasetFolder, fileName);
    }

    private toggleLogging() {
        this.isEnabled = !this.isEnabled;
        this._onStatusChange.fire();
        this.updateContext();
        const message = this.isEnabled ? '編集ログ収集を開始しました' : '編集ログ収集を停止しました';
        vscode.window.showInformationMessage(message);
    }

    private updateContext() {
        vscode.commands.executeCommand('setContext', 'editLoggerEnabled', this.isEnabled);
    }

    private showStatus() {
        const status = this.isEnabled ? '有効' : '無効';
        const message = `編集ログ収集: ${status}\n保存済みイベント数: ${this.savedEventCount}\n保存先: ${this.config.datasetRoot}`;
        vscode.window.showInformationMessage(message);
    }

    private async openDatasetFolder() {
        const folderPath = path.resolve(this.config.datasetRoot);
        
        if (!fs.existsSync(folderPath)) {
            const createFolder = await vscode.window.showErrorMessage(
                `フォルダが見つかりません: ${folderPath}`,
                { modal: true },
                'フォルダを作成して開く',
                'キャンセル'
            );
            
            if (createFolder === 'フォルダを作成して開く') {
                try {
                    fs.mkdirSync(folderPath, { recursive: true });
                    vscode.window.showInformationMessage(`フォルダを作成しました: ${folderPath}`);
                } catch (error) {
                    vscode.window.showErrorMessage(`フォルダの作成に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
                    return;
                }
            } else {
                return;
            }
        }
        
        try {
            await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(folderPath), true);
        } catch (error) {
            vscode.env.openExternal(vscode.Uri.file(folderPath));
        }
    }

    public getSavedEventCount(): number {
        return this.savedEventCount;
    }

    public getConfig(): LoggerConfig {
        return { ...this.config };
    }

    dispose() {
        this.disposable.dispose();
        
        // タイマーをクリア
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        
        // ペンディング中のイベントがあれば保存
        if (this.pendingEvents && this.pendingEvents.events.length > 0) {
            this.savePendingEvents();
        }
    }

    private async setContextFiles() {
        const config = vscode.workspace.getConfiguration('editLogger');
        const currentFiles = config.get<string[]>('contextFiles', []);
        
        const input = await vscode.window.showInputBox({
            placeHolder: 'ファイル名をカンマ区切りで入力 (例: package.json, README.md, .env)',
            prompt: 'コンテキストとして保存するファイル名を入力してください',
            value: currentFiles.join(', ')
        });
        
        if (input !== undefined) {
            const files = input.split(',').map(f => f.trim()).filter(f => f.length > 0);
            await config.update('contextFiles', files, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`コンテキストファイルを設定しました: ${files.join(', ')}`);
        }
    }

    private async configure() {
        const SidebarProvider = require('./sidebarProvider').SidebarProvider;
        const sidebarProvider = (vscode.window.registerTreeDataProvider as any)('editLoggerSidebar', new SidebarProvider(this));
        
        // サイドバーのshowConfigDialogメソッドを呼び出す
        if (sidebarProvider && typeof sidebarProvider.showConfigDialog === 'function') {
            // 実際の実装では、sidebarProviderのインスタンスにアクセスする必要がある
            // ここでは設定ダイアログを直接表示する
            await this.showConfigDialog();
        } else {
            await this.showConfigDialog();
        }
    }

    private async showConfigDialog(): Promise<void> {
        const config = vscode.workspace.getConfiguration('editLogger');
        
        // 設定項目の選択肢
        const items: vscode.QuickPickItem[] = [
            { label: '📁 保存先ディレクトリ', description: `現在: ${config.get<string>('datasetRoot')}`, detail: 'editLogger.datasetRoot' },
            { label: '📄 includeパターン', description: `現在: ${config.get<string[]>('includePatterns')?.join(', ') || 'なし'}`, detail: 'editLogger.includePatterns' },
            { label: '🚫 excludeパターン', description: `現在: ${config.get<string[]>('excludePatterns')?.join(', ')}`, detail: 'editLogger.excludePatterns' },
            { label: '🔒 マスキング', description: `現在: ${config.get<boolean>('enableMasking') ? '有効' : '無効'}`, detail: 'editLogger.enableMasking' },
            { label: '🎭 マスキングパターン', description: `現在: ${config.get<string[]>('maskPatterns')?.join(', ')}`, detail: 'editLogger.maskPatterns' },
            { label: '📝 履歴サイズ', description: `現在: ${config.get<number>('historySize')}`, detail: 'editLogger.historySize' },
            { label: '⏱️ デバウンス時間', description: `現在: ${config.get<number>('debounceMs')}ms`, detail: 'editLogger.debounceMs' },
            { label: '📋 コンテキストファイル', description: `現在: ${config.get<string[]>('contextFiles')?.join(', ') || 'なし'}`, detail: 'editLogger.contextFiles' }
        ];

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: '変更する設定項目を選択してください'
        });

        if (selected) {
            await this.updateConfig(selected.detail!);
        }
    }

    private async updateConfig(setting: string): Promise<void> {
        const config = vscode.workspace.getConfiguration('editLogger');
        
        switch (setting) {
            case 'editLogger.datasetRoot':
                const datasetRoot = await vscode.window.showInputBox({
                    placeHolder: '保存先ディレクトリ名',
                    value: config.get<string>('datasetRoot') || 'dataset',
                    prompt: 'データセットの保存先ルートディレクトリを入力してください'
                });
                if (datasetRoot !== undefined) {
                    await config.update('datasetRoot', datasetRoot, vscode.ConfigurationTarget.Global);
                    this.config.datasetRoot = datasetRoot;
                }
                break;

            case 'editLogger.includePatterns':
                const includeInput = await vscode.window.showInputBox({
                    placeHolder: '例: **/*.ts,**/*.js',
                    value: config.get<string[]>('includePatterns')?.join(',') || '',
                    prompt: '収集対象のファイルパターンをカンマ区切りで入力してください'
                });
                if (includeInput !== undefined) {
                    const patterns = includeInput.split(',').map(p => p.trim()).filter(p => p);
                    await config.update('includePatterns', patterns, vscode.ConfigurationTarget.Global);
                    this.config.includePatterns = patterns;
                }
                break;

            case 'editLogger.excludePatterns':
                const excludeInput = await vscode.window.showInputBox({
                    placeHolder: '例: **/node_modules/**,**/dist/**',
                    value: config.get<string[]>('excludePatterns')?.join(',') || '',
                    prompt: '収集除外のファイルパターンをカンマ区切りで入力してください'
                });
                if (excludeInput !== undefined) {
                    const patterns = excludeInput.split(',').map(p => p.trim()).filter(p => p);
                    await config.update('excludePatterns', patterns, vscode.ConfigurationTarget.Global);
                    this.config.excludePatterns = patterns;
                }
                break;

            case 'editLogger.enableMasking':
                const maskingOptions: vscode.QuickPickItem[] = [
                    { label: '有効', detail: 'true' },
                    { label: '無効', detail: 'false' }
                ];
                const maskingChoice = await vscode.window.showQuickPick(maskingOptions, {
                    placeHolder: 'マスキングの設定を選択してください'
                });
                if (maskingChoice) {
                    const enabled = maskingChoice.detail === 'true';
                    await config.update('enableMasking', enabled, vscode.ConfigurationTarget.Global);
                    this.config.enableMasking = enabled;
                }
                break;

            case 'editLogger.maskPatterns':
                const maskInput = await vscode.window.showInputBox({
                    placeHolder: '例: api_key,secret,password',
                    value: config.get<string[]>('maskPatterns')?.join(',') || '',
                    prompt: 'マスキング対象のパターンをカンマ区切りで入力してください'
                });
                if (maskInput !== undefined) {
                    const patterns = maskInput.split(',').map(p => p.trim()).filter(p => p);
                    await config.update('maskPatterns', patterns, vscode.ConfigurationTarget.Global);
                    this.config.maskPatterns = patterns;
                }
                break;

            case 'editLogger.historySize':
                const historySize = await vscode.window.showInputBox({
                    placeHolder: '5',
                    value: String(config.get<number>('historySize') || 5),
                    prompt: '記録する過去のイベント数を入力してください',
                    validateInput: value => {
                        const num = parseInt(value);
                        return isNaN(num) || num < 1 ? '1以上の数値を入力してください' : null;
                    }
                });
                if (historySize !== undefined) {
                    const size = parseInt(historySize);
                    await config.update('historySize', size, vscode.ConfigurationTarget.Global);
                    this.config.historySize = size;
                }
                break;

            case 'editLogger.debounceMs':
                const debounceMs = await vscode.window.showInputBox({
                    placeHolder: '1000',
                    value: String(config.get<number>('debounceMs') || 1000),
                    prompt: 'デバウンス時間（ミリ秒）を入力してください',
                    validateInput: value => {
                        const num = parseInt(value);
                        return isNaN(num) || num < 0 ? '0以上の数値を入力してください' : null;
                    }
                });
                if (debounceMs !== undefined) {
                    const ms = parseInt(debounceMs);
                    await config.update('debounceMs', ms, vscode.ConfigurationTarget.Global);
                    this.config.debounceMs = ms;
                }
                break;

            case 'editLogger.contextFiles':
                const contextFiles = await vscode.window.showInputBox({
                    placeHolder: '例: package.json,README.md',
                    value: config.get<string[]>('contextFiles')?.join(',') || '',
                    prompt: 'コンテキストとして保存するファイル名をカンマ区切りで入力してください'
                });
                if (contextFiles !== undefined) {
                    const files = contextFiles.split(',').map(f => f.trim()).filter(f => f);
                    await config.update('contextFiles', files, vscode.ConfigurationTarget.Global);
                    this.config.contextFiles = files;
                }
                break;
        }
    }
}

export function activate(context: vscode.ExtensionContext) {
    const logger = new EditLogger(context);
    
    const SidebarProvider = require('./sidebarProvider').SidebarProvider;
    const sidebarProvider = new SidebarProvider(logger);
    vscode.window.registerTreeDataProvider('editLoggerSidebar', sidebarProvider);
    
    context.subscriptions.push(
        logger,
        vscode.commands.registerCommand('editLogger.refreshSidebar', () => {
            sidebarProvider.refresh();
        })
    );
}

export function deactivate() {}