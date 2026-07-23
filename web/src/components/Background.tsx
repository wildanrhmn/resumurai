import { useEffect, useRef } from "react";

/** Ambient: two fixed indigo glows + a slow drift of faint gold forge-sparks. */
export default function Background() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const canvas = ref.current;
    if (!canvas || reduce) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let w = 0;
    let h = 0;
    const resize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const N = Math.min(46, Math.floor(window.innerWidth / 34));
    const sparks = Array.from({ length: N }, (_, i) => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: 0.5 + Math.random() * 1.4,
      vy: -0.05 - Math.random() * 0.16,
      vx: (Math.random() - 0.5) * 0.12,
      a: 0.05 + Math.random() * 0.28,
      tw: Math.random() * Math.PI * 2,
      // vary by index so no Math.random-at-render dependency for seed determinism
      s: 0.4 + (i % 5) * 0.12,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of sparks) {
        p.y += p.vy;
        p.x += p.vx;
        p.tw += 0.02;
        if (p.y < -5) { p.y = h + 5; p.x = Math.random() * w; }
        const flick = p.a * (0.6 + 0.4 * Math.sin(p.tw));
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(224, 167, 43, ${flick})`;
        ctx.shadowBlur = 6;
        ctx.shadowColor = "rgba(244, 193, 78, 0.5)";
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <>
      <div aria-hidden className="bg-glow" style={glowStyle} />
      <canvas ref={ref} aria-hidden style={canvasStyle} />
    </>
  );
}

const glowStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: -2,
  pointerEvents: "none",
  background:
    "radial-gradient(700px 500px at 78% -6%, rgba(224,167,43,0.10), transparent 60%)," +
    "radial-gradient(900px 700px at 8% 12%, rgba(28,33,66,0.9), transparent 62%)",
};
const canvasStyle: React.CSSProperties = { position: "fixed", inset: 0, zIndex: -1, pointerEvents: "none" };
