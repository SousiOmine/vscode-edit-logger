import { EditLoggerError, ERROR_CODES } from '../errors';

export class ErrorHandler {
    static handle(error: unknown, context: string): void {
        if (error instanceof EditLoggerError) {
            console.error(`[${context}] ${error.code}: ${error.message}`, error.cause);
        } else if (error instanceof Error) {
            console.error(`[${context}] Unexpected error: ${error.message}`, error);
        } else {
            console.error(`[${context}] Unknown error:`, error);
        }
    }

    static wrap(error: unknown, code: string, context: string): EditLoggerError {
        if (error instanceof EditLoggerError) {
            return error;
        }
        
        const message = error instanceof Error 
            ? error.message 
            : String(error);
            
        return new EditLoggerError(
            `${context}: ${message}`,
            code,
            error instanceof Error ? error : undefined
        );
    }

    static isRecoverable(error: EditLoggerError): boolean {
        const recoverableCodes = [
            ERROR_CODES.CONFIG_LOAD_FAILED,
            ERROR_CODES.CONFIG_UPDATE_FAILED,
            ERROR_CODES.FILE_OPERATION_FAILED
        ];
        return recoverableCodes.includes(error.code as typeof recoverableCodes[number]);
    }
}