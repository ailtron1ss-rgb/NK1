let body = "";
for await (const chunk of process.stdin) body += chunk;

const health = JSON.parse(body);
process.exit(health?.ready === true ? 0 : 1);
