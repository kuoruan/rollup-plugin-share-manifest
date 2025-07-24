import type { OutputBundle } from "rollup";
import type { EntryChunk } from "./types.js";

export function isEntryChunk(info: OutputBundle[string]): info is EntryChunk {
  return "isEntry" in info && info.isEntry;
}
