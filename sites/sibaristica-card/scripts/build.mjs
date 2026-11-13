import { readFile, writeFile, readdir, mkdir, rm, cp } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const sourcePath = path.resolve(root, "../../tokens.json");
const source = await readFile(sourcePath, "utf8");
const sourceSha = createHash("sha1").update(`blob ${Buffer.byteLength(source)}\0`).update(source).digest("hex");
const tokens = JSON.parse(source);
const required = [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16];
const lines = required.map((key) => {
  const value = tokens.spacing?.[key]?.$value;
  if (typeof value !== "number" || !Number.isFinite(value) || (key > 0 && value <= 0)) {
    throw new Error(`Invalid GitHub source token: spacing/${key}`);
  }
  return `  --spacing-${key}: ${value}px;`;
});
const generated = `/* Generated from verymoko/tmp/tokens.json; Git blob ${sourceSha}.\n   Run npm run build to refresh. Do not edit generated values. */\n:root {\n${lines.join("\n")}\n}\n`;
await writeFile(path.join(root, "public/tokens.generated.css"), generated);
const provenance = {
  repository: "https://github.com/verymoko/tmp",
  path: "tokens.json",
  blob: sourceSha,
  sourceUrl: "https://github.com/verymoko/tmp/blob/main/tokens.json",
  blobUrl: `https://api.github.com/repos/verymoko/tmp/git/blobs/${sourceSha}`,
  tokens: required.map((key) => `spacing/${key}`),
  figma: { fileKey: "gFlYUy3WbjTYnR5ViiC1kL", nodeId: "19108:2756" },
};
await writeFile(path.join(root, "public/tokens.provenance.json"), JSON.stringify(provenance, null, 2) + "\n");

const dist = path.join(root, "dist");
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(path.join(root, "public"), path.join(dist, "public"), { recursive: true });
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8" };
const assets = {};
async function collect(directory, prefix = "") {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    const relative = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) await collect(absolute, relative);
    else {
      const bytes = await readFile(absolute);
      assets[relative] = {
        type: types[path.extname(entry.name)] || "application/octet-stream",
        etag: `"${createHash("sha256").update(bytes).digest("hex")}"`,
        base64: bytes.toString("base64"),
      };
    }
  }
}
await collect(path.join(root, "public"));
const worker = (await readFile(path.join(root, "src/worker.mjs"), "utf8")).replace("const assets = __ASSETS__;", `const assets = ${JSON.stringify(assets)};`);
await writeFile(path.join(dist, "worker.mjs"), worker);
console.log(`Built ${Object.keys(assets).length} local files. GitHub tokens: ${sourceSha}`);
