#!/usr/bin/env bun
// Builds standalone canvasmagicks binaries for multiple platforms using `bun build --compile`.
// Usage: bun run scripts/build.ts [target1 target2 ...]
// With no args, builds for all TARGETS below.

const TARGETS: Record<string, string> = {
  "linux-x64": "bun-linux-x64",
  "linux-arm64": "bun-linux-arm64",
  "darwin-x64": "bun-darwin-x64",
  "darwin-arm64": "bun-darwin-arm64",
  "windows-x64": "bun-windows-x64",
};

const requested = process.argv.slice(2);
const names = requested.length > 0 ? requested : Object.keys(TARGETS);

for (const name of names) {
  const target = TARGETS[name];
  if (!target) {
    console.error(`Unknown target "${name}". Available: ${Object.keys(TARGETS).join(", ")}`);
    process.exit(1);
  }

  const outfile = `dist/canvasmagicks-${name}${name.startsWith("windows") ? ".exe" : ""}`;
  console.log(`Building ${name} -> ${outfile}`);

  const proc = Bun.spawn(
    ["bun", "build", "src/index.ts", "--compile", `--target=${target}`, "--outfile", outfile],
    { stdout: "inherit", stderr: "inherit" },
  );
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    console.error(`Build failed for ${name}`);
    process.exit(exitCode);
  }

  // macOS refuses to run a freshly compiled, unsigned binary (SIGKILL) until it is
  // at least ad-hoc signed. Only needed/possible on a macOS build host, and only
  // matters when producing a darwin binary.
  if (process.platform === "darwin" && name.startsWith("darwin-")) {
    const sign = Bun.spawn(["codesign", "-s", "-", outfile], { stdout: "inherit", stderr: "inherit" });
    const signExit = await sign.exited;
    if (signExit !== 0) {
      console.error(`codesign failed for ${name}`);
      process.exit(signExit);
    }
  }
}

console.log("Done.");
