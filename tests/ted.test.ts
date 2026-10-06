import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildCybersecurityTenderQuery,
  buildTedNoticeLinks,
  classifyTenderNotice,
  DEFAULT_TENDER_FIELDS,
  normalizeTenderNotice,
  searchTedNotices,
  triageTenderSearchResult,
  validateTedQuery
} from "../src/ted";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("TED Search API client", () => {
  it("builds a bounded ACTIVE page request with useful default fields", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          notices: [{ "publication-number": "123456-2026" }],
          totalNoticeCount: 1,
          timedOut: false
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      )
    );

    const result = await searchTedNotices({
      query: "buyer-country = ITA",
      limit: 100
    });

    expect(result.response.totalNoticeCount).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init?.body));

    expect(body.query).toBe("buyer-country = ITA");
    expect(body.limit).toBe(50);
    expect(body.page).toBe(1);
    expect(body.scope).toBe("ACTIVE");
    expect(body.paginationMode).toBe("PAGE_NUMBER");
    expect(body.onlyLatestVersions).toBe(true);
    expect(body.checkQuerySyntax).toBe(false);
    expect(body.fields).toEqual([...DEFAULT_TENDER_FIELDS]);
  });

  it("uses TED syntax-check mode without executing a broad page", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ notices: [] }), { status: 200 })
    );

    await validateTedQuery("classification-cpv = 72*");

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init?.body));

    expect(body.checkQuerySyntax).toBe(true);
    expect(body.limit).toBe(1);
    expect(body.fields).toEqual(["publication-number"]);
  });

  it("surfaces upstream HTTP errors with bounded details", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response('{"message":"bad query"}', { status: 400 })
    );

    await expect(
      searchTedNotices({ query: "not-a-real-field = x" })
    ).rejects.toThrow("HTTP 400");
  });
});

describe("TED notice links", () => {
  it("builds canonical public notice links", () => {
    const links = buildTedNoticeLinks("291298-2024", "it");

    expect(links.web).toBe(
      "https://ted.europa.eu/it/notice/291298-2024"
    );
    expect(links.xml).toBe(
      "https://ted.europa.eu/it/notice/291298-2024/xml"
    );
  });

  it("rejects malformed publication numbers", () => {
    expect(() => buildTedNoticeLinks("bad-id")).toThrow(
      "Publication number"
    );
  });
});


describe("TED opportunity triage", () => {
  const referenceDate = new Date("2026-10-04T12:00:00Z");

  it("treats contract award notices as history even under ACTIVE search scope", () => {
    const result = classifyTenderNotice(
      {
        "notice-type": "can-standard",
        "deadline-receipt-tender-date-lot": ["2026-10-30+01:00"]
      },
      referenceDate
    );

    expect(result.status).toBe("award-or-history");
  });

  it("confirms an open competition only when a returned deadline is current or future", () => {
    expect(
      classifyTenderNotice(
        {
          "notice-type": "cn-standard",
          "deadline-receipt-tender-date-lot": ["2026-10-12+02:00"]
        },
        referenceDate
      ).status
    ).toBe("open");

    expect(
      classifyTenderNotice(
        {
          "notice-type": "cn-standard",
          "deadline-receipt-tender-date-lot": ["2026-10-03+02:00"]
        },
        referenceDate
      ).status
    ).toBe("closed");
  });

  it("normalizes multilingual TED evidence without returning every translation", () => {
    const normalized = normalizeTenderNotice(
      {
        "publication-number": "669860-2026",
        "notice-type": "cn-standard",
        "notice-title": {
          ita: ["Titolo italiano"],
          eng: ["English title"]
        },
        "buyer-name": {
          ita: ["Regione Toscana"],
          eng: ["Tuscany Region"]
        },
        "classification-cpv": ["32400000", "32400000", "72700000"],
        "deadline-receipt-tender-date-lot": [
          "2026-10-12+02:00",
          "2026-10-12+02:00"
        ]
      },
      {
        preferredLanguage: "it",
        referenceDate
      }
    );

    expect(normalized.evidence.title).toBe("Titolo italiano");
    expect(normalized.evidence.buyer).toBe("Regione Toscana");
    expect(normalized.evidence.cpv).toEqual(["32400000", "72700000"]);
    expect(normalized.evidence.deadlines).toEqual(["2026-10-12+02:00"]);
    expect(normalized.availability.status).toBe("open");
    expect(normalized.evidence.tedLinks?.language).toBe("it");
  });

  it("separates confirmed open opportunities from non-open notices", () => {
    const result = triageTenderSearchResult(
      {
        request: {
          query: "buyer-country = ITA",
          scope: "ACTIVE",
          checkQuerySyntax: false
        },
        response: {
          notices: [
            {
              "publication-number": "100001-2026",
              "notice-type": "cn-standard",
              "deadline-receipt-tender-date-lot": ["2026-10-20+02:00"]
            },
            {
              "publication-number": "100002-2026",
              "notice-type": "can-standard"
            }
          ],
          totalNoticeCount: 2,
          timedOut: false
        }
      },
      { referenceDate }
    );

    expect(result.openOpportunities).toHaveLength(1);
    expect(result.nonOpenNotices).toHaveLength(1);
    expect(result.statusCounts.open).toBe(1);
    expect(result.statusCounts["award-or-history"]).toBe(1);
  });

  it("builds a high-precision cybersecurity preset without ambiguous standalone SOC or EDR terms", () => {
    const query = buildCybersecurityTenderQuery({
      country: "ita",
      publicationFrom: "2026-09-01",
      publicationTo: "2026-10-04"
    });

    expect(query).toContain("buyer-country = ITA");
    expect(query).toContain("FT ~ cybersecurity");
    expect(query).toContain('FT ~ "incident response"');
    expect(query).toContain("FT ~ SIEM");
    expect(query).toContain("FT ~ CSIRT");
    expect(query).not.toContain("FT ~ SOC");
    expect(query).not.toContain("FT ~ EDR");
  });
});
