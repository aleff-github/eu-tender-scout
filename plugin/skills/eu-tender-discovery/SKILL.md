---
name: eu-tender-discovery
description: Search, classify, and triage EU public procurement notices from TED using official expert-search queries and evidence returned by the TED Search API.
---

Use this skill when the user wants to find, filter, compare, or triage EU public procurement opportunities published on TED.

## Workflow

1. Translate structured user criteria into TED expert-search syntax.
2. For open/current bidding opportunities, prefer `triage_tenders`.
3. For cybersecurity discovery with country/date filters, prefer `find_cybersecurity_opportunities`.
4. Use `search_tenders` for raw or unusual expert searches.
5. Use `validate_tender_query` only for explicit syntax validation or debugging a rejected query.
6. Keep `onlyLatestVersions=true` unless earlier versions are explicitly required.
7. Use `build_notice_links` for direct TED links when a publication number is already known.

## Interpretation rules

- TED `ACTIVE` is a search population, not proof that a notice is open for bids.
- Treat a competition as confirmed open only when notice type and returned deadline evidence support that conclusion.
- Keep closed competitions, award/history notices, and deadline-unknown competitions separate from confirmed-open opportunities.
- Do not infer missing deadlines, values, currencies, locations, or eligibility requirements.
- Preserve lot-level multiplicity where TED returns several deadlines, CPVs, locations, or values.
- Keep official TED evidence separate from the model's relevance assessment.
- Do not make binding legal eligibility or procurement-compliance decisions.
- If TED returns a timeout, rate limit, syntax error, or partial response, state that limitation.

## Output

Show the TED query used, lead with confirmed-open opportunities when requested, include the returned evidence fields, and keep non-open matching notices in a separate section.
