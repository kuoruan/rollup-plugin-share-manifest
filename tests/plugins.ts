import path from "node:path";
import type { Volume } from "memfs";
import type { Plugin } from "rollup";
import { removeQuery } from "@/utils.js";

const isAsset = (id: string) =>
  [".png", ".jpg", ".gif", ".webp", ".svg"].some((ext) => id.endsWith(ext));

/**
 * This plugin resolves imports with query parameters.
 */
export const createQueryPlugin = (_vol: Volume): Plugin => ({
  name: "resolve-query-plugin",
  resolveId(id, importer) {
    if (id.includes("?")) {
      const baseId = removeQuery(id);
      if (!baseId.startsWith("/") && importer) {
        return path.resolve(path.dirname(importer), baseId); // Resolve relative paths correctly
      }
      return baseId;
    }
    return null;
  },
});

export const createAssetPlugin = (vol: Volume): Plugin => {
  const copies: Record<
    string,
    {
      fileName: string;
      source: Buffer;
    }
  > = {};

  return {
    name: "asset-plugin",
    load(id) {
      const filePath = removeQuery(id);
      if (isAsset(filePath)) {
        const fileName = path.basename(filePath);
        const assetPath = fileName;

        copies[id] = {
          fileName: assetPath,
          source: vol.readFileSync(filePath) as Buffer,
        };
        return `export default ${JSON.stringify(assetPath)};`;
      }
    },
    generateBundle() {
      for (const asset of Object.values(copies)) {
        this.emitFile({
          type: "asset",
          name: asset.fileName,
          fileName: asset.fileName,
          source: asset.source,
        });
      }
    },
  };
};
