// src/lib/firestore-sanitize.ts

export type CategoryHierarchy = {
  l0: string;
  l1: string;
  l2: string;
  l3: string;
};

const DEFAULT_HIERARCHY: CategoryHierarchy = {
  l0: "Uncategorized",
  l1: "",
  l2: "",
  l3: "",
};

export function normalizeCategoryHierarchy(input: any): CategoryHierarchy {
  const h = input ?? {};
  return {
    l0: typeof h.l0 === "string" && h.l0.trim() ? h.l0 : DEFAULT_HIERARCHY.l0,
    l1: typeof h.l1 === "string" ? h.l1 : DEFAULT_HIERARCHY.l1,
    l2: typeof h.l2 === "string" ? h.l2 : DEFAULT_HIERARCHY.l2,
    l3: typeof h.l3 === "string" ? h.l3 : DEFAULT_HIERARCHY.l3,
  };
}

/**
 * Deeply removes any `undefined` values so Firestore never rejects the write.
 */
export function removeUndefinedDeep<T>(obj: T): T {
  if (Array.isArray(obj)) {
    return obj.map(removeUndefinedDeep) as any;
  }
  if (obj && typeof obj === "object") {
    const out: any = {};
    for (const [k, v] of Object.entries(obj as any)) {
      if (v === undefined) continue;
      out[k] = removeUndefinedDeep(v);
    }
    return out;
  }
  return obj;
}
