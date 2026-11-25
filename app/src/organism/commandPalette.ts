export interface UiCommandDescriptor {
  id: string;
  title: string;
  keywords: string[];
}

export function filterUiCommands<T extends UiCommandDescriptor>(commands: T[], query: string): T[] {
  const normalized = String(query ?? "").normalize("NFKC").trim().toLocaleLowerCase();
  if (!normalized) return commands;
  return commands.filter((command) => {
    const haystack = [command.title, ...command.keywords].join(" ").normalize("NFKC").toLocaleLowerCase();
    return haystack.includes(normalized);
  });
}


/** Move to the next enabled command, wrapping at the end and skipping disabled actions. */
export function nextUiCommandIndex<T extends UiCommandDescriptor & { disabled?: boolean }>(
  commands: T[],
  currentIndex: number,
  direction: 1 | -1,
): number {
  if (!commands.length) return -1;
  const start = Number.isInteger(currentIndex) ? currentIndex : 0;
  for (let offset = 1; offset <= commands.length; offset += 1) {
    const index = (start + direction * offset + commands.length * 2) % commands.length;
    if (!commands[index].disabled) return index;
  }
  return commands.findIndex((command) => !command.disabled);
}
