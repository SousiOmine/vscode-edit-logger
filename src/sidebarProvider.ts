import * as vscode from 'vscode';

export class SidebarProvider implements vscode.TreeDataProvider<StatusItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<StatusItem | undefined | null | void> = new vscode.EventEmitter<StatusItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<StatusItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private logger: any) {
        this.logger.onStatusChange(() => {
            this._onDidChangeTreeData.fire();
        });
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: StatusItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: StatusItem): Thenable<StatusItem[]> {
        if (!element) {
            return Promise.resolve(this.getRootItems());
        }
        return Promise.resolve([]);
    }

    private getRootItems(): StatusItem[] {
        const items: StatusItem[] = [];
        
        // ステータスアイテム
        const statusItem = new StatusItem(
            this.logger.isEnabled ? '🟢 ログ収集中' : '🔴 ログ収集停止中',
            vscode.TreeItemCollapsibleState.None,
            'status'
        );
        statusItem.description = this.logger.isEnabled ? '有効' : '無効';
        items.push(statusItem);

        // 操作ボタン
        const toggleItem = new StatusItem(
            this.logger.isEnabled ? '⏹️ 収集を停止' : '▶️ 収集を開始',
            vscode.TreeItemCollapsibleState.None,
            'toggle'
        );
        toggleItem.command = {
            command: 'editLogger.toggleLogging',
            title: this.logger.isEnabled ? '収集を停止' : '収集を開始'
        };
        items.push(toggleItem);

        // 統計情報
        const statsItem = new StatusItem(
            '📊 統計情報',
            vscode.TreeItemCollapsibleState.Expanded,
            'stats'
        );
        items.push(statsItem);

        // 統計詳細
        const savedCount = new StatusItem(
            `保存済みイベント数: ${this.logger.getSavedEventCount()}`,
            vscode.TreeItemCollapsibleState.None,
            'savedCount'
        );
        items.push(savedCount);

        // 設定
        const settingsItem = new StatusItem(
            '⚙️ 設定',
            vscode.TreeItemCollapsibleState.Expanded,
            'settings'
        );
        items.push(settingsItem);

        // 設定詳細
        const config = this.logger.getConfig();
        const datasetRootItem = new StatusItem(
            `保存先: ${config.datasetRoot}`,
            vscode.TreeItemCollapsibleState.None,
            'datasetRoot'
        );
        items.push(datasetRootItem);

        const historySizeItem = new StatusItem(
            `履歴サイズ: ${config.historySize}`,
            vscode.TreeItemCollapsibleState.None,
            'historySize'
        );
        items.push(historySizeItem);

        const maskingItem = new StatusItem(
            `マスキング: ${config.enableMasking ? '有効' : '無効'}`,
            vscode.TreeItemCollapsibleState.None,
            'masking'
        );
        items.push(maskingItem);

        const contextFilesItem = new StatusItem(
            `コンテキストファイル: ${config.contextFiles.length > 0 ? config.contextFiles.join(', ') : 'なし'}`,
            vscode.TreeItemCollapsibleState.None,
            'contextFiles'
        );
        items.push(contextFilesItem);

        // 操作
        const actionsItem = new StatusItem(
            '🔧 操作',
            vscode.TreeItemCollapsibleState.Expanded,
            'actions'
        );
        items.push(actionsItem);

        const openDatasetItem = new StatusItem(
            '📂 データセットフォルダを開く',
            vscode.TreeItemCollapsibleState.None,
            'openDataset'
        );
        openDatasetItem.command = {
            command: 'editLogger.openDatasetFolder',
            title: 'データセットフォルダを開く'
        };
        items.push(openDatasetItem);

        const refreshItem = new StatusItem(
            '🔄 更新',
            vscode.TreeItemCollapsibleState.None,
            'refresh'
        );
        refreshItem.command = {
            command: 'editLogger.refreshSidebar',
            title: '更新'
        };
        items.push(refreshItem);

        const setContextItem = new StatusItem(
            '📄 コンテキストファイルを設定',
            vscode.TreeItemCollapsibleState.None,
            'setContext'
        );
        setContextItem.command = {
            command: 'editLogger.setContextFiles',
            title: 'コンテキストファイルを設定'
        };
        items.push(setContextItem);

        const configureItem = new StatusItem(
            '⚙️ 設定を変更',
            vscode.TreeItemCollapsibleState.None,
            'configure'
        );
        configureItem.command = {
            command: 'editLogger.configure',
            title: '設定を変更'
        };
        items.push(configureItem);

        return items;
    }

    private async showConfigDialog(): Promise<void> {
        const config = this.logger.getConfig();
        
        // 設定項目の選択肢
        const items: vscode.QuickPickItem[] = [
            { label: '📁 保存先ディレクトリ', description: `現在: ${config.datasetRoot}`, detail: 'editLogger.datasetRoot' },
            { label: '📄 includeパターン', description: `現在: ${config.includePatterns.join(', ') || 'なし'}`, detail: 'editLogger.includePatterns' },
            { label: '🚫 excludeパターン', description: `現在: ${config.excludePatterns.join(', ')}`, detail: 'editLogger.excludePatterns' },
            { label: '🔒 マスキング', description: `現在: ${config.enableMasking ? '有効' : '無効'}`, detail: 'editLogger.enableMasking' },
            { label: '🎭 マスキングパターン', description: `現在: ${config.maskPatterns.join(', ')}`, detail: 'editLogger.maskPatterns' },
            { label: '📝 履歴サイズ', description: `現在: ${config.historySize}`, detail: 'editLogger.historySize' },
            { label: '⏱️ デバウンス時間', description: `現在: ${config.debounceMs}ms`, detail: 'editLogger.debounceMs' },
            { label: '📋 コンテキストファイル', description: `現在: ${config.contextFiles.join(', ') || 'なし'}`, detail: 'editLogger.contextFiles' }
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
                    await config.update('enableMasking', maskingChoice.detail === 'true', vscode.ConfigurationTarget.Global);
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
                    await config.update('historySize', parseInt(historySize), vscode.ConfigurationTarget.Global);
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
                    await config.update('debounceMs', parseInt(debounceMs), vscode.ConfigurationTarget.Global);
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
                }
                break;
        }
    }
}

class StatusItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly type: string
    ) {
        super(label, collapsibleState);
        this.contextValue = type;
    }
}