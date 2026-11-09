# Privacy Policy

EU Tender Scout is a read-only public-procurement discovery tool.

## Data processed

When a search tool is used, the MCP service receives the structured tool arguments needed to perform the requested TED search. It sends the generated TED expert-search query and requested result fields to the official TED Search API to retrieve public procurement notices.

EU Tender Scout does not require a user account and is designed as a stateless service. It does not intentionally persist tender queries, returned notices, or ChatGPT conversation content in application storage.

The service is hosted on Cloudflare Workers. Infrastructure providers may process technical request and security telemetry under their own terms and policies.

## Data retention and Cloudflare telemetry

EU Tender Scout processes search arguments and TED results to answer a request. It does not intentionally write those searches, results, or ChatGPT conversation content to application-controlled persistent storage, so it has no application-level retention period for them.

The production service runs on Cloudflare Workers. In the Worker settings reviewed on November 9, 2026, **Workers Logs, Traces, and Issues were disabled**, and **no observability export destination was configured for this Worker**. This means the service is not configured to persist or export those optional Workers observability datasets. These settings do not prevent Cloudflare from separately processing technical request or security information needed to operate and protect its infrastructure.

Cloudflare Workers also provides **aggregated operational metrics** (such as invocation counts, errors, and execution performance) independently of Workers Logs. Cloudflare states that Workers metrics can be inspected for **up to three months**. This is the available metrics history, **not** a guarantee that all underlying infrastructure or security data are deleted after three months.

For **technical request and security telemetry** that Cloudflare may process (for example, IP addresses, request metadata, routing information, and security signals), the applicable retention criteria depend on Cloudflare's role and the data involved:

- **When Cloudflare acts as a data processor for customer personal data:** Annex 1 of the [Cloudflare Data Processing Addendum](https://www.cloudflare.com/cloudflare-customer-dpa/) states that such data are retained until the earlier of (i) expiry or termination of the applicable agreement or (ii) when processing is no longer necessary for either party to perform its obligations under that agreement, to the extent applicable. Other applicable contractual or legal obligations may also govern handling of the data.
- **When Cloudflare acts as an independent controller:** Section 11 of [Cloudflare's Privacy Policy](https://www.cloudflare.com/privacypolicy/) describes retention based on the purposes of processing, the nature and sensitivity of the information, risks of unauthorized use or disclosure, whether less data would suffice, and relevant legal or contractual requirements. It does not provide one universal fixed period for all infrastructure and security data.

These Cloudflare retention rules and criteria concern provider-side processing, which is distinct from EU Tender Scout's lack of intentional application-level storage. For Workers metrics availability, see [Cloudflare's Workers metrics documentation](https://developers.cloudflare.com/workers/observability/metrics-and-analytics/).

## Third-party services

EU Tender Scout may communicate with:

- the official TED Search API operated for Tenders Electronic Daily;
- Cloudflare infrastructure used to host the MCP service.

The plugin does not sell user data and does not use tender-search data for advertising or behavioral profiling.

## User responsibility

Do not include passwords, authentication tokens, unnecessary personal data, confidential bid material, or other sensitive information in TED search queries.

## Changes

This policy may be updated if the service's data practices or third-party integrations change.
