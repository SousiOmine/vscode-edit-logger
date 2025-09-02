export class EditLoggerError extends Error {
    constructor(
        message: string,
        public readonly code: string,
        public readonly cause?: Error
    ) {
        super(message);
        this.name = 'EditLoggerError';
    }
}

export const ERROR_CODES = {
    CONFIG_LOAD_FAILED: 'CONFIG_LOAD_FAILED',
    CONFIG_UPDATE_FAILED: 'CONFIG_UPDATE_FAILED',
    FILE_OPERATION_FAILED: 'FILE_OPERATION_FAILED',
    EVENT_PROCESSING_FAILED: 'EVENT_PROCESSING_FAILED',
    INVALID_PATTERN: 'INVALID_PATTERN',
    VALIDATION_FAILED: 'VALIDATION_FAILED'
} as const;