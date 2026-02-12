import fs from "node:fs";
import fsp from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const PORT = Number(process.env.PORT ?? 8080);
const HOST = process.env.HOST ?? "127.0.0.1";
const PUZZLE_COUNT = Number(process.env.PUZZLE_COUNT ?? 14);
const DEV_BUILD_PUZZLES = process.env.DEV_BUILD_PUZZLES === "true";

const watchTargets = [
  path.join(rootDir, "src"),
  path.join(rootDir, "data/raw"),
  path.join(rootDir, "tools"),
  path.join(rootDir, "index.html")
];

const mimeByExt = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon"
};

let server;
const watchers = [];
const watchedPaths = new Set();
let buildRunning = false;
let buildQueued = false;
let debounceTimer = null;

function runNode(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: rootDir,
      stdio: "inherit"
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed: node ${args.join(" ")}`));
      }
    });
  });
}

async function runBuild(reason) {
  if (buildRunning) {
    buildQueued = true;
    return;
  }

  buildRunning = true;
  const start = Date.now();

  console.log(`\n[dev] Build started (${reason})`);

  try {
    await runNode(["tools/build-dictionary.mjs"]);
    if (DEV_BUILD_PUZZLES) {
      await runNode(["tools/build-puzzles.mjs", `--count=${PUZZLE_COUNT}`]);
    } else {
      console.log("[dev] Skipping puzzle build (set DEV_BUILD_PUZZLES=true to enable).");
    }
    await runNode(["tools/check-code.mjs"]);
    const duration = Date.now() - start;
    console.log(`[dev] Build finished in ${duration}ms`);
  } catch (error) {
    console.error(`[dev] Build failed: ${error.message}`);
  } finally {
    buildRunning = false;
    if (buildQueued) {
      buildQueued = false;
      await runBuild("queued changes");
    }
  }
}

function scheduleBuild(reason) {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(() => {
    runBuild(reason);
  }, 250);
}

async function serveFile(res, absolutePath) {
  try {
    const data = await fsp.readFile(absolutePath);
    const ext = path.extname(absolutePath).toLowerCase();
    const contentType = mimeByExt[ext] ?? "application/octet-stream";

    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

function createServer() {
  return http.createServer(async (req, res) => {
    const urlPath = decodeURIComponent((req.url ?? "/").split("?")[0]);
    const requested = urlPath === "/" ? "/index.html" : urlPath;
    const normalized = path.normalize(requested).replace(/^\.{2,}(\/|\\|$)/, "");
    const absolutePath = path.join(rootDir, normalized);

    if (!absolutePath.startsWith(rootDir)) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Forbidden");
      return;
    }

    try {
      const stat = await fsp.stat(absolutePath);
      if (stat.isDirectory()) {
        await serveFile(res, path.join(absolutePath, "index.html"));
      } else {
        await serveFile(res, absolutePath);
      }
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
    }
  });
}

async function watchPath(targetPath) {
  if (watchedPaths.has(targetPath)) {
    return;
  }

  try {
    const stat = await fsp.stat(targetPath);

    if (stat.isFile()) {
      const watcher = fs.watch(targetPath, () => {
        scheduleBuild(targetPath);
      });
      watchers.push(watcher);
      watchedPaths.add(targetPath);
      return;
    }

    if (!stat.isDirectory()) {
      return;
    }

    const watcher = fs.watch(targetPath, async (_event, changedName) => {
      const changedPath = changedName ? path.join(targetPath, changedName.toString()) : targetPath;
      scheduleBuild(changedPath);

      try {
        const changedStat = await fsp.stat(changedPath);
        if (changedStat.isDirectory()) {
          await watchPath(changedPath);
        }
      } catch {
      }
    });

    watchers.push(watcher);
    watchedPaths.add(targetPath);

    const entries = await fsp.readdir(targetPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === ".git" || entry.name === "node_modules") {
        continue;
      }

      if (entry.isDirectory()) {
        await watchPath(path.join(targetPath, entry.name));
      }
    }
  } catch {
  }
}

async function startWatchers() {
  for (const target of watchTargets) {
    await watchPath(target);
  }
  console.log("[dev] Watching for changes in src/, data/raw/, tools/, and index.html");
}

async function main() {
  await runBuild("initial startup");

  server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(PORT, HOST, () => {
      server.off("error", reject);
      resolve();
    });
  });

  console.log(`[dev] Server running at http://${HOST}:${PORT}`);

  await startWatchers();
}

function shutdown() {
  for (const watcher of watchers) {
    watcher.close();
  }

  if (server) {
    server.close(() => {
      process.exit(0);
    });
    return;
  }

  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

main().catch((error) => {
  if (error && typeof error === "object" && "code" in error && error.code === "EPERM") {
    console.error(`[dev] Fatal error: could not bind to ${HOST}:${PORT}. Try a different PORT, e.g. PORT=4173 npm run dev`);
  } else if (error && typeof error === "object" && "code" in error && error.code === "EADDRINUSE") {
    console.error(`[dev] Fatal error: ${HOST}:${PORT} is already in use. Try PORT=4173 npm run dev`);
  } else {
    console.error(`[dev] Fatal error: ${error.message}`);
  }
  process.exit(1);
});
