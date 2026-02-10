import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const includeDirs = ["src", "tools", "tests"];
const includeExt = new Set([".js", ".mjs"]);

async function collectFiles(baseDir) {
  const files = [];

  async function walk(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === ".git") {
        continue;
      }

      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }

      if (includeExt.has(path.extname(entry.name))) {
        files.push(fullPath);
      }
    }
  }

  await walk(baseDir);
  return files;
}

function runNodeCheck(filePath) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--check", filePath], {
      stdio: "inherit"
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Syntax check failed: ${filePath}`));
      }
    });
  });
}

async function main() {
  const files = [];
  for (const dir of includeDirs) {
    const absolute = path.join(rootDir, dir);
    try {
      await fs.access(absolute);
    } catch {
      continue;
    }
    files.push(...(await collectFiles(absolute)));
  }

  for (const filePath of files) {
    await runNodeCheck(filePath);
  }

  console.log(`Code check complete. files=${files.length}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
