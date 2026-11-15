import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const project = fileURLToPath(new URL(".", import.meta.url));
const site = new URL("dist/", import.meta.url);
const demo = new URL("analisis/", site);

await mkdir(demo, { recursive: true });
await build({
  absWorkingDir: project,
  entryPoints: ["src/main.jsx"],
  outfile: fileURLToPath(new URL("main.js", demo)),
  bundle: true,
  minify: true,
  target: "chrome60",
  define: { "process.env.NODE_ENV": '"production"' },
});
await copyFile(new URL("index.html", import.meta.url), new URL("index.html", demo));

const licenses = await Promise.all(
  ["react", "react-dom", "scheduler", "jsqr"].map(async (name) => {
    const license = await readFile(new URL(`node_modules/${name}/LICENSE`, import.meta.url), "utf8");
    return `${name}\n\n${license}`;
  }),
);
await writeFile(new URL("licenses.txt", demo), licenses.join("\n\n"));

await Promise.all([
  copyFile(new URL("site/qr-demo.svg", import.meta.url), new URL("qr-demo.svg", demo)),
  copyFile(new URL("site/qr-demo.svg", import.meta.url), new URL("qr-demo.svg", site)),
  copyFile(new URL("site/index.html", import.meta.url), new URL("index.html", site)),
  copyFile(new URL("site/landing.css", import.meta.url), new URL("landing.css", site)),
  copyFile(new URL("site/arquitectura.svg", import.meta.url), new URL("arquitectura.svg", site)),
  copyFile(new URL("site/secuencia.svg", import.meta.url), new URL("secuencia.svg", site)),
]);
