import { EditEvent, DiffLine, DiffHunk } from '../types';
import { DIFF_CONTEXT_LINES } from '../constants';

export class DiffUtils {
    static generateUnifiedDiff(oldContent: string, newContent: string): DiffHunk[] {
        const oldLines = oldContent.split('\n');
        const newLines = newContent.split('\n');
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
                        text: oldLines[i],
                        line_number: i + 1
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
                        text: oldLines[i],
                        line_number: i + 1
                    });
                    i++;
                } else if (j < newLines.length) {
                    hunkLines.push({
                        op: 'insert',
                        text: newLines[j],
                        line_number: j + 1
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
        
        hunks.push({
            old_start: oldStart,
            old_lines: oldLineCount,
            new_start: newStart,
            new_lines: newLineCount,
            lines: allLines
        });
    }

    static calculateChangedLines(events: EditEvent[]): { minLine: number; maxLine: number } {
        let minLine = Infinity;
        let maxLine = 0;
        
        for (const event of events) {
            minLine = Math.min(minLine, event.position.line + 1);
            maxLine = Math.max(maxLine, event.position.line + (event.diff?.before?.split('\n').length || 1));
        }
        
        return {
            minLine: minLine === Infinity ? 1 : minLine,
            maxLine
        };
    }
}