const { spawn } = require("node:child_process");

const [, , command, ...args] = process.argv;

if (!command) {
  console.error("Usage: node ./scripts/run-next.cjs <dev|build|start> [...args]");
  process.exit(1);
}

const distDirByCommand = {
  dev: ".next-dev",
  build: ".next-build",
  start: ".next-build",
};

const distDir = distDirByCommand[command];

if (!distDir) {
  console.error(`Unsupported next command: ${command}`);
  process.exit(1);
}

const nextBin = require.resolve("next/dist/bin/next");

const child = spawn(
  process.execPath,
  [nextBin, command, ...args],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_DIST_DIR: distDir,
    },
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
