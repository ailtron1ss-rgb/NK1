/**
 * Response hygiene for a living conversational persona.
 * It separates stage directions for TTS but does not impose an artificial
 * sentence/character minimum. Natural brevity is allowed when the context calls for it.
 */
export function splitSpeechAndActions(raw: string): { speech: string; actions: string[]; display: string } {
  const text = String(raw || '').trim();
  const actions: string[] = [];
  let speech = text.replace(/\*([^*]+)\*/g, (_, inner) => {
    const action = String(inner).trim();
    if (action) actions.push(action);
    return ' ';
  });
  speech = speech.replace(/\s+/g, ' ').trim();

  // An action-only model output is not useful for conversation, so add a tiny
  // bridge line rather than manufacturing a long canned paragraph.
  const letters = speech.replace(/[^a-zA-Zа-яА-ЯёЁ]/g, '');
  if (letters.length < 3 && actions.length) {
    const a = (actions[0] || '').toLowerCase();
    speech = /вздох|sigh/.test(a)
      ? '…Ладно.'
      : /улыб|smile/.test(a)
        ? 'Хм.'
        : 'Я здесь.';
  }

  const actionPart = actions.length ? actions.map(x => `*${x}*`).join(' ') : '';
  return {
    speech,
    actions,
    display: actionPart ? `${speech}${speech ? ' ' : ''}${actionPart}` : speech
  };
}

export function speechOnlyForTTS(display: string): string {
  return String(display || '')
    .replace(/\*([^*]+)\*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
