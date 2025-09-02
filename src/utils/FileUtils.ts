import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface IFileSystem {
    existsSync(path: string): boolean;
    mkdirSync(path: string, options?: { recursive?: boolean }): void;
    readFileSync(path: string, encoding: string): string;
    writeFileSync(path: string, data: string, encoding: string): void;
}

export class NodeFileSystem implements IFileSystem {
    private fsImpl: any = fs;

    existsSync(path: string): boolean {
        return this.fsImpl.existsSync(path);
    }

    mkdirSync(path: string, options?: { recursive?: boolean }): void {
        this.fsImpl.mkdirSync(path, options);
    }

    readFileSync(path: string, encoding: string): string {
        return this.fsImpl.readFileSync(path, encoding as BufferEncoding);
    }

    writeFileSync(path: string, data: string, encoding: string): void {
        this.fsImpl.writeFileSync(path, data, encoding as BufferEncoding);
    }
}

export class FileUtils {
    constructor(private fileSystem: IFileSystem = new NodeFileSystem()) {}

    addLineNumbers(content: string): string {
        const lines = content.split('\n');
        const maxLineNumber = lines.length;
        const lineNumberWidth = Math.max(4, maxLineNumber.toString().length + 1);
        
        return lines.map((line, index) => {
            const lineNumber = (index + 1).toString().padStart(lineNumberWidth);
            return `${lineNumber} | ${line}`;
        }).join('\n');
    }

    loadContextFiles(files: string[]): { [fileName: string]: string } {
        const context: { [fileName: string]: string } = {};
        
        for (const fileName of files) {
            try {
                const workspaceFolders = vscode.workspace.workspaceFolders;
                if (!workspaceFolders) {
                    continue;
                }

                let filePath = '';
                for (const folder of workspaceFolders) {
                    const possiblePath = path.join(folder.uri.fsPath, fileName);
                    if (this.fileSystem.existsSync(possiblePath)) {
                        filePath = possiblePath;
                        break;
                    }
                }

                if (filePath && this.fileSystem.existsSync(filePath)) {
                    const content = this.fileSystem.readFileSync(filePath, 'utf8');
                    context[fileName] = content;
                }
            } catch (error) {
                console.error(`Failed to load context file ${fileName}:`, error);
            }
        }

        return context;
    }

    getOutputPath(datasetRoot: string): string {
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
        
        const datasetFolder = path.join(datasetRoot, escapedFolderName);
        
        return path.join(datasetFolder, fileName);
    }

    ensureDirectoryExists(filePath: string): void {
        const dir = path.dirname(filePath);
        if (!this.fileSystem.existsSync(dir)) {
            this.fileSystem.mkdirSync(dir, { recursive: true });
        }
    }

    saveJsonFile(filePath: string, data: any): void {
        try {
            this.ensureDirectoryExists(filePath);
            this.fileSystem.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        } catch (error) {
            console.error('Failed to save JSON file:', error);
            throw error;
        }
    }

    matchPattern(filePath: string, pattern: string): boolean {
        const normalizedPath = filePath.replace(/\\/g, '/');
        const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'));
        return regex.test(normalizedPath);
    }
}