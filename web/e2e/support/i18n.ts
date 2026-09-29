import ar from '../../src/locales/ar.json' with { type: 'json' };

/**
 * Arabic UI text by locale key (`t('map.layers')`), read from the same file the app uses — a copy edit in ar.json does
 * not break the specs, and a renamed or deleted key fails loudly here instead of silently matching nothing.
 */
export function t(key: string, values: Record<string, string | number> = {}): string {
  let node: unknown = ar;
  for (const part of key.split('.')) {
    node = node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined;
  }
  if (typeof node !== 'string') throw new Error(`e2e: no Arabic text for locale key "${key}"`);
  return node.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(values[name] ?? `{{${name}}}`));
}
