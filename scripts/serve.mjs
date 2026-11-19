// Tiny static server for local preview of public/ (run `npm run data` first).
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../public/", import.meta.url));
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json" };
const port = process.env.PORT || 8788;

http.createServer(async (req, res) => {
  const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = normalize(join(root, p === "/" ? "index.html" : p));
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  try {
    res.writeHead(200, { "content-type": types[extname(file)] || "application/octet-stream" });
    res.end(await readFile(file));
  } catch { res.writeHead(404); res.end("Not found"); }
}).listen(port, () => console.log(`http://localhost:${port}`));
