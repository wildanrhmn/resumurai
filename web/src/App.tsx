import { useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { SplitText } from "gsap/SplitText";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Background from "./components/Background";
import TryConsole from "./components/TryConsole";

gsap.registerPlugin(useGSAP, SplitText, ScrollTrigger);

/** "Clean cut" — a solid block sliced and offset. Gradient defined once in <MoltenDefs/>. */
const Mark = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="20 20 60 60" fill="none" aria-hidden>
    <path d="M22 24 h56 v22 L22 66 Z" fill="url(#rm-molten)" />
    <path d="M22 74 L78 54 v22 H22 Z" fill="url(#rm-molten)" opacity="0.5" />
  </svg>
);

const MoltenDefs = () => (
  <svg width="0" height="0" aria-hidden style={{ position: "absolute" }}>
    <defs>
      <linearGradient id="rm-molten" x1="0" y1="1" x2="1" y2="0">
        <stop offset="0" stopColor="#ff5e0e" />
        <stop offset="0.55" stopColor="#ff8f3c" />
        <stop offset="1" stopColor="#ffd873" />
      </linearGradient>
    </defs>
  </svg>
);

const FORGE = [
  ["01", "Read", "Paste your résumé and the exact job you want. Attach a PDF or image, and Resumurai reads that too."],
  ["02", "Score", "It measures your résumé against the role's real ATS keywords, hard requirements, formatting, and completeness. Every number is shown."],
  ["03", "Reforge", "It rewrites and reorders around the role, surfacing your real strengths in the posting's own language. It never invents experience."],
  ["04", "Deliver", "You get an ATS-safe .docx and .pdf, a tailored cover letter, and an honest list of the gaps left to close."],
] as const;

export default function App() {
  const scope = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const magnetRef = useRef<HTMLAnchorElement>(null);

  useGSAP(
    () => {
      // Respect reduced motion — CSS fallbacks keep everything visible.
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      // Hero headline "forges in" — chars rise from ember-hot and cool to paper.
      const split = SplitText.create(titleRef.current, {
        type: "chars,words",
        charsClass: "char",
        autoSplit: true,
        onSplit(self) {
          return gsap.from(self.chars, {
            yPercent: 130,
            opacity: 0,
            filter: "blur(12px)",
            color: "#ff7a2e",
            stagger: 0.028,
            duration: 0.72,
            ease: "power3.out",
          });
        },
      });

      gsap.from(".hero .h-rise", {
        y: 22,
        opacity: 0,
        stagger: 0.1,
        duration: 0.7,
        ease: "power3.out",
        delay: 0.5,
      });

      // Scroll: draw molten seams at each section's top edge.
      gsap.utils.toArray<HTMLElement>(".seam").forEach((el) =>
        gsap.to(el, { scaleX: 1, duration: 1.1, ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 92%" } }),
      );

      // Forge cards rise in on scroll (clearProps so their :hover transitions stay intact).
      gsap.from(".steps .step", {
        opacity: 0,
        y: 38,
        stagger: 0.12,
        duration: 0.75,
        ease: "power3.out",
        clearProps: "transform,opacity",
        scrollTrigger: { trigger: ".steps", start: "top 82%", once: true },
      });

      ScrollTrigger.batch(".reveal", {
        start: "top 86%",
        onEnter: (els) => els.forEach((e, i) => setTimeout(() => e.classList.add("in"), i * 80)),
      });

      return () => split.revert();
    },
    { scope },
  );

  // Magnetic primary CTA — gentle pull, smooth return (no snap).
  const onMagnet = (e: React.PointerEvent) => {
    const el = magnetRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    gsap.to(el, {
      x: (e.clientX - (r.left + r.width / 2)) * 0.16,
      y: (e.clientY - (r.top + r.height / 2)) * 0.22,
      duration: 0.9,
      ease: "power2.out",
    });
  };
  const offMagnet = () => magnetRef.current && gsap.to(magnetRef.current, { x: 0, y: 0, duration: 0.9, ease: "power2.out" });

  return (
    <div ref={scope}>
      <MoltenDefs />
      <Background />

      <nav className="nav">
        <div className="inner">
          <a className="brand" href="/"><Mark className="mark" /> Resumurai</a>
          <div className="nav-links">
            <a href="#forge">The forge</a>
            <a href="#console">Test it</a>
            <a href="#agents">For agents</a>
            <a className="nav-cta" href="#console">Sharpen</a>
          </div>
        </div>
      </nav>

      {/* ---------------- hero ---------------- */}
      <header className="hero">
        <div className="inner hero-copy">
          <span className="kicker h-rise">OKX.AI · Agent service</span>
          <h1 ref={titleRef}>Reforge your résumé. Cut through the ATS.</h1>
          <p className="lede h-rise">
            Paste your résumé and the job you want. Resumurai scores it against the ATS, reforges it for
            that exact role, and returns a real ATS-safe <b style={{ color: "var(--paper)" }}>.docx</b> and{" "}
            <b style={{ color: "var(--paper)" }}>.pdf</b>, plus a cover letter. It sharpens your real
            experience. It never fabricates.
          </p>
          <div className="hero-cta h-rise">
            <a ref={magnetRef} className="btn" href="#console" onPointerMove={onMagnet} onPointerLeave={offMagnet}>
              Sharpen my résumé <span className="arrow">→</span>
            </a>
            <a className="btn btn-ghost" href="#forge">See the forge</a>
          </div>
          <div className="hero-stats h-rise">
            <div className="stat"><b>.docx + .pdf</b><span>ATS-safe output</span></div>
            <div className="stat"><b className="hot-word">0.03 USDT</b><span>per résumé</span></div>
            <div className="stat"><b>Zero</b><span>fabrication</span></div>
            <div className="stat"><b>Evidence</b><span>O*NET · LanguageTool · re-parse</span></div>
          </div>
        </div>
      </header>

      {/* ---------------- forge / how it works ---------------- */}
      <section id="forge">
        <div className="seam" />
        <div className="inner">
          <div className="sec-head reveal">
            <span className="kicker">The forge</span>
            <h2>Four strikes to a<br />sharper résumé.</h2>
            <p className="lede">
              A résumé rarely fails because you're unqualified. It fails because a parser never sees the
              qualification. Resumurai forges what's already there into something the filter, and the human
              behind it, can read.
            </p>
          </div>
          <div className="forge-wrap">
            <div className="steps">
              {FORGE.map(([n, title, body]) => (
                <div className="step" key={n}>
                  <span className="idx">{n}</span>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- console ---------------- */}
      <section id="console">
        <div className="seam" />
        <div className="inner">
          <div className="sec-head center reveal">
            <span className="kicker">Test the blade</span>
            <h2>Watch it get sharpened.</h2>
            <p className="lede" style={{ marginInline: "auto" }}>
              Use a sample or paste your own. Free on the site, resets daily. Agents pay per call.
            </p>
          </div>
          <div className="reveal"><TryConsole /></div>
        </div>
      </section>

      {/* ---------------- agents ---------------- */}
      <section id="agents">
        <div className="seam" />
        <div className="inner">
          <div className="agents-grid">
            <div className="reveal">
              <span className="kicker">For the agent economy</span>
              <h2 style={{ margin: "18px 0" }}>A service agents<br />can hire.</h2>
              <p className="lede">
                Resumurai is a paid agent service on OKX.AI. Any agent can send a résumé and a job, pay per
                call in a stablecoin over x402, and get back scored, reforged, downloadable files. No
                account, no keys.
              </p>
              <ul className="spec">
                <li><b>Endpoint</b> POST /x402/tailor</li>
                <li><b>Payment</b> x402 · 0.03 USDT · X Layer (eip155:196)</li>
                <li><b>Returns</b> ATS score, gaps, .docx + .pdf + cover letter</li>
                <li><b>Guarantee</b> Reframes real experience, never fabricates</li>
              </ul>
            </div>
            <div className="terminal reveal">
              <div className="term-bar">
                <span className="cdot a" /><span className="cdot b" /><span className="cdot c" />
                <span className="path">POST /x402/tailor</span>
                <button className="copy" onClick={(e) => { navigator.clipboard?.writeText(CURL); (e.currentTarget as HTMLButtonElement).textContent = "copied"; }}>copy</button>
              </div>
              <pre><code dangerouslySetInnerHTML={{ __html: CURL_HTML }} /></pre>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- footer ---------------- */}
      <footer className="footer">
        <div className="inner">
          <div className="wordmark" aria-hidden>RESUMURAI</div>
          <div className="footer-row">
            <div className="brand"><Mark className="mark" /> Resumurai</div>
            <div className="meta">Sharpen your real experience. Never fabricate.</div>
          </div>
          <div className="footer-credit">
            Role skills data from O*NET® (U.S. Department of Labor). Grammar checks by LanguageTool.
          </div>
        </div>
      </footer>
    </div>
  );
}

const CURL = `curl -X POST https://resumurai.xyz/x402/tailor \\
  -H "content-type: application/json" \\
  -d '{
    "resume": "…your résumé text…",
    "jobDescription": "…the target job posting…"
  }'`;

const CURL_HTML = CURL
  .replace(/curl|POST/g, '<span class="c-gold">$&</span>')
  .replace(/(-H|-d|-X)/g, '<span class="c-mut">$&</span>');
