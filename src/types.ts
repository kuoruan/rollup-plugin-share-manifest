import type { OutputChunk } from "rollup";

export interface EntryPoint {
  format: string;
  globalImports: string[];
  url: string;
  code: string;
}

export interface EntryManifest {
  [entryName: string]: EntryPoint[];
}

export interface RecordOptions {
  publicPath?: string;
}

export interface ProvideOptions {
  virtualId?: string;
}

export interface EntryChunk extends OutputChunk {
  isEntry: true;
}
