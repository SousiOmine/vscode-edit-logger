import { REDACTED_TEXT } from '../constants';

export class MaskingUtils {
    static maskSensitiveInfo(text: string, patterns: string[]): string {
        let maskedText = text;
        
        for (const pattern of patterns) {
            const regex = new RegExp(pattern, 'gi');
            maskedText = maskedText.replace(regex, REDACTED_TEXT);
        }

        maskedText = maskedText.replace(/['"`][^'"`]*['"`]/g, match => {
            const lowerMatch = match.toLowerCase();
            if (lowerMatch.includes('key') || 
                lowerMatch.includes('secret') || 
                lowerMatch.includes('password') || 
                lowerMatch.includes('token')) {
                return REDACTED_TEXT;
            }
            return match;
        });

        return maskedText;
    }

    static isValidMaskPattern(pattern: string): boolean {
        try {
            new RegExp(pattern);
            return true;
        } catch {
            return false;
        }
    }
}