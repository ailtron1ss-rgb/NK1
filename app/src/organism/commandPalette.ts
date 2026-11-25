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
