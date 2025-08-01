/** biome-ignore-all lint/suspicious/noExplicitAny: allowing any type for flexibility */
import fs from "node:fs";
import type {
  OutputAsset,
  OutputChunk,
  Plugin,
  TransformPluginContext,
} from "rollup";
import { temporaryFile } from "tempy";
import {
  ResolvedIdPrefix,
  VirtualModuleId,
  VirtualModulesId,
} from "./constants.js";
import type {
  ChunkBuiltinImport,
  ChunkGlobalImport,
  ChunkImport,
  ChunkLocalImport,
  ChunkThirdPartyImport,
  Manifest,
  ManifestAsset,
  ManifestChunk,
  Manifests,
  ProvideOptions,
  RecordOptions,
  SharedManifest,
} from "./types.js";
import {
  extractManifestOptions,
  getAssetName,
  getPackageNameFromImport,
  isAssetOutput,
  isBuiltinModule,
  isResolvedModulesId,
  isVirtualModuleId,
  isVirtualModulesId,
  normalizeKey,
  removeQuery,
} from "./utils.js";

export default function shareManifest(): SharedManifest {
  const manifests: Manifests = Object.create(null);

  let index: number = 0;

  const keyAlias: Record<string | symbol, string> = Object.create(null);

  const watchfile: string = temporaryFile();

  const updateWatchfile = async () => {
    try {
      await fs.promises.writeFile(watchfile, Date.now().toString());
    } catch (error) {
      console.error(`Error updating watchfile ${watchfile}: `, error);
    }
  };

  return {
    record: (options: RecordOptions = {}): Plugin => {
      // Generate a unique manifest key for each record call
      const manifestKey = (index++).toString();

      // If a custom key is provided, use it to alias the manifest
      if (options.key !== undefined && options.key !== null) {
        const customKey = normalizeKey(options.key);

        if (customKey in keyAlias) {
          const keyDescription =
            typeof customKey === "symbol"
              ? `[symbol] ${customKey.description}`
              : customKey;

          throw new Error(
            `[share-manifest] key "${keyDescription}" is already used, please use a different key.`,
          );
        }

        if (customKey !== manifestKey) {
          keyAlias[customKey] = manifestKey;
        }
      }

      const manifest: Manifest = {
        chunks: Object.create(null),
        assets: Object.create(null),
      };
      manifests[manifestKey] = manifest;

      return {
        name: "share-manifest:record",
        buildStart() {
          manifest.chunks = Object.create(null);
          manifest.assets = Object.create(null);
        },
        generateBundle(outputOptions, outputBundle) {
          const assetsMap: Record<string, ManifestAsset> = Object.create(null);
          const chunksMap: Record<string, ManifestChunk> = Object.create(null);

          // check if the import is a global import
          const getGlobalImport = (importName: string): string | undefined => {
            if (typeof outputOptions.globals === "function") {
              return outputOptions.globals(importName);
            }
            return outputOptions.globals?.[importName];
          };

          const getManifestAsset = (asset: OutputAsset): ManifestAsset => {
            const assetName = getAssetName(asset) || asset.fileName;
            const assetFileName = asset.fileName || assetName;

            return {
              name: assetName,
              fileName: assetFileName,
            } satisfies ManifestAsset;
          };

          // Populate the assets map
          // This is used to link assets to chunks
          for (const output of Object.values(outputBundle)) {
            if (!isAssetOutput(output)) continue;

            assetsMap[output.fileName] = getManifestAsset(output);
          }

          const parseImport = (importName: string, imports: ChunkImport[]) => {
            // Remove query parameters from the import name
            // This is useful for handling imports with query parameters
            // such as "react?esm" or "path?commonjs"
            const importPath = removeQuery(importName);

            if (isBuiltinModule(importPath)) {
              imports.push({
                importName: importName,
                importType: "builtin",
                moduleName: importPath,
              } satisfies ChunkBuiltinImport);
              return;
            }

            const globalImport = getGlobalImport(importPath);

            if (globalImport) {
              imports.push({
                globalName: globalImport,
                importName: importName,
                importType: "global",
              } satisfies ChunkGlobalImport);

              return;
            }

            const output = outputBundle[importName];
            // If the output is not found, it might be a third-party import
            if (!output) {
              const packageName =
                getPackageNameFromImport(importPath) || importPath;

              imports.push({
                importName: importName,
                importType: "third-party",
                packageName: packageName,
              } satisfies ChunkThirdPartyImport);
              return;
            }

            // This should not happen, the imports should always be chunks.
            // But for safety, we check if the output is an asset.
            // If it is, we add it to the assets and skip the import.
            if (isAssetOutput(output)) {
              return;
            }

            imports.push({
              importName: importName,
              importType: "local",
              importPath: importPath,
            } satisfies ChunkLocalImport);
          };

          const getManifestChunk = (chunk: OutputChunk): ManifestChunk => {
            const imports: ChunkImport[] = [];

            for (const importName of chunk.imports) {
              parseImport(importName, imports);
            }

            const dynamicImports: ChunkImport[] = [];
            for (const importName of chunk.dynamicImports) {
              parseImport(importName, dynamicImports);
            }

            return {
              name: chunk.name,
              fileName: chunk.fileName,
              isEntry: chunk.isEntry,
              isDynamicEntry: chunk.isDynamicEntry,
              format: outputOptions.format || "es",
              imports,
              dynamicImports,
              exports: chunk.exports,
              code: options.withoutCode ? "" : chunk.code,
            } satisfies ManifestChunk;
          };

          for (const output of Object.values(outputBundle)) {
            const isAsset = isAssetOutput(output);

            // Skip assets, as they are handled separately
            if (isAsset) continue;

            chunksMap[output.fileName] = getManifestChunk(output);
          }

          manifest.chunks = chunksMap;
          manifest.assets = assetsMap;

          updateWatchfile();
        },
      };
    },
    provide: (_options: ProvideOptions = {}): Plugin => {
      return {
        name: "share-manifest:provide",
        resolveId(id: string) {
          if (isVirtualModuleId(id)) {
            // If the id is a single virtual module id, we resolve it to the first manifest
            return id.replace(
              VirtualModuleId,
              `${ResolvedIdPrefix}${VirtualModulesId}/0`,
            );
          } else if (isVirtualModulesId(id)) {
            return `${ResolvedIdPrefix}${id}`;
          }
        },
        load(id: string) {
          if (!isResolvedModulesId(id)) {
            return null;
          }

          const opts = extractManifestOptions(id);
          if (!opts || !opts.key) {
            return `export default ${JSON.stringify(manifests)};`;
          }

          const manifest = manifests[keyAlias[opts.key] || opts.key];
          if (!manifest) {
            return `export default null;`;
          }

          if (!opts.type) {
            return `export default ${JSON.stringify(manifest)};`;
          }

          return `export default ${JSON.stringify(manifest[opts.type])};`;
        },
        transform(this: TransformPluginContext, _code: string, id: string) {
          if (isResolvedModulesId(id)) {
            this.addWatchFile(watchfile);
          }
        },
      };
    },
    getManifests: (): Manifests => {
      const cloned = structuredClone(manifests);

      // Apply key aliasing to the cloned manifests
      // Remove the original keys and replace them with the custom keys
      for (const [customKey, manifestKey] of Object.entries(keyAlias)) {
        cloned[customKey] = cloned[manifestKey];

        delete cloned[manifestKey];
      }

      return cloned;
    },
    getManifest: (key, type): any => {
      const actualKey = normalizeKey(key ?? "0");

      const manifest = manifests[keyAlias[actualKey] || actualKey];
      if (!manifest) return null;

      const cloned = structuredClone(manifest);

      if (!type) return cloned;

      return cloned[type] ?? null;
    },
  };
}
