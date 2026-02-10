import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const sourcesDir = path.join(rootDir, "data/raw/sources");
const cacheDir = path.join(sourcesDir, ".cache");
const scowlRepoDir = path.join(cacheDir, "en-wl-wordlist");
const venvDir = path.join(sourcesDir, ".venv-wordfreq");

const scowlTarget = path.join(sourcesDir, "scowl.txt");
const wordfreqTarget = path.join(sourcesDir, "wordfreq.tsv");

function parseArgs(argv) {
  const parsed = {
    scowlSize: "60",
    region: "A",
    spellingLevel: "1",
    categories: "",
    python: process.env.PYTHON || "python3",
    forceReclone: false
  };

  for (const arg of argv) {
    if (arg.startsWith("--scowl-size=")) {
      parsed.scowlSize = arg.slice("--scowl-size=".length);
    } else if (arg.startsWith("--region=")) {
      parsed.region = arg.slice("--region=".length);
    } else if (arg.startsWith("--spelling-level=")) {
      parsed.spellingLevel = arg.slice("--spelling-level=".length);
    } else if (arg.startsWith("--categories=")) {
      parsed.categories = arg.slice("--categories=".length);
    } else if (arg.startsWith("--python=")) {
      parsed.python = arg.slice("--python=".length);
    } else if (arg === "--force-reclone") {
      parsed.forceReclone = true;
    }
  }

  return parsed;
}

function run(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
      cwd: options.cwd ?? rootDir,
      env: process.env
    });

    if (options.capture) {
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (data) => {
        stdout += data.toString("utf8");
      });
      child.stderr.on("data", (data) => {
        stderr += data.toString("utf8");
      });

      child.on("close", (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
          return;
        }
        reject(new Error(`${cmd} ${args.join(" ")} failed (${code})\n${stderr}`));
      });
      return;
    }

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout: "", stderr: "" });
        return;
      }
      reject(new Error(`${cmd} ${args.join(" ")} failed (${code})`));
    });
  });
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function ensureScowlRepo(forceReclone) {
  await fs.mkdir(cacheDir, { recursive: true });

  if (forceReclone && (await exists(scowlRepoDir))) {
    await fs.rm(scowlRepoDir, { recursive: true, force: true });
  }

  if (await exists(scowlRepoDir)) {
    console.log("Updating SCOWL repository cache...");
    await run("git", ["-C", scowlRepoDir, "fetch", "--depth=1", "origin", "main"]);
    await run("git", ["-C", scowlRepoDir, "reset", "--hard", "origin/main"]);
    return;
  }

  console.log("Cloning SCOWL repository...");
  await run("git", ["clone", "--depth=1", "https://github.com/en-wl/wordlist.git", scowlRepoDir]);
}

async function buildScowlDb() {
  console.log("Building SCOWL database...");
  await run("make", [], { cwd: scowlRepoDir });
}

async function exportScowlWordList(config) {
  console.log("Exporting SCOWL word list...");
  const args = [
    "--db",
    "scowl.db",
    "word-list",
    config.scowlSize,
    config.region,
    config.spellingLevel
  ];

  if (config.categories !== "") {
    args.push(`--categories=${config.categories}`);
  } else {
    args.push("--categories=");
  }

  const { stdout } = await run(path.join(scowlRepoDir, "scowl"), args, {
    cwd: scowlRepoDir,
    capture: true
  });

  const words = [...new Set(
    stdout
      .split(/\r?\n/u)
      .map((line) => line.trim().toLowerCase())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => line.split(/\s+/u)[0])
  )].sort();

  await fs.mkdir(sourcesDir, { recursive: true });
  await fs.writeFile(scowlTarget, `${words.join("\n")}\n`, "utf8");
  console.log(`Wrote ${scowlTarget} (${words.length} words).`);
}

function venvPythonPath() {
  if (process.platform === "win32") {
    return path.join(venvDir, "Scripts", "python.exe");
  }
  return path.join(venvDir, "bin", "python");
}

function venvPipPath() {
  if (process.platform === "win32") {
    return path.join(venvDir, "Scripts", "pip.exe");
  }
  return path.join(venvDir, "bin", "pip");
}

async function ensureWordfreqVenv(pythonCmd) {
  if (!(await exists(venvPythonPath()))) {
    console.log("Creating local Python venv for wordfreq...");
    await run(pythonCmd, ["-m", "venv", venvDir]);
  }

  console.log("Installing wordfreq in local venv...");
  await run(venvPipPath(), ["install", "--upgrade", "pip", "wordfreq"]);
}

async function buildWordfreqTsv() {
  console.log("Generating wordfreq.tsv from SCOWL words...");

  const script = `
from pathlib import Path
from wordfreq import zipf_frequency

scowl = Path(r"${scowlTarget}")
out = Path(r"${wordfreqTarget}")
words = [line.strip() for line in scowl.read_text(encoding="utf-8").splitlines() if line.strip()]

rows = ["word\\tzipf"]
for w in words:
    rows.append(f"{w}\\t{zipf_frequency(w, 'en'):.4f}")

out.write_text("\\n".join(rows) + "\\n", encoding="utf-8")
print(f"Wrote {out} ({len(words)} rows).")
`.trim();

  const tempScript = path.join(await fs.mkdtemp(path.join(os.tmpdir(), "wordfreq-build-")), "build_wordfreq.py");
  await fs.writeFile(tempScript, `${script}\n`, "utf8");
  await run(venvPythonPath(), [tempScript]);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  await ensureScowlRepo(args.forceReclone);
  await buildScowlDb();
  await exportScowlWordList(args);

  await ensureWordfreqVenv(args.python);
  await buildWordfreqTsv();

  console.log("Source preparation complete.");
  console.log("Next step: npm run build:data");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
