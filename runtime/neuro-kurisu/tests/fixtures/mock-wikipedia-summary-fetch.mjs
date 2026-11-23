const revision = Number(process.env.NK1_WIKI_FIXTURE_REVISION ?? 1000);

globalThis.fetch = async (input) => {
  const url = new URL(String(input));
  const language = url.hostname.startsWith('ru.') ? 'ru' : 'en';
  const requestedTitle = decodeURIComponent(url.pathname.split('/').at(-1) ?? '');
  const stableTitleNumber = [...requestedTitle].reduce((sum, character) => sum + character.codePointAt(0), 0);
  const pageId = revision + stableTitleNumber + (language === 'ru' ? 100_000 : 0);
  const extract = `${language.toUpperCase()} Wikipedia fixture summary for ${requestedTitle}. This stable source extract is deliberately longer than forty characters and supports deterministic offline provenance tests.`;
  return {
    ok: true,
    status: 200,
    async json() {
      return {
        extract,
        revision: `${revision}-${language}-${stableTitleNumber}`,
        pageid: pageId,
        timestamp: '2026-11-23T00:00:00.000Z',
        title: requestedTitle,
        content_urls: {
          desktop: { page: `https://${language}.wikipedia.org/wiki/${encodeURIComponent(requestedTitle)}` },
        },
      };
    },
  };
};
