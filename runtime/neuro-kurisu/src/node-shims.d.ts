/**
 * Runtime code uses the real @types/node contract from app/node_modules/@types.
 * Do not re-declare partial node:* modules here: those declarations shadow complete
 * Node API types and make the runtime typecheck miss valid APIs.
 */
