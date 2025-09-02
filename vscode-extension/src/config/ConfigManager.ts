import * as vscode from 'vscode';
import { CONFIG_KEYS, DEFAULT_CONFIG, VALIDATION } from '../constants';
import { EditLoggerError, ERROR_CODES } from '../errors';
import { ErrorHandler } from '../utils/ErrorHandler';

export interface LoggerConfig {
    datasetRoot: string;
    historySize: number;
    debounceMs: number;
    includePatterns: string[];
    excludePatterns: string[];
    enableMasking: boolean;
    maskPatterns: string[];
    contextFiles: string[];
}

export class ConfigManager {
    private config: vscode.WorkspaceConfiguration;

    constructor() {
        try {
            this.config = vscode.workspace.getConfiguration('editLogger');
        } catch (error) {
            throw ErrorHandler.wrap(
                error,
                ERROR_CODES.CONFIG_LOAD_FAILED,
                'Failed to initialize configuration'
            );
        }
    }

    loadConfig(): LoggerConfig {
        try {
            return {
                datasetRoot: this.config.get<string>(CONFIG_KEYS.DATASET_ROOT, DEFAULT_CONFIG.DATASET_ROOT),
                historySize: this.config.get<number>(CONFIG_KEYS.HISTORY_SIZE, DEFAULT_CONFIG.HISTORY_SIZE),
                debounceMs: this.config.get<number>(CONFIG_KEYS.DEBOUNCE_MS, DEFAULT_CONFIG.DEBOUNCE_MS),
                includePatterns: this.config.get<string[]>(CONFIG_KEYS.INCLUDE_PATTERNS, DEFAULT_CONFIG.INCLUDE_PATTERNS),
                excludePatterns: this.config.get<string[]>(CONFIG_KEYS.EXCLUDE_PATTERNS, DEFAULT_CONFIG.EXCLUDE_PATTERNS),
                enableMasking: this.config.get<boolean>(CONFIG_KEYS.ENABLE_MASKING, DEFAULT_CONFIG.ENABLE_MASKING),
                maskPatterns: this.config.get<string[]>(CONFIG_KEYS.MASK_PATTERNS, DEFAULT_CONFIG.MASK_PATTERNS),
                contextFiles: this.config.get<string[]>(CONFIG_KEYS.CONTEXT_FILES, DEFAULT_CONFIG.CONTEXT_FILES)
            };
        } catch (error) {
            throw ErrorHandler.wrap(
                error,
                ERROR_CODES.CONFIG_LOAD_FAILED,
                'Failed to load configuration'
            );
        }
    }

    private async updateConfig<T>(key: string, value: T): Promise<void> {
        try {
            await this.config.update(key, value, vscode.ConfigurationTarget.Global);
            this.config = vscode.workspace.getConfiguration('editLogger');
        } catch (error) {
            throw ErrorHandler.wrap(
                error,
                ERROR_CODES.CONFIG_UPDATE_FAILED,
                `Failed to update configuration: ${key}`
            );
        }
    }

    async updateDatasetRoot(value: string): Promise<void> {
        await this.updateConfig(CONFIG_KEYS.DATASET_ROOT, value);
    }

    async updateIncludePatterns(value: string[]): Promise<void> {
        await this.updateConfig(CONFIG_KEYS.INCLUDE_PATTERNS, value);
    }

    async updateExcludePatterns(value: string[]): Promise<void> {
        await this.updateConfig(CONFIG_KEYS.EXCLUDE_PATTERNS, value);
    }

    async updateEnableMasking(value: boolean): Promise<void> {
        await this.updateConfig(CONFIG_KEYS.ENABLE_MASKING, value);
    }

    async updateMaskPatterns(value: string[]): Promise<void> {
        await this.updateConfig(CONFIG_KEYS.MASK_PATTERNS, value);
    }

    async updateHistorySize(value: number): Promise<void> {
        await this.updateConfig(CONFIG_KEYS.HISTORY_SIZE, value);
    }

    async updateDebounceMs(value: number): Promise<void> {
        await this.updateConfig(CONFIG_KEYS.DEBOUNCE_MS, value);
    }

    async updateContextFiles(value: string[]): Promise<void> {
        await this.updateConfig(CONFIG_KEYS.CONTEXT_FILES, value);
    }

    static validateNumber(value: string, min: number = 0): { isValid: boolean; error?: string; parsed?: number } {
        const num = parseInt(value);
        if (isNaN(num)) {
            return { isValid: false, error: VALIDATION.NUMBER_REQUIRED };
        }
        if (num < min) {
            return { isValid: false, error: VALIDATION.NUMBER_MIN(min) };
        }
        return { isValid: true, parsed: num };
    }

    onDidChangeConfiguration(callback: (e: vscode.ConfigurationChangeEvent) => void): vscode.Disposable {
        return vscode.workspace.onDidChangeConfiguration(e => {
            try {
                if (e.affectsConfiguration('editLogger')) {
                    this.config = vscode.workspace.getConfiguration('editLogger');
                    callback(e);
                }
            } catch (error) {
                ErrorHandler.handle(error, 'Configuration change handler');
            }
        });
    }
}