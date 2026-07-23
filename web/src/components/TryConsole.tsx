import { useEffect, useRef, useState } from "react";
import { EXAMPLES } from "./examples";

interface Sub { score: number; reason: string }
interface Ats {
  scoreBefore: number; scoreAfter: number;
  before: Record<string, Sub | number>; after: Record<string, Sub | number>;
}
interface Artifact { filename: string; mimeType: string; url: string }
interface EvidenceItem { label: string; detail: string; source: string; status: "pass" | "warn" | "info" }
interface Result {
  role: string; company: string; ats: Ats;
  gaps: { missingKeywords: string[]; injectedKeywords: string[]; notAddressable: string[]; unmetHardRequirements: string[] };
  positioningMemo: string; coverLetter: string; disclaimer: string; artifacts: Artifact[]; evidence?: EvidenceItem[];
  limit_reached?: boolean; error?: string;
}
type FileKind = "pdf" | "docx" | "image";
interface Picked { name: string; size: number; kind: FileKind; base64: string; mediaType: string }

const SUBS = [
  ["keywordCoverage", "Keywords"],
  ["hardRequirements", "Requirements"],
  ["formatting", "Formatting"],
  ["completeness", "Completeness"],
] as const;

const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function detectKind(f: File): { kind: FileKind; mediaType: string } | null {
  const t = (f.type || "").toLowerCase();
  const n = f.name.toLowerCase();
  if (t === "application/pdf" || n.endsWith(".pdf")) return { kind: "pdf", mediaType: "application/pdf" };
  if (t.includes("wordprocessingml") || n.endsWith(".docx")) return { kind: "docx", mediaType: DOCX_TYPE };
  if (t.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/.test(n))
    return { kind: "image", mediaType: t.startsWith("image/") ? t : "image/png" };
  return null;
}
function prettySize(b: number): string {
  return b < 1024 ? `${b} B` : b < 1_048_576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1_048_576).toFixed(1)} MB`;
}

const IconUpload = (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden>
    <path d="M12 15V4M12 4l-4 4M12 4l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
const FileGlyph = ({ kind }: { kind: FileKind }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden>
    <path d="M6 2h8l4 4v14a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M14 2v4h4" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    <text x="12" y="17" textAnchor="middle" fontSize="5.4" fontFamily="monospace" fontWeight="700" fill="currentColor">
      {kind === "image" ? "IMG" : kind.toUpperCase()}
    </text>
  </svg>
);

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
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [file, setFile] = useState<Picked | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const after = useCountUp(result?.ats.scoreAfter ?? 0, !!result, 1000);

  async function run(rOverride?: string, jOverride?: string) {
    const r = rOverride ?? resume;
    const j = jOverride ?? jd;
    if ((!r.trim() && !file) || !j.trim()) {
      setError("Add your résumé (paste or upload) and a job description first.");
      return;
    }
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const body: Record<string, unknown> = { jobDescription: j };
      if (file) body.resumeFile = { kind: file.kind, base64: file.base64, mediaType: file.mediaType };
      else if (r.trim()) body.resume = r;
      const res = await fetch("/try", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data: Result = await res.json();
      if (data.limit_reached) { setLocked(true); return; }
      if (!res.ok || data.error) { setError(data.error ?? "Something went wrong. Try again shortly."); return; }
      setResult(data);
      setTimeout(() => document.getElementById("forge-result")?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 60);
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

  function pick(files: FileList | null | undefined) {
    const f = files?.[0];
    if (!f) return;
    const det = detectKind(f);
    if (!det) { setError("Unsupported file. Upload a PDF, DOCX, PNG, or JPG."); return; }
    if (f.size > 6_000_000) { setError("That file is over 6 MB. Try a smaller one."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      setError("");
      setFile({ name: f.name, size: f.size, kind: det.kind, base64: String(reader.result).split(",")[1] ?? "", mediaType: det.mediaType });
      setResume("");
    };
    reader.readAsDataURL(f);
  }
  function removeFile() {
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  const sub = (rec: Record<string, Sub | number>, key: string) => {
    const v = rec[key];
    return typeof v === "number" ? v : (v?.score ?? 0);
  };
  const disabled = busy || locked;

  return (
    <div className="console" id="console-card">
      {busy && <div className="forging-bar" aria-hidden />}
      <div className="console-bar">
        <span className="cdot a" /><span className="cdot b" /><span className="cdot c" />
        <span className="title">resumurai · forge</span>
        <span className="live forge-live">live</span>
      </div>
      <div className="console-body">
        <div className="io-grid">
          {/* résumé: paste or drag-drop upload */}
          <div className="field">
            <label>
              <span>Your résumé</span>
              {file && <span className="attach" onClick={removeFile}>remove</span>}
            </label>
            <div
              className={`dropzone ${dragging ? "dragging" : ""}`}
              onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
              onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
              onDrop={(e) => { e.preventDefault(); setDragging(false); if (!disabled) pick(e.dataTransfer.files); }}
            >
              {file ? (
                <div className="file-card">
                  <span className="file-ic"><FileGlyph kind={file.kind} /></span>
                  <span className="file-meta">
                    <b>{file.name}</b>
                    <span>{prettySize(file.size)} · {file.kind === "image" ? "Image" : file.kind.toUpperCase()} ready to forge</span>
                  </span>
                  <button className="file-x" onClick={removeFile} aria-label="Remove file" disabled={disabled}>✕</button>
                </div>
              ) : (
                <>
                  <textarea
                    value={resume}
                    disabled={disabled}
                    onChange={(e) => setResume(e.target.value)}
                    placeholder="Paste your résumé here…"
                  />
                  <div className="dz-foot">
                    <button type="button" className="dz-browse" disabled={disabled} onClick={() => fileRef.current?.click()}>
                      {IconUpload} Upload PDF, DOCX or image
                    </button>
                    <span className="dz-hint">or drop a file</span>
                  </div>
                </>
              )}
              {dragging && <div className="dz-overlay"><span>{IconUpload} Drop to forge</span></div>}
            </div>
            <input
              ref={fileRef}
              type="file"
              hidden
              accept=".pdf,.docx,.png,.jpg,.jpeg,.webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*"
              onChange={(e) => pick(e.target.files)}
            />
          </div>

          {/* job description */}
          <div className="field">
            <label htmlFor="jd"><span>Target job description</span></label>
            <textarea
              id="jd"
              className="jd-area"
              value={jd}
              disabled={disabled}
              onChange={(e) => setJd(e.target.value)}
              placeholder="Paste the full job posting you're aiming for."
            />
          </div>
        </div>

        <div className="console-actions">
          <button className="btn" onClick={() => run()} disabled={disabled}>
            {busy ? "Forging…" : "Sharpen my résumé"} <span className="arrow">→</span>
          </button>
          <div className="examples">
            <span className="ex-label">or try:</span>
            {EXAMPLES.map((ex, i) => (
              <button key={ex.label} className="chip" disabled={disabled} onClick={() => loadExample(i)}>
                {ex.label}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="notice err">{error}</p>}
        {locked && (
          <p className="notice">
            The free daily demo limit has been reached. It resets within 24 hours. Agents can call the paid
            endpoint any time at <b style={{ color: "var(--gold-hot)" }}>0.03 USDT</b> per résumé.
          </p>
        )}

        {result && (
          <div className="result" id="forge-result">
            {/* 1 — score banner */}
            <div className="res-score">
              <span className="res-eyebrow">ATS match · <b>{result.role}</b>{result.company ? ` @ ${result.company}` : ""}</span>
              <div className="res-score-nums">
                <span className="score-big before">{result.ats.scoreBefore}</span>
                <span className="score-to">→</span>
                <span className="score-big after">{after}</span>
                {result.ats.scoreAfter > result.ats.scoreBefore && (
                  <span className="score-delta">+{result.ats.scoreAfter - result.ats.scoreBefore} points</span>
                )}
              </div>
              <div className="res-bar">
                <div className="res-bar-base" style={{ width: `${result.ats.scoreBefore}%` }} />
                <div className="res-bar-gain" style={{ left: `${result.ats.scoreBefore}%`, width: `${Math.max(0, result.ats.scoreAfter - result.ats.scoreBefore)}%` }} />
              </div>
            </div>

            {/* 2 — sub-metrics */}
            <div className="res-metrics">
              {SUBS.map(([key, label]) => {
                const b = sub(result.ats.before, key);
                const a = sub(result.ats.after, key);
                return (
                  <div className="metric" key={key}>
                    <div className="metric-k">{label}</div>
                    <div className="metric-v">{b} → <em>{a}</em></div>
                    <div className="metric-bar">
                      <i className="ghost" style={{ width: `${b}%` }} />
                      <i className="fill" style={{ left: `${b}%`, width: `${Math.max(0, a - b)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 3 — verified evidence */}
            {result.evidence && result.evidence.length > 0 && (
              <div className="res-block">
                <h4 className="res-h">Evidence (independently checked)</h4>
                <ul className="ev-list">
                  {result.evidence.map((e, i) => (
                    <li className={`ev ev-${e.status}`} key={i}>
                      <span className="ev-ic">{e.status === "pass" ? "✓" : e.status === "warn" ? "!" : "•"}</span>
                      <span className="ev-body">
                        <span className="ev-head"><b>{e.label}</b><span className="ev-src">{e.source}</span></span>
                        <span className="ev-detail">{e.detail}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 4 — files */}
            <div className="res-block">
              <h4 className="res-h">Your files</h4>
              <div className="downloads">
                {result.artifacts.map((a) => (
                  <a className="dl" key={a.url} href={a.url} download={a.filename}>⬇ {a.filename}</a>
                ))}
              </div>
            </div>

            {/* 4 — what changed */}
            <div className="res-cols">
              <div>
                <h4 className="res-h up">Surfaced for this role</h4>
                {result.gaps.injectedKeywords.length ? (
                  <div className="tags">
                    {result.gaps.injectedKeywords.map((k) => <span className="tag" key={k}>{k}</span>)}
                  </div>
                ) : (
                  <p className="gap-empty">Nothing new needed to add.</p>
                )}
              </div>
              <div>
                <h4 className="res-h down">Honest gaps to close</h4>
                {result.gaps.notAddressable.length ? (
                  <ul className="gap-list">
                    {result.gaps.notAddressable.map((g, i) => <li key={i}>{g}</li>)}
                  </ul>
                ) : (
                  <p className="gap-empty">None. You already cover the role.</p>
                )}
              </div>
            </div>

            {/* 5 — positioning */}
            {result.positioningMemo && (
              <div className="res-block">
                <h4 className="res-h">Positioning</h4>
                <div className="memo-box"><p className="memo-text">{result.positioningMemo}</p></div>
              </div>
            )}

            <p className="disclaimer">{result.disclaimer}</p>
          </div>
        )}
      </div>
    </div>
  );
}
