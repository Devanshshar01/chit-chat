/**
 * Structured logging + global crash hooks.
 *
 * Every log line is a single JSON object so production logs are
 * machine-parseable. A ring buffer keeps the most recent entries in
 * memory so a crash report can include the context that led up to it.
 *
 * `setCrashReporter` is the integration point for an external service
 * (Sentry, Crashlytics, ...) - the app never depends on one directly.
 */
type Level = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  ts: string;
  level: Level;
  tag: string;
  message: string;
  data?: Record<string, unknown>;
}

type CrashReporter = (error: Error, isFatal: boolean, recentLogs: LogEntry[]) => void;

const RING_BUFFER_SIZE = 200;
const buffer: LogEntry[] = [];
let crashReporter: CrashReporter | null = null;

function emit(level: Level, tag: string, message: string, data?: Record<string, unknown>): void {
  const entry: LogEntry = { ts: new Date().toISOString(), level, tag, message, ...(data ? { data } : {}) };
  buffer.push(entry);
  if (buffer.length > RING_BUFFER_SIZE) buffer.shift();

  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else if (__DEV__) console.log(line);
}

export const log = {
  debug: (tag: string, message: string, data?: Record<string, unknown>) => emit('debug', tag, message, data),
  info: (tag: string, message: string, data?: Record<string, unknown>) => emit('info', tag, message, data),
  warn: (tag: string, message: string, data?: Record<string, unknown>) => emit('warn', tag, message, data),
  error: (tag: string, message: string, data?: Record<string, unknown>) => emit('error', tag, message, data),
};

export function getRecentLogs(): LogEntry[] {
  return [...buffer];
}

export function setCrashReporter(reporter: CrashReporter): void {
  crashReporter = reporter;
}

/**
 * Installs the global JS exception handler. Call once at startup.
 * Non-fatal errors are logged and swallowed; fatal ones are logged,
 * forwarded to the crash reporter (if configured), then re-thrown to the
 * previous handler so RN's own recovery/redbox behavior still applies.
 */
export function installGlobalErrorHandlers(): void {
  const previousHandler = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
    const err = error instanceof Error ? error : new Error(String(error));
    emit('error', 'global', `${isFatal ? 'FATAL' : 'non-fatal'}: ${err.message}`, { stack: err.stack });
    crashReporter?.(err, Boolean(isFatal), getRecentLogs());
    previousHandler(error, isFatal);
  });
}
