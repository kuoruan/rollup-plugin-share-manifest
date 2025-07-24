import fs from "node:fs";
import type { Plugin, TransformPluginContext } from "rollup";
import { temporaryFile } from "tempy";
import type { EntryManifest, ProvideOptions, RecordOptions } from "./types.js";
import { isEntryChunk } from "./utils.js";

export default function shareManifest() {
  const manifest: EntryManifest = Object.create(null);

  const watchfile: string = temporaryFile();

  const updateWatchfile = async () => {
    try {
      await fs.promises.writeFile(watchfile, Date.now().toString());
    } catch (error) {
      console.error(`Error updating watchfile ${watchfile}: `, error);
    }
  };

  return {
    /**
     * A Rollup plugin that populates the entry manifest. This should be
     * used in the client bundle where the code-splitting is taking place.
     */
    record(options: RecordOptions = {}): Plugin {
      const publicPath = (options.publicPath || "/").replace(/\/+$/, "/");

      return {
        name: "share-manifest:record",
        buildStart() {
          for (const key in manifest) {
            delete manifest[key];
          }
        },
        generateBundle(options, bundle) {
          for (const fileName of Object.keys(bundle)) {
            const chunk = bundle[fileName];

            const isEntry = isEntryChunk(chunk);

            // We're interested only in entry points.
            if (!isEntry) continue;

            const globalImports = chunk.imports.filter((name) => {
              if (typeof options.globals === "object") {
                return !!options.globals[name];
              }

              return !!options.globals(name);
            });

            let entryPoints = manifest[chunk.name];

            if (!entryPoints) {
              entryPoints = manifest[chunk.name] = [];
            }

            entryPoints.push({
              format: options.format || "es",
              globalImports: globalImports,
              url: publicPath + fileName,
              code: chunk.code,
            });
          }

          updateWatchfile();
        },
      };
    },

    /**
     * A Rollup plugin that provides the current entry manifest via a
     * virtual module id.
     */
    provide(options: ProvideOptions = {}): Plugin {
      const virtualId = options.virtualId || "shared-manifest";
      const virtualModuleId = `virtual:${virtualId}`;

      const resolvedVirtualModuleId = `\0${virtualModuleId}`;

      return {
        name: "share-manifest:provide",
        resolveId(id: string) {
          if (id === virtualId) {
            return resolvedVirtualModuleId;
          }
        },
        load(id: string) {
          if (!id.startsWith(resolvedVirtualModuleId)) {
            return null;
          }

          return `export default ${JSON.stringify(manifest)}`;
        },
        transform(this: TransformPluginContext, _code: string, id: string) {
          if (id === resolvedVirtualModuleId) {
            this.addWatchFile(watchfile);
          }
        },
      };
    },
  };
}
