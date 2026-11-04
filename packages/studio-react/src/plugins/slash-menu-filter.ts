/**
 * Typeahead queries are author-controlled text, not regular expressions.
 * Keep matching literal and deterministic across RTL/LTR inputs.
 */
export function filterSlashMenuOptions<
  T extends {
    title: string;
    cardType?: string | undefined;
    actionType?: string | undefined;
    keywords?: string[] | undefined;
  },
>(options: T[], query: string | null): T[] {
  if (!query) return options;

  const needle = query.trim().toLowerCase();
  if (!needle) return options;

  return options.filter(
    (option) =>
      option.title.toLowerCase().includes(needle) ||
      (option.cardType?.toLowerCase().includes(needle) ?? false) ||
      (option.actionType?.toLowerCase().includes(needle) ?? false) ||
      (option.keywords?.some((k) => k.toLowerCase().includes(needle)) ?? false),
  );
}
