import { useEffect, useRef } from "react";

/** Molten-forge ambient: warm radial heat + rising embers on canvas. */
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
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const COLORS = ["255,170,60", "255,120,30", "230,169,43", "255,196,77"];
    const N = Math.min(70, Math.floor(window.innerWidth / 24));
    const make = (i: number, atBottom: boolean) => ({
      x: Math.random() * w,
      y: atBottom ? h + Math.random() * 40 : Math.random() * h,
      r: 0.6 + Math.random() * 1.8,
      vy: -0.15 - Math.random() * 0.5,
      vx: (Math.random() - 0.5) * 0.25,
      life: 0,
      max: 200 + Math.random() * 260,
      col: COLORS[i % COLORS.length],
      sw: Math.random() * Math.PI * 2,
      bright: Math.random() < 0.12,
    });
    const embers = Array.from({ length: N }, (_, i) => make(i, false));

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < embers.length; i++) {
        const p = embers[i]!;
        p.life++;
        p.y += p.vy;
        p.x += p.vx + Math.sin(p.sw + p.life * 0.02) * 0.12;
        const t = p.life / p.max;
        if (t >= 1 || p.y < -20) Object.assign(p, make(i, true));
        const fade = Math.sin(Math.min(1, t) * Math.PI); // rise-in, fade-out
        const a = fade * (p.bright ? 0.9 : 0.5);
        const flick = 0.7 + 0.3 * Math.sin(p.sw + p.life * 0.2);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (p.bright ? 1.4 : 1), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.col}, ${a * flick})`;
        ctx.shadowBlur = p.bright ? 14 : 8;
        ctx.shadowColor = `rgba(${p.col}, 0.8)`;
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
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
      <div aria-hidden style={glow} />
      <canvas ref={ref} aria-hidden style={canvasStyle} />
    </>
  );
}

const glow: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: -2,
  pointerEvents: "none",
  background:
    "radial-gradient(900px 600px at 82% -8%, rgba(255,106,26,0.12), transparent 58%)," +
    "radial-gradient(700px 900px at 6% 108%, rgba(255,140,60,0.10), transparent 60%)," +
    "radial-gradient(1200px 700px at 50% 120%, rgba(230,169,43,0.06), transparent 65%)",
};
const canvasStyle: React.CSSProperties = { position: "fixed", inset: 0, zIndex: -1, pointerEvents: "none" };
