export interface EditEvent {
    timestamp: number;
    type: 'text_input' | 'text_delete' | 'text_replace';
    text?: string;
    position: {
        line: number;
        character: number;
    };
    diff?: {
        before: string;
        after: string;
    };
}

export interface HistoryEntry {
    timestamp: number;
    fileName: string;
    fileContent: string;
    fileContentWithLines: string;
    eventType: EditEvent['type'];
    eventText?: string;
    lineNumbers?: {
        start: number;
        end: number;
        current: number;
    };
    hunks?: DiffHunk[];
}

export interface DiffHunk {
    old_start: number;         // 旧ファイルでの開始行（1始まり）
    old_lines: number;
    new_start: number;         // 新ファイルでの開始行（1始まり）
    new_lines: number;
    context_before?: number;   // アンカー用に前後何行見るか（任意）
    context_after?: number;
    lines: DiffLine[];
}

export interface DiffLine {
    op: 'context' | 'delete' | 'insert';
    text: string;
}