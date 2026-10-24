import { register } from 'node:module';

// Register the repository's pinned TypeScript transpiler for runtime smoke tests.
// Node's strip-only mode cannot execute existing parameter properties/enums.
register('./typescript-transpile-loader.mjs', import.meta.url);
