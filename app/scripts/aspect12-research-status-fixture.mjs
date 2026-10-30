import http from "node:http";

const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 8765);

const status = {
  ok: true,
  smokeFixture: true,
  neurocore: { version: "not-connected", evidence: {}, mode: "smoke-fixture" },
  nomega: { version: "not-connected", forge: "not-connected", registry: {}, mode: "smoke-fixture" },
  deepcode: { version: "not-connected", entrypoint: "not-connected", mode: "smoke-fixture" },
};

const server = http.createServer((request, response) => {
  if (request.method === "GET" && request.url === "/api/research/status") {
    response.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    });
    response.end(JSON.stringify(status));
    return;
  }
  response.writeHead(404, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify({ ok: false, error: "smoke-fixture-route-not-found" }));
});

server.listen(port, host, () => {
  process.stdout.write("[Aspect12] isolated Research Bridge status fixture listening on " + host + ":" + port + "\n");
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
