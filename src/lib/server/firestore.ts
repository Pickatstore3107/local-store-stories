// Reads public data through Firestore's REST API as an anonymous visitor, so
// the security rules decide what comes back, exactly as they do for anyone
// on the web. The server has no special access to the database.

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

// Only public data is read here, so this may follow the emulator setting
// outside development too (for local production builds).
const host =
  process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true"
    ? "http://127.0.0.1:8080"
    : "https://firestore.googleapis.com";

const databasePath = `projects/${projectId}/databases/(default)/documents`;

type Value = {
  stringValue?: string;
  integerValue?: string;
  doubleValue?: number;
  booleanValue?: boolean;
  timestampValue?: string;
  nullValue?: null;
  mapValue?: { fields?: Record<string, Value> };
  arrayValue?: { values?: Value[] };
};

type RestDocument = { name: string; fields?: Record<string, Value> };

/** A document's fields as plain values. Timestamps become milliseconds. */
export type Fields = Record<string, unknown>;

export type PublicDocument = { id: string; data: Fields };

function decode(value: Value): unknown {
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.integerValue !== undefined) return Number(value.integerValue);
  if (value.doubleValue !== undefined) return value.doubleValue;
  if (value.booleanValue !== undefined) return value.booleanValue;
  if (value.timestampValue !== undefined) return Date.parse(value.timestampValue);
  if (value.mapValue !== undefined) return decodeFields(value.mapValue.fields);
  if (value.arrayValue !== undefined) return (value.arrayValue.values ?? []).map(decode);
  return null;
}

function decodeFields(fields: Record<string, Value> = {}): Fields {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decode(value)]));
}

function fromRest(document: RestDocument): PublicDocument {
  return { id: document.name.split("/").pop()!, data: decodeFields(document.fields) };
}

function url(suffix: string) {
  const target = new URL(`${host}/v1/${databasePath}${suffix}`);
  if (apiKey) target.searchParams.set("key", apiKey);
  return target;
}

async function post(suffix: string, body: unknown) {
  const response = await fetch(url(suffix), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Firestore ${suffix} failed with ${response.status}`);
  return response.json();
}

/** False when the app has no Firebase project, as in CI builds. */
export function hasDatabase() {
  return Boolean(projectId);
}

/** One document, or null when it doesn't exist or visitors may not read it. */
export async function getPublicDocument(path: string): Promise<PublicDocument | null> {
  const response = await fetch(url(`/${path}`));
  if (response.status === 404 || response.status === 403) return null;
  if (!response.ok) throw new Error(`Firestore read failed with ${response.status}`);
  return fromRest((await response.json()) as RestDocument);
}

/** Several documents in one request, by path. Missing ones are left out. */
export async function getPublicDocuments(paths: string[]): Promise<Map<string, PublicDocument>> {
  if (!paths.length) return new Map();
  const rows = (await post(":batchGet", {
    documents: paths.map((path) => `${databasePath}/${path}`),
  })) as { found?: RestDocument }[];
  return new Map(
    rows.flatMap((row) => {
      if (!row.found) return [];
      const path = row.found.name.slice(row.found.name.indexOf("/documents/") + "/documents/".length);
      return [[path, fromRest(row.found)]];
    }),
  );
}

/** The documents in a collection whose fields equal the given strings. */
export async function queryPublic(
  collectionId: string,
  equals: Record<string, string>,
  limit: number,
): Promise<PublicDocument[]> {
  const filters = Object.entries(equals).map(([fieldPath, value]) => ({
    fieldFilter: { field: { fieldPath }, op: "EQUAL", value: { stringValue: value } },
  }));
  const rows = (await post(":runQuery", {
    structuredQuery: {
      from: [{ collectionId }],
      where: filters.length === 1 ? filters[0] : { compositeFilter: { op: "AND", filters } },
      limit,
    },
  })) as { document?: RestDocument }[];
  return rows.flatMap((row) => (row.document ? [fromRest(row.document)] : []));
}
