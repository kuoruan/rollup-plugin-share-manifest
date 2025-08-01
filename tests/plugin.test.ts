import { Volume } from "memfs";
import { type RollupFsModule, rollup } from "rollup";
import shareManifest from "@/plugin.js";

describe("shareManifest plugin integration tests", () => {
  describe("basic functionality", () => {
    it("should return an object with record and provide methods", () => {
      const plugin = shareManifest();

      expect(plugin).toBeTypeOf("object");
      expect(plugin).toHaveProperty("record");
      expect(plugin).toHaveProperty("provide");
      expect(plugin).toHaveProperty("getManifests");
      expect(plugin).toHaveProperty("getManifest");
      expect(typeof plugin.record).toBe("function");
      expect(typeof plugin.provide).toBe("function");
      expect(typeof plugin.getManifests).toBe("function");
      expect(typeof plugin.getManifest).toBe("function");
    });

    it("should create record plugin with correct properties", () => {
      const sharedManifest = shareManifest();
      const recordPlugin = sharedManifest.record();

      expect(recordPlugin).toBeTypeOf("object");
      expect(recordPlugin.name).toBe("share-manifest:record");
      expect(recordPlugin).toHaveProperty("buildStart");
      expect(recordPlugin).toHaveProperty("generateBundle");
    });

    it("should create provide plugin with correct properties", () => {
      const sharedManifest = shareManifest();
      const providePlugin = sharedManifest.provide();

      expect(providePlugin).toBeTypeOf("object");
      expect(providePlugin.name).toBe("share-manifest:provide");
      expect(providePlugin).toHaveProperty("resolveId");
      expect(providePlugin).toHaveProperty("load");
      expect(providePlugin).toHaveProperty("transform");
    });
  });

  describe("record and provide plugins", () => {
    it("should record and provide plugins correctly", async () => {
      const sharedManifest = shareManifest();

      const vol = Volume.fromJSON({
        "/record.js": `export const foo = "bar";`,
        "/provide.js": `
        import manifest from "virtual:shared-manifest";
        export default manifest;
        `,
      });

      const recordBundle = await rollup({
        input: "/record.js",
        fs: vol.promises as RollupFsModule,
        plugins: [sharedManifest.record()],
      });

      await recordBundle.generate({
        format: "es",
      });

      const provideBundle = await rollup({
        input: "/provide.js",
        fs: vol.promises as RollupFsModule,
        plugins: [sharedManifest.provide()],
      });

      const { output } = await provideBundle.generate({
        format: "es",
      });

      expect(output).toHaveLength(1);
      expect(output[0].code).toContain("record.js");
    });

    it("should work with custom keys", async () => {
      const sharedManifest = shareManifest();

      const vol = Volume.fromJSON({
        "/record.js": `export const foo = "bar";`,
        "/provide.js": `
        import manifest from "virtual:shared-manifests/my-key";
        export default manifest;
        `,
      });

      const recordBundle = await rollup({
        input: "/record.js",
        fs: vol.promises as RollupFsModule,
        plugins: [sharedManifest.record({ key: "my-key" })],
      });

      await recordBundle.generate({
        format: "es",
      });

      const provideBundle = await rollup({
        input: "/provide.js",
        fs: vol.promises as RollupFsModule,
        plugins: [sharedManifest.provide()],
      });

      const { output } = await provideBundle.generate({
        format: "es",
      });

      expect(output).toHaveLength(1);
      expect(output[0].code).toContain("record.js");
    });

    it("should provide chunks only when requested", async () => {
      const sharedManifest = shareManifest();

      const vol = Volume.fromJSON({
        "/record.js": `export const foo = "bar";`,
        "/provide.js": `
        import manifest from "virtual:shared-manifest/chunks";
        export default manifest;
        `,
      });

      const recordBundle = await rollup({
        input: "/record.js",
        fs: vol.promises as RollupFsModule,
        plugins: [sharedManifest.record()],
      });

      await recordBundle.generate({
        format: "es",
      });

      const provideBundle = await rollup({
        input: "/provide.js",
        fs: vol.promises as RollupFsModule,
        plugins: [sharedManifest.provide()],
      });

      const { output } = await provideBundle.generate({
        format: "es",
      });

      expect(output).toHaveLength(1);
      expect(output[0].code).toContain("record.js");
    });

    it("should provide assets only when requested", async () => {
      const sharedManifest = shareManifest();

      const vol = Volume.fromJSON({
        "/record.js": `export const foo = "bar";`,
        "/provide.js": `
        import manifest from "virtual:shared-manifest/assets";
        export default manifest;
        `,
      });

      const recordBundle = await rollup({
        input: "/record.js",
        fs: vol.promises as RollupFsModule,
        plugins: [sharedManifest.record()],
      });

      await recordBundle.generate({
        format: "es",
      });

      const provideBundle = await rollup({
        input: "/provide.js",
        fs: vol.promises as RollupFsModule,
        plugins: [sharedManifest.provide()],
      });

      const { output } = await provideBundle.generate({
        format: "es",
      });

      expect(output).toHaveLength(1);
      expect(output[0].code).toContain("{}");
    });
  });

  describe("manifest retrieval methods", () => {
    it("should retrieve all manifests", async () => {
      const sharedManifest = shareManifest();

      const vol = Volume.fromJSON({
        "/record1.js": `export const foo = "bar";`,
        "/record2.js": `export const baz = "qux";`,
      });

      // Record first manifest
      const recordBundle1 = await rollup({
        input: "/record1.js",
        fs: vol.promises as RollupFsModule,
        plugins: [sharedManifest.record({ key: "first" })],
      });
      await recordBundle1.generate({ format: "es" });

      // Record second manifest
      const recordBundle2 = await rollup({
        input: "/record2.js",
        fs: vol.promises as RollupFsModule,
        plugins: [sharedManifest.record({ key: "second" })],
      });
      await recordBundle2.generate({ format: "es" });

      const manifests = sharedManifest.getManifests();
      expect(Object.keys(manifests)).toHaveLength(2);
      // Should contain custom keys, not internal keys
      expect(manifests).toHaveProperty("first");
      expect(manifests).toHaveProperty("second");
      expect(manifests).not.toHaveProperty("0");
      expect(manifests).not.toHaveProperty("1");
    });

    it("should retrieve specific manifest by key", async () => {
      const sharedManifest = shareManifest();

      const vol = Volume.fromJSON({
        "/record.js": `export const foo = "bar";`,
      });

      const recordBundle = await rollup({
        input: "/record.js",
        fs: vol.promises as RollupFsModule,
        plugins: [sharedManifest.record({ key: "test-key" })],
      });
      await recordBundle.generate({ format: "es" });

      const manifest = sharedManifest.getManifest("test-key");
      expect(manifest).toBeTruthy();
      expect(manifest).toHaveProperty("chunks");
      expect(manifest).toHaveProperty("assets");
    });

    it("should retrieve specific manifest chunks by key", async () => {
      const sharedManifest = shareManifest();

      const vol = Volume.fromJSON({
        "/record.js": `export const foo = "bar";`,
      });

      const recordBundle = await rollup({
        input: "/record.js",
        fs: vol.promises as RollupFsModule,
        plugins: [sharedManifest.record({ key: "test-key" })],
      });
      await recordBundle.generate({ format: "es" });

      const chunks = sharedManifest.getManifest("test-key", "chunks");
      expect(chunks).toBeTruthy();
      if (chunks) {
        expect(Object.keys(chunks)).toHaveLength(1);
        expect(Object.values(chunks)[0]).toHaveProperty("fileName");
      }
    });

    it("should retrieve specific manifest assets by key", async () => {
      const sharedManifest = shareManifest();

      const vol = Volume.fromJSON({
        "/record.js": `export const foo = "bar";`,
      });

      const recordBundle = await rollup({
        input: "/record.js",
        fs: vol.promises as RollupFsModule,
        plugins: [sharedManifest.record({ key: "test-key" })],
      });
      await recordBundle.generate({ format: "es" });

      const assets = sharedManifest.getManifest("test-key", "assets");
      expect(assets).toEqual({});
    });

    it("should return null for non-existent manifest", () => {
      const sharedManifest = shareManifest();

      const manifest = sharedManifest.getManifest("non-existent");
      expect(manifest).toBeNull();
    });

    it("should return null for non-existent manifest type", async () => {
      const sharedManifest = shareManifest();

      const vol = Volume.fromJSON({
        "/record.js": `export const foo = "bar";`,
      });

      const recordBundle = await rollup({
        input: "/record.js",
        fs: vol.promises as RollupFsModule,
        plugins: [sharedManifest.record({ key: "test-key" })],
      });
      await recordBundle.generate({ format: "es" });

      const result = sharedManifest.getManifest("non-existent", "chunks");
      expect(result).toBeNull();
    });

    it("should return deep cloned manifest objects", async () => {
      const sharedManifest = shareManifest();

      const vol = Volume.fromJSON({
        "/record.js": `export const foo = "bar";`,
      });

      const recordBundle = await rollup({
        input: "/record.js",
        fs: vol.promises as RollupFsModule,
        plugins: [sharedManifest.record({ key: "test-key" })],
      });
      await recordBundle.generate({ format: "es" });

      const manifest1 = sharedManifest.getManifest("test-key");
      const manifest2 = sharedManifest.getManifest("test-key");

      // Should be different objects (deep cloned)
      expect(manifest1).not.toBe(manifest2);
      // But with same content
      expect(manifest1).toEqual(manifest2);

      // Modifying one should not affect the other
      if (manifest1) {
        manifest1.chunks = {};
        expect(manifest2?.chunks).not.toEqual({});
      }
    });

    it("should return deep cloned manifests from getManifests", async () => {
      const sharedManifest = shareManifest();

      const vol = Volume.fromJSON({
        "/record.js": `export const foo = "bar";`,
      });

      const recordBundle = await rollup({
        input: "/record.js",
        fs: vol.promises as RollupFsModule,
        plugins: [sharedManifest.record({ key: "test-key" })],
      });
      await recordBundle.generate({ format: "es" });

      const manifests1 = sharedManifest.getManifests();
      const manifests2 = sharedManifest.getManifests();

      // Should be different objects (deep cloned)
      expect(manifests1).not.toBe(manifests2);
      // But with same content
      expect(manifests1).toEqual(manifests2);

      // Modifying one should not affect the other
      manifests1["test-key"].chunks = {};
      expect(manifests2["test-key"].chunks).not.toEqual({});
    });

    it("should handle mixed custom keys and auto-generated keys in getManifests", async () => {
      const sharedManifest = shareManifest();

      const vol = Volume.fromJSON({
        "/record1.js": `export const foo = "bar";`,
        "/record2.js": `export const baz = "qux";`,
        "/record3.js": `export const test = "value";`,
      });

      // Record with custom key
      const recordBundle1 = await rollup({
        input: "/record1.js",
        fs: vol.promises as RollupFsModule,
        plugins: [sharedManifest.record({ key: "custom" })],
      });
      await recordBundle1.generate({ format: "es" });

      // Record without custom key (auto-generated)
      const recordBundle2 = await rollup({
        input: "/record2.js",
        fs: vol.promises as RollupFsModule,
        plugins: [sharedManifest.record()],
      });
      await recordBundle2.generate({ format: "es" });

      // Record with another custom key
      const recordBundle3 = await rollup({
        input: "/record3.js",
        fs: vol.promises as RollupFsModule,
        plugins: [sharedManifest.record({ key: "another" })],
      });
      await recordBundle3.generate({ format: "es" });

      const manifests = sharedManifest.getManifests();

      // Should contain custom keys and auto-generated key
      expect(Object.keys(manifests)).toHaveLength(3);
      expect(manifests).toHaveProperty("custom");
      expect(manifests).toHaveProperty("another");
      expect(manifests).toHaveProperty("1"); // auto-generated key for second record

      // Should not contain internal keys that have custom aliases
      expect(manifests).not.toHaveProperty("0"); // has custom key "custom"
      expect(manifests).not.toHaveProperty("2"); // has custom key "another"
    });

    it("should handle edge case when custom key equals manifest key", async () => {
      const sharedManifest = shareManifest();

      const vol = Volume.fromJSON({
        "/record.js": `export const foo = "bar";`,
      });

      // Use "0" as custom key, which would equal the auto-generated key
      const recordBundle = await rollup({
        input: "/record.js",
        fs: vol.promises as RollupFsModule,
        plugins: [sharedManifest.record({ key: "0" })],
      });
      await recordBundle.generate({ format: "es" });

      const manifests = sharedManifest.getManifests();
      expect(Object.keys(manifests)).toHaveLength(1);
      expect(manifests).toHaveProperty("0");

      const manifest = sharedManifest.getManifest("0");
      expect(manifest).toBeTruthy();
    });
  });

  describe("virtual module integration", () => {
    it("should work with virtual:shared-manifests/key import", async () => {
      const sharedManifest = shareManifest();

      const vol = Volume.fromJSON({
        "/record.js": `export const foo = "bar";`,
        "/provide.js": `
        import manifest from "virtual:shared-manifests/my-key";
        export default manifest;
        `,
      });

      const recordBundle = await rollup({
        input: "/record.js",
        fs: vol.promises as RollupFsModule,
        plugins: [sharedManifest.record({ key: "my-key" })],
      });

      await recordBundle.generate({
        format: "es",
      });

      const provideBundle = await rollup({
        input: "/provide.js",
        fs: vol.promises as RollupFsModule,
        plugins: [sharedManifest.provide()],
      });

      const { output } = await provideBundle.generate({
        format: "es",
      });

      expect(output).toHaveLength(1);
      expect(output[0].code).toContain("record.js");
    });

    it("should work with virtual:shared-manifests base import", async () => {
      const sharedManifest = shareManifest();

      const vol = Volume.fromJSON({
        "/record.js": `export const foo = "bar";`,
        "/provide.js": `
        import manifests from "virtual:shared-manifests";
        export default manifests;
        `,
      });

      const recordBundle = await rollup({
        input: "/record.js",
        fs: vol.promises as RollupFsModule,
        plugins: [sharedManifest.record()],
      });

      await recordBundle.generate({
        format: "es",
      });

      const provideBundle = await rollup({
        input: "/provide.js",
        fs: vol.promises as RollupFsModule,
        plugins: [sharedManifest.provide()],
      });

      const { output } = await provideBundle.generate({
        format: "es",
      });

      expect(output).toHaveLength(1);
      expect(output[0].code).toContain("record.js");
    });

    it("should work with virtual:shared-manifests/key/chunks import", async () => {
      const sharedManifest = shareManifest();

      const vol = Volume.fromJSON({
        "/record.js": `export const foo = "bar";`,
        "/provide.js": `
        import chunks from "virtual:shared-manifests/my-key/chunks";
        export default chunks;
        `,
      });

      const recordBundle = await rollup({
        input: "/record.js",
        fs: vol.promises as RollupFsModule,
        plugins: [sharedManifest.record({ key: "my-key" })],
      });

      await recordBundle.generate({
        format: "es",
      });

      const provideBundle = await rollup({
        input: "/provide.js",
        fs: vol.promises as RollupFsModule,
        plugins: [sharedManifest.provide()],
      });

      const { output } = await provideBundle.generate({
        format: "es",
      });

      expect(output).toHaveLength(1);
      expect(output[0].code).toContain("record.js");
      expect(output[0].code).toContain("fileName");
      expect(output[0].code).toContain("isEntry");
    });

    it("should work with virtual:shared-manifests/key/assets import", async () => {
      const sharedManifest = shareManifest();

      const vol = Volume.fromJSON({
        "/record.js": `export const foo = "bar";`,
        "/provide.js": `
        import assets from "virtual:shared-manifests/my-key/assets";
        export default assets;
        `,
      });

      const recordBundle = await rollup({
        input: "/record.js",
        fs: vol.promises as RollupFsModule,
        plugins: [sharedManifest.record({ key: "my-key" })],
      });

      await recordBundle.generate({
        format: "es",
      });

      const provideBundle = await rollup({
        input: "/provide.js",
        fs: vol.promises as RollupFsModule,
        plugins: [sharedManifest.provide()],
      });

      const { output } = await provideBundle.generate({
        format: "es",
      });

      expect(output).toHaveLength(1);
      expect(output[0].code).toContain("{}");
    });

    it("should handle multiple manifests with different keys", async () => {
      const sharedManifest = shareManifest();

      const vol = Volume.fromJSON({
        "/record1.js": `export const foo = "bar";`,
        "/record2.js": `export const baz = "qux";`,
        "/provide.js": `
        import manifest1 from "virtual:shared-manifests/key1";
        import manifest2 from "virtual:shared-manifests/key2";
        export { manifest1, manifest2 };
        `,
      });

      // Record first manifest
      const recordBundle1 = await rollup({
        input: "/record1.js",
        fs: vol.promises as RollupFsModule,
        plugins: [sharedManifest.record({ key: "key1" })],
      });
      await recordBundle1.generate({ format: "es" });

      // Record second manifest
      const recordBundle2 = await rollup({
        input: "/record2.js",
        fs: vol.promises as RollupFsModule,
        plugins: [sharedManifest.record({ key: "key2" })],
      });
      await recordBundle2.generate({ format: "es" });

      const provideBundle = await rollup({
        input: "/provide.js",
        fs: vol.promises as RollupFsModule,
        plugins: [sharedManifest.provide()],
      });

      const { output } = await provideBundle.generate({
        format: "es",
      });

      expect(output).toHaveLength(1);
      expect(output[0].code).toContain("record1.js");
      expect(output[0].code).toContain("record2.js");
    });

    it("should return null for non-existent key in virtual:shared-manifests", async () => {
      const sharedManifest = shareManifest();

      const vol = Volume.fromJSON({
        "/provide.js": `
        import manifest from "virtual:shared-manifests/non-existent-key";
        export default manifest;
        `,
      });

      const provideBundle = await rollup({
        input: "/provide.js",
        fs: vol.promises as RollupFsModule,
        plugins: [sharedManifest.provide()],
      });

      const { output } = await provideBundle.generate({
        format: "es",
      });

      expect(output).toHaveLength(1);
      expect(output[0].code).toContain("null");
    });

    it("should handle numeric keys in virtual:shared-manifests", async () => {
      const sharedManifest = shareManifest();

      const vol = Volume.fromJSON({
        "/record.js": `export const foo = "bar";`,
        "/provide.js": `
        import manifest from "virtual:shared-manifests/123";
        export default manifest;
        `,
      });

      const recordBundle = await rollup({
        input: "/record.js",
        fs: vol.promises as RollupFsModule,
        plugins: [sharedManifest.record({ key: "123" })],
      });

      await recordBundle.generate({
        format: "es",
      });

      const provideBundle = await rollup({
        input: "/provide.js",
        fs: vol.promises as RollupFsModule,
        plugins: [sharedManifest.provide()],
      });

      const { output } = await provideBundle.generate({
        format: "es",
      });

      expect(output).toHaveLength(1);
      expect(output[0].code).toContain("record.js");
    });

    it("should handle special characters in keys", async () => {
      const sharedManifest = shareManifest();

      const vol = Volume.fromJSON({
        "/record.js": `export const foo = "bar";`,
        "/provide.js": `
        import manifest from "virtual:shared-manifests/my-special_key.v1";
        export default manifest;
        `,
      });

      const recordBundle = await rollup({
        input: "/record.js",
        fs: vol.promises as RollupFsModule,
        plugins: [sharedManifest.record({ key: "my-special_key.v1" })],
      });

      await recordBundle.generate({
        format: "es",
      });

      const provideBundle = await rollup({
        input: "/provide.js",
        fs: vol.promises as RollupFsModule,
        plugins: [sharedManifest.provide()],
      });

      const { output } = await provideBundle.generate({
        format: "es",
      });

      expect(output).toHaveLength(1);
      expect(output[0].code).toContain("record.js");
    });

    it("should work with destructured imports from virtual:shared-manifests", async () => {
      const sharedManifest = shareManifest();

      const vol = Volume.fromJSON({
        "/record.js": `export const foo = "bar";`,
        "/provide.js": `
        import manifests from "virtual:shared-manifests";
        const { 0: defaultManifest } = manifests;
        export default defaultManifest;
        `,
      });

      const recordBundle = await rollup({
        input: "/record.js",
        fs: vol.promises as RollupFsModule,
        plugins: [sharedManifest.record()],
      });

      await recordBundle.generate({
        format: "es",
      });

      const provideBundle = await rollup({
        input: "/provide.js",
        fs: vol.promises as RollupFsModule,
        plugins: [sharedManifest.provide()],
      });

      const { output } = await provideBundle.generate({
        format: "es",
      });

      expect(output).toHaveLength(1);
      expect(output[0].code).toContain("record.js");
    });

    it("should work with mixed virtual imports in same file", async () => {
      const sharedManifest = shareManifest();

      const vol = Volume.fromJSON({
        "/record.js": `export const foo = "bar";`,
        "/provide.js": `
        import allManifests from "virtual:shared-manifests";
        import specificManifest from "virtual:shared-manifests/0";
        import chunks from "virtual:shared-manifests/0/chunks";
        import assets from "virtual:shared-manifests/0/assets";

        export { allManifests, specificManifest, chunks, assets };
        `,
      });

      const recordBundle = await rollup({
        input: "/record.js",
        fs: vol.promises as RollupFsModule,
        plugins: [sharedManifest.record()],
      });

      await recordBundle.generate({
        format: "es",
      });

      const provideBundle = await rollup({
        input: "/provide.js",
        fs: vol.promises as RollupFsModule,
        plugins: [sharedManifest.provide()],
      });

      const { output } = await provideBundle.generate({
        format: "es",
      });

      expect(output).toHaveLength(1);
      expect(output[0].code).toContain("record.js");
      expect(output[0].code).toContain("allManifests");
      expect(output[0].code).toContain("specificManifest");
      expect(output[0].code).toContain("chunks");
      expect(output[0].code).toContain("assets");
    });
  });

  describe("error handling and edge cases", () => {
    it("should handle empty manifests", () => {
      const sharedManifest = shareManifest();

      const manifests = sharedManifest.getManifests();
      expect(manifests).toEqual({});
    });

    it("should throw error when using same key multiple times", async () => {
      const sharedManifest = shareManifest();

      sharedManifest.record({ key: "same-key" });

      // Second record with same key should throw error
      expect(() => {
        sharedManifest.record({ key: "same-key" });
      }).toThrow(
        '[share-manifest] key "same-key" is already used, please use a different key.',
      );
    });

    it("should handle non-string keys by converting to string", async () => {
      const sharedManifest = shareManifest();

      const vol = Volume.fromJSON({
        "/record1.js": `export const foo = "bar";`,
        "/record2.js": `export const baz = "qux";`,
      });

      // Test with number key (casting to unknown first to bypass TypeScript)
      const recordBundle1 = await rollup({
        input: "/record1.js",
        fs: vol.promises as RollupFsModule,
        plugins: [sharedManifest.record({ key: 123 })],
      });
      await recordBundle1.generate({ format: "es" });

      // Test with boolean key
      const recordBundle2 = await rollup({
        input: "/record2.js",
        fs: vol.promises as RollupFsModule,
        plugins: [sharedManifest.record({ key: true })],
      });
      await recordBundle2.generate({ format: "es" });

      const manifests = sharedManifest.getManifests();
      expect(manifests).toHaveProperty("123");
      expect(manifests).toHaveProperty("true");

      const manifest1 = sharedManifest.getManifest("123");
      const manifest2 = sharedManifest.getManifest("true");
      expect(manifest1).toBeTruthy();
      expect(manifest2).toBeTruthy();
    });

    it("should throw error when converted keys are duplicate", async () => {
      const sharedManifest = shareManifest();

      sharedManifest.record({ key: 123 });

      // Second record with string version of same key should throw error
      expect(() => {
        sharedManifest.record({ key: "123" });
      }).toThrow(
        '[share-manifest] key "123" is already used, please use a different key.',
      );
    });

    it("should handle different shareManifest instances independently", async () => {
      const sharedManifest1 = shareManifest();
      const sharedManifest2 = shareManifest();

      const vol = Volume.fromJSON({
        "/record1.js": `export const foo = "bar";`,
        "/record2.js": `export const baz = "qux";`,
      });

      // Both instances should be able to use the same key independently
      const recordBundle1 = await rollup({
        input: "/record1.js",
        fs: vol.promises as RollupFsModule,
        plugins: [sharedManifest1.record({ key: "same-key" })],
      });
      await recordBundle1.generate({ format: "es" });

      const recordBundle2 = await rollup({
        input: "/record2.js",
        fs: vol.promises as RollupFsModule,
        plugins: [sharedManifest2.record({ key: "same-key" })],
      });
      await recordBundle2.generate({ format: "es" });

      const manifest1 = sharedManifest1.getManifest("same-key");
      const manifest2 = sharedManifest2.getManifest("same-key");

      expect(manifest1).toBeTruthy();
      expect(manifest2).toBeTruthy();
      expect(manifest1).not.toBe(manifest2);
    });

    it("should handle empty string keys", async () => {
      const sharedManifest = shareManifest();

      const vol = Volume.fromJSON({
        "/record.js": `export const foo = "bar";`,
      });

      // Empty string is treated as falsy, so no custom key is set
      const recordBundle = await rollup({
        input: "/record.js",
        fs: vol.promises as RollupFsModule,
        plugins: [sharedManifest.record({ key: "" })],
      });
      await recordBundle.generate({ format: "es" });

      // Empty string key should return manifest
      const manifest = sharedManifest.getManifest("");
      expect(manifest).toBeTruthy();

      // Empty string key should return manifest
      const emptyKeyManifest = sharedManifest.getManifest("");
      expect(emptyKeyManifest).toBeTruthy();
    });

    it("should handle imports with query parameters correctly", async () => {
      const sharedManifest = shareManifest();

      const vol = Volume.fromJSON({
        "/record.js": `
          import React from "react?esm";
          export const component = React.createElement("div");
        `,
      });

      const recordBundle = await rollup({
        input: "/record.js",
        fs: vol.promises as RollupFsModule,
        plugins: [sharedManifest.record()],
        external: ["react?esm"],
      });

      await recordBundle.generate({
        format: "es",
      });

      const manifests = sharedManifest.getManifests();
      const manifest = Object.values(manifests)[0];
      const chunk = Object.values(manifest.chunks)[0];

      expect(chunk.imports).toHaveLength(1);
      expect(chunk.imports[0]).toEqual({
        importName: "react?esm",
        importType: "third-party",
        packageName: "react",
      });
    });
  });
});
