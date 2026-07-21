/**
 * Structured Logger for Embrace Health Grid Backend
 * - JSON-formatted output for log aggregation (e.g. Datadog, Loki, CloudWatch)
 * - Log levels: debug, info, warn, error, fatal
 * - Request correlation via requestId
 * - HIPAA-safe field redaction (removes PII from logs)
 * - Performance timing helpers
 */

const LOG_LEVEL_VALUES = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  fatal: 50,
};

// Minimum level to output; controlled via LOG_LEVEL env var
const MIN_LEVEL = LOG_LEVEL_VALUES[process.env.LOG_LEVEL?.toLowerCase()] ?? LOG_LEVEL_VALUES.info;

// Fields that should never appear in logs (HIPAA compliance)
const REDACTED_FIELDS = new Set([
  "password",
  "passwordHash",
  "secret",
  "token",
  "jwtSecret",
  "clientKey",
  "walletSecret",
  "privateKey",
  "ssn",
  "dob",
]);

/**
 * Deep-redact sensitive keys from an object before logging.
 */
function redact(obj, depth = 0) {
  if (depth > 5 || obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map((item) => redact(item, depth + 1));
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (REDACTED_FIELDS.has(k)) {
      out[k] = "[REDACTED]";
    } else {
      out[k] = redact(v, depth + 1);
    }
  }
  return out;
}

/**
 * Core log emitter — writes a single JSON line to stdout/stderr.
 */
function emit(level, message, meta = {}) {
  const levelValue = LOG_LEVEL_VALUES[level] ?? LOG_LEVEL_VALUES.info;
  if (levelValue < MIN_LEVEL) return;

  const entry = {
    ts: new Date().toISOString(),
    level,
    service: "embrace-health-backend",
    env: process.env.NODE_ENV || "development",
    msg: message,
    ...redact(meta),
  };

  const line = JSON.stringify(entry);

  if (level === "error" || level === "fatal") {
    process.stderr.write(line + "\n");
  } else {
    process.stdout.write(line + "\n");
  }
}

const logger = {
  debug: (msg, meta) => emit("debug", msg, meta),
  info:  (msg, meta) => emit("info",  msg, meta),
  warn:  (msg, meta) => emit("warn",  msg, meta),
  error: (msg, meta) => emit("error", msg, meta),
  fatal: (msg, meta) => emit("fatal", msg, meta),

  /**
   * Create a child logger that automatically merges a fixed context into
   * every log entry (e.g., requestId, userId, module name).
   */
  child(context) {
    return {
      debug: (msg, meta) => emit("debug", msg, { ...context, ...meta }),
      info:  (msg, meta) => emit("info",  msg, { ...context, ...meta }),
      warn:  (msg, meta) => emit("warn",  msg, { ...context, ...meta }),
      error: (msg, meta) => emit("error", msg, { ...context, ...meta }),
      fatal: (msg, meta) => emit("fatal", msg, { ...context, ...meta }),
      child(extra) {
        return logger.child({ ...context, ...extra });
      },
    };
  },

  /**
   * Express middleware: attaches a per-request child logger and logs
   * request start + completion with latency.
   */
  requestMiddleware(req, res, next) {
    const requestId =
      req.headers["x-request-id"] ||
      req.headers["x-correlation-id"] ||
      crypto.randomUUID();

    req.requestId = requestId;
    res.setHeader("X-Request-Id", requestId);

    const reqLog = logger.child({
      requestId,
      method: req.method,
      path: req.path,
      ip: req.ip || req.socket?.remoteAddress,
    });

    req.log = reqLog;
    const startAt = Date.now();

    reqLog.info("request_start");

    res.on("finish", () => {
      const latencyMs = Date.now() - startAt;
      const logFn = res.statusCode >= 500 ? reqLog.error : res.statusCode >= 400 ? reqLog.warn : reqLog.info;
      logFn("request_end", {
        statusCode: res.statusCode,
        latencyMs,
        contentLength: res.getHeader("content-length"),
      });
    });

    next();
  },
};

export default logger;
