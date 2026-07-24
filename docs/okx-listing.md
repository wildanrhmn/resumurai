# OKX.AI listing copy (P6)

Values to use with `onchainos agent create --role asp`. Formats mirror the Scaminja
listing that was approved (agent 5318).

- **Avatar:** `C:\Users\wilda\Downloads\resumurai-cut-avatar-1024.png` (1024x1024, square,
  full-bleed, 546 KB). Upload with `agent upload` immediately before `agent create`, because
  the returned CDN URL expires.
- **Service type:** `A2MCP`
- **Fee:** `0.03`
- **Endpoint:** `https://resumurai.xyz/x402/tailor`

## name (9 chars, limit 3-25)

```
Resumurai
```

## description (491 chars, limit 500)

```
Resumurai tailors a resume to one specific job. It scores the resume against the target role, rewrites and reorders it to surface the candidate's real strengths in the posting's own language, and returns a ready-to-send, ATS-safe Word document and PDF plus a matching cover letter. Every result carries a before-and-after ATS score with a component breakdown, the keywords it truthfully surfaced, and an honest list of gaps it could not close. It reframes real experience and never fabricates.
```

## service name (20 chars, limit 5-30)

```
ATS Resume Tailoring
```

## service description (497 chars, limit 500, two-part format)

```
1. Scores a resume against a target job description, rewrites it for that exact role, and returns an ATS-safe .docx and .pdf resume plus a tailored cover letter, with a before/after ATS score, the keywords surfaced, and the honest remaining gaps, as JSON.
2. User must provide POST or GET parameters: required: resume (the resume text) or resumeFile ({kind: pdf|docx|image, base64, mediaType}), and jobDescription (the target job posting text). Optional: options.includeCoverLetter (default true).
```

## Order of operations

1. VPN on (OKX is ISP-filtered on this connection).
2. `onchainos agent x402-check --endpoint https://resumurai.xyz/x402/tailor` -> expect `valid:true`.
3. `onchainos agent pre-check --role asp` (ToS consent, if not already accepted on this account).
4. `onchainos agent upload --file <avatar>` -> copy the returned CDN URL.
5. `onchainos agent create --role asp --name ... --description ... --picture <url> --service '[...]'`
   Writes the endpoint on-chain permanently, so confirm before running.
6. `onchainos agent activate` (needs the okx-a2a helper: `npm i -g @okxweb3/a2a-node` then
   `okx-a2a doctor --fix`).
7. Wait for review (Scaminja took about 2 days).
