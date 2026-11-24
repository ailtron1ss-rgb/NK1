import { createHash } from 'node:crypto';

export type ContextPriority = 'critical' | 'high' | 'normal' | 'low';
export type ContextSlot = 'system' | 'user';
export interface ContextSectionInput {
  id: string;
  slot: ContextSlot;
  text: string;
  priority: ContextPriority;
  required?: boolean;
  sourceRef?: string;
  recallable?: boolean;
}
export interface ContextSectionReceipt {
  id: string;
  slot: ContextSlot;
  priority: ContextPriority;
  status: 'included' | 'truncated' | 'omitted';
  reason: string;
  originalChars: number;
  includedChars: number;
  omittedChars: number;
  sha256: string;
  sourceRef?: string;
  recallable: boolean;
}
export interface ContextBudgetLedgerReport {
  version: 1;
  owner: 'LanguageOrgan';
  policy: 'priority-bounded-loss-accounting';
  maxDynamicChars: number;
  totalInputChars: number;
  renderedChars: number;
  omittedChars: number;
  estimatedInputTokens: number;
  estimatedRenderedTokens: number;
  includedSections: number;
  truncatedSections: number;
  omittedSections: number;
  receipts: ContextSectionReceipt[];
  note: string;
}
export interface BudgetedLanguageContext {
  system: string;
  user: string;
  ledger: ContextBudgetLedgerReport;
}

const PRIORITY: Record<ContextPriority, number> = { critical: 0, high: 1, normal: 2, low: 3 };
const tokenEstimate = (characters: number) => Math.ceil(Math.max(0, characters) / 4);
const digest = (text: string) => createHash('sha256').update(text).digest('hex');

function boundedExcerpt(text: string, budget: number, marker: string): string {
  if (budget <= 0) return '';
  if (text.length <= budget) return text;
  if (budget <= marker.length + 2) return text.slice(0, budget);
  const contentBudget = budget - marker.length;
  const head = Math.ceil(contentBudget * 0.72);
  const tail = Math.max(0, contentBudget - head);
  return `${text.slice(0, head)}${marker}${tail ? text.slice(-tail) : ''}`;
}

/** Build the exact prompt text plus an auditable, content-free omission manifest. */
export function buildBudgetedLanguageContext(sections: ContextSectionInput[], maxDynamicChars = 12_000): BudgetedLanguageContext {
  const maxChars = Math.max(256, Math.floor(Number.isFinite(maxDynamicChars) ? maxDynamicChars : 12_000));
  const normalized = sections.map((section, index) => ({ ...section, index, text: String(section.text ?? '') }));
  const totalInputChars = normalized.reduce((sum, section) => sum + section.text.length, 0);
  const receiptByIndex = new Map<number, ContextSectionReceipt>();
  const textByIndex = new Map<number, string>();
  // Reserve one character per possible join delimiter so actual rendered text never exceeds the cap.
  let remaining = Math.max(0, maxChars - Math.max(0, normalized.length - 1));

  const ranked = [...normalized].sort((a, b) => PRIORITY[a.priority] - PRIORITY[b.priority] || Number(Boolean(b.required)) - Number(Boolean(a.required)) || a.index - b.index);
  for (const section of ranked) {
    const originalChars = section.text.length;
    const marker = `
[… ${Math.max(1, originalChars - remaining)} chars omitted; source=${section.sourceRef ?? 'no-recall-ref'}; sha256=${digest(section.text).slice(0, 12)} …]
`;
    let rendered = '';
    let status: ContextSectionReceipt['status'] = 'omitted';
    let reason = 'budget-exhausted';
    if (originalChars === 0) {
      rendered = '';
      status = 'included';
      reason = 'empty-section';
    } else if (originalChars <= remaining) {
      rendered = section.text;
      status = 'included';
      reason = 'fits-budget';
    } else if (remaining > 0 && (section.required || section.priority === 'critical' || section.priority === 'high')) {
      rendered = boundedExcerpt(section.text, remaining, marker);
      status = rendered.length > 0 ? 'truncated' : 'omitted';
      reason = rendered.length > 0 ? 'priority-preserving-truncation' : 'budget-exhausted';
    }
    const includedChars = rendered.length;
    const omittedChars = Math.max(0, originalChars - includedChars);
    if (includedChars > 0) remaining = Math.max(0, remaining - includedChars);
    if (status !== 'omitted') textByIndex.set(section.index, rendered);
    receiptByIndex.set(section.index, {
      id: section.id,
      slot: section.slot,
      priority: section.priority,
      status,
      reason,
      originalChars,
      includedChars,
      omittedChars,
      sha256: digest(section.text),
      sourceRef: section.sourceRef,
      recallable: Boolean(section.recallable && section.sourceRef),
    });
  }

  const receipts = normalized.map((section) => receiptByIndex.get(section.index)!);
  const system = normalized.filter((section) => section.slot === 'system' && textByIndex.has(section.index)).map((section) => textByIndex.get(section.index)).join('\n');
  const user = normalized.filter((section) => section.slot === 'user' && textByIndex.has(section.index)).map((section) => textByIndex.get(section.index)).join('\n');
  const renderedChars = system.length + user.length;
  const report: ContextBudgetLedgerReport = {
    version: 1,
    owner: 'LanguageOrgan',
    policy: 'priority-bounded-loss-accounting',
    maxDynamicChars: maxChars,
    totalInputChars,
    renderedChars,
    omittedChars: receipts.reduce((sum, receipt) => sum + receipt.omittedChars, 0),
    estimatedInputTokens: tokenEstimate(totalInputChars),
    estimatedRenderedTokens: tokenEstimate(renderedChars),
    includedSections: receipts.filter((receipt) => receipt.status === 'included').length,
    truncatedSections: receipts.filter((receipt) => receipt.status === 'truncated').length,
    omittedSections: receipts.filter((receipt) => receipt.status === 'omitted').length,
    receipts,
    note: 'Token counts are character-based estimates. Omission receipts contain hashes and source references, not the underlying text; later recall must query the canonical source owner.',
  };
  return { system, user, ledger: report };
}
