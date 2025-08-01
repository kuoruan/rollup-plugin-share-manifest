import type { OutputAsset, OutputChunk } from "rollup";
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
} from "@/utils.js";

describe("utils", () => {
  describe("normalizeKey", () => {
    it("should return string keys as-is", () => {
      expect(normalizeKey("hello")).toBe("hello");
      expect(normalizeKey("")).toBe("");
      expect(normalizeKey("123")).toBe("123");
      expect(normalizeKey("key-with-dashes")).toBe("key-with-dashes");
      expect(normalizeKey("special@chars#")).toBe("special@chars#");
    });

    it("should return symbol keys as-is", () => {
      const sym1 = Symbol("test");
      const sym2 = Symbol.for("global");
      const sym3 = Symbol();

      expect(normalizeKey(sym1)).toBe(sym1);
      expect(normalizeKey(sym2)).toBe(sym2);
      expect(normalizeKey(sym3)).toBe(sym3);
    });

    it("should convert numbers to string", () => {
      expect(normalizeKey(123)).toBe("123");
      expect(normalizeKey(0)).toBe("0");
      expect(normalizeKey(-456)).toBe("-456");
      expect(normalizeKey(Math.PI)).toBe(Math.PI.toString());
      expect(normalizeKey(Number.POSITIVE_INFINITY)).toBe("Infinity");
      expect(normalizeKey(Number.NEGATIVE_INFINITY)).toBe("-Infinity");
      expect(normalizeKey(Number.NaN)).toBe("NaN");
    });

    it("should convert booleans to string", () => {
      expect(normalizeKey(true)).toBe("true");
      expect(normalizeKey(false)).toBe("false");
    });

    it("should convert null and undefined to string", () => {
      expect(normalizeKey(null)).toBe("null");
      expect(normalizeKey(undefined)).toBe("undefined");
    });

    it("should convert bigint to string", () => {
      expect(normalizeKey(123n)).toBe("123");
      expect(normalizeKey(BigInt(456))).toBe("456");
      expect(normalizeKey(0n)).toBe("0");
    });

    it("should handle edge cases", () => {
      // Empty string is falsy but should remain as string
      expect(normalizeKey("")).toBe("");

      // Zero is falsy but should convert to "0"
      expect(normalizeKey(0)).toBe("0");

      // False is falsy but should convert to "false"
      expect(normalizeKey(false)).toBe("false");
    });
  });

  describe("isVirtualModuleId", () => {
    it("should return true for VirtualModuleId", () => {
      expect(isVirtualModuleId("virtual:shared-manifest")).toBe(true);
      expect(isVirtualModuleId("virtual:shared-manifest/assets")).toBe(true);
      expect(isVirtualModuleId("virtual:shared-manifest/chunks")).toBe(true);
    });

    it("should return false for non-matching ids", () => {
      expect(isVirtualModuleId("virtual:shared-manifests")).toBe(false);
      expect(isVirtualModuleId("virtual:shared-manifests/key")).toBe(false);
      expect(isVirtualModuleId("virtual:shared-manifests/assets")).toBe(false);
      expect(isVirtualModuleId("virtual:shared-manifest/")).toBe(false);
      expect(isVirtualModuleId("virtual:shared-manifest/assets/")).toBe(false);
      expect(isVirtualModuleId("some-other-id")).toBe(false);
      expect(isVirtualModuleId("")).toBe(false);
    });
  });

  describe("isVirtualModulesId", () => {
    it("should return true for ids matching VirtualModulesIdRegex", () => {
      expect(isVirtualModulesId("virtual:shared-manifests")).toBe(true);
      expect(isVirtualModulesId("virtual:shared-manifests/key")).toBe(true);
      expect(isVirtualModulesId("virtual:shared-manifests/key/assets")).toBe(
        true,
      );
      expect(isVirtualModulesId("virtual:shared-manifests/key/chunks")).toBe(
        true,
      );
    });

    it("should return false for non-matching ids", () => {
      expect(isVirtualModulesId("virtual:shared-manifest")).toBe(false);
      expect(isVirtualModulesId("virtual:shared-manifest/assets")).toBe(false);
      expect(isVirtualModulesId("virtual:shared-manifest/chunks")).toBe(false);
      expect(isVirtualModulesId("virtual:shared-manifest/assets/")).toBe(false);
      expect(isVirtualModulesId("virtual:shared-manifests/")).toBe(false);
      expect(isVirtualModulesId("virtual:shared-manifests/assets/")).toBe(
        false,
      );
      expect(isVirtualModulesId("regular-module-id")).toBe(false);
      expect(isVirtualModulesId("")).toBe(false);
    });
  });

  describe("isResolvedModulesId", () => {
    it("should return true for ids matching ResolvedModulesIdRegex", () => {
      expect(isResolvedModulesId("\0virtual:shared-manifests")).toBe(true);
      expect(isResolvedModulesId("\0virtual:shared-manifests/key")).toBe(true);
    });

    it("should return false for non-matching ids", () => {
      expect(isResolvedModulesId("regular-module-id")).toBe(false);
      expect(isResolvedModulesId("")).toBe(false);
    });
  });

  describe("extractManifestOptions", () => {
    it("should extract key and type from resolved modules id", () => {
      expect(
        extractManifestOptions("\0virtual:shared-manifests/my-key/assets"),
      ).toEqual({
        key: "my-key",
        type: "assets",
      });
      expect(
        extractManifestOptions("\0virtual:shared-manifests/my-key/chunks"),
      ).toEqual({
        key: "my-key",
        type: "chunks",
      });
      expect(
        extractManifestOptions(
          "\0virtual:shared-manifests/component-key/assets",
        ),
      ).toEqual({
        key: "component-key",
        type: "assets",
      });
    });

    it("should extract only key when no type is specified", () => {
      expect(
        extractManifestOptions("\0virtual:shared-manifests/my-key"),
      ).toEqual({
        key: "my-key",
        type: undefined,
      });
      expect(
        extractManifestOptions("\0virtual:shared-manifests/another-key"),
      ).toEqual({
        key: "another-key",
        type: undefined,
      });
    });

    it("should handle base resolved modules id without key", () => {
      expect(extractManifestOptions("\0virtual:shared-manifests")).toEqual({
        key: undefined,
        type: undefined,
      });
    });

    it("should return undefined for non-matching ids", () => {
      expect(extractManifestOptions("regular-module-id")).toBeUndefined();
      expect(
        extractManifestOptions("virtual:shared-manifests"),
      ).toBeUndefined();
      expect(extractManifestOptions("virtual:shared-manifest")).toBeUndefined();
      expect(
        extractManifestOptions("\0virtual:shared-manifest"),
      ).toBeUndefined();
      expect(extractManifestOptions("")).toBeUndefined();
    });
  });

  describe("removeQuery", () => {
    it("should remove query string from id", () => {
      expect(removeQuery("module.js?param=value")).toBe("module.js");
      expect(removeQuery("path/to/file.css?v=1.0.0")).toBe("path/to/file.css");
      expect(removeQuery("file.html?a=1&b=2")).toBe("file.html");
    });

    it("should return original id when no query string", () => {
      expect(removeQuery("module.js")).toBe("module.js");
      expect(removeQuery("path/to/file.css")).toBe("path/to/file.css");
      expect(removeQuery("")).toBe("");
    });

    it("should handle ids with only query string", () => {
      expect(removeQuery("?param=value")).toBe("");
    });

    it("should handle multiple question marks", () => {
      expect(removeQuery("file.js?first=1?second=2")).toBe("file.js");
    });
  });

  describe("isBuiltinModule", () => {
    it("should return true for builtin modules", () => {
      expect(isBuiltinModule("fs")).toBe(true);
      expect(isBuiltinModule("path")).toBe(true);
      expect(isBuiltinModule("http")).toBe(true);
      expect(isBuiltinModule("crypto")).toBe(true);
      expect(isBuiltinModule("util")).toBe(true);
      expect(isBuiltinModule("url")).toBe(true);
      expect(isBuiltinModule("os")).toBe(true);
    });

    it("should return true for builtin modules with node: prefix", () => {
      expect(isBuiltinModule("node:fs")).toBe(true);
      expect(isBuiltinModule("node:path")).toBe(true);
      expect(isBuiltinModule("node:http")).toBe(true);
      expect(isBuiltinModule("node:crypto")).toBe(true);
    });

    it("should return false for non-builtin modules", () => {
      expect(isBuiltinModule("react")).toBe(false);
      expect(isBuiltinModule("lodash")).toBe(false);
      expect(isBuiltinModule("vue")).toBe(false);
      expect(isBuiltinModule("custom-module")).toBe(false);
      expect(isBuiltinModule("")).toBe(false);
    });

    it("should return false for scoped packages", () => {
      expect(isBuiltinModule("@babel/core")).toBe(false);
      expect(isBuiltinModule("@vue/cli")).toBe(false);
    });
  });

  describe("isAssetOutput", () => {
    it("should return true for assets", () => {
      const asset: OutputAsset = {
        type: "asset",
        fileName: "image.png",
        source: Buffer.from("fake-image-data"),
        name: "image.png",
        names: ["image.png"],
        needsCodeReference: false,
        originalFileName: null,
        originalFileNames: [],
      };

      expect(isAssetOutput(asset)).toBe(true);
    });

    it("should return false for chunks", () => {
      const chunk: OutputChunk = {
        type: "chunk",
        isEntry: true,
        isImplicitEntry: false,
        fileName: "main.js",
        name: "main",
        facadeModuleId: "/src/main.ts",
        isDynamicEntry: false,
        moduleIds: ["/src/main.ts"],
        modules: {},
        exports: [],
        imports: [],
        dynamicImports: [],
        implicitlyLoadedBefore: [],
        importedBindings: {},
        referencedFiles: [],
        code: 'console.log("hello");',
        map: null,
        sourcemapFileName: null,
        preliminaryFileName: "main.js",
      };

      expect(isAssetOutput(chunk)).toBe(false);
    });
  });

  describe("getAssetName", () => {
    it("should return the first name from names array", () => {
      const asset: OutputAsset = {
        type: "asset",
        fileName: "style.css",
        source: "body { color: red; }",
        name: "style.css",
        names: ["original-name.css", "style.css"],
        needsCodeReference: false,
        originalFileName: null,
        originalFileNames: [],
      };

      expect(getAssetName(asset)).toBe("original-name.css");
    });

    it("should return the name property when names array is empty", () => {
      const asset: OutputAsset = {
        type: "asset",
        fileName: "style.css",
        source: "body { color: red; }",
        name: "style.css",
        names: [],
        needsCodeReference: false,
        originalFileName: null,
        originalFileNames: [],
      };

      expect(getAssetName(asset)).toBe("style.css");
    });

    it("should return undefined when both names and name are not available", () => {
      const asset: OutputAsset = {
        type: "asset",
        fileName: "style.css",
        source: "body { color: red; }",
        name: undefined,
        names: [],
        needsCodeReference: false,
        originalFileName: null,
        originalFileNames: [],
      };

      expect(getAssetName(asset)).toBeUndefined();
    });
  });

  describe("getPackageNameFromImport", () => {
    it("should return undefined for local imports", () => {
      expect(getPackageNameFromImport("./local-file")).toBeUndefined();
      expect(getPackageNameFromImport("../parent-dir")).toBeUndefined();
      expect(getPackageNameFromImport("/absolute/path")).toBeUndefined();
    });

    it("should return package name for regular imports", () => {
      expect(getPackageNameFromImport("react")).toBe("react");
      expect(getPackageNameFromImport("lodash")).toBe("lodash");
      expect(getPackageNameFromImport("react/jsx-runtime")).toBe("react");
      expect(getPackageNameFromImport("lodash/map")).toBe("lodash");
    });

    it("should return package name for scoped packages", () => {
      expect(getPackageNameFromImport("@babel/core")).toBe("@babel/core");
      expect(getPackageNameFromImport("@vue/cli")).toBe("@vue/cli");
      expect(getPackageNameFromImport("@angular/common/http")).toBe(
        "@angular/common",
      );
    });

    it("should return undefined for invalid package names", () => {
      // Empty string
      expect(getPackageNameFromImport("")).toBeUndefined();

      // Invalid scoped package format (incomplete scope)
      expect(getPackageNameFromImport("@")).toBeUndefined();
      expect(getPackageNameFromImport("@/")).toBeUndefined();

      // String that starts with valid characters but has no valid package name part
      expect(getPackageNameFromImport("@scope/")).toBeUndefined();
    });
  });
});
