# WorkPass482 — Full root-persistence regression

**Date:** 2026-10-27  
**Status:** committed; validation through current-head Hexis server-smoke CI.

The Hexis server smoke now exercises a true process restart:
1. Submit a source observation with a SHA-256 fingerprint matching its raw content.
2. Verify the first call adds canonical lineage.
3. Verify an in-process replay is idempotent.
4. Send modified content under the old fingerprint and require rejection.
5. Stop the server after its flush completes.
6. Restart the server over the same temporary `STATE_DIR`.
7. Submit the original request again and require `duplicate-source-lineage`, proving that both the source trace and canonical lineage survived the root snapshot/checkpoint restore.

This is stronger than reconstructing a standalone `MemorySubsystemRuntime` in a unit test. It still does not prove that the upstream source is authentic or factually correct.
