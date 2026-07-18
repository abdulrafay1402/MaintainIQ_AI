import { useCallback, useEffect, useState } from 'react';
import PieChart from './PieChart';
import StatusBadge from './StatusBadge';
import StatusProgress from './StatusProgress';

// In-app pitch deck: a horizontal, keyboard-driven slide modal that explains
// the whole product. Visuals are REAL product components (progress bar, pie
// chart, QR frame, terminal) so the deck always matches the live theme.

const QrVisual = () => (
  <div className="flex flex-col items-center gap-5">
    <div className="qr-loader scale-[1.7]">
      <div className="qr-dots">{Array.from({ length: 16 }, (_, i) => <span key={i} />)}</div>
    </div>
    <p className="mt-6 font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-[#6E8F89]">PROJ-001 · scan to open</p>
  </div>
);

const ChaosVisual = () => (
  <div className="w-full space-y-2.5">
    {[
      ['📒', 'Register #3', 'entry missing…'],
      ['📞', 'Phone call', 'kis ne uthaya tha?'],
      ['💬', 'WhatsApp group', '412 unread messages'],
      ['📄', 'Excel sheet', 'v7_final_FINAL(2).xlsx'],
    ].map(([icon, title, sub], i) => (
      <div key={title} className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3" style={{ transform: `rotate(${(i % 2 ? 1 : -1) * 1.2}deg)` }}>
        <span className="text-xl">{icon}</span>
        <div>
          <p className="text-xs font-extrabold text-white">{title}</p>
          <p className="text-[10px] font-semibold text-rose-300/80">{sub}</p>
        </div>
        <span className="ml-auto text-rose-400 text-sm font-black">✗</span>
      </div>
    ))}
  </div>
);

const FlowVisual = () => (
  <div className="w-full space-y-3">
    {['Scan', 'Report', 'Diagnose', 'Maintain'].map((step, i) => (
      <div key={step} className="flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#2DD4BF] font-display text-xs font-black text-[#060C11] shadow-[0_6px_20px_rgba(45,212,191,0.4)]">{i + 1}</span>
        <div className="flex-1 rounded-2xl border border-[#2DD4BF]/20 bg-white/[0.03] px-4 py-2.5">
          <p className="font-display text-sm font-extrabold uppercase tracking-wide text-white">{step}</p>
        </div>
        {i < 3 ? <span className="text-[#2DD4BF] text-lg">↓</span> : <span className="text-lg">✅</span>}
      </div>
    ))}
  </div>
);

const TerminalVisual = () => (
  <div className="w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0A141A]">
    <div className="flex items-center gap-1.5 border-b border-white/8 px-4 py-2.5">
      <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
      <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
      <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
      <span className="ml-2 text-[9px] font-bold uppercase tracking-widest text-white/30">ai triage</span>
    </div>
    <div className="p-4 font-mono text-[11px] leading-6">
      <p className="text-white/45">$ report <span className="text-[#2DD4BF]">"AC pani tapak raha hai"</span></p>
      <p className="mt-1.5"><span className="text-[#8B7CF7]">title</span>: <span className="text-white/90">"Water leakage detected"</span></p>
      <p><span className="text-[#8B7CF7]">priority</span>: <span className="text-[#FF5F57] font-bold">"High"</span></p>
      <p><span className="text-[#8B7CF7]">causes</span>: <span className="text-white/90">["Blocked drain", "Dirty filter"]</span></p>
      <p><span className="text-[#8B7CF7]">recurring</span>: <span className="text-[#FEBC2E]">"⚠ 2nd issue in 90 days"</span></p>
    </div>
  </div>
);

const WorkflowVisual = () => (
  <div className="w-full space-y-5">
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
      <StatusProgress status="Maintenance In Progress" />
    </div>
    <div className="flex flex-wrap justify-center gap-2">
      <StatusBadge value="Reported" />
      <StatusBadge value="Under Inspection" />
      <StatusBadge value="Resolved" />
      <StatusBadge value="Verified" />
    </div>
    <p className="text-center text-[10px] font-bold uppercase tracking-[0.2em] text-[#6E8F89]">Invalid jumps? Server bolta hai: 400 ❌</p>
  </div>
);

const RolesVisual = () => (
  <div className="grid w-full grid-cols-2 gap-2.5">
    {[
      ['👑', 'Admin', 'Assets · approvals · analytics'],
      ['🔧', 'Technician', 'Inspect · repair · evidence'],
      ['⭐', 'Supervisor', 'Verify · reopen · team stats'],
      ['🎓', 'Reporter', 'Scan · report · track'],
    ].map(([icon, role, desc]) => (
      <div key={role} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3.5 text-center">
        <span className="text-2xl">{icon}</span>
        <p className="mt-1.5 font-display text-sm font-extrabold text-white">{role}</p>
        <p className="mt-0.5 text-[9px] font-semibold leading-relaxed text-[#A9C4BE]">{desc}</p>
      </div>
    ))}
  </div>
);

const AnalyticsVisual = () => (
  <div className="w-full [&_section]:!border-white/8 [&_section]:!bg-white/[0.03] [&_h2]:!text-white">
    <PieChart
      title="Complaints by status"
      rows={[
        { label: 'Resolved', count: 9 },
        { label: 'In Progress', count: 4 },
        { label: 'Reported', count: 3 },
        { label: 'Verified', count: 2 },
      ]}
      colorFor={(label) => ({ Resolved: '#10b981', 'In Progress': '#f97316', Reported: '#f59e0b', Verified: '#14b8a6' }[label])}
    />
  </div>
);

const StackVisual = () => (
  <div className="flex w-full flex-wrap justify-center gap-2">
    {['React 18', 'Node + Express', 'MongoDB Atlas', 'Gemini AI', 'Three.js', 'Cloudinary', 'JWT + 2FA', 'Tailwind v4', 'Vercel', 'TanStack Query'].map((tech) => (
      <span key={tech} className="rounded-full border border-[#2DD4BF]/25 bg-[#2DD4BF]/8 px-3.5 py-1.5 font-mono text-[11px] font-bold text-[#2DD4BF]">
        {tech}
      </span>
    ))}
  </div>
);

const SLIDES = [
  {
    eyebrow: 'SMIT Final Hackathon 2026',
    title: <>MAINTAIN<span className="gradient-text">IQ</span></>,
    points: ['AI-Powered QR Maintenance & Asset History Platform', 'Scan. Report. Diagnose. Maintain.'],
    visual: <QrVisual />,
  },
  {
    eyebrow: 'The Problem',
    title: <>Maintenance = <span className="text-rose-400">Chaos</span></>,
    points: [
      'Complaints scattered across registers, calls, and WhatsApp',
      'Kaun se assets baar-baar fail ho rahe hain? Kisi ko nahi pata',
      'No accountability, no history, no prevention',
    ],
    visual: <ChaosVisual />,
  },
  {
    eyebrow: 'The Solution',
    title: <>Every asset gets a <span className="gradient-text">digital identity</span></>,
    points: [
      'Ek permanent QR — scan karo, safe public page khul jata hai',
      'No app, no login needed to report a fault',
      'Poora lifecycle ek controlled flow mein',
    ],
    visual: <FlowVisual />,
  },
  {
    eyebrow: 'AI Issue Triage — Gemini',
    title: <>Roman Urdu in, <span className="gradient-text">diagnosis out</span></>,
    points: [
      'Complaint kisi bhi zubaan mein — structured English work order out',
      'Title, category, priority, causes, safe checks + safety warnings',
      'Recurring-fault warning from asset history · 8s timeout · rule-based fallback',
    ],
    visual: <TerminalVisual />,
  },
  {
    eyebrow: 'Controlled Workflow',
    title: <>Server-enforced <span className="gradient-text">lifecycle</span></>,
    points: [
      'Reported → Assigned → Inspection → Maintenance → Resolved → Verified → Closed',
      'Frontend sirf legal transitions dikhata hai; backend sab enforce karta hai',
      'Reopen sirf supervisor/admin · resolve requires maintenance note',
    ],
    visual: <WorkflowVisual />,
  },
  {
    eyebrow: 'Roles & Accountability',
    title: <>Four roles, <span className="gradient-text">zero confusion</span></>,
    points: [
      'Self-signup + email OTP + admin approval queue',
      'Per-category supervisors review & verify completed work',
      'Immutable history: har action, har actor, hamesha ke liye',
    ],
    visual: <RolesVisual />,
  },
  {
    eyebrow: 'Ops Intelligence',
    title: <>Data that <span className="gradient-text">decides</span></>,
    points: [
      'Parts, costs & total spend per complaint aur per asset',
      'AI asset health reports · technician performance · service-due radar',
      'Charts, pies, CSV export — decorative nahi, operational',
    ],
    visual: <AnalyticsVisual />,
  },
  {
    eyebrow: 'Engineering',
    title: <>Built <span className="gradient-text">production-grade</span></>,
    points: [
      'Serverless-safe: awaited emails, shared-cache fix, cold-start friendly',
      'JWT (12h) + 2FA + rate limiting + validations on both ends',
      'Code-split 3D, lazy routes, PWA — fast on any phone',
    ],
    visual: <StackVisual />,
  },
  {
    eyebrow: 'Shukriya!',
    title: <>Scan karo, <span className="gradient-text">try karo</span></>,
    points: [
      'maintain-iq-ai.vercel.app',
      'Cube ka QR asli hai — apne phone se scan karke dekho 📱',
    ],
    visual: <QrVisual />,
  },
];

export default function SlideDeck({ open, onClose }) {
  const [index, setIndex] = useState(0);

  const goNext = useCallback(() => setIndex((i) => Math.min(i + 1, SLIDES.length - 1)), []);
  const goPrev = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), []);

  useEffect(() => {
    if (!open) return undefined;
    setIndex(0);
    const handleKey = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight') goNext();
      if (event.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose, goNext, goPrev]);

  if (!open) return null;

  return (
    // "dark" class forces dark-variant styling on embedded product components
    // (badges, progress, chart) even when the app itself is in light mode.
    <div className="dark fixed inset-0 z-[90] bg-[#060C11] text-white animate-fade-in">
      <div className="pointer-events-none absolute inset-0 bg-dot-grid opacity-30" />
      <div className="grain-overlay" />
      <div className="glow-orb h-[380px] w-[380px] -top-32 -left-24" style={{ background: 'rgba(45,212,191,0.12)' }} />
      <div className="glow-orb h-[340px] w-[340px] -bottom-28 -right-24" style={{ background: 'rgba(139,124,247,0.10)' }} />

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-5 py-4 sm:px-8">
        <p className="font-display text-xs font-black uppercase tracking-[0.3em] text-[#2DD4BF]">MaintainIQ · Pitch Deck</p>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] font-bold text-white/40">{String(index + 1).padStart(2, '0')} / {String(SLIDES.length).padStart(2, '0')}</span>
          <button
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full border border-white/15 text-white/70 transition-all hover:border-rose-400/60 hover:text-rose-400 cursor-pointer"
            aria-label="Close (Esc)"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Horizontal slide track */}
      <div className="relative z-10 h-[calc(100vh-140px)] overflow-hidden">
        <div
          className="flex h-full transition-transform duration-500"
          style={{ transform: `translateX(-${index * 100}%)`, transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
        >
          {SLIDES.map((slide, slideIndex) => (
            <div key={slideIndex} className="grid h-full w-full shrink-0 place-items-center overflow-y-auto px-6 sm:px-16">
              <div className="grid w-full max-w-5xl items-center gap-8 py-4 lg:grid-cols-2 lg:gap-14">
                {/* Text side */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#2DD4BF]">{slide.eyebrow}</p>
                  <h2 className="mt-3 font-display text-4xl font-black uppercase leading-[0.95] sm:text-5xl">{slide.title}</h2>
                  <ul className="mt-6 space-y-3">
                    {slide.points.map((point) => (
                      <li key={point} className="flex items-start gap-3 text-sm font-semibold leading-relaxed text-[#A9C4BE]">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2DD4BF]" />
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
                {/* Visual side */}
                <div className="flex items-center justify-center">{slide.visual}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Left / Right nav buttons */}
        <button
          onClick={goPrev}
          disabled={index === 0}
          className="absolute left-3 top-1/2 z-20 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-[#060C11]/70 text-white/80 backdrop-blur transition-all hover:border-[#2DD4BF]/60 hover:text-[#2DD4BF] disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer sm:left-6"
          aria-label="Previous slide"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <button
          onClick={goNext}
          disabled={index === SLIDES.length - 1}
          className="absolute right-3 top-1/2 z-20 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-[#060C11]/70 text-white/80 backdrop-blur transition-all hover:border-[#2DD4BF]/60 hover:text-[#2DD4BF] disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer sm:right-6"
          aria-label="Next slide"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      {/* Progress dots + hint */}
      <div className="relative z-10 flex flex-col items-center gap-2.5 pb-5">
        <div className="flex items-center gap-2">
          {SLIDES.map((_, dotIndex) => (
            <button
              key={dotIndex}
              onClick={() => setIndex(dotIndex)}
              className={`h-1.5 rounded-full transition-all cursor-pointer ${dotIndex === index ? 'w-7 bg-[#2DD4BF]' : 'w-1.5 bg-white/20 hover:bg-white/40'}`}
              aria-label={`Go to slide ${dotIndex + 1}`}
            />
          ))}
        </div>
        <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-white/25">← → navigate · Esc close</p>
      </div>
    </div>
  );
}
