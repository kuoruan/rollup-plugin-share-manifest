import type { InternalModuleFormat, Plugin } from "rollup";

export interface ChunkGlobalImport {
  importName: string;
  importType: "global";
  globalName: string;
}

export interface ChunkLocalImport {
  importName: string;
  importType: "local";
  importPath: string;
}

export interface ChunkBuiltinImport {
  importName: string;
  importType: "builtin";
  moduleName: string;
}

export interface ChunkThirdPartyImport {
  importName: string;
  importType: "third-party";
  packageName: string;
}

export type ChunkImport =
  | ChunkGlobalImport
  | ChunkLocalImport
  | ChunkBuiltinImport
  | ChunkThirdPartyImport;

export interface ManifestAsset {
  name: string;
  fileName: string;
}

export interface ManifestChunk {
  name: string;
  fileName: string;
  isEntry: boolean;
  isDynamicEntry: boolean;
  format: InternalModuleFormat;
  imports: ChunkImport[];
  dynamicImports: ChunkImport[];
  exports: string[];
  /** The code of the chunk */
  code: string;
}

export type ManifestAssets = Record<string, ManifestAsset>;
export type ManifestChunks = Record<string, ManifestChunk>;

export interface Manifest {
  chunks: ManifestChunks;
  assets: ManifestAssets;
}

export interface Manifests {
  [key: string | symbol]: Manifest;
}

export type RecordKey = string | number | boolean | symbol | bigint;

export interface RecordOptions {
  key?: RecordKey;
  withoutCode?: boolean;
}

export type ManifestTypes = keyof Manifest;

export type ProvideOptions = Record<never, never>;

export type ManifestOptions = {
  key?: string;
  type?: ManifestTypes;
};

export interface SharedManifest {
  /**
   * A Rollup plugin that populates the entry manifest. This should be
   * used in the client bundle where the code-splitting is taking place.
   */
  record(this: void, options?: RecordOptions): Plugin;
  /**
   * A Rollup plugin that provides the current entry manifest via a
   * virtual module id.
   */
  provide(this: void, options?: ProvideOptions): Plugin;

  /**
   * Retrieves all manifests recorded by the plugin.
   * @returns An object containing all manifests, keyed by their unique keys.
   * @example
   * const manifests = plugin.getManifests();
   * // Retrieves all recorded manifests
   */
  getManifests(this: void): Manifests;

  /**
   * Retrieves a manifest by its key and type.
   * If no key is provided, it defaults to the first manifest (key "0").
   * If no type is provided, it returns the entire manifest.
   * If the manifest or type is not found, it returns null.
   * @param key - The key of the manifest to retrieve.
   * @param type - The type of the manifest to retrieve (e.g., "chunks", "assets").
   * @returns The requested manifest or null if not found.
   * @example
   * const manifest = plugin.getManifest("0", "chunks");
   * // Retrieves the chunks of the manifest with key "0"
   * @example
   * const manifest = plugin.getManifest("1");
   * // Retrieves the entire manifest with key "1"
   * @example
   * const manifest = plugin.getManifest();
   * // Retrieves the entire manifest with key "0" (default behavior)
   */
  getManifest(
    this: void,
    key?: RecordKey,
    type?: Exclude<ManifestTypes, "assets" | "chunks">,
  ): Manifest | null;
  getManifest(
    this: void,
    key: RecordKey,
    type: Exclude<ManifestTypes, "chunks">,
  ): ManifestAssets | null;
  getManifest(
    this: void,
    key: RecordKey,
    type: Exclude<ManifestTypes, "assets">,
  ): ManifestChunks | null;
}
