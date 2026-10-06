# EU Tender Scout

EU Tender Scout is a read-only ChatGPT plugin for discovering and triaging European public procurement opportunities from the official TED (Tenders Electronic Daily) dataset.

It keeps official notice evidence separate from relevance assessment and does not treat TED `ACTIVE` status alone as proof that a competition is still open.

## What it does

- searches the official TED Search API v3;
- supports TED expert-search syntax;
- searches by country, CPV, full text, publication date, and combined criteria;
- distinguishes competition notices from award/history notices;
- classifies competition notices conservatively using returned submission deadlines;
- surfaces buyer, geography, CPV, publication date, deadline, value, currency, and canonical TED links when available;
- preserves the TED query used so searches can be inspected and reproduced;
- provides a focused cybersecurity-discovery preset.

## Example

> Find cybersecurity-related public procurement opportunities in Italy published between September 1 and October 4, 2026. Focus on confirmed open competitions and show the 5 most relevant opportunities. Keep official TED evidence separate from your relevance assessment.

## Opportunity triage

Returned notices are separated into:

- **confirmed open competitions** — competition notices with at least one current or future returned submission deadline;
- **closed competitions** — competition notices whose returned deadlines are all in the past;
- **openness not confirmed** — competition notices without enough returned deadline evidence;
- **contract award/history notices** — notices describing award or historical procurement outcomes;
- **other notice types** — notices that should be reviewed manually.

The classification is intentionally conservative. Official TED notices and procurement documents remain authoritative.

## Scope

EU Tender Scout is intended for procurement discovery and research. It does not submit bids, determine legal eligibility, or replace official procurement documents or professional advice.

## Privacy and terms

- [Privacy Policy](PRIVACY.md)
- [Terms of Service](TERMS.md)
- [Security Policy](SECURITY.md)

## License

GNU General Public License v3.0 only (`GPL-3.0-only`). See [LICENSE](LICENSE).
