import * as vscode from 'vscode';
import { EditEvent, HistoryEntry, DiffHunk } from '../types';
import { FileUtils } from '../utils/FileUtils';
import { MaskingUtils } from '../utils/MaskingUtils';
import { DiffUtils } from '../utils/DiffUtils';
import { JsonExporter } from '../utils/JsonExporter';
import { EventHistory } from '../utils/EventHistory';
import { LoggerConfig } from '../config/ConfigManager';

export interface PendingEvents {
    filePath: string;
    fileName: string;
    events: EditEvent[];
    initialContent: string;
}

export class EventManager {
    private pendingEvents: PendingEvents | null = null;
    private debounceTimer: NodeJS.Timeout | null = null;
    private savedEventCount: number = 0;
    private config: LoggerConfig;
    private jsonExporter: JsonExporter;
    private eventHistory: EventHistory;
    private fileUtils: FileUtils;

    constructor(
        config: LoggerConfig, 
        jsonExporter?: JsonExporter, 
        eventHistory?: EventHistory,
        fileUtils?: FileUtils
    ) {
        this.config = config;
        this.jsonExporter = jsonExporter || new JsonExporter();
        this.eventHistory = eventHistory || new EventHistory(config.historySize);
        this.fileUtils = fileUtils || new FileUtils();
    }

    updateConfig(config: LoggerConfig): void {
        this.config = config;
        this.eventHistory.setMaxSize(config.historySize);
    }

    addEvents(document: vscode.TextDocument, changes: readonly vscode.TextDocumentContentChangeEvent[]): void {
        if (!this.pendingEvents || this.pendingEvents.filePath !== document.uri.fsPath) {
            if (this.pendingEvents && this.pendingEvents.events.length > 0) {
                this.savePendingEvents();
            }
            
            this.pendingEvents = {
                filePath: document.uri.fsPath,
                fileName: document.fileName,
                events: [],
                initialContent: document.getText()
            };
        }

        for (const change of changes) {
            const event = this.createEditEvent(change, document);
            if (event) {
                this.pendingEvents.events.push(event);
            }
        }

        this.setDebounceTimer();
    }

    private createEditEvent(change: vscode.TextDocumentContentChangeEvent, document: vscode.TextDocument): EditEvent | null {
        let eventType: EditEvent['type'];
        let eventText = change.text;

        if (change.rangeLength > 0 && change.text === '') {
            eventType = 'text_delete';
            eventText = document.getText(change.range);
        } else if (change.rangeLength > 0) {
            eventType = 'text_replace';
        } else if (change.text.length > 0) {
            eventType = 'text_input';
        } else {
            return null;
        }

        const beforeText = document.getText(change.range);
        
        return {
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
    }

    private setDebounceTimer(): void {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        this.debounceTimer = setTimeout(() => {
            this.savePendingEvents();
        }, this.config.debounceMs);
    }

    savePendingEvents(): void {
        if (!this.pendingEvents || this.pendingEvents.events.length === 0) {
            return;
        }

        try {
            const document = vscode.workspace.textDocuments.find(
                doc => doc.uri.fsPath === this.pendingEvents!.filePath
            );
            
            if (!document) {
                return;
            }

            const historyEntry = this.createHistoryEntry(document, this.pendingEvents);
            this.eventHistory.add(historyEntry);
            this.jsonExporter.export(historyEntry, this.eventHistory.getAll(), this.config);
            this.savedEventCount++;
            this.pendingEvents = null;

        } catch (error) {
            console.error('Failed to save pending events:', error);
        }
    }

    private createHistoryEntry(document: vscode.TextDocument, pending: PendingEvents): HistoryEntry {
        const fileContent = document.getText();
        const maskedContent = this.config.enableMasking ? 
            MaskingUtils.maskSensitiveInfo(fileContent, this.config.maskPatterns) : 
            fileContent;
        
        const fileContentWithLines = this.fileUtils.addLineNumbers(maskedContent);
        const { minLine, maxLine } = DiffUtils.calculateChangedLines(pending.events);

        const activeEditor = vscode.window.activeTextEditor;
        const currentLine = activeEditor && activeEditor.document === document 
            ? activeEditor.selection.active.line + 1 
            : 1;

        const lineNumbers = {
            start: minLine,
            end: Math.max(maxLine, document.lineCount),
            current: currentLine
        };

        const hunks = DiffUtils.generateUnifiedDiff(pending.initialContent, fileContent);
        const lastEvent = pending.events[pending.events.length - 1];

        return {
            timestamp: lastEvent.timestamp,
            fileName: pending.fileName,
            fileContent: maskedContent,
            fileContentWithLines,
            eventType: lastEvent.type,
            eventText: lastEvent.text,
            lineNumbers,
            hunks
        };
    }

    clearPendingEvents(): void {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        
        if (this.pendingEvents && this.pendingEvents.events.length > 0) {
            this.savePendingEvents();
        }
    }

    getSavedEventCount(): number {
        return this.savedEventCount;
    }

    getEventHistory(): HistoryEntry[] {
        return this.eventHistory.getAll();
    }

    getPendingEvents(): PendingEvents | null {
        return this.pendingEvents;
    }
}