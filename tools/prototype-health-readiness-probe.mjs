let body = "";
for await (const chunk of process.stdin) body += chunk;

let health;
try {
  health = JSON.parse(body);
} catch {
  process.exitCode = 1;
}

if (health?.ready !== true) process.exitCode = 1;
