import assert from 'node:assert/strict';
import { tokenizeUnicodeTerms } from '../src/organism/core/UnicodeTokenizer.ts';

assert.deepEqual(tokenizeUnicodeTerms('THIS is Kurisu_01 co-op Москва-центр １２３'), ['this','is','kurisu','01','co','op','москва','центр','123']);
assert.deepEqual(tokenizeUnicodeTerms('THIS is Kurisu_01 co-op Москва-центр １２３', {includeUnderscore:true, includeHyphen:true}), ['this','is','kurisu_01','co-op','москва-центр','123']);
assert.deepEqual(tokenizeUnicodeTerms('a b cc я х да', {minimumLength:2}), ['cc','да']);
console.log('UNICODE_TOKENIZER_WORKPASS36=PASS', JSON.stringify({ unicodeNfkc:true, luminaSeparators:'preserved', conscioSeparators:'preserved' }));
