/**
 * Text Number Parser
 * Converts written-out numbers to numeric values
 * e.g., "one thousand five hundred" -> 1500
 */

// Single digit and teen words
const ONES = {
    'zero': 0,
    'one': 1,
    'two': 2,
    'three': 3,
    'four': 4,
    'five': 5,
    'six': 6,
    'seven': 7,
    'eight': 8,
    'nine': 9,
    'ten': 10,
    'eleven': 11,
    'twelve': 12,
    'thirteen': 13,
    'fourteen': 14,
    'fifteen': 15,
    'sixteen': 16,
    'seventeen': 17,
    'eighteen': 18,
    'nineteen': 19
};

// Tens words
const TENS = {
    'twenty': 20,
    'thirty': 30,
    'forty': 40,
    'fourty': 40, // Common misspelling
    'fifty': 50,
    'sixty': 60,
    'seventy': 70,
    'eighty': 80,
    'ninety': 90
};

// Scale words
const SCALES = {
    'hundred': 100,
    'thousand': 1000,
    'million': 1000000,
    'billion': 1000000000,
    'trillion': 1000000000000
};

// Ordinal suffixes (for parsing ordinal numbers)
const ORDINAL_MAP = {
    'first': 1,
    'second': 2,
    'third': 3,
    'fourth': 4,
    'fifth': 5,
    'sixth': 6,
    'seventh': 7,
    'eighth': 8,
    'ninth': 9,
    'tenth': 10,
    'eleventh': 11,
    'twelfth': 12,
    'thirteenth': 13,
    'fourteenth': 14,
    'fifteenth': 15,
    'sixteenth': 16,
    'seventeenth': 17,
    'eighteenth': 18,
    'nineteenth': 19,
    'twentieth': 20,
    'thirtieth': 30,
    'fortieth': 40,
    'fiftieth': 50,
    'sixtieth': 60,
    'seventieth': 70,
    'eightieth': 80,
    'ninetieth': 90,
    'hundredth': 100,
    'thousandth': 1000,
    'millionth': 1000000
};

/**
 * Parse text number to numeric value
 * @param {string} text - Text to parse
 * @returns {number|null} Numeric value or null if not parseable
 */
function parseTextNumber(text) {
    if (!text || typeof text !== 'string') {
        return null;
    }

    // Normalize the text
    let normalized = text.toLowerCase().trim();

    // Handle negative
    const isNegative = normalized.startsWith('negative ') ||
                       normalized.startsWith('minus ') ||
                       normalized.startsWith('-');

    if (isNegative) {
        normalized = normalized
            .replace(/^negative\s+/, '')
            .replace(/^minus\s+/, '')
            .replace(/^-\s*/, '');
    }

    // Remove common filler words
    normalized = normalized
        .replace(/\band\b/gi, '')
        .replace(/\bdollars?\b/gi, '')
        .replace(/\bcents?\b/gi, '')
        .replace(/[,\-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    // Check if it's already a numeric string
    if (/^[\d.]+$/.test(normalized)) {
        const num = parseFloat(normalized);
        return isNaN(num) ? null : (isNegative ? -num : num);
    }

    // Check for ordinals
    if (ORDINAL_MAP[normalized]) {
        const num = ORDINAL_MAP[normalized];
        return isNegative ? -num : num;
    }

    // Parse word-based numbers
    const words = normalized.split(' ').filter(w => w.length > 0);

    if (words.length === 0) {
        return null;
    }

    let result = 0;
    let current = 0;
    let foundNumber = false;

    for (const word of words) {
        // Check ones/teens
        if (ONES[word] !== undefined) {
            current += ONES[word];
            foundNumber = true;
            continue;
        }

        // Check tens
        if (TENS[word] !== undefined) {
            current += TENS[word];
            foundNumber = true;
            continue;
        }

        // Check for hyphenated tens (e.g., "twenty-one")
        if (word.includes('-')) {
            const parts = word.split('-');
            if (parts.length === 2 && TENS[parts[0]] !== undefined && ONES[parts[1]] !== undefined) {
                current += TENS[parts[0]] + ONES[parts[1]];
                foundNumber = true;
                continue;
            }
        }

        // Check scales
        if (word === 'hundred') {
            current = current === 0 ? 100 : current * 100;
            foundNumber = true;
            continue;
        }

        if (SCALES[word]) {
            if (current === 0) current = 1;
            current *= SCALES[word];
            result += current;
            current = 0;
            foundNumber = true;
            continue;
        }

        // Handle ordinal suffixes (-th, -st, -nd, -rd)
        const ordinalMatch = word.match(/^(\d+)(?:st|nd|rd|th)$/);
        if (ordinalMatch) {
            current += parseInt(ordinalMatch[1]);
            foundNumber = true;
            continue;
        }

        // If word is purely numeric
        if (/^\d+$/.test(word)) {
            current += parseInt(word);
            foundNumber = true;
            continue;
        }
    }

    result += current;

    if (!foundNumber) {
        return null;
    }

    return isNegative ? -result : result;
}

/**
 * Parse amount that may be text or numeric
 * @param {string|number} value - Value to parse
 * @returns {number} Parsed amount (0 if not parseable)
 */
function parseAmount(value) {
    if (typeof value === 'number') {
        return value;
    }

    if (typeof value !== 'string') {
        return 0;
    }

    const trimmed = value.trim();

    // Check for common non-numeric values
    if (['', 'n/a', 'na', 'null', 'none', '-', '--'].includes(trimmed.toLowerCase())) {
        return 0;
    }

    // Try text number parsing first
    const textResult = parseTextNumber(trimmed);
    if (textResult !== null) {
        return textResult;
    }

    // Fall back to standard numeric parsing
    // Remove currency symbols
    let cleaned = trimmed.replace(/[$€£¥₹\s]/g, '');

    // Handle accounting notation (parentheses for negative)
    const isParenNegative = cleaned.startsWith('(') && cleaned.endsWith(')');
    if (isParenNegative) {
        cleaned = '-' + cleaned.slice(1, -1);
    }

    // Remove commas
    cleaned = cleaned.replace(/,/g, '');

    const result = parseFloat(cleaned);
    return isNaN(result) ? 0 : result;
}

/**
 * Check if a string contains text-formatted numbers
 * @param {string} text - Text to check
 * @returns {boolean} True if text contains word numbers
 */
function containsTextNumbers(text) {
    if (!text || typeof text !== 'string') {
        return false;
    }

    const lower = text.toLowerCase();
    const allWords = [...Object.keys(ONES), ...Object.keys(TENS), ...Object.keys(SCALES)];

    return allWords.some(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'i');
        return regex.test(lower);
    });
}

module.exports = {
    parseTextNumber,
    parseAmount,
    containsTextNumbers,
    ONES,
    TENS,
    SCALES
};
