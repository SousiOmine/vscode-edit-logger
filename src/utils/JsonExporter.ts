import { LoggerConfig } from '../config/ConfigManager';
import { HistoryEntry } from '../types';
import { FileUtils } from './FileUtils';

export class JsonExporter {
    constructor(private fileUtils: FileUtils = new FileUtils()) {}

    export(entry: HistoryEntry, history: HistoryEntry[], config: LoggerConfig): void {
        try {
            const outputPath = this.fileUtils.getOutputPath(config.datasetRoot);
            
            const jsonData = {
                fileContent: entry.fileContent,
                fileContentWithLines: entry.fileContentWithLines,
                context: this.fileUtils.loadContextFiles(config.contextFiles),
                history: history.map(h => ({
                    timestamp: h.timestamp,
                    eventType: h.eventType,
                    eventText: h.eventText,
                    fileName: h.fileName,
                    lineNumbers: h.lineNumbers,
                    hunks: h.hunks
                }))
            };

            this.fileUtils.saveJsonFile(outputPath, jsonData);
        } catch (error) {
            console.error('Failed to export JSON:', error);
            throw error;
        }
    }
}