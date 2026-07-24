/**
 * Minimal console logger with a pino-compatible surface.
 */
type Fields = Record<string, unknown>;

interface Logger {
  info(objOrMsg: Fields | string, msg?: string): void;
  warn(objOrMsg: Fields | string, msg?: string): void;
  error(objOrMsg: Fields | string, msg?: string): void;
  child(bindings: Fields): Logger;
}

function emit(
  level: "info" | "warn" | "error",
  bindings: Fields,
  objOrMsg: Fields | string,
  msg?: string,
): void {
  const message = typeof objOrMsg === "string" ? objOrMsg : (msg ?? "");
  const fields =
    typeof objOrMsg === "string" ? bindings : { ...bindings, ...objOrMsg };
  const suffix =
    Object.keys(fields).length > 0 ? ` ${JSON.stringify(fields)}` : "";
  const line = `[${level}] ${message}${suffix}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

function make(bindings: Fields): Logger {
  return {
    info: (objOrMsg, msg) => emit("info", bindings, objOrMsg, msg),
    warn: (objOrMsg, msg) => emit("warn", bindings, objOrMsg, msg),
    error: (objOrMsg, msg) => emit("error", bindings, objOrMsg, msg),
    child: (childBindings) => make({ ...bindings, ...childBindings }),
  };
}

export const log: Logger = make({});
