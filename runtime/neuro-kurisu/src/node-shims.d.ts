/// <reference types="node" />

/**
 * Node's built-in modules and globals must come from the pinned @types/node package
 * installed from app/package-lock.json by runtime typecheck workflows. Hand-written
 * partial declarations shadow real overloads (for example fs.writeFile and Buffer)
 * and produce false errors, so this file intentionally contains no replacement shims.
 */
