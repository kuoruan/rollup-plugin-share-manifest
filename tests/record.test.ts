import { Volume } from "memfs";
import { type RollupFsModule, rollup } from "rollup";
import shareManifest from "@/plugin.js";
import { createAssetPlugin, createQueryPlugin } from "./plugins.js";

describe("Plugin Chunks Record Tests", () => {
  it("should load plugin correctly", async () => {
    const sharedManifest = shareManifest();

    const vol = Volume.fromJSON({
      "/main.js": `
        export const foo = "bar";
      `,
    });

    const bundle = await rollup({
      input: "/main.js",
      fs: vol.promises as RollupFsModule,
      plugins: [sharedManifest.record()],
    });

    await bundle.generate({
      format: "es",
    });

    expect(sharedManifest.getManifest("0", "chunks")).toMatchSnapshot();
  });

  it("should handle imports correctly", async () => {
    const sharedManifest = shareManifest();

    const vol = Volume.fromJSON({
      "/main.js": `
        import { foo } from "./foo.js";
        export { foo };
      `,
      "/foo.js": `
        import path from "path";

        export const foo = path.join("bar", "baz");
      `,
    });

    const bundle = await rollup({
      input: "/main.js",
      fs: vol.promises as RollupFsModule,
      plugins: [sharedManifest.record()],
      external: ["path"],
    });

    await bundle.generate({
      format: "es",
    });

    expect(sharedManifest.getManifest("0", "chunks")).toMatchSnapshot();
  });

  it("should handle third-party imports", async () => {
    const sharedManifest = shareManifest();

    const vol = Volume.fromJSON({
      "/main.js": `
        import React from "react";
        import { useState } from "react";
        import _ from "lodash";

        export const App = () => {
          const [count, setCount] = useState(0);
          return React.createElement("div", null, _.toString(count));
        };
      `,
    });

    const bundle = await rollup({
      input: "/main.js",
      fs: vol.promises as RollupFsModule,
      plugins: [sharedManifest.record()],
      external: ["react", "lodash"],
    });

    await bundle.generate({
      format: "es",
    });

    const manifest = sharedManifest.getManifest("0", "chunks");
    expect(manifest).toBeDefined();

    const mainChunk = manifest?.["main.js"];
    expect(mainChunk).toBeDefined();
    expect(mainChunk?.imports).toHaveLength(2);
    expect(mainChunk?.imports).toMatchInlineSnapshot(`
      [
        {
          "importName": "react",
          "importType": "third-party",
          "packageName": "react",
        },
        {
          "importName": "lodash",
          "importType": "third-party",
          "packageName": "lodash",
        },
      ]
    `);
  });

  it("should handle global imports", async () => {
    const sharedManifest = shareManifest();

    const vol = Volume.fromJSON({
      "/main.js": `
        import $ from "jquery";
        import React from "react";

        export const init = () => {
          $("body").append(React.createElement("div", null, "Hello"));
        };
      `,
    });

    const bundle = await rollup({
      input: "/main.js",
      fs: vol.promises as RollupFsModule,
      plugins: [sharedManifest.record()],
      external: ["jquery", "react"],
    });

    await bundle.generate({
      format: "iife",
      name: "MyLib",
      globals: {
        jquery: "$",
        react: "React",
      },
    });

    const manifest = sharedManifest.getManifest("0", "chunks");
    const mainChunk = manifest?.["main.js"];

    expect(mainChunk).toBeDefined();
    expect(mainChunk?.imports).toHaveLength(2);
    expect(mainChunk?.imports).toMatchInlineSnapshot(`
      [
        {
          "globalName": "$",
          "importName": "jquery",
          "importType": "global",
        },
        {
          "globalName": "React",
          "importName": "react",
          "importType": "global",
        },
      ]
    `);
    expect(mainChunk?.format).toBe("iife");
  });

  it("should handle global imports with custom globals function", async () => {
    const sharedManifest = shareManifest();

    const vol = Volume.fromJSON({
      "/main.js": `
      import React from "react";

      export const App = () => {
        return React.createElement("div", null, "Hello World");
      };
      `,
    });

    const bundle = await rollup({
      input: "/main.js",
      fs: vol.promises as RollupFsModule,
      plugins: [sharedManifest.record()],
      external: ["react"],
    });

    await bundle.generate({
      format: "iife",
      name: "MyApp",
      globals: (id) => {
        if (id === "react") return "React";
        return id;
      },
    });

    const manifest = sharedManifest.getManifest("0", "chunks");
    const mainChunk = manifest?.["main.js"];
    expect(mainChunk).toBeDefined();
    expect(mainChunk?.imports).toHaveLength(1);
    expect(mainChunk?.imports[0]).toEqual({
      importName: "react",
      importType: "global",
      globalName: "React",
    });
  });

  it("should handle dynamic imports", async () => {
    const sharedManifest = shareManifest();

    const vol = Volume.fromJSON({
      "/main.js": `
        export async function loadModule() {
          const { foo } = await import("./foo.js");
          const lodash = await import("lodash");
          return { foo, lodash };
        }
      `,
      "/foo.js": `
        export const foo = "bar";
      `,
    });

    const bundle = await rollup({
      input: "/main.js",
      fs: vol.promises as RollupFsModule,
      output: {
        chunkFileNames: "[name].js",
      },
      plugins: [sharedManifest.record()],
      external: ["lodash"],
    });

    await bundle.generate({
      format: "es",
    });

    const manifest = sharedManifest.getManifest("0", "chunks");
    const mainChunk = manifest?.["main.js"];

    expect(mainChunk).toBeDefined();
    expect(mainChunk?.dynamicImports).toHaveLength(2);
    expect(mainChunk?.dynamicImports).toMatchInlineSnapshot(`
      [
        {
          "importName": "foo-BFeZFBZU.js",
          "importPath": "foo-BFeZFBZU.js",
          "importType": "local",
        },
        {
          "importName": "lodash",
          "importType": "third-party",
          "packageName": "lodash",
        },
      ]
    `);
  });

  it("should handle multiple entries", async () => {
    const sharedManifest = shareManifest();

    const vol = Volume.fromJSON({
      "/main.js": `
        import { shared } from "./shared.js";
        export const main = shared + "main";
      `,
      "/other.js": `
        import { shared } from "./shared.js";
        export const other = shared + "other";
      `,
      "/shared.js": `
        export const shared = "shared-";
      `,
    });

    const bundle = await rollup({
      input: ["/main.js", "/other.js"],
      fs: vol.promises as RollupFsModule,
      plugins: [sharedManifest.record()],
    });

    await bundle.generate({
      format: "es",
    });

    const manifest = sharedManifest.getManifest("0", "chunks");

    expect(manifest).toBeDefined();
    expect(Object.keys(manifest ?? {})).toHaveLength(3); // main.js, other.js, shared.js
    expect(manifest?.["main.js"]?.isEntry).toBe(true);
    expect(manifest?.["other.js"]?.isEntry).toBe(true);
  });

  it("should support custom key", async () => {
    const sharedManifest = shareManifest();

    const vol = Volume.fromJSON({
      "/main.js": `
        export const foo = "bar";
      `,
    });

    const bundle = await rollup({
      input: "/main.js",
      fs: vol.promises as RollupFsModule,
      plugins: [sharedManifest.record({ key: "custom-key" })],
    });

    await bundle.generate({
      format: "es",
    });

    const manifest = sharedManifest.getManifest("custom-key", "chunks");
    expect(manifest).toBeDefined();
    expect(manifest?.["main.js"]).toBeDefined();

    // 默认的 "0" 键应该仍然存在，因为它是内部索引
    const defaultManifest = sharedManifest.getManifest("0", "chunks");
    expect(defaultManifest).toBeDefined();
  });

  it("should support withoutCode option", async () => {
    const sharedManifest = shareManifest();

    const vol = Volume.fromJSON({
      "/main.js": `
        export const foo = "bar";
        console.log("This is some code");
      `,
    });

    const bundle = await rollup({
      input: "/main.js",
      fs: vol.promises as RollupFsModule,
      plugins: [sharedManifest.record({ withoutCode: true })],
    });

    await bundle.generate({
      format: "es",
    });

    const manifest = sharedManifest.getManifest("0", "chunks");
    const mainChunk = manifest?.["main.js"];

    expect(mainChunk).toBeDefined();
    expect(mainChunk?.code).toBe("");
  });

  it("should handle builtin modules correctly", async () => {
    const sharedManifest = shareManifest();

    const vol = Volume.fromJSON({
      "/main.js": `
        import fs from "fs";
        import path from "path";
        import { createServer } from "http";

        export const server = createServer();
        export const filePath = path.join("/tmp", "test.txt");
        export { fs };
      `,
    });

    const bundle = await rollup({
      input: "/main.js",
      fs: vol.promises as RollupFsModule,
      plugins: [sharedManifest.record()],
      external: [/^(fs|path|http)$/],
    });

    await bundle.generate({
      format: "es",
    });

    const manifest = sharedManifest.getManifest("0", "chunks");
    const mainChunk = manifest?.["main.js"];

    expect(mainChunk).toBeDefined();
    expect(mainChunk?.imports).toHaveLength(3);
    expect(
      mainChunk?.imports.every((imp) => imp.importType === "builtin"),
    ).toBe(true);
    expect(mainChunk?.imports).toMatchInlineSnapshot(`
      [
        {
          "importName": "fs",
          "importType": "builtin",
          "moduleName": "fs",
        },
        {
          "importName": "path",
          "importType": "builtin",
          "moduleName": "path",
        },
        {
          "importName": "http",
          "importType": "builtin",
          "moduleName": "http",
        },
      ]
    `);
  });

  it("should handle complex package names", async () => {
    const sharedManifest = shareManifest();

    const vol = Volume.fromJSON({
      "/main.js": `
        import vue from "@vue/runtime-core";
        import config from "@my-org/config/dist/index.js";
        import utils from "some-package/utils";

        export { vue, config, utils };
      `,
    });

    const bundle = await rollup({
      input: "/main.js",
      fs: vol.promises as RollupFsModule,
      plugins: [sharedManifest.record()],
      external: [
        "@vue/runtime-core",
        "@my-org/config/dist/index.js",
        "some-package/utils",
      ],
    });

    await bundle.generate({
      format: "es",
    });

    const manifest = sharedManifest.getManifest("0", "chunks");
    const mainChunk = manifest?.["main.js"];

    expect(mainChunk).toBeDefined();
    expect(mainChunk?.imports).toHaveLength(3);
    expect(
      mainChunk?.imports.every((imp) => imp.importType === "third-party"),
    ).toBe(true);
    expect(mainChunk?.imports).toMatchInlineSnapshot(`
      [
        {
          "importName": "@vue/runtime-core",
          "importType": "third-party",
          "packageName": "@vue/runtime-core",
        },
        {
          "importName": "@my-org/config/dist/index.js",
          "importType": "third-party",
          "packageName": "@my-org/config",
        },
        {
          "importName": "some-package/utils",
          "importType": "third-party",
          "packageName": "some-package",
        },
      ]
    `);
  });

  it("should clear manifest on buildStart", async () => {
    const sharedManifest = shareManifest();

    const vol = Volume.fromJSON({
      "/main.js": `export const foo = "bar";`,
    });

    // First build
    const bundle1 = await rollup({
      input: "/main.js",
      fs: vol.promises as RollupFsModule,
      plugins: [sharedManifest.record()],
    });

    await bundle1.generate({ format: "es" });

    const manifestAfterFirst = sharedManifest.getManifest("0", "chunks");
    expect(manifestAfterFirst).toBeDefined();
    expect(Object.keys(manifestAfterFirst ?? {})).toHaveLength(1);

    // Second build with different input
    vol.fromJSON({
      "/main.js": `export const baz = "qux";`,
      "/other.js": `export const other = "value";`,
    });

    const bundle2 = await rollup({
      input: ["/main.js", "/other.js"],
      fs: vol.promises as RollupFsModule,
      plugins: [sharedManifest.record()],
    });

    await bundle2.generate({ format: "es" });

    const manifestAfterSecond = sharedManifest.getManifest("1", "chunks");
    expect(manifestAfterSecond).toBeDefined();
    expect(Object.keys(manifestAfterSecond ?? {})).toHaveLength(2);
  });

  it("should handle different output formats", async () => {
    const sharedManifest = shareManifest();

    const vol = Volume.fromJSON({
      "/main.js": `
        export const foo = "bar";
      `,
    });

    const formats = ["es", "cjs", "iife", "umd", "amd"] as const;

    for (const format of formats) {
      const bundle = await rollup({
        input: "/main.js",
        fs: vol.promises as RollupFsModule,
        plugins: [sharedManifest.record({ key: format })],
      });

      await bundle.generate({
        format,
        name: format === "iife" || format === "umd" ? "MyLib" : undefined,
      });

      const manifest = sharedManifest.getManifest(format, "chunks");
      expect(manifest).toBeDefined();
      expect(manifest?.["main.js"]?.format).toBe(format);
    }
  });

  it("should handle imports with query parameters", async () => {
    const sharedManifest = shareManifest();

    const vol = Volume.fromJSON({
      "/main.js": `
        import { foo } from "./foo.js?raw";
        import { bar } from "./bar.js?version=1.0.0&type=module";
        import React from "react?esm";
        import path from "path?commonjs";

        export { foo, bar, React, path };
      `,
      "/foo.js": `
        export const foo = "bar";
      `,
      "/bar.js": `
        export const bar = "baz";
      `,
    });

    const bundle = await rollup({
      input: "/main.js",
      fs: vol.promises as RollupFsModule,
      plugins: [createQueryPlugin(vol), sharedManifest.record()],
      external: ["react?esm", "path?commonjs"],
    });

    await bundle.generate({
      format: "es",
    });

    const manifest = sharedManifest.getManifest("0", "chunks");
    const mainChunk = manifest?.["main.js"];

    expect(mainChunk).toBeDefined();
    expect(mainChunk?.imports).toHaveLength(2); // react, path
    expect(mainChunk?.imports).toMatchInlineSnapshot(`
      [
        {
          "importName": "react?esm",
          "importType": "third-party",
          "packageName": "react",
        },
        {
          "importName": "path?commonjs",
          "importType": "builtin",
          "moduleName": "path",
        },
      ]
    `);
  });

  it("should handle dynamic imports with query parameters", async () => {
    const sharedManifest = shareManifest();

    const vol = Volume.fromJSON({
      "/main.js": `
        export async function loadModules() {
          const { foo } = await import("./foo.js?raw");
          const lodash = await import("lodash?esm");
          const fs = await import("fs?node");
          return { foo, lodash, fs };
        }
      `,
      "/foo.js": `
        export const foo = "bar";
      `,
    });

    const bundle = await rollup({
      input: "/main.js",
      fs: vol.promises as RollupFsModule,
      output: {
        chunkFileNames: "[name].js",
      },
      plugins: [createQueryPlugin(vol), sharedManifest.record()],
      external: ["lodash?esm", "fs?node"],
    });

    await bundle.generate({
      format: "es",
    });

    const manifest = sharedManifest.getManifest("0", "chunks");
    const mainChunk = manifest?.["main.js"];

    expect(mainChunk).toBeDefined();
    expect(mainChunk?.dynamicImports).toHaveLength(3);
    expect(mainChunk?.dynamicImports).toMatchInlineSnapshot(`
      [
        {
          "importName": "foo-BFeZFBZU.js",
          "importPath": "foo-BFeZFBZU.js",
          "importType": "local",
        },
        {
          "importName": "lodash?esm",
          "importType": "third-party",
          "packageName": "lodash",
        },
        {
          "importName": "fs?node",
          "importType": "builtin",
          "moduleName": "fs",
        },
      ]
    `);
  });
});

describe("Plugin Record with Image Plugin", async () => {
  // Create a simple 1x1 PNG image Buffer
  const createPngBuffer = () => {
    return Buffer.from([
      137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1,
      0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65, 84,
      120, 218, 99, 248, 15, 0, 1, 1, 1, 0, 24, 221, 141, 219, 0, 0, 0, 0, 73,
      69, 78, 68, 174, 66, 96, 130,
    ]);
  };

  it("should handle image imports with image plugin", async () => {
    const sharedManifest = shareManifest();

    const vol = Volume.fromJSON({
      "/main.js": `
          import logoUrl from "./assets/logo.png";
          import iconUrl from "./assets/icon.jpg";
          import avatarUrl from "./assets/avatar.gif";

          export { logoUrl, iconUrl, avatarUrl };
        `,
      "/assets/logo.png": createPngBuffer(),
      "/assets/icon.jpg": createPngBuffer(),
      "/assets/avatar.gif": createPngBuffer(),
    });

    const bundle = await rollup({
      input: "/main.js",
      fs: vol.promises as RollupFsModule,
      plugins: [createAssetPlugin(vol), sharedManifest.record()],
    });

    await bundle.generate({
      format: "es",
    });

    const manifest = sharedManifest.getManifest("0");
    const mainChunk = manifest?.chunks?.["main.js"];

    expect(mainChunk).toBeDefined();
    expect(mainChunk?.imports).toHaveLength(0); // no imports for images
    expect(manifest?.assets).toMatchInlineSnapshot(`
      {
        "avatar.gif": {
          "fileName": "avatar.gif",
          "name": "avatar.gif",
        },
        "icon.jpg": {
          "fileName": "icon.jpg",
          "name": "icon.jpg",
        },
        "logo.png": {
          "fileName": "logo.png",
          "name": "logo.png",
        },
      }
    `);
  });

  it("should handle mixed assets and regular imports", async () => {
    const sharedManifest = shareManifest();

    const vol = Volume.fromJSON({
      "/main.js": `
          import { utils } from "./utils.js";
          import logoUrl from "./assets/logo.png";
          import React from "react";

          export const App = () => {
            return React.createElement("img", { src: logoUrl, alt: "Logo" });
          };
          export { utils };
        `,
      "/utils.js": `
          export const utils = { helper: () => "helper" };
        `,
      "/assets/logo.png": createPngBuffer(),
    });

    const bundle = await rollup({
      input: "/main.js",
      fs: vol.promises as RollupFsModule,
      plugins: [createAssetPlugin(vol), sharedManifest.record()],
      external: ["react"],
    });

    await bundle.generate({
      format: "es",
    });

    const manifest = sharedManifest.getManifest("0");
    const mainChunk = manifest?.chunks?.["main.js"];

    expect(mainChunk).toBeDefined();
    expect(mainChunk?.imports).toHaveLength(1);
    expect(mainChunk?.imports[0]?.importName).toBe("react");
    expect(manifest?.assets).toMatchInlineSnapshot(`
      {
        "logo.png": {
          "fileName": "logo.png",
          "name": "logo.png",
        },
      }
    `);
  });

  it("should handle dynamic image imports", async () => {
    const sharedManifest = shareManifest();

    const vol = Volume.fromJSON({
      "/main.js": `
          export async function loadAssets() {
            const logoModule = await import("./assets/logo.png");
            const iconModule = await import("./assets/icon.jpg");
            return { logo: logoModule.default, icon: iconModule.default };
          }
        `,
      "/assets/logo.png": createPngBuffer(),
      "/assets/icon.jpg": createPngBuffer(),
    });

    const bundle = await rollup({
      input: "/main.js",
      output: {
        chunkFileNames: "[name]-[hash].js",
      },
      fs: vol.promises as RollupFsModule,
      plugins: [createAssetPlugin(vol), sharedManifest.record()],
    });

    await bundle.generate({
      format: "es",
    });

    const manifest = sharedManifest.getManifest("0");
    const mainChunk = manifest?.chunks?.["main.js"];

    expect(mainChunk).toBeDefined();
    expect(mainChunk?.dynamicImports).toHaveLength(2);
    expect(manifest?.assets).toMatchInlineSnapshot(`
      {
        "icon.jpg": {
          "fileName": "icon.jpg",
          "name": "icon.jpg",
        },
        "logo.png": {
          "fileName": "logo.png",
          "name": "logo.png",
        },
      }
    `);
  });

  it("should handle images with query parameters", async () => {
    const sharedManifest = shareManifest();

    const vol = Volume.fromJSON({
      "/main.js": `
          import logoUrl from "./assets/logo.png?width=100";
          import iconUrl from "./assets/icon.jpg?quality=80";

          export { logoUrl, iconUrl };
        `,
      "/assets/logo.png": createPngBuffer(),
      "/assets/icon.jpg": createPngBuffer(),
    });

    const bundle = await rollup({
      input: "/main.js",
      fs: vol.promises as RollupFsModule,
      plugins: [
        createQueryPlugin(vol),
        createAssetPlugin(vol),
        sharedManifest.record(),
      ],
    });

    await bundle.generate({
      format: "es",
    });

    const manifest = sharedManifest.getManifest("0");
    const mainChunk = manifest?.chunks?.["main.js"];

    expect(mainChunk).toBeDefined();
    expect(mainChunk?.imports).toHaveLength(0);
    expect(manifest?.assets).toMatchInlineSnapshot(`
      {
        "icon.jpg": {
          "fileName": "icon.jpg",
          "name": "icon.jpg",
        },
        "logo.png": {
          "fileName": "logo.png",
          "name": "logo.png",
        },
      }
    `);
  });

  it("should handle different image formats", async () => {
    const sharedManifest = shareManifest();

    const vol = Volume.fromJSON({
      "/main.js": `
          import pngImage from "./assets/image.png";
          import jpgImage from "./assets/image.jpg";
          import gifImage from "./assets/image.gif";
          import webpImage from "./assets/image.webp";
          import svgImage from "./assets/image.svg";

          export { pngImage, jpgImage, gifImage, webpImage, svgImage };
        `,
      "/assets/image.png": createPngBuffer(),
      "/assets/image.jpg": createPngBuffer(),
      "/assets/image.gif": createPngBuffer(),
      "/assets/image.webp": createPngBuffer(),
      "/assets/image.svg": Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1" fill="red"/></svg>',
      ),
    });

    const bundle = await rollup({
      input: "/main.js",
      fs: vol.promises as RollupFsModule,
      plugins: [createAssetPlugin(vol), sharedManifest.record()],
    });

    await bundle.generate({
      format: "es",
    });

    const manifest = sharedManifest.getManifest("0");
    const mainChunk = manifest?.chunks?.["main.js"];

    expect(mainChunk).toBeDefined();
    expect(mainChunk?.imports).toHaveLength(0);
  });

  it("should handle assets in multiple entry points", async () => {
    const sharedManifest = shareManifest();

    const vol = Volume.fromJSON({
      "/main.js": `
          import logoUrl from "./assets/logo.png";
          export { logoUrl };
        `,
      "/secondary.js": `
          import iconUrl from "./assets/icon.jpg";
          import logoUrl from "./assets/logo.png";
          export { iconUrl, logoUrl };
        `,
      "/assets/logo.png": createPngBuffer(),
      "/assets/icon.jpg": createPngBuffer(),
    });

    const bundle = await rollup({
      input: ["/main.js", "/secondary.js"],
      fs: vol.promises as RollupFsModule,
      plugins: [createAssetPlugin(vol), sharedManifest.record()],
    });

    await bundle.generate({
      format: "es",
    });

    const manifest = sharedManifest.getManifest("0");
    const mainChunk = manifest?.chunks?.["main.js"];

    expect(mainChunk).toBeDefined();
    expect(Object.keys(manifest?.chunks ?? {})).toHaveLength(2);
    expect(mainChunk?.isEntry).toBe(true);
    expect(manifest?.chunks?.["secondary.js"]?.isEntry).toBe(true);
    expect(manifest?.assets).toMatchInlineSnapshot(`
      {
        "icon.jpg": {
          "fileName": "icon.jpg",
          "name": "icon.jpg",
        },
        "logo.png": {
          "fileName": "logo.png",
          "name": "logo.png",
        },
      }
    `);
  });

  it("should track assets without code when withoutCode is true", async () => {
    const sharedManifest = shareManifest();

    const vol = Volume.fromJSON({
      "/main.js": `
          import logoUrl from "./assets/logo.png";
          import { helper } from "./utils.js";

          console.log("Logo URL:", logoUrl);
          export { logoUrl, helper };
        `,
      "/utils.js": `
          export const helper = () => "helper function";
        `,
      "/assets/logo.png": createPngBuffer(),
    });

    const bundle = await rollup({
      input: "/main.js",
      fs: vol.promises as RollupFsModule,
      plugins: [
        createAssetPlugin(vol),
        sharedManifest.record({ withoutCode: true }),
      ],
    });

    await bundle.generate({
      format: "es",
    });

    const manifest = sharedManifest.getManifest("0");
    const mainChunk = manifest?.chunks?.["main.js"];

    expect(mainChunk).toBeDefined();
    expect(mainChunk?.code).toBe("");
    expect(mainChunk?.imports).toHaveLength(0);
  });
});
