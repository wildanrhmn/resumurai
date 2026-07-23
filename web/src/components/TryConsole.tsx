import { useEffect, useRef, useState } from "react";
import { EXAMPLES } from "./examples";

interface Sub { score: number; reason: string }
interface Ats {
  scoreBefore: number; scoreAfter: number;
  before: Record<string, Sub | number>; after: Record<string, Sub | number>;
}
interface Artifact { filename: string; mimeType: string; url: string }
interface Result {
  role: string; company: string; ats: Ats;
  gaps: { missingKeywords: string[]; injectedKeywords: string[]; notAddressable: string[]; unmetHardRequirements: string[] };
  positioningMemo: string; coverLetter: string; disclaimer: string; artifacts: Artifact[];
  limit_reached?: boolean; error?: string;
}

const SUBS = [
  ["keywordCoverage", "Keywords"],
  ["hardRequirements", "Requirements"],
  ["formatting", "Formatting"],
  ["completeness", "Completeness"],
] as const;

function useCountUp(target: number, run: boolean, ms = 900) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!run) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      setN(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run, ms]);
  return n;
}

export default function TryConsole() {
  const [resume, setResume] = useState("");
  const [jd, setJd] = useState("");
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; kind: "pdf" | "image"; base64: string; mediaType: string } | null>(null);

  const after = useCountUp(result?.ats.scoreAfter ?? 0, !!result, 1000);

  async function run(rOverride?: string, jOverride?: string) {
    const r = rOverride ?? resume;
    const j = jOverride ?? jd;
    if ((!r.trim() && !file) || !j.trim()) {
      setError("Add your résumé and a job description first.");
      return;
    }
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const body: Record<string, unknown> = { jobDescription: j };
      if (r.trim()) body.resume = r;
      if (file) body.resumeFile = { kind: file.kind, base64: file.base64, mediaType: file.mediaType };
      const res = await fetch("/try", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data: Result = await res.json();
      if (data.limit_reached) { setLocked(true); return; }
      if (!res.ok || data.error) { setError(data.error ?? "Something went wrong. Try again shortly."); return; }
      setResult(data);
    } catch {
      setError("Couldn't reach the forge. Check your connection and retry.");
    } finally {
      setBusy(false);
    }
  }

  function loadExample(i: number) {
    const ex = EXAMPLES[i];
    if (!ex) return;
    setResume(ex.resume);
    setJd(ex.jobDescription);
    setFile(null);
    void run(ex.resume, ex.jobDescription);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const isPdf = f.type === "application/pdf";
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = String(reader.result).split(",")[1] ?? "";
      setFile({ name: f.name, kind: isPdf ? "pdf" : "image", base64: b64, mediaType: isPdf ? "application/pdf" : f.type || "image/png" });
    };
    reader.readAsDataURL(f);
  }

  const sub = (rec: Record<string, Sub | number>, key: string) => {
    const v = rec[key];
    return typeof v === "number" ? v : (v?.score ?? 0);
  };

  return (
    <div className="console" id="console">
      <div className="console-bar">
        <span className="cdot a" /><span className="cdot b" /><span className="cdot c" />
        <span className="title">resumurai · dojo</span>
        <span className="live eyebrow dot-live" style={{ fontSize: 10 }}>live</span>
      </div>
      <div className="console-body">
        <div className="io-grid">
          <div className="field">
            <label htmlFor="resume">
              <span>Your résumé</span>
              <span className="attach" onClick={() => fileRef.current?.click()}>+ attach PDF / image</span>
            </label>
            <textarea id="resume" value={resume} disabled={busy || locked}
              onChange={(e) => setResume(e.target.value)}
              placeholder="Paste your résumé text — or attach a PDF/image and leave this blank." />
            <input ref={fileRef} type="file" accept="application/pdf,image/*" hidden onChange={onFile} />
            {file && (
              <span className="attached">📎 {file.name}<button onClick={() => setFile(null)} aria-label="Remove file">✕</button></span>
            )}
          </div>
          <div className="field">
            <label htmlFor="jd"><span>Target job description</span></label>
            <textarea id="jd" value={jd} disabled={busy || locked}
              onChange={(e) => setJd(e.target.value)}
              placeholder="Paste the full job posting you're aiming for." />
          </div>
        </div>

        <div className="console-actions">
          <button className="btn" onClick={() => run()} disabled={busy || locked}>
            {busy ? "Sharpening…" : "Sharpen my résumé"} <span className="arrow">→</span>
          </button>
          <div className="examples">
            {EXAMPLES.map((ex, i) => (
              <button key={ex.label} className="chip" disabled={busy || locked} onClick={() => loadExample(i)}>
                {ex.label}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="notice err">{error}</p>}
        {locked && (
          <p className="notice">
            The free daily demo limit has been reached — it resets within 24 hours. Agents can call the paid
            endpoint any time at <b style={{ color: "var(--gold)" }}>0.03 USDT</b> per résumé.
          </p>
        )}

        {result && (
          <div className="result">
            <div className="score-row">
              <div className="score-jump">
                <span className="score-big before">{result.ats.scoreBefore}</span>
                <span className="score-to">→</span>
                <span className="score-big after">{after}</span>
              </div>
              <div>
                <div className="score-meta">ATS match · {result.role}{result.company ? ` @ ${result.company}` : ""}</div>
                <div className="subscores" style={{ marginTop: 12 }}>
                  {SUBS.map(([key, label]) => (
                    <div className="sub" key={key}>
                      <div className="k">{label}</div>
                      <div className="v">{sub(result.ats.before, key)}<span className="to"> → {sub(result.ats.after, key)}</span></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="gaps">
              <div className="gap-box">
                <h4>Truthfully surfaced</h4>
                <div className="tags">
                  {result.gaps.injectedKeywords.length
                    ? result.gaps.injectedKeywords.map((k) => <span className="tag in" key={k}>{k}</span>)
                    : <span className="score-meta">—</span>}
                </div>
              </div>
              <div className="gap-box">
                <h4>Honest gaps to close</h4>
                <div className="tags">
                  {result.gaps.notAddressable.length
                    ? result.gaps.notAddressable.map((k) => <span className="tag miss" key={k}>{k}</span>)
                    : <span className="score-meta">None — you cover the role.</span>}
                </div>
              </div>
            </div>

            {result.positioningMemo && (
              <p className="memo"><b>Positioning</b>{result.positioningMemo}</p>
            )}

            <div className="downloads">
              {result.artifacts.map((a) => (
                <a className="dl" key={a.url} href={a.url} download={a.filename}>
                  ⬇ {a.filename}
                </a>
              ))}
            </div>
            <p className="disclaimer">{result.disclaimer}</p>
          </div>
        )}
      </div>
    </div>
  );
}
