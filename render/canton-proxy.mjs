import http from "node:http";

const listenPort = Number(process.env.PORT ?? 10000);
const targetPort = Number(process.env.CANTON_JSON_PORT ?? 7575);
const targetHost = "127.0.0.1";

const server = http.createServer((incoming, outgoing) => {
  const targetPath = incoming.url || "/";
  const request = http.request(
    {
      host: targetHost,
      port: targetPort,
      path: targetPath,
      method: incoming.method,
      headers: {
        ...incoming.headers,
        host: `${targetHost}:${targetPort}`,
      },
    },
    (response) => {
      outgoing.writeHead(response.statusCode ?? 502, response.headers);
      response.pipe(outgoing);
    },
  );

  request.on("error", () => {
    if (outgoing.headersSent) return;
    outgoing.writeHead(503, { "content-type": "application/json" });
    outgoing.end(
      JSON.stringify({
        mode: "canton-json-api",
        healthy: false,
        message: "Canton sandbox is starting. Retry shortly.",
      }),
    );
  });

  incoming.pipe(request);
});

server.listen(listenPort, "0.0.0.0", () => {
  console.log(`Render proxy listening on 0.0.0.0:${listenPort}, forwarding to ${targetHost}:${targetPort}`);
});
