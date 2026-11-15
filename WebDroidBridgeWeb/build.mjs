import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const project = fileURLToPath(new URL(".", import.meta.url));
const assets = new URL("../WebDroidBridgeAPP/app/src/main/assets/toastlink/", import.meta.url);

await mkdir(assets, { recursive: true });
await build({
  absWorkingDir: project,
  entryPoints: ["src/main.jsx"],
  outfile: fileURLToPath(new URL("main.js", assets)),
  bundle: true,
  minify: true,
  target: "chrome60",
  define: { "process.env.NODE_ENV": '"production"' },
});
await copyFile(new URL("index.html", import.meta.url), new URL("index.html", assets));

const licenses = await Promise.all(
  ["react", "react-dom", "scheduler"].map(async (name) => {
    const license = await readFile(new URL(`node_modules/${name}/LICENSE`, import.meta.url), "utf8");
    return `${name}\n\n${license}`;
  }),
);
await writeFile(new URL("licenses.txt", assets), licenses.join("\n\n"));
