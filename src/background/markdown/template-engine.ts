/** A single filter in a pipe chain */
export interface TemplateFilter {
  name: string;
  arg?: string;
}

/** A parsed template expression: variable name + filter chain */
export interface ParsedExpression {
  variable: string;
  filters: TemplateFilter[];
}

/** The context object from which variables are resolved */
export type TemplateContext = Record<string, unknown>;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Format a Date using a subset of dayjs/moment tokens.
 * Supported: YYYY, MM, DD, HH, mm, ss, Z, ddd, MMM
 */
export function formatDate(date: Date, format: string): string {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();

  // Timezone offset as +HH:MM or -HH:MM
  const tzOffset = date.getTimezoneOffset();
  const tzSign = tzOffset <= 0 ? '+' : '-';
  const tzHours = String(Math.floor(Math.abs(tzOffset) / 60)).padStart(2, '0');
  const tzMins = String(Math.abs(tzOffset) % 60).padStart(2, '0');
  const tz = `${tzSign}${tzHours}:${tzMins}`;

  // Replace longer tokens first to avoid partial matches
  let result = format;
  result = result.replace(/YYYY/g, String(year));
  result = result.replace(/MMM/g, MONTHS[month]);
  result = result.replace(/MM/g, String(month + 1).padStart(2, '0'));
  result = result.replace(/DD/g, String(day).padStart(2, '0'));
  result = result.replace(/HH/g, String(hours).padStart(2, '0'));
  result = result.replace(/mm/g, String(minutes).padStart(2, '0'));
  result = result.replace(/ss/g, String(seconds).padStart(2, '0'));
  result = result.replace(/ddd/g, WEEKDAYS[date.getDay()]);
  result = result.replace(/Z/g, tz);

  return result;
}

/**
 * Parse a template expression string (without {{ }}) into variable + filters.
 * Handles quoted filter arguments: date:"YYYY-MM-DDTHH:mm:ssZ"
 */
export function parseExpression(expr: string): ParsedExpression {
  const parts = splitPipes(expr.trim());
  const variable = parts[0].trim();
  const filters: TemplateFilter[] = [];

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i].trim();
    if (!part) continue;

    const colonIdx = findUnquotedColon(part);
    if (colonIdx === -1) {
      filters.push({ name: part });
    } else {
      const name = part.slice(0, colonIdx).trim();
      let arg = part.slice(colonIdx + 1).trim();
      // Strip surrounding quotes from arg
      if ((arg.startsWith('"') && arg.endsWith('"')) ||
          (arg.startsWith("'") && arg.endsWith("'"))) {
        arg = arg.slice(1, -1);
      }
      filters.push({ name, arg });
    }
  }

  return { variable, filters };
}

/** Split on | characters, respecting quoted strings */
function splitPipes(str: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inQuote: string | null = null;

  for (const ch of str) {
    if (inQuote) {
      current += ch;
      if (ch === inQuote) inQuote = null;
    } else if (ch === '"' || ch === "'") {
      current += ch;
      inQuote = ch;
    } else if (ch === '|') {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts;
}

/** Find first colon not inside quotes */
function findUnquotedColon(str: string): number {
  let inQuote: string | null = null;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (inQuote) {
      if (ch === inQuote) inQuote = null;
    } else if (ch === '"' || ch === "'") {
      inQuote = ch;
    } else if (ch === ':') {
      return i;
    }
  }
  return -1;
}

/** Convert a value to a Date, if possible */
function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d;
  }
  if (typeof value === 'number') {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

/**
 * Apply a single filter to a value.
 * Unknown filters pass the value through unchanged.
 */
export function applyFilter(value: unknown, filter: TemplateFilter): unknown {
  switch (filter.name) {
    case 'date': {
      const d = toDate(value);
      if (!d) return value;
      return formatDate(d, filter.arg ?? 'YYYY-MM-DD');
    }

    case 'lowercase':
      return String(value ?? '').toLowerCase();

    case 'uppercase':
      return String(value ?? '').toUpperCase();

    case 'default':
      if (value === null || value === undefined || value === '') {
        return filter.arg ?? '';
      }
      return value;

    case 'join': {
      if (Array.isArray(value)) {
        const sep = filter.arg ?? ', ';
        return value.join(sep);
      }
      return value;
    }

    case 'slug': {
      return String(value ?? '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    }

    case 'trim':
      return String(value ?? '').trim();

    case 'truncate': {
      const str = String(value ?? '');
      const max = parseInt(filter.arg ?? '100', 10);
      if (str.length <= max) return str;
      return str.slice(0, max) + '\u2026';
    }

    default:
      // Unknown filter — pass through
      return value;
  }
}

/**
 * Resolve a single template value string against a context.
 *
 * If the entire string is one `{{expression}}`, returns the resolved value
 * with its original type preserved (e.g., number stays number).
 * If the string contains literals mixed with expressions, returns a string.
 */
export function resolveTemplateValue(valueStr: string, context: TemplateContext): unknown {
  // Check if the entire string is a single expression
  const singleMatch = /^\{\{(.+?)\}\}$/.exec(valueStr);
  if (singleMatch) {
    return resolveExpression(singleMatch[1], context);
  }

  // Mixed literals + expressions → always string
  return valueStr.replace(/\{\{(.+?)\}\}/g, (_match, expr: string) => {
    const resolved = resolveExpression(expr, context);
    if (resolved === null || resolved === undefined) return '';
    return String(resolved);
  });
}

/** Resolve a single expression (without {{ }}) against a context */
function resolveExpression(expr: string, context: TemplateContext): unknown {
  const parsed = parseExpression(expr);
  let value = context[parsed.variable];

  for (const filter of parsed.filters) {
    value = applyFilter(value, filter);
  }

  return value;
}

/**
 * Resolve an entire template object against a context.
 * Template values can be strings (with {{expressions}}), arrays of strings,
 * or literal values. Returns a resolved data object ready for YAML serialization.
 */
export function resolveTemplate(
  template: Record<string, unknown>,
  context: TemplateContext,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(template)) {
    if (typeof value === 'string') {
      const resolved = resolveTemplateValue(value, context);
      // Omit null/undefined/empty
      if (resolved === null || resolved === undefined || resolved === '') continue;
      result[key] = resolved;
    } else if (Array.isArray(value)) {
      const resolvedArr = value
        .map((item) => {
          if (typeof item === 'string') {
            return resolveTemplateValue(item, context);
          }
          return item;
        })
        .filter((item) => item !== null && item !== undefined && item !== '');
      if (resolvedArr.length > 0) {
        result[key] = resolvedArr;
      }
    } else {
      // Pass through non-string, non-array values (numbers, booleans)
      if (value !== null && value !== undefined) {
        result[key] = value;
      }
    }
  }

  return result;
}
