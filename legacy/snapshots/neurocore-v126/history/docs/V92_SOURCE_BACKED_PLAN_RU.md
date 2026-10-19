# V92 source-backed plan

## Done

- lazy upstream catalog;
- exact import targets where known;
- research-only licensing boundary;
- safe ZIP intake with traversal protection;
- source SHA-256 manifest;
- current tests for lazy import/failure/no fallback;
- source registry for 20 candidates;
- neutral current naming.

## Not falsely claimed

Full upstream source trees are not vendored in this archive because the execution environment could not download GitHub/PyPI bytes. They are explicitly linked for user upload.

## Next gate

Accept real upstream ZIPs, inspect LICENSE/NOTICE and run isolated source tests. Then build a matched recurrence tournament before promoting any external backend into current.
