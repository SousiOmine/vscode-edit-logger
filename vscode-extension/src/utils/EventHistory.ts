import { HistoryEntry } from '../types';

export class EventHistory {
    private history: HistoryEntry[] = [];
    private maxSize: number;

    constructor(maxSize: number = 5) {
        this.maxSize = maxSize;
    }

    add(entry: HistoryEntry): void {
        this.history.push(entry);
        
        if (this.history.length > this.maxSize) {
            this.history.shift();
        }
    }

    getAll(): HistoryEntry[] {
        return [...this.history];
    }

    clear(): void {
        this.history = [];
    }

    setMaxSize(size: number): void {
        this.maxSize = size;
        
        while (this.history.length > this.maxSize) {
            this.history.shift();
        }
    }

    get size(): number {
        return this.history.length;
    }
}