export const CONFIG_KEYS = {
    DATASET_ROOT: 'datasetRoot',
    HISTORY_SIZE: 'historySize',
    DEBOUNCE_MS: 'debounceMs',
    INCLUDE_PATTERNS: 'includePatterns',
    EXCLUDE_PATTERNS: 'excludePatterns',
    ENABLE_MASKING: 'enableMasking',
    MASK_PATTERNS: 'maskPatterns',
    CONTEXT_FILES: 'contextFiles'
} as const;

export const DEFAULT_CONFIG = {
    DATASET_ROOT: 'dataset',
    HISTORY_SIZE: 5,
    DEBOUNCE_MS: 1000,
    INCLUDE_PATTERNS: [] as string[],
    EXCLUDE_PATTERNS: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/.git/**',
        '**/venv/**'
    ] as string[],
    ENABLE_MASKING: true,
    MASK_PATTERNS: [
        'api[_-]?key',
        'secret[_-]?key',
        'password',
        'token',
        'auth[_-]?token',
        'bearer[_-]?token',
        'access[_-]?token',
        'refresh[_-]?token'
    ] as string[],
    CONTEXT_FILES: [] as string[]
} as const;

export const COMMANDS = {
    TOGGLE_LOGGING: 'editLogger.toggleLogging',
    SHOW_STATUS: 'editLogger.showStatus',
    OPEN_DATASET_FOLDER: 'editLogger.openDatasetFolder',
    SET_CONTEXT_FILES: 'editLogger.setContextFiles',
    CONFIGURE: 'editLogger.configure',
    REFRESH_SIDEBAR: 'editLogger.refreshSidebar'
} as const;

export const CONTEXT_KEYS = {
    EDIT_LOGGER_ENABLED: 'editLoggerEnabled'
} as const;

export const MESSAGES = {
    TOGGLE_ON: '編集ログ収集を開始しました',
    TOGGLE_OFF: '編集ログ収集を停止しました',
    STATUS_TEMPLATE: (enabled: string, eventCount: number, datasetRoot: string) => 
        `編集ログ収集: ${enabled}\n保存済みイベント数: ${eventCount}\n保存先: ${datasetRoot}`,
    FOLDER_NOT_FOUND: (folderPath: string) => `フォルダが見つかりません: ${folderPath}`,
    FOLDER_CREATED: (folderPath: string) => `フォルダを作成しました: ${folderPath}`,
    FOLDER_CREATE_FAILED: (error: string) => `フォルダの作成に失敗しました: ${error}`,
    CONTEXT_FILES_SET: (files: string) => `コンテキストファイルを設定しました: ${files}`
} as const;

export const VALIDATION = {
    NUMBER_REQUIRED: '数値を入力してください',
    NUMBER_MIN: (min: number) => `${min}以上の数値を入力してください`
} as const;

export const DIFF_CONTEXT_LINES = 3;
export const REDACTED_TEXT = '[REDACTED]';