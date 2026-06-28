import { $ } from "bun";

async function main() {
  try {
    console.log("Clean dist...");
    await $`rm -rf dist`;

    console.log("Prisma generate...");
    await $`bun prisma generate`;

    console.log("Build with tsc (via Bun)...");
    await $`bun tsc -p tsconfig.build.json`;

    console.log("Build success");
  } catch (err) {
    console.error("x Build failed x");
    console.error(err);
    process.exit(1);
  }
}

main();