import { useEffect, useRef, useState } from "react";
import Background from "./components/Background";
import TryConsole from "./components/TryConsole";

const Katana = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M3 21L18 6" stroke="#e0a72b" strokeWidth="2" strokeLinecap="round" />
    <path d="M18 6l3-3-1.5 3.5L18 6z" fill="#f4c14e" stroke="#f4c14e" strokeWidth="1" strokeLinejoin="round" />
    <path d="M3 21l-1 1M5 19l1.5 1.5" stroke="#8a93b2" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

const FORGE = [
  ["01", "Read", "Paste your résumé and the exact job you want. Attach a PDF or image and Resumurai reads it too."],
  ["02", "Score", "It scores your résumé against the role's real ATS keywords, hard requirements, formatting, and completeness — and shows you every number."],
  ["03", "Reforge", "It rewrites and reorders around the role, surfacing your real strengths in the posting's own language. It never invents experience."],
  ["04", "Deliver", "You get an ATS-safe .docx and .pdf, a tailored cover letter, and an honest list of the gaps left to close."],
] as const;

export default function App() {
  const [lit, setLit] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("in")),
      { threshold: 0.14 },
    );
    document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
    const t = setTimeout(() => setLit(true), reduce ? 0 : 320);
    return () => { io.disconnect(); clearTimeout(t); };
  }, []);

  return (
    <>
      <Background />

      <nav className="nav">
        <div className="inner">
          <a className="brand" href="/"><Katana className="mark" /> Resumurai</a>
          <div className="nav-links">
            <a href="#forge">How it works</a>
            <a href="#console">Try it</a>
            <a href="#agents">For agents</a>
            <a className="nav-cta" href="#console">Sharpen →</a>
          </div>
        </div>
      </nav>

      {/* ---------------- hero ---------------- */}
      <section className="hero">
        <div className="inner hero-grid">
          <div>
            <span className="eyebrow reveal">Résumé × job, reforged</span>
            <h1 className="reveal">
              Slice your résumé<br />to cut through<br />the <span className="gild">ATS</span>.
            </h1>
            <p className="lede reveal">
              Paste your résumé and a job. Resumurai scores it, reforges it for that exact role, and hands
              back a real ATS-safe <b style={{ color: "var(--paper)" }}>.docx</b> and{" "}
              <b style={{ color: "var(--paper)" }}>.pdf</b> — plus a cover letter. It sharpens your real
              experience. It never fabricates.
            </p>
            <div className="hero-cta reveal">
              <a className="btn" href="#console">Sharpen my résumé <span className="arrow">→</span></a>
              <a className="btn btn-ghost" href="#forge">See how it works</a>
            </div>
            <div className="hero-proof reveal">
              <div className="proof"><b>ATS-safe</b><span>.docx + .pdf</span></div>
              <div className="proof"><b>0.03 USDT</b><span>per résumé</span></div>
              <div className="proof"><b>Zero</b><span>fabrication</span></div>
            </div>
          </div>

          <div className="blade-panel reveal" aria-hidden>
            <div className="cap">
              <span>ATS match</span>
              <span className="dot-live">live forge</span>
            </div>
            <div className="blades">
              <div className="blade-col">
                <div className="blade before">
                  <div className="fill" style={{ height: lit ? "58%" : "8%" }} />
                  <div className="edge" />
                </div>
                <div className="blade-score">58</div>
                <div className="blade-lbl">before</div>
              </div>
              <div className="blade-arrow"><b>cut →</b></div>
              <div className="blade-col">
                <div className={`blade ${lit ? "after" : ""}`}>
                  <div className="fill" style={{ height: lit ? "94%" : "8%" }} />
                  <div className="edge" />
                </div>
                <div className="blade-score hot">{lit ? "94" : "58"}</div>
                <div className="blade-lbl">reforged</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- forge / how it works ---------------- */}
      <section className="section-light" id="forge">
        <div className="cut top" />
        <div className="inner">
          <div className="forge-head">
            <div>
              <span className="eyebrow reveal">The four cuts</span>
              <h2 className="reveal" style={{ marginTop: 18 }}>From buried<br />to blade.</h2>
            </div>
            <p className="lede reveal">
              A résumé doesn't fail because you're unqualified. It fails because a parser never sees the
              qualification. Resumurai forges what's already there into something the filter — and the human
              behind it — can read.
            </p>
          </div>
          <div className="steps">
            {FORGE.map(([num, title, body]) => (
              <div className="step reveal" key={num}>
                <div className="num">{num}</div>
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- console ---------------- */}
      <section id="console">
        <div className="cut top" />
        <div className="inner">
          <div className="console-head reveal">
            <span className="eyebrow" style={{ justifyContent: "center" }}>Try the forge</span>
            <h2 style={{ marginTop: 16 }}>Watch it sharpen.</h2>
            <p className="lede">
              Use a sample or paste your own. Free while you're on the site — resets daily. Agents pay per call.
            </p>
          </div>
          <div className="reveal"><TryConsole /></div>
        </div>
      </section>

      {/* ---------------- agents / api ---------------- */}
      <section id="agents">
        <div className="cut top" />
        <div className="inner agents-grid">
          <div className="reveal">
            <span className="eyebrow">On the OKX.AI marketplace</span>
            <h2 style={{ marginTop: 16 }}>An A2MCP<br />service for agents.</h2>
            <p className="lede" style={{ marginTop: 22 }}>
              Resumurai is a paid agent service. Any agent can send a résumé and a job, pay per call in a
              stablecoin over x402, and get back scored, reforged, downloadable files — no account, no keys.
            </p>
            <ul className="spec">
              <li><b>Endpoint</b> POST /x402/tailor</li>
              <li><b>Payment</b> x402 · 0.03 USDT · X Layer (eip155:196)</li>
              <li><b>Returns</b> ATS score, gaps, .docx + .pdf + cover letter (base64 & URL)</li>
              <li><b>Guarantee</b> Reframes real experience — never fabricates</li>
            </ul>
          </div>
          <div className="terminal reveal">
            <div className="term-bar">
              <span className="cdot a" /><span className="cdot b" /><span className="cdot c" />
              <span className="path">POST /x402/tailor</span>
              <button className="copy" onClick={(e) => {
                navigator.clipboard?.writeText(CURL);
                (e.currentTarget as HTMLButtonElement).textContent = "copied";
              }}>copy</button>
            </div>
            <pre><code dangerouslySetInnerHTML={{ __html: CURL_HTML }} /></pre>
          </div>
        </div>
      </section>

      {/* ---------------- footer ---------------- */}
      <footer className="footer">
        <div className="inner">
          <div className="wordmark" aria-hidden>RESUMURAI</div>
          <div className="footer-row">
            <div className="brand"><Katana className="mark" /> Resumurai</div>
            <div className="meta">Sharpen your real experience. Never fabricate.</div>
            <div className="dojo">from the same dojo as <a href="https://scaminja.app">Scaminja 🥷</a></div>
          </div>
        </div>
      </footer>
    </>
  );
}

const CURL = `curl -X POST https://resumurai.app/x402/tailor \\
  -H "content-type: application/json" \\
  -d '{
    "resume": "…your résumé text…",
    "jobDescription": "…the target job posting…"
  }'`;

const CURL_HTML = CURL
  .replace(/curl|POST/g, '<span class="c-gold">$&</span>')
  .replace(/(-H|-d|-X)/g, '<span class="c-mut">$&</span>');
