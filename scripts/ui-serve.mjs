import esbuild from "esbuild";

const defaultPort = 4173;
const argPort = process.argv.find((arg) => arg.startsWith("--port="));
const portIndex = process.argv.findIndex((arg) => arg === "--port");
const resolvedPort = argPort
  ? Number(argPort.split("=")[1])
  : portIndex >= 0
    ? Number(process.argv[portIndex + 1])
    : Number(process.env.UI_PREVIEW_PORT ?? defaultPort);
const port = Number.isFinite(resolvedPort) ? resolvedPort : defaultPort;

const context = await esbuild.context({
  entryPoints: ["preview/preview.ts"],
  bundle: true,
  format: "esm",
  target: "es2018",
  sourcemap: "inline",
  logLevel: "info",
  outfile: "preview/preview.js",
});

await context.watch();
const server = await context.serve({
  servedir: ".",
  port,
});

const host = server.host ?? "localhost";
const url = `http://${host}:${server.port}/preview/index.html`;
console.log(`UI preview available at ${url}`);
