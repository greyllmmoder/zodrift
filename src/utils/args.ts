export interface ParsedArgs {
  command: string | null;
  flags: Map<string, string | boolean>;
  positionals: string[];
}

export function parseArgs(argv: string[]): ParsedArgs {
  const [commandOrNull, ...rest] = argv;
  const flags = new Map<string, string | boolean>();
  const positionals: string[] = [];

  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];

    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }

    const withoutPrefix = token.slice(2);
    if (!withoutPrefix) {
      continue;
    }

    if (withoutPrefix.includes("=")) {
      const [key, ...valueParts] = withoutPrefix.split("=");
      flags.set(key, valueParts.join("="));
      continue;
    }

    const next = rest[i + 1];
    if (next && !next.startsWith("--")) {
      flags.set(withoutPrefix, next);
      i += 1;
      continue;
    }

    flags.set(withoutPrefix, true);
  }

  return {
    command: commandOrNull ?? null,
    flags,
    positionals,
  };
}

export function flagString(
  flags: Map<string, string | boolean>,
  key: string,
  fallback: string,
): string {
  const value = flags.get(key);
  return typeof value === "string" ? value : fallback;
}

export function flagBoolean(
  flags: Map<string, string | boolean>,
  key: string,
  fallback = false,
): boolean {
  const value = flags.get(key);
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return ["1", "true", "yes", "on"].includes(value.toLowerCase());
  }
  return fallback;
}

export function flagNumber(
  flags: Map<string, string | boolean>,
  key: string,
): number | undefined {
  const value = flags.get(key);
  if (typeof value !== "string") {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
