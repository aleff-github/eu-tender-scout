const TED_SEARCH_ENDPOINT = "https://api.ted.europa.eu/v3/notices/search";

export const DEFAULT_TENDER_FIELDS = [
  "publication-number",
  "notice-title",
  "notice-type",
  "publication-date",
  "buyer-name",
  "buyer-country",
  "classification-cpv",
  "place-of-performance",
  "estimated-value-proc",
  "estimated-value-cur-proc",
  "deadline-receipt-tender-date-lot"
] as const;

export const HIGH_PRECISION_CYBERSECURITY_TERMS = [
  'FT ~ cybersecurity',
  'FT ~ "cyber security"',
  'FT ~ "sicurezza informatica"',
  'FT ~ "incident response"',
  'FT ~ "network security"',
  'FT ~ "security operations center"',
  "FT ~ SIEM",
  "FT ~ CSIRT"
] as const;

export type TedSearchScope = "ACTIVE" | "LATEST" | "ALL";

export interface TedSearchRequest {
  query: string;
  fields?: string[];
  page?: number;
  limit?: number;
  scope?: TedSearchScope;
  onlyLatestVersions?: boolean;
  checkQuerySyntax?: boolean;
}

export interface TedSearchEnvelope {
  notices?: unknown[];
  totalNoticeCount?: number;
  iterationNextToken?: string | null;
  timedOut?: boolean;
  [key: string]: unknown;
}

export type TenderOpportunityStatus =
  | "open"
  | "closed"
  | "competition-unknown-deadline"
  | "award-or-history"
  | "other";

export interface NormalizedTenderNotice {
  evidence: {
    publicationNumber: string | null;
    title: string | null;
    noticeType: string | null;
    publicationDate: string | null;
    buyer: string | null;
    buyerCountry: string[];
    cpv: string[];
    placeOfPerformance: string[];
    estimatedValue: {
      amount: string | null;
      currency: string | null;
    } | null;
    deadlines: string[];
    tedLinks: ReturnType<typeof buildTedNoticeLinks> | null;
  };
  availability: {
    status: TenderOpportunityStatus;
    reason: string;
    derivedByEuTenderScout: true;
  };
}

function cleanQuery(query: string): string {
  const cleaned = query.trim();

  if (!cleaned) {
    throw new Error("TED expert query must not be empty.");
  }

  if (cleaned.length > 4000) {
    throw new Error("TED expert query exceeds the 4,000-character MVP limit.");
  }

  return cleaned;
}

function cleanFields(fields?: string[]): string[] {
  const selected =
    fields && fields.length > 0
      ? fields
      : [...DEFAULT_TENDER_FIELDS];

  const deduplicated = Array.from(
    new Set(selected.map((field) => field.trim()).filter(Boolean))
  );

  if (deduplicated.length === 0) {
    throw new Error("At least one TED response field is required.");
  }

  if (deduplicated.length > 25) {
    throw new Error("EU Tender Scout supports at most 25 fields per request.");
  }

  for (const field of deduplicated) {
    if (!/^[A-Za-z0-9_.()\-]+$/.test(field)) {
      throw new Error(`Unsupported TED field syntax: ${field}`);
    }
  }

  return deduplicated;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map(asString)
      .filter((item): item is string => item !== null);
  }

  const single = asString(value);
  return single ? [single] : [];
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

const TWO_TO_THREE_LANGUAGE: Record<string, string> = {
  bg: "bul",
  cs: "ces",
  da: "dan",
  de: "deu",
  el: "ell",
  en: "eng",
  es: "spa",
  et: "est",
  fi: "fin",
  fr: "fra",
  ga: "gle",
  hr: "hrv",
  hu: "hun",
  it: "ita",
  lt: "lit",
  lv: "lav",
  mt: "mlt",
  nl: "nld",
  pl: "pol",
  pt: "por",
  ro: "ron",
  sk: "slk",
  sl: "slv",
  sv: "swe"
};

const THREE_TO_TWO_LANGUAGE = Object.fromEntries(
  Object.entries(TWO_TO_THREE_LANGUAGE).map(([two, three]) => [three, two])
);

function languageKeys(preferredLanguage: string): string[] {
  const clean = preferredLanguage.trim().toLowerCase() || "en";
  const three = TWO_TO_THREE_LANGUAGE[clean] ?? clean;

  return uniqueStrings([three, clean, "eng", "en", "ita", "it"]);
}

function linkLanguage(preferredLanguage: string): string {
  const clean = preferredLanguage.trim().toLowerCase() || "en";
  if (/^[a-z]{2}$/.test(clean)) return clean;
  return THREE_TO_TWO_LANGUAGE[clean] ?? "en";
}

function localizedText(
  value: unknown,
  preferredLanguage: string
): string | null {
  const direct = asString(value);
  if (direct) return direct;

  const record = asRecord(value);
  if (!record) return null;

  for (const key of languageKeys(preferredLanguage)) {
    const values = asStringArray(record[key]);
    if (values.length > 0) return values[0];
  }

  for (const candidate of Object.values(record)) {
    const values = asStringArray(candidate);
    if (values.length > 0) return values[0];
  }

  return null;
}

function dateOnly(value: string): string | null {
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? null;
}

function referenceDateOnly(referenceDate: Date): string {
  if (!Number.isFinite(referenceDate.getTime())) {
    throw new Error("Reference date must be valid.");
  }
  return referenceDate.toISOString().slice(0, 10);
}

export function classifyTenderNotice(
  notice: unknown,
  referenceDate = new Date()
): { status: TenderOpportunityStatus; reason: string } {
  const record = asRecord(notice) ?? {};
  const noticeType = (asString(record["notice-type"]) ?? "").toLowerCase();
  const deadlines = uniqueStrings(
    asStringArray(record["deadline-receipt-tender-date-lot"])
  );
  const datedDeadlines = deadlines
    .map(dateOnly)
    .filter((value): value is string => value !== null);
  const today = referenceDateOnly(referenceDate);

  if (noticeType.startsWith("can-") || noticeType.startsWith("veat-")) {
    return {
      status: "award-or-history",
      reason:
        "TED notice type indicates an award/history notice; it is not treated as an open bidding opportunity."
    };
  }

  const isCompetitionNotice =
    noticeType.startsWith("cn-") || noticeType.startsWith("pin-cfc-");

  if (!isCompetitionNotice) {
    return {
      status: "other",
      reason:
        "TED notice type is not recognized by this release as a competition notice or an award/history notice."
    };
  }

  if (datedDeadlines.some((deadline) => deadline >= today)) {
    return {
      status: "open",
      reason:
        "TED notice type indicates a competition and at least one submission deadline is today or in the future."
    };
  }

  if (datedDeadlines.length > 0) {
    return {
      status: "closed",
      reason:
        "TED notice type indicates a competition, but all returned submission deadlines are in the past."
    };
  }

  return {
    status: "competition-unknown-deadline",
    reason:
      "TED notice type indicates a competition, but the requested TED evidence contains no submission deadline, so openness cannot be confirmed."
  };
}

export function normalizeTenderNotice(
  notice: unknown,
  options: {
    preferredLanguage?: string;
    referenceDate?: Date;
  } = {}
): NormalizedTenderNotice {
  const record = asRecord(notice) ?? {};
  const preferredLanguage = options.preferredLanguage ?? "en";
  const publicationNumber = asString(record["publication-number"]);
  const amount = asString(record["estimated-value-proc"]);
  const currency = asString(record["estimated-value-cur-proc"]);
  const classification = classifyTenderNotice(
    notice,
    options.referenceDate ?? new Date()
  );

  return {
    evidence: {
      publicationNumber,
      title: localizedText(record["notice-title"], preferredLanguage),
      noticeType: asString(record["notice-type"]),
      publicationDate: asString(record["publication-date"]),
      buyer: localizedText(record["buyer-name"], preferredLanguage),
      buyerCountry: uniqueStrings(asStringArray(record["buyer-country"])),
      cpv: uniqueStrings(asStringArray(record["classification-cpv"])),
      placeOfPerformance: uniqueStrings(
        asStringArray(record["place-of-performance"])
      ),
      estimatedValue:
        amount || currency
          ? {
              amount,
              currency
            }
          : null,
      deadlines: uniqueStrings(
        asStringArray(record["deadline-receipt-tender-date-lot"])
      ),
      tedLinks:
        publicationNumber && /^\d+-\d{4}$/.test(publicationNumber)
          ? buildTedNoticeLinks(
              publicationNumber,
              linkLanguage(preferredLanguage)
            )
          : null
    },
    availability: {
      ...classification,
      derivedByEuTenderScout: true
    }
  };
}

export function triageTenderSearchResult(
  searchResult: {
    request: Record<string, unknown>;
    response: TedSearchEnvelope;
  },
  options: {
    preferredLanguage?: string;
    referenceDate?: Date;
  } = {}
) {
  const normalized = (searchResult.response.notices ?? []).map((notice) =>
    normalizeTenderNotice(notice, options)
  );

  const openOpportunities = normalized.filter(
    (notice) => notice.availability.status === "open"
  );
  const nonOpenNotices = normalized.filter(
    (notice) => notice.availability.status !== "open"
  );

  const statusCounts = normalized.reduce<Record<string, number>>(
    (counts, notice) => {
      const status = notice.availability.status;
      counts[status] = (counts[status] ?? 0) + 1;
      return counts;
    },
    {}
  );

  return {
    request: searchResult.request,
    responseMeta: {
      totalNoticeCount: searchResult.response.totalNoticeCount ?? null,
      returnedNoticeCount: normalized.length,
      iterationNextToken: searchResult.response.iterationNextToken ?? null,
      timedOut: searchResult.response.timedOut ?? false
    },
    statusCounts,
    openOpportunities,
    nonOpenNotices,
    interpretationNote:
      "TED ACTIVE scope is a search population, not proof that every returned notice is currently open for bids. EU Tender Scout derives availability from notice type and returned submission-deadline evidence."
  };
}

function compactTedDate(value: string): string {
  const clean = value.trim();
  const match = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    throw new Error("Publication dates must use YYYY-MM-DD.");
  }

  return `${match[1]}${match[2]}${match[3]}`;
}

export function buildCybersecurityTenderQuery(options: {
  country?: string;
  publicationFrom?: string;
  publicationTo?: string;
} = {}): string {
  const clauses: string[] = [];

  if (options.country) {
    const country = options.country.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(country)) {
      throw new Error("Country must be a three-letter TED country code such as ITA.");
    }
    clauses.push(`buyer-country = ${country}`);
  }

  if (options.publicationFrom && options.publicationTo) {
    clauses.push(
      `publication-date = (${compactTedDate(options.publicationFrom)} <> ${compactTedDate(options.publicationTo)})`
    );
  } else if (options.publicationFrom) {
    clauses.push(
      `publication-date >= ${compactTedDate(options.publicationFrom)}`
    );
  } else if (options.publicationTo) {
    clauses.push(
      `publication-date <= ${compactTedDate(options.publicationTo)}`
    );
  }

  clauses.push(`(${HIGH_PRECISION_CYBERSECURITY_TERMS.join(" OR ")})`);

  return clauses.join(" AND ");
}

async function postTed(body: Record<string, unknown>): Promise<TedSearchEnvelope> {
  const response = await fetch(TED_SEARCH_ENDPOINT, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "eu-tender-scout-mcp"
    },
    body: JSON.stringify(body)
  });

  const text = await response.text();

  if (!response.ok) {
    const detail = text.trim().slice(0, 1200);
    throw new Error(
      `TED Search API request failed with HTTP ${response.status}${detail ? `: ${detail}` : "."}`
    );
  }

  try {
    return JSON.parse(text) as TedSearchEnvelope;
  } catch {
    throw new Error("TED Search API returned a non-JSON response.");
  }
}

export async function searchTedNotices(
  request: TedSearchRequest
): Promise<{
  request: Record<string, unknown>;
  response: TedSearchEnvelope;
}> {
  const query = cleanQuery(request.query);
  const fields = cleanFields(request.fields);
  const page = Math.max(1, Math.floor(request.page ?? 1));
  const limit = Math.max(1, Math.min(Math.floor(request.limit ?? 20), 50));
  const scope = request.scope ?? "ACTIVE";
  const onlyLatestVersions = request.onlyLatestVersions ?? true;

  const body = {
    query,
    fields,
    page,
    limit,
    scope,
    checkQuerySyntax: request.checkQuerySyntax ?? false,
    paginationMode: "PAGE_NUMBER",
    onlyLatestVersions
  };

  return {
    request: body,
    response: await postTed(body)
  };
}

export async function searchAndTriageTedNotices(
  request: TedSearchRequest & {
    preferredLanguage?: string;
  }
) {
  const result = await searchTedNotices({
    ...request,
    fields: request.fields ?? [...DEFAULT_TENDER_FIELDS],
    checkQuerySyntax: false
  });

  return triageTenderSearchResult(result, {
    preferredLanguage: request.preferredLanguage
  });
}

export async function validateTedQuery(
  query: string,
  options: {
    scope?: TedSearchScope;
    onlyLatestVersions?: boolean;
  } = {}
): Promise<{
  query: string;
  validation: TedSearchEnvelope;
}> {
  const cleaned = cleanQuery(query);

  const body = {
    query: cleaned,
    fields: ["publication-number"],
    page: 1,
    limit: 1,
    scope: options.scope ?? "ACTIVE",
    checkQuerySyntax: true,
    paginationMode: "PAGE_NUMBER",
    onlyLatestVersions: options.onlyLatestVersions ?? true
  };

  return {
    query: cleaned,
    validation: await postTed(body)
  };
}

export function buildTedNoticeLinks(
  publicationNumber: string,
  language = "en"
): {
  publicationNumber: string;
  language: string;
  web: string;
  htmlDownload: string;
  pdf: string;
  signedPdf: string;
  xml: string;
} {
  const number = publicationNumber.trim();
  const lang = language.trim().toLowerCase();

  if (!/^\d+-\d{4}$/.test(number)) {
    throw new Error(
      "Publication number must use TED format such as 291298-2024."
    );
  }

  if (!/^[a-z]{2}$/.test(lang)) {
    throw new Error("Language must be a two-letter code such as en or it.");
  }

  const base = `https://ted.europa.eu/${lang}/notice/${encodeURIComponent(number)}`;

  return {
    publicationNumber: number,
    language: lang,
    web: base,
    htmlDownload: `${base}/html`,
    pdf: `${base}/pdf`,
    signedPdf: `${base}/pdfs`,
    xml: `${base}/xml`
  };
}
