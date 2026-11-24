import fs from 'node:fs';

const requests = [];
globalThis.fetch = async (input, options = {}) => {
  requests.push({
    method: String(options.method ?? 'GET').toUpperCase(),
    url: String(input),
  });
  return {
    status: 404,
    async text() { return ''; },
  };
};

process.on('exit', () => {
  const target = process.env.NK1_BRANCH_RETIREMENT_METHOD_LOG;
  if (target) fs.writeFileSync(target, JSON.stringify(requests), 'utf8');
});
