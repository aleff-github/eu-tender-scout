import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";
import {
  buildCybersecurityTenderQuery,
  buildTedNoticeLinks,
  DEFAULT_TENDER_FIELDS,
  searchAndTriageTedNotices,
  searchTedNotices,
  validateTedQuery
} from "./ted";

interface Env {
  OPENAI_APPS_CHALLENGE?: string;
}

function asTextPayload(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value, null, 2)
      }
    ]
  };
}

function errorPayload(error: unknown) {
  return {
    ...asTextPayload({
      error: error instanceof Error ? error.message : String(error)
    }),
    isError: true
  };
}

function createServer() {
  const server = new McpServer({
    name: "eu-tender-scout",
    version: "0.1.4"
  });

  server.registerTool(
    "validate_tender_query",
    {
      description:
        "Validate a TED expert-search query against the official TED Search API before executing a tender search.",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true
      },
      inputSchema: z.object({
        query: z
          .string()
          .min(1)
          .describe("TED expert-search query, for example: buyer-country = ITA AND FT ~ cybersecurity."),
        scope: z
          .enum(["ACTIVE", "LATEST", "ALL"])
          .default("ACTIVE")
          .describe("TED search population."),
        onlyLatestVersions: z
          .boolean()
          .default(true)
          .describe("Ask TED to prefer only the latest notice versions.")
      })
    },
    async ({ query, scope, onlyLatestVersions }) => {
      try {
        return asTextPayload(
          await validateTedQuery(query, {
            scope,
            onlyLatestVersions
          })
        );
      } catch (error) {
        return errorPayload(error);
      }
    }
  );

  server.registerTool(
    "search_tenders",
    {
      description:
        "Run a raw TED expert-search query against the official anonymous TED Search API. Use triage_tenders instead when the user asks for bidding opportunities, because TED ACTIVE scope can also contain award/history notices. Results are capped at 50 notices per call.",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true
      },
      inputSchema: z.object({
        query: z
          .string()
          .min(1)
          .describe(
            "TED expert-search query. Examples: buyer-country = ITA; classification-cpv = 72*; FT ~ cybersecurity; combine expressions with AND/OR/NOT."
          ),
        fields: z
          .array(z.string().min(1))
          .max(25)
          .optional()
          .describe(
            `TED fields to return. Defaults to: ${DEFAULT_TENDER_FIELDS.join(", ")}.`
          ),
        page: z
          .number()
          .int()
          .min(1)
          .default(1)
          .describe("One-based result page."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .default(20)
          .describe("Number of notices to return. Maximum 50."),
        scope: z
          .enum(["ACTIVE", "LATEST", "ALL"])
          .default("ACTIVE")
          .describe(
            "ACTIVE for current notices, LATEST for the latest OJ S release, or ALL for the wider searchable archive."
          ),
        onlyLatestVersions: z
          .boolean()
          .default(true)
          .describe("Return only the latest versions of notices when supported by TED.")
      })
    },
    async ({ query, fields, page, limit, scope, onlyLatestVersions }) => {
      try {
        return asTextPayload(
          await searchTedNotices({
            query,
            fields,
            page,
            limit,
            scope,
            onlyLatestVersions,
            checkQuerySyntax: false
          })
        );
      } catch (error) {
        return errorPayload(error);
      }
    }
  );

  server.registerTool(
    "triage_tenders",
    {
      description:
        "Search TED and return a compact evidence-first triage that separates confirmed open bidding opportunities from closed competitions, award/history notices, and other notice types. Prefer this tool when the user asks for active or open opportunities.",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true
      },
      inputSchema: z.object({
        query: z
          .string()
          .min(1)
          .describe("TED expert-search query."),
        page: z
          .number()
          .int()
          .min(1)
          .default(1)
          .describe("One-based result page."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .default(20)
          .describe("Number of TED notices to triage. Maximum 50."),
        scope: z
          .enum(["ACTIVE", "LATEST", "ALL"])
          .default("ACTIVE")
          .describe(
            "TED search population. ACTIVE is not itself proof that a notice is open for bids."
          ),
        onlyLatestVersions: z
          .boolean()
          .default(true)
          .describe("Return only the latest versions of notices when supported by TED."),
        preferredLanguage: z
          .string()
          .regex(/^[A-Za-z]{2,3}$/)
          .default("en")
          .describe(
            "Preferred language for normalized title, buyer, and TED links, for example en or it."
          )
      })
    },
    async ({
      query,
      page,
      limit,
      scope,
      onlyLatestVersions,
      preferredLanguage
    }) => {
      try {
        return asTextPayload(
          await searchAndTriageTedNotices({
            query,
            page,
            limit,
            scope,
            onlyLatestVersions,
            preferredLanguage,
            checkQuerySyntax: false
          })
        );
      } catch (error) {
        return errorPayload(error);
      }
    }
  );

  server.registerTool(
    "find_cybersecurity_opportunities",
    {
      description:
        "Find and triage cybersecurity procurement opportunities using a high-precision TED full-text preset. The preset favors explicit terms such as cybersecurity, SIEM, CSIRT, incident response, network security, and security operations center, avoiding ambiguous standalone abbreviations such as SOC or EDR.",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true
      },
      inputSchema: z.object({
        country: z
          .string()
          .regex(/^[A-Za-z]{3}$/)
          .optional()
          .describe(
            "Optional three-letter TED buyer-country code such as ITA, FRA, or DEU."
          ),
        publicationFrom: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional()
          .describe("Optional earliest publication date in YYYY-MM-DD format."),
        publicationTo: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional()
          .describe("Optional latest publication date in YYYY-MM-DD format."),
        page: z
          .number()
          .int()
          .min(1)
          .default(1),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .default(20),
        preferredLanguage: z
          .string()
          .regex(/^[A-Za-z]{2,3}$/)
          .default("en")
      })
    },
    async ({
      country,
      publicationFrom,
      publicationTo,
      page,
      limit,
      preferredLanguage
    }) => {
      try {
        const query = buildCybersecurityTenderQuery({
          country,
          publicationFrom,
          publicationTo
        });

        return asTextPayload({
          preset: {
            name: "cybersecurity-high-precision-v1",
            query
          },
          ...(await searchAndTriageTedNotices({
            query,
            page,
            limit,
            scope: "ACTIVE",
            onlyLatestVersions: true,
            preferredLanguage,
            checkQuerySyntax: false
          }))
        });
      } catch (error) {
        return errorPayload(error);
      }
    }
  );

  server.registerTool(
    "build_notice_links",
    {
      description:
        "Build canonical TED web, HTML, PDF, signed-PDF, and XML links for a known TED publication number without making another external request.",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
        idempotentHint: true
      },
      inputSchema: z.object({
        publicationNumber: z
          .string()
          .min(1)
          .describe("TED publication number such as 291298-2024."),
        language: z
          .string()
          .regex(/^[A-Za-z]{2}$/)
          .default("en")
          .describe("Two-letter display language, for example en or it.")
      })
    },
    async ({ publicationNumber, language }) => {
      try {
        return asTextPayload(
          buildTedNoticeLinks(publicationNumber, language)
        );
      } catch (error) {
        return errorPayload(error);
      }
    }
  );

  return server;
}

export default {
  fetch(request: Request, env: Env, context: any) {
    const url = new URL(request.url);
    if (url.pathname === "/.well-known/openai-apps-challenge") {
      const token = env.OPENAI_APPS_CHALLENGE;
      return new Response(token ?? "OpenAI apps challenge not configured", {
        status: token ? 200 : 404,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "no-store"
        }
      });
    }

    return createMcpHandler(() => createServer())(
      request,
      env,
      context
    );
  }
};
