import { readFile } from "node:fs/promises";

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
if (!accountId || !token) throw new Error("Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in your environment.");
const { script_name: name, ...metadata } = JSON.parse(await readFile(new URL("../cloudflare-deploy.json", import.meta.url), "utf8"));
const script = await readFile(new URL("../dist/worker.mjs", import.meta.url), "utf8");
const form = new FormData();
form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
form.append("worker.mjs", new Blob([script], { type: "application/javascript+module" }), "worker.mjs");
async function api(path, options = {}) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...options.headers },
  });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(`Cloudflare ${response.status}: ${JSON.stringify(data.errors)}`);
  return data.result;
}
await api(`/workers/scripts/${name}`, { method: "PUT", body: form });
await api(`/workers/scripts/${name}/subdomain`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ enabled: true }),
});
const { subdomain } = await api("/workers/subdomain");
console.log(`https://${name}.${subdomain}.workers.dev`);
