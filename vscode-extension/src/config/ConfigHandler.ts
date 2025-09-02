import * as vscode from 'vscode';
import { ConfigManager, LoggerConfig } from '../config/ConfigManager';
import { CONFIG_KEYS } from '../constants';

export class ConfigHandler {
    constructor(private configManager: ConfigManager) {}

    async showConfigDialog(): Promise<void> {
        const config = this.configManager.loadConfig();
        const items = this.getConfigItems(config);

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: '変更する設定項目を選択してください'
        });

        if (selected) {
            await this.updateConfig(selected.detail!);
        }
    }

    private getConfigItems(config: LoggerConfig): vscode.QuickPickItem[] {
        return [
            {
                label: '📁 保存先ディレクトリ',
                description: `現在: ${config.datasetRoot}`,
                detail: CONFIG_KEYS.DATASET_ROOT
            },
            {
                label: '📄 includeパターン',
                description: `現在: ${config.includePatterns.join(', ') || 'なし'}`,
                detail: CONFIG_KEYS.INCLUDE_PATTERNS
            },
            {
                label: '🚫 excludeパターン',
                description: `現在: ${config.excludePatterns.join(', ')}`,
                detail: CONFIG_KEYS.EXCLUDE_PATTERNS
            },
            {
                label: '🔒 マスキング',
                description: `現在: ${config.enableMasking ? '有効' : '無効'}`,
                detail: CONFIG_KEYS.ENABLE_MASKING
            },
            {
                label: '🎭 マスキングパターン',
                description: `現在: ${config.maskPatterns.join(', ')}`,
                detail: CONFIG_KEYS.MASK_PATTERNS
            },
            {
                label: '📝 履歴サイズ',
                description: `現在: ${config.historySize}`,
                detail: CONFIG_KEYS.HISTORY_SIZE
            },
            {
                label: '⏱️ デバウンス時間',
                description: `現在: ${config.debounceMs}ms`,
                detail: CONFIG_KEYS.DEBOUNCE_MS
            },
            {
                label: '📋 コンテキストファイル',
                description: `現在: ${config.contextFiles.join(', ') || 'なし'}`,
                detail: CONFIG_KEYS.CONTEXT_FILES
            }
        ];
    }

    private async updateConfig(setting: string): Promise<void> {
        const config = this.configManager.loadConfig();

        switch (setting) {
            case CONFIG_KEYS.DATASET_ROOT:
                await this.updateDatasetRoot(config.datasetRoot);
                break;
            case CONFIG_KEYS.INCLUDE_PATTERNS:
                await this.updateIncludePatterns(config.includePatterns);
                break;
            case CONFIG_KEYS.EXCLUDE_PATTERNS:
                await this.updateExcludePatterns(config.excludePatterns);
                break;
            case CONFIG_KEYS.ENABLE_MASKING:
                await this.updateEnableMasking(config.enableMasking);
                break;
            case CONFIG_KEYS.MASK_PATTERNS:
                await this.updateMaskPatterns(config.maskPatterns);
                break;
            case CONFIG_KEYS.HISTORY_SIZE:
                await this.updateHistorySize(config.historySize);
                break;
            case CONFIG_KEYS.DEBOUNCE_MS:
                await this.updateDebounceMs(config.debounceMs);
                break;
            case CONFIG_KEYS.CONTEXT_FILES:
                await this.updateContextFiles(config.contextFiles);
                break;
        }
    }

    private async updateDatasetRoot(currentValue: string): Promise<void> {
        const value = await vscode.window.showInputBox({
            placeHolder: '保存先ディレクトリ名',
            value: currentValue,
            prompt: 'データセットの保存先ルートディレクトリを入力してください'
        });
        if (value !== undefined) {
            await this.configManager.updateDatasetRoot(value);
        }
    }

    private async updateIncludePatterns(currentValue: string[]): Promise<void> {
        const value = await vscode.window.showInputBox({
            placeHolder: '例: **/*.ts,**/*.js',
            value: currentValue.join(','),
            prompt: '収集対象のファイルパターンをカンマ区切りで入力してください'
        });
        if (value !== undefined) {
            const patterns = value.split(',').map(p => p.trim()).filter(p => p);
            await this.configManager.updateIncludePatterns(patterns);
        }
    }

    private async updateExcludePatterns(currentValue: string[]): Promise<void> {
        const value = await vscode.window.showInputBox({
            placeHolder: '例: **/node_modules/**,**/dist/**',
            value: currentValue.join(','),
            prompt: '収集除外のファイルパターンをカンマ区切りで入力してください'
        });
        if (value !== undefined) {
            const patterns = value.split(',').map(p => p.trim()).filter(p => p);
            await this.configManager.updateExcludePatterns(patterns);
        }
    }

    private async updateEnableMasking(currentValue: boolean): Promise<void> {
        const options: vscode.QuickPickItem[] = [
            { label: '有効', detail: 'true' },
            { label: '無効', detail: 'false' }
        ];
        const choice = await vscode.window.showQuickPick(options, {
            placeHolder: 'マスキングの設定を選択してください'
        });
        if (choice) {
            const enabled = choice.detail === 'true';
            await this.configManager.updateEnableMasking(enabled);
        }
    }

    private async updateMaskPatterns(currentValue: string[]): Promise<void> {
        const value = await vscode.window.showInputBox({
            placeHolder: '例: api_key,secret,password',
            value: currentValue.join(','),
            prompt: 'マスキング対象のパターンをカンマ区切りで入力してください'
        });
        if (value !== undefined) {
            const patterns = value.split(',').map(p => p.trim()).filter(p => p);
            await this.configManager.updateMaskPatterns(patterns);
        }
    }

    private async updateHistorySize(currentValue: number): Promise<void> {
        const value = await vscode.window.showInputBox({
            placeHolder: '5',
            value: String(currentValue),
            prompt: '記録する過去のイベント数を入力してください',
            validateInput: value => {
                const result = ConfigManager.validateNumber(value, 1);
                return result.isValid ? null : result.error;
            }
        });
        if (value !== undefined) {
            const size = parseInt(value);
            await this.configManager.updateHistorySize(size);
        }
    }

    private async updateDebounceMs(currentValue: number): Promise<void> {
        const value = await vscode.window.showInputBox({
            placeHolder: '1000',
            value: String(currentValue),
            prompt: 'デバウンス時間（ミリ秒）を入力してください',
            validateInput: value => {
                const result = ConfigManager.validateNumber(value, 0);
                return result.isValid ? null : result.error;
            }
        });
        if (value !== undefined) {
            const ms = parseInt(value);
            await this.configManager.updateDebounceMs(ms);
        }
    }

    private async updateContextFiles(currentValue: string[]): Promise<void> {
        const value = await vscode.window.showInputBox({
            placeHolder: '例: package.json,README.md',
            value: currentValue.join(','),
            prompt: 'コンテキストとして保存するファイル名をカンマ区切りで入力してください'
        });
        if (value !== undefined) {
            const files = value.split(',').map(f => f.trim()).filter(f => f);
            await this.configManager.updateContextFiles(files);
        }
    }
}