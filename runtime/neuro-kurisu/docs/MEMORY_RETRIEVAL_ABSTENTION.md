# NK1 MemoryOS2 retrieval abstention boundary

`MemoryOS2.retrieve()` must not manufacture an answer merely because a memory exists in the recent window or has high salience, identity relevance, or goal relevance.

## Candidate contract

- Lexical token postings, fuzzy token postings, bilingual-concept postings, or metadata postings may establish an evidence-bearing candidate.
- Recent-memory padding is allowed only after candidate discovery has at least one evidence-bearing candidate; it supplements search but cannot seed a result from zero evidence.
- If no evidence-bearing posting matches, `retrieve()` returns an empty result and the candidate count remains zero. This is intentional abstention, not a retrieval failure.
- A subsequent query with an actual corpus match must still retrieve normally; the abstention decision must not mutate or disable memory state.

## Regression

Run from `runtime/neuro-kurisu`:

~~~bash
npm run test:memory-retrieval-candidate-coverage
npm run test:memoryos2-metadata-retrieval
npm run typecheck
~~~

The candidate-coverage regression uses high-salience, high-identity and high-goal unrelated rows. A novel no-match query must return no result and report zero candidates, while a follow-up matched query must retrieve the relevant row. The same test continues to check candidate coverage beyond the old 96-posting cap and order stability under reversed snapshot rows.

This guard is about evidence integrity, not a recall-uplift claim. Partial-overlap unanswerable queries and real holdout quality remain subject to the independent, immutable evaluation and the promotion gate.
