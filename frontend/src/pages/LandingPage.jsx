import { lazy, Suspense, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Reveal from '../components/Reveal';
import { useAuth } from '../context/AuthContext';

const ThreeHero = lazy(() => import('../components/ThreeHero'));
const SlideDeck = lazy(() => import('../components/SlideDeck'));

// The landing page is ALWAYS the dark signature look (independent of the app's
// theme toggle) — the QR cube and laser need the dark backdrop to read right.

const MARQUEE_ITEMS = ['SCAN', 'REPORT', 'DIAGNOSE', 'MAINTAIN', 'AI TRIAGE', 'QR ASSETS', 'ROMAN URDU SUPPORT', 'TAMPER-PROOF HISTORY', 'SUPERVISOR REVIEW'];

const FEATURES = [
  {
    title: 'Scan',
    body: 'Every asset gets a permanent QR identity. Scan it with any phone — no app, no login — and its safe public page opens instantly.',
  },
  {
    title: 'Report',
    body: 'Describe the fault in English or Roman Urdu, attach photo evidence, and submit. A unique ticket tracks it end to end.',
  },
  {
    title: 'Diagnose',
    body: 'AI triage turns the complaint into a professional title, category, priority, probable causes, and safe first checks — with recurring-fault warnings from history.',
  },
  {
    title: 'Maintain',
    body: 'Assignment, inspection, parts, cost, and supervisor-verified resolution flow through a controlled workflow, preserved forever.',
  },
];

const STEPS = [
  ['Admin registers the asset', 'A unique code + printable QR label is generated automatically.'],
  ['Anyone scans & reports', 'The public asset page takes complaints with evidence photos.'],
  ['AI triages instantly', 'Structured diagnosis, priority, and safety warnings — human-reviewed.'],
  ['Team resolves & verifies', 'Technician repairs, supervisor verifies, history remembers forever.'],
];

function Counter({ target, suffix = '' }) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let frame;
    const start = performance.now();
    const duration = 1400;
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      setValue(Math.round(target * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return <span className="tabular-nums">{value.toLocaleString()}{suffix}</span>;
}

export default function LandingPage() {
  const auth = useAuth();
  const user = auth?.user;
  const [deckOpen, setDeckOpen] = useState(false);

  const dashboardPath = user?.role === 'admin'
    ? '/admin/dashboard'
    : user?.role === 'technician'
      ? '/technician/dashboard'
      : '/student/dashboard';

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#060C11] text-white">
      {/* Atmosphere: orbs, dot grid, film grain */}
      <div className="glow-orb h-[460px] w-[460px] -top-44 -left-36" style={{ background: 'rgba(45,212,191,0.14)' }} />
      <div className="glow-orb h-[400px] w-[400px] top-1/2 -right-44" style={{ background: 'rgba(139,124,247,0.12)' }} />
      <div className="pointer-events-none absolute inset-0 bg-dot-grid opacity-40" />
      <div className="grain-overlay" />

      {/* ── Nav ── */}
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-[#2DD4BF]/40 bg-[#2DD4BF]/10 font-display text-sm font-black text-[#2DD4BF]">IQ</span>
          <div className="hidden sm:block">
            <p className="font-display text-sm font-extrabold leading-none tracking-wide">MAINTAINIQ</p>
            <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.35em] text-[#6E8F89]">Asset Intelligence</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          {user ? (
            <Link to={dashboardPath} className="rounded-full bg-[#2DD4BF] px-5 py-2.5 text-xs font-bold text-[#060C11] hover:opacity-90 shadow-[0_8px_28px_rgba(45,212,191,0.35)]">
              Open dashboard →
            </Link>
          ) : (
            <>
              <Link to="/login" className="rounded-full border border-white/15 px-5 py-2.5 text-xs font-bold text-white/80 hover:border-[#2DD4BF]/50 hover:text-white">
                Log in
              </Link>
              <Link to="/register" className="rounded-full bg-[#2DD4BF] px-5 py-2.5 text-xs font-bold text-[#060C11] hover:opacity-90 shadow-[0_8px_28px_rgba(45,212,191,0.35)]">
                Sign up
              </Link>
            </>
          )}
        </div>
      </header>

      {/* ── Hero: split typography wrapped AROUND the QR cube ── */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 pt-6 pb-10 lg:pt-10">
        <div className="grid items-center gap-4 lg:grid-cols-[1fr_minmax(340px,460px)_1fr]">
          {/* Left type block */}
          <Reveal className="text-center lg:text-right">
            <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#2DD4BF]">Har asset ki</p>
            <h1 className="mt-2 font-display leading-[0.88]">
              <span className="block text-5xl font-black uppercase sm:text-6xl xl:text-7xl">Digital</span>
              <span className="text-stroke block text-5xl font-black uppercase sm:text-6xl xl:text-7xl">Identity</span>
            </h1>
          </Reveal>

          {/* Center: THE QR CUBE — scan it for real */}
          <div className="relative mx-auto h-[340px] w-full max-w-md sm:h-[430px]">
            <Suspense fallback={<div className="grid h-full w-full place-items-center"><div className="qr-loader"><div className="qr-dots">{Array.from({ length: 16 }, (_, i) => <span key={i} />)}</div></div></div>}>
              <ThreeHero />
            </Suspense>
            <p className="pointer-events-none absolute -bottom-2 left-1/2 w-max -translate-x-1/2 text-[9px] font-bold uppercase tracking-[0.3em] text-[#6E8F89]">
              ↳ apne phone se scan karke dekho — yeh asli QR hai
            </p>
          </div>

          {/* Right type block */}
          <Reveal delay={150} className="text-center lg:text-left">
            <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#2DD4BF]">AI-powered CMMS</p>
            <h1 className="mt-2 font-display leading-[0.88]">
              <span className="text-stroke block text-5xl font-black uppercase sm:text-6xl xl:text-7xl">Zero</span>
              <span className="gradient-text block text-5xl font-black uppercase sm:text-6xl xl:text-7xl">Chaos</span>
            </h1>
            <p className="mt-5 hidden text-xs font-semibold leading-relaxed text-[#A9C4BE] lg:block">
              Scan → AI triage → repair → verify.<br />Poora lifecycle, ek platform.
            </p>
          </Reveal>
        </div>

        {/* CTAs + stats under the cube */}
        <Reveal delay={250}>
          <div className="mx-auto mt-10 flex max-w-2xl flex-col items-center gap-7">
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                to={user ? dashboardPath : '/register'}
                className="interactive-hover rounded-full bg-[#2DD4BF] px-8 py-4 text-sm font-black text-[#060C11] shadow-[0_14px_40px_rgba(45,212,191,0.35)]"
              >
                {user ? 'Go to your dashboard' : 'Get started free →'}
              </Link>
              <Link
                to="/login"
                className="interactive-hover rounded-full border border-white/15 px-8 py-4 text-sm font-bold text-white/85 hover:border-[#2DD4BF]/60"
              >
                Live demo login
              </Link>
            </div>
            <div className="grid w-full grid-cols-3 gap-3 text-center">
              {[
                [7, '', 'Lifecycle stages'],
                [2, '', 'Languages AI reads'],
                [100, '%', 'History tamper-proof'],
              ].map(([num, suffix, label]) => (
                <div key={label} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 backdrop-blur">
                  <p className="font-display text-3xl font-black text-white">
                    <Counter target={num} suffix={suffix} />
                  </p>
                  <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.2em] text-[#6E8F89]">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── Marquee strip ── */}
      <div className="relative z-10 border-y border-white/8 bg-white/[0.02] py-4 overflow-hidden">
        <div className="marquee-track">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex shrink-0 items-center" aria-hidden={copy === 1}>
              {MARQUEE_ITEMS.map((item) => (
                <span key={`${copy}-${item}`} className="mx-6 flex items-center gap-6 font-display text-sm font-black uppercase tracking-[0.25em] text-white/35">
                  {item}
                  <span className="text-[#2DD4BF]">◆</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── Terminal: the AI in action (dev-flavored proof) ── */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 py-16">
        <Reveal>
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0A141A] shadow-[0_30px_80px_rgba(0,0,0,0.5)]">
            <div className="flex items-center gap-2 border-b border-white/8 px-5 py-3.5">
              <span className="h-3 w-3 rounded-full bg-[#FF5F57]" />
              <span className="h-3 w-3 rounded-full bg-[#FEBC2E]" />
              <span className="h-3 w-3 rounded-full bg-[#28C840]" />
              <span className="ml-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">maintainiq — ai triage</span>
            </div>
            <div className="overflow-x-auto p-5 font-mono text-[11px] leading-6 sm:p-6 sm:text-[13px] sm:leading-7">
              <p className="text-white/40">$ <span className="text-white/90">report</span> <span className="text-[#2DD4BF]">"AC pani tapak raha hai aur cooling kam hai"</span></p>
              <p className="mt-3 text-white/35">→ analyzing asset AC-101 · history: 2 issues / 90 days · <span className="text-[#2DD4BF]">gemini-2.5-flash</span></p>
              <div className="mt-3 text-white/80">
                <p><span className="text-[#8B7CF7]">title</span>: <span className="text-[#EAF6F2]">"Water leakage and reduced cooling"</span></p>
                <p><span className="text-[#8B7CF7]">category</span>: <span className="text-[#EAF6F2]">"HVAC / Air Conditioning"</span></p>
                <p><span className="text-[#8B7CF7]">priority</span>: <span className="text-[#FF5F57] font-bold">"High"</span></p>
                <p><span className="text-[#8B7CF7]">causes</span>: <span className="text-[#EAF6F2]">["Blocked drain pipe", "Dirty filter", "Frozen coil"]</span></p>
                <p><span className="text-[#8B7CF7]">recurring</span>: <span className="text-[#FEBC2E]">"⚠ 2nd cooling issue in 90 days"</span></p>
              </div>
              <p className="mt-3 text-white/40">$ <span className="caret-blink text-[#2DD4BF]">▌</span></p>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── Features: editorial numbered rows ── */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-10">
        <Reveal>
          <div className="flex items-end justify-between border-b border-white/10 pb-5">
            <h2 className="font-display text-4xl font-black uppercase sm:text-5xl">
              The <span className="gradient-text">flow</span>
            </h2>
            <p className="hidden text-[10px] font-bold uppercase tracking-[0.3em] text-[#6E8F89] sm:block">04 steps / 00 paperwork</p>
          </div>
        </Reveal>
        <div className="mt-2">
          {FEATURES.map((feature, index) => (
            <Reveal key={feature.title} delay={index * 100}>
              <div className="group flex items-start gap-6 border-b border-white/8 py-7 transition-colors hover:bg-white/[0.02] sm:items-center sm:gap-10 px-2">
                <span className="font-display text-5xl font-black text-white/10 transition-colors group-hover:text-[#2DD4BF]/40 sm:text-6xl">
                  {`0${index + 1}`}
                </span>
                <div className="flex-1">
                  <h3 className="font-display text-xl font-extrabold uppercase tracking-wide group-hover:text-[#2DD4BF] transition-colors">{feature.title}</h3>
                  <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-[#A9C4BE]">{feature.body}</p>
                </div>
                <span className="hidden text-2xl text-white/15 transition-all group-hover:translate-x-2 group-hover:text-[#2DD4BF] sm:block">→</span>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-5 md:grid-cols-4">
          {STEPS.map(([title, body], index) => (
            <Reveal key={title} delay={index * 120}>
              <div className="relative h-full rounded-2xl border border-white/8 bg-white/[0.03] p-6 backdrop-blur transition-colors hover:border-[#2DD4BF]/40">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-[#2DD4BF] text-xs font-black text-[#060C11] shadow-[0_6px_20px_rgba(45,212,191,0.4)]">{index + 1}</span>
                <h3 className="mt-4 text-sm font-extrabold text-white">{title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-[#A9C4BE]">{body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Footer CTA ── */}
      <footer className="relative z-10 mx-auto max-w-6xl px-6 pb-16 pt-6">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] border border-[#2DD4BF]/20 p-10 text-center">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#2DD4BF]/10 via-transparent to-[#8B7CF7]/10" />
            <h2 className="relative font-display text-3xl font-black uppercase sm:text-4xl">
              Ready to give your assets <span className="gradient-text">a memory?</span>
            </h2>
            <p className="relative mt-2 text-xs font-semibold text-[#A9C4BE]">Register equipment · print QR labels · let AI handle the triage</p>
            <Link
              to={user ? dashboardPath : '/register'}
              className="interactive-hover relative mt-7 inline-block rounded-full bg-[#2DD4BF] px-9 py-4 text-sm font-black text-[#060C11] shadow-[0_14px_40px_rgba(45,212,191,0.4)]"
            >
              {user ? 'Open dashboard →' : 'Create your workspace →'}
            </Link>
          </div>
        </Reveal>
        {/* Preview slides — the in-app pitch deck */}
        <div className="mt-7 flex justify-center">
          <button
            onClick={() => setDeckOpen(true)}
            className="group inline-flex items-center gap-2.5 rounded-full border border-white/12 bg-white/[0.03] px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.2em] text-white/60 backdrop-blur transition-all hover:border-[#2DD4BF]/50 hover:text-[#2DD4BF] cursor-pointer"
          >
            <span className="grid h-5 w-5 place-items-center rounded-md border border-current text-[9px] transition-transform group-hover:scale-110">▶</span>
            Preview Slides
          </button>
        </div>

        <p className="mt-6 text-center text-[9px] font-bold uppercase tracking-[0.35em] text-white/25">MaintainIQ — SMIT Final Hackathon 2026</p>
      </footer>

      {deckOpen ? (
        <Suspense fallback={null}>
          <SlideDeck open={deckOpen} onClose={() => setDeckOpen(false)} />
        </Suspense>
      ) : null}
    </div>
  );
}
