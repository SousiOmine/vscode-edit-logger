import { EditEvent, DiffLine, DiffHunk } from '../types';
import { DIFF_CONTEXT_LINES } from '../constants';

export class DiffUtils {
    static generateUnifiedDiff(oldContent: string, newContent: string): DiffHunk[] {
        // キャリッジリターンを削除して改行コードを\nに統一
        const normalizedOldContent = oldContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const normalizedNewContent = newContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const oldLines = normalizedOldContent.split('\n');
        const newLines = normalizedNewContent.split('\n');
        const hunks: DiffHunk[] = [];
        
        let i = 0, j = 0;
        let hunkStartOld = 1;
        let hunkStartNew = 1;
        let hunkLines: DiffLine[] = [];
        let contextLines: DiffLine[] = [];
        
        while (i < oldLines.length || j < newLines.length) {
            if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
                if (hunkLines.length > 0) {
                    contextLines.push({
                        op: 'context',
                        text: oldLines[i]
                    });
                }
                i++;
                j++;
                
                if (contextLines.length >= DIFF_CONTEXT_LINES && hunkLines.length > 0) {
                    this.finishHunk(hunks, hunkStartOld, hunkStartNew, hunkLines, contextLines, DIFF_CONTEXT_LINES);
                    hunkLines = [];
                    contextLines = [];
                }
            } else {
                if (hunkLines.length === 0 && contextLines.length > 0) {
                    const keepContext = contextLines.slice(-DIFF_CONTEXT_LINES);
                    hunkStartOld = Math.max(1, i - DIFF_CONTEXT_LINES + 1);
                    hunkStartNew = Math.max(1, j - DIFF_CONTEXT_LINES + 1);
                    hunkLines.push(...contextLines.slice(0, -DIFF_CONTEXT_LINES));
                    contextLines = keepContext;
                }
                
                if (i < oldLines.length && (j >= newLines.length || oldLines[i] !== newLines[j])) {
                    hunkLines.push({
                        op: 'delete',
                        text: oldLines[i]
                    });
                    i++;
                } else if (j < newLines.length) {
                    hunkLines.push({
                        op: 'insert',
                        text: newLines[j]
                    });
                    j++;
                }
            }
        }
        
        if (hunkLines.length > 0) {
            this.finishHunk(hunks, hunkStartOld, hunkStartNew, hunkLines, contextLines, 0);
        }
        
        return hunks;
    }
    
    private static finishHunk(
        hunks: DiffHunk[], 
        oldStart: number, 
        newStart: number, 
        hunkLines: DiffLine[], 
        contextLines: DiffLine[], 
        contextKeep: number
    ): void {
        const allLines = [...hunkLines, ...contextLines];
        const oldLineCount = allLines.filter(l => l.op !== 'insert').length;
        const newLineCount = allLines.filter(l => l.op !== 'delete').length;
        
        // コンテキスト行数を計算（先頭と末尾のcontext行数）
        let beforeContext = 0;
        let afterContext = 0;
        
        // 先頭のcontext行をカウント
        for (let i = 0; i < allLines.length; i++) {
            if (allLines[i].op === 'context') {
                beforeContext++;
            } else {
                break;
            }
        }
        
        // 末尾のcontext行をカウント
        for (let i = allLines.length - 1; i >= 0; i--) {
            if (allLines[i].op === 'context') {
                afterContext++;
            } else {
                break;
            }
        }
        
        hunks.push({
            old_start: oldStart,
            old_lines: oldLineCount,
            new_start: newStart,
            new_lines: newLineCount,
            context_before: beforeContext > 0 ? beforeContext : undefined,
            context_after: afterContext > 0 ? afterContext : undefined,
            lines: allLines
        });
    }

    static calculateChangedLines(events: EditEvent[]): { minLine: number; maxLine: number } {
        let minLine = Infinity;
        let maxLine = 0;
        
        for (const event of events) {
            minLine = Math.min(minLine, event.position.line + 1);
            // beforeはすでに正規化済みだが、念のため再度処理
            const beforeText = event.diff?.before?.replace(/\r\n/g, '\n').replace(/\r/g, '\n') || '';
            maxLine = Math.max(maxLine, event.position.line + (beforeText.split('\n').length || 1));
        }
        
        return {
            minLine: minLine === Infinity ? 1 : minLine,
            maxLine
        };
    }
}