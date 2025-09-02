import * as vscode from 'vscode';
import { LoggerConfig } from './config/ConfigManager';

export class SidebarProvider implements vscode.TreeDataProvider<StatusItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<StatusItem | undefined | null | void> = new vscode.EventEmitter<StatusItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<StatusItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private logger: {
        isEnabled: boolean;
        onStatusChange: vscode.Event<void>;
        getSavedEventCount: () => number;
        getConfig: () => LoggerConfig;
    }) {
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