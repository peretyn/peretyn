export const TERM_DEFINITIONS = {
  schema: 'The TypeScript file where you declare your types, relations and permissions.',
  relation:
    'A direct link between a subject and an object, such as owner or viewer. You save relations as tuples.',
  permission:
    'A rule computed from relations, such as can_view. You check permissions, but you never write them.',
  tuple:
    'One saved fact: a subject has a relation on an object, such as user:alice is owner of document:roadmap.',
  check:
    'A question you ask Peretyn: does this subject have this relation or permission on this object? The answer is allowed or denied.',
  fact: 'Something true about your data right now, such as who owns a document. In Peretyn, a fact is a relation saved as a tuple.',
  rule: 'Something your product decides, such as "owners can view". In Peretyn, a rule is a permission in the schema.',
} as const;

export type TermName = keyof typeof TERM_DEFINITIONS;

function isTermName(name: string): name is TermName {
  return Object.hasOwn(TERM_DEFINITIONS, name);
}

export function definitionOf(name: string): string {
  if (!isTermName(name)) {
    throw new Error(`No definition for the term "${name}". Add it to TERM_DEFINITIONS.`);
  }
  return TERM_DEFINITIONS[name];
}
