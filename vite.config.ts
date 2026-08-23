import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import path from "path"
import fs from "fs"

// Vite 8 uses Rolldown as its bundler, which wraps CommonJS files in arrow-function
// factories. Since arrow functions don't create a `var` scope, any `var` declarations
// inside them escape to module scope. This causes minifiers to rename those vars to
// the same single-letter names already used at module level, producing runtime crashes
// like `var t = t()` where `t` is undefined (hoisted but not yet assigned).
//
// recharts imports `es-toolkit/compat/*` sub-paths that resolve to CJS entry stubs
// (e.g. `compat/get.js` → `require('../dist/compat/object/get.js')`). This plugin
// intercepts those imports and redirects them to the proper `.mjs` ESM files,
// eliminating the CJS wrapper entirely.
function esToolkitEsmPlugin() {
  const virtualPrefix = "\0es-toolkit-esm/"
  const shimMap = new Map<string, string>()

  return {
    name: "es-toolkit-esm-compat",
    enforce: "pre" as const,
    resolveId(id: string) {
      const match = id.match(/^es-toolkit\/compat\/(.+)$/)
      if (!match) return
      const name = match[1]
      const stubPath = path.resolve(__dirname, `node_modules/es-toolkit/compat/${name}.js`)
      if (!fs.existsSync(stubPath)) return
      const stub = fs.readFileSync(stubPath, "utf-8")
      // e.g. module.exports = require('../dist/compat/object/get.js').get
      const requireMatch = stub.match(/require\(['"](\.\.[^'"]+)\.js['"]\)\.(\w+)/)
      if (!requireMatch) return
      const mjsPath = path.resolve(path.dirname(stubPath), requireMatch[1] + ".mjs")
      if (!fs.existsSync(mjsPath)) return
      // Store the shim content and return a virtual ID
      const exportName = requireMatch[2]
      shimMap.set(name, `export { ${exportName} as default } from ${JSON.stringify(mjsPath)};\n`)
      return `${virtualPrefix}${name}`
    },
    load(id: string) {
      if (!id.startsWith(virtualPrefix)) return
      return shimMap.get(id.slice(virtualPrefix.length))
    },
  }
}

const { version } = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "package.json"), "utf-8")
) as { version: string }

export default defineConfig({
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(version),
  },
  plugins: [esToolkitEsmPlugin(), react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src/views"),
    },
  },
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
  },
})
