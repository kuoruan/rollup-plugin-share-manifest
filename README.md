# rollup-plugin-share-manifest

[![npm version](https://badge.fury.io/js/rollup-plugin-share-manifest.svg)](https://badge.fury.io/js/rollup-plugin-share-manifest)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

A Rollup plugin to share manifest information between builds. This plugin allows you to record build manifest data in one bundle and access it in another, enabling advanced build coordination and optimization scenarios.

## Features

- 📦 **Cross-build manifest sharing**: Share manifest data between different Rollup builds
- 🔑 **Custom keys**: Organize manifests with custom identifiers
- 🎯 **Type-safe**: Full TypeScript support with comprehensive type definitions
- 🚀 **Virtual modules**: Access manifest data through virtual module imports
- 📊 **Detailed metadata**: Captures chunks, assets, imports, and dependency information
- 🔄 **Watch mode support**: Automatically updates shared manifests during development

## Installation

```bash
npm install rollup-plugin-share-manifest
```

```bash
pnpm add rollup-plugin-share-manifest
```

```bash
yarn add rollup-plugin-share-manifest
```

## Quick Start

### Basic Usage

```javascript
// rollup.config.js

import { shareManifest } from 'rollup-plugin-share-manifest';

// Create a shared manifest instance
const sharedManifest = shareManifest();

// In your first build (record manifest)
const clientConfig = {
  input: 'src/main.js',
  output: {
    dir: 'dist',
    format: 'es'
  },
  plugins: [
    sharedManifest.record() // Records the manifest
  ]
};

// In your second build (access manifest)
const serverConfig = {
  input: 'src/server.js',
  output: {
    dir: 'dist-server',
    format: 'cjs'
  },
  plugins: [
    sharedManifest.provide() // Provides access to the manifest
  ]
};

export default [clientConfig, serverConfig];
```

### Accessing Manifest Data

```javascript
// Import the entire manifest
import manifest from 'virtual:shared-manifest';

// Access chunks and assets
console.log(manifest.chunks); // All chunks information
console.log(manifest.assets); // All assets information
```

## API Reference

### `shareManifest()`

Creates a new shared manifest instance.

```javascript
const sharedManifest = shareManifest();
```

### `record(options?)`

Creates a Rollup plugin that records manifest data during the build process.

#### Options

- `key?: string` - Custom key to identify this manifest
- `withoutCode?: boolean` - Exclude chunk code from the manifest (default: `false`)

```javascript
// Basic recording
sharedManifest.record()

// With custom key
sharedManifest.record({ key: 'client-build' })

// Without chunk code (for smaller manifest size)
sharedManifest.record({ withoutCode: true })
```

### `provide(options?)`

Creates a Rollup plugin that provides access to recorded manifests through virtual modules.

```javascript
sharedManifest.provide()
```

## Virtual Module Imports

### Import entire manifest

```javascript
import manifest from 'virtual:shared-manifest';
// Returns: { chunks: {...}, assets: {...} }
```

> This import provides access to the first recorded manifest (key "0"). If you have multiple builds, use `virtual:shared-manifests/my-key` to access specific manifests.

### Import specific manifest by key

```javascript
import manifest from 'virtual:shared-manifests/my-key';
// Returns: { chunks: {...}, assets: {...} } for the specified key
```

### Import specific manifest type

```javascript
import chunks from 'virtual:shared-manifests/my-key/chunks';
// Returns: { [fileName]: ManifestChunk, ... }

import assets from 'virtual:shared-manifests/my-key/assets';
// Returns: { [fileName]: ManifestAsset, ... }
```

## Programmatic API

### `getManifests()`

Retrieves all recorded manifests.

```javascript
const allManifests = sharedManifest.getManifests();
// Returns: { [key]: Manifest, ... }
```

### `getManifest(key?, type?)`

Retrieves a specific manifest or manifest type.

```javascript
// Get entire manifest by key
const manifest = sharedManifest.getManifest('my-key');

// Get specific type
const chunks = sharedManifest.getManifest('my-key', 'chunks');
const assets = sharedManifest.getManifest('my-key', 'assets');

// Get default manifest (key "0")
const defaultManifest = sharedManifest.getManifest();
```

## Advanced Usage

### Multiple Builds with Different Keys

```javascript
// rollup.config.js

import { shareManifest } from 'rollup-plugin-share-manifest';

const sharedManifest = shareManifest();

// Client build configuration
const clientConfig = {
  input: 'src/client/main.js',
  output: { dir: 'dist/client', format: 'es' },
  plugins: [
    sharedManifest.record({ key: 'client' })
  ]
};

// Server build configuration
const serverConfig = {
  input: 'src/server/main.js',
  output: { dir: 'dist/server', format: 'cjs' },
  plugins: [
    sharedManifest.record({ key: 'server' })
  ]
};

// Analysis build that uses both manifests
const analysisConfig = {
  input: 'src/analysis/main.js',
  output: { dir: 'dist/analysis', format: 'es' },
  plugins: [
    sharedManifest.provide()
  ]
};

export default [clientConfig, serverConfig, analysisConfig];
```

```javascript
// In analysis/main.js
import clientManifest from 'virtual:shared-manifests/client';
import serverManifest from 'virtual:shared-manifests/server';

console.log('Client chunks:', Object.keys(clientManifest.chunks));
console.log('Server chunks:', Object.keys(serverManifest.chunks));
```

### Server-Side Rendering (SSR) Example

```javascript
// rollup.config.js

// Build client bundle first
const clientConfig = {
  input: 'src/client.js',
  output: { dir: 'dist/client', format: 'es' },
  plugins: [
    sharedManifest.record({ key: 'client' })
  ]
};

// Build server bundle with access to client manifest
const serverConfig = {
  input: 'src/server.js',
  output: { dir: 'dist/server', format: 'cjs' },
  plugins: [
    sharedManifest.provide()
  ]
};

export default [clientConfig, serverConfig];
```

```javascript
// In server.js
import clientManifest from 'virtual:shared-manifests/client';

// Generate HTML with proper asset links
function renderHTML(content) {
  const chunks = Object.values(clientManifest.chunks);
  const entryChunk = chunks.find(chunk => chunk.isEntry);

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <script type="module" src="/${entryChunk.fileName}"></script>
      </head>
      <body>${content}</body>
    </html>
  `;
}
```

## Manifest Data Structure

The manifest contains detailed information about your build:

```typescript
interface Manifest {
  chunks: {
    [fileName: string]: {
      name: string;
      fileName: string;
      isEntry: boolean;
      isDynamicEntry: boolean;
      format: 'es' | 'cjs' | 'umd' | 'iife' | 'system';
      imports: ChunkImport[];
      dynamicImports: ChunkImport[];
      exports: string[];
      code: string; // Only if withoutCode is false
    }
  };
  assets: {
    [fileName: string]: {
      name: string;
      fileName: string;
    }
  };
}
```

### Import Types

The plugin categorizes imports into different types:

- **`local`**: Imports from your own code/chunks
- **`third-party`**: Imports from npm packages
- **`global`**: Imports that are externalized as globals
- **`builtin`**: Node.js built-in modules

## Use Cases

1. **Server-Side Rendering**: Access client build information in your SSR setup
2. **Micro-frontends**: Share manifest data between different applications
3. **Build Analysis**: Analyze dependencies and chunk relationships across builds
4. **Asset Optimization**: Coordinate asset loading strategies between builds
5. **Development Tools**: Build development tools that need build metadata

## Requirements

- Node.js >= 18.6.0
- Rollup >= 4.0.0

## TypeScript Support

If you are using TypeScript, the virtual module imports and manifest types are fully typed.

You can import types as needed:

```typescript
import type { Manifest, ManifestChunk, ChunkImport } from 'rollup-plugin-share-manifest';
```

Add virtual module types to your TypeScript configuration:

```typescript
/// <reference types="rollup-plugin-share-manifest/types" />
```
