import type { OutputFormat, ReporterPayload } from "../core/types.js";
import { renderJson } from "./json.js";
import { renderPretty } from "./pretty.js";
import { renderSarif } from "./sarif.js";

export function renderOutput(format: OutputFormat, payload: ReporterPayload): string {
  switch (format) {
    case "json":
      return renderJson(payload);
    case "sarif":
      return renderSarif(payload);
    case "pretty":
    default:
      return renderPretty(payload);
  }
}
