import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const rootDir = process.cwd();
const srcDir = path.join(rootDir, "src");

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "next/server") {
    return {
      shortCircuit: true,
      url: pathToFileURL(path.join(rootDir, "node_modules", "next", "server.js")).href,
    };
  }

  if (specifier.startsWith("@/")) {
    const relativePath = specifier.slice(2);
    const resolvedPath = path.join(srcDir, relativePath);
    for (const ext of ["", ".ts", ".js", "/index.ts", "/index.js"]) {
      const candidate = resolvedPath + ext;
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return {
          shortCircuit: true,
          url: pathToFileURL(candidate).href,
        };
      }
    }
  }

  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    if (context.parentURL && context.parentURL.startsWith("file:")) {
      const parentDir = path.dirname(fileURLToPath(context.parentURL));
      const resolvedPath = path.resolve(parentDir, specifier);
      for (const ext of ["", ".ts", ".js", "/index.ts", "/index.js"]) {
        const candidate = resolvedPath + ext;
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
          return {
            shortCircuit: true,
            url: pathToFileURL(candidate).href,
          };
        }
      }
    }
  }

  const result = await nextResolve(specifier, context);
  return {
    ...result,
    shortCircuit: true,
  };
}
