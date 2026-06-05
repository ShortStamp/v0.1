import Link from "next/link";

const features = [
  {
    id: "01",
    title: "Fact Check",
    description:
      "Highlight any claim, stat, or headline on your screen. ShortStamp cross-references it against verified sources and returns a real/fake verdict with a confidence score.",
    category: "fact",
  },
  {
    id: "02",
    title: "AI Detection",
    description:
      "Instantly detect AI-generated images, deepfakes, and synthetic text. Know whether what you're looking at was created by a human or a model.",
    category: "media",
  },
  {
    id: "03",
    title: "Scam Links",
    description:
      "Before you click, ShortStamp analyzes URLs on screen for phishing patterns, domain spoofing, and known scam signatures.",
    category: "link",
  },
  {
    id: "04",
    title: "Misinformation",
    description:
      "News articles, social posts, screenshots — ShortStamp reads the context and flags narratives that contradict established consensus.",
    category: "general",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-black">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-black">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="text-sm font-bold tracking-[0.15em] uppercase">
            ShortStamp
          </span>
          <div className="flex items-center gap-8">
            <a
              href="#features"
              className="text-xs font-bold tracking-[0.15em] uppercase text-gray-500 hover:text-black transition-colors duration-200"
            >
              Features
            </a>
            <a
              href="#pricing"
              className="text-xs font-bold tracking-[0.15em] uppercase text-gray-500 hover:text-black transition-colors duration-200"
            >
              Pricing
            </a>
            <a
              href="#download"
              className="text-xs font-bold tracking-[0.15em] uppercase text-gray-500 hover:text-black transition-colors duration-200"
            >
              Download
            </a>
            <Link
              href="/subscribe"
              className="bg-black text-white px-5 py-2 text-xs font-bold tracking-[0.15em] uppercase hover:bg-gray-800 transition-colors duration-200"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-14 min-h-screen flex items-center border-b border-black">
        <div className="max-w-6xl mx-auto px-6 py-32 w-full">
          <div className="max-w-3xl">
            <p className="text-xs font-bold tracking-[0.2em] uppercase text-gray-400 mb-8">
              AI Legitimacy Overlay
            </p>
            <h1 className="text-[clamp(3rem,8vw,7rem)] font-bold leading-none tracking-tight mb-8">
              Is it
              <br />
              real?
            </h1>
            <p className="text-xl text-gray-600 max-w-xl mb-12 leading-relaxed">
              ShortStamp sits on your desktop and checks anything on your screen.
              Facts, links, images, claims — get an instant AI verdict without
              leaving your workflow.
            </p>
            <div className="flex items-center gap-4">
              <Link href="/subscribe" className="btn-primary">
                Download &amp; Subscribe — $60/mo
              </Link>
              <a href="#features" className="btn-secondary">
                See How It Works
              </a>
            </div>
            <p className="text-xs text-gray-400 mt-6 tracking-wide">
              Mac &amp; Windows · Press Cmd+Shift+S to activate · Cancel anytime
            </p>
          </div>
        </div>
        {/* Large stamp graphic */}
        <div className="hidden lg:flex absolute right-0 top-14 bottom-0 w-1/2 items-center justify-center pointer-events-none select-none">
          <div className="border-[6px] border-black p-10 rotate-[-8deg] opacity-[0.06]">
            <span className="text-[10rem] font-black tracking-widest uppercase leading-none">
              REAL
            </span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-b border-black">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="mb-16">
            <p className="text-xs font-bold tracking-[0.2em] uppercase text-gray-400 mb-4">
              What It Checks
            </p>
            <h2 className="text-5xl font-bold tracking-tight">
              Four ways to
              <br />
              verify the truth
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-black">
            {features.map((feature) => (
              <div
                key={feature.id}
                className="bg-white p-10 hover:bg-gray-50 transition-colors duration-200"
              >
                <div className="flex items-start gap-6">
                  <span className="text-xs font-bold tracking-[0.15em] text-gray-300 pt-1 shrink-0">
                    {feature.id}
                  </span>
                  <div>
                    <h3 className="text-xl font-bold tracking-wide uppercase mb-4">
                      {feature.title}
                    </h3>
                    <p className="text-gray-600 leading-relaxed text-sm">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-b border-black bg-black text-white">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="mb-16">
            <p className="text-xs font-bold tracking-[0.2em] uppercase text-gray-500 mb-4">
              How It Works
            </p>
            <h2 className="text-5xl font-bold tracking-tight">
              Three steps.
              <br />
              Under a second.
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
              {
                step: "01",
                title: "Activate",
                desc: "Press Cmd+Shift+S on Mac or Ctrl+Shift+S on Windows. The ShortStamp overlay appears instantly over your screen.",
              },
              {
                step: "02",
                title: "Stamp It",
                desc: "Hit the STAMP IT button. ShortStamp captures what's on your screen and sends it to our AI analysis pipeline.",
              },
              {
                step: "03",
                title: "Get the Verdict",
                desc: "In under a second, receive a clear verdict — REAL, FAKE, SCAM, or AI GENERATED — with a confidence score and explanation.",
              },
            ].map((item) => (
              <div key={item.step} className="border-t border-gray-700 pt-8">
                <span className="text-xs font-bold tracking-[0.2em] text-gray-500 uppercase">
                  Step {item.step}
                </span>
                <h3 className="text-2xl font-bold uppercase tracking-wider mt-4 mb-4">
                  {item.title}
                </h3>
                <p className="text-gray-400 leading-relaxed text-sm">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-b border-black">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="mb-16">
            <p className="text-xs font-bold tracking-[0.2em] uppercase text-gray-400 mb-4">
              Pricing
            </p>
            <h2 className="text-5xl font-bold tracking-tight">
              One plan.
              <br />
              Everything included.
            </h2>
          </div>
          <div className="max-w-md">
            <div className="border border-black p-10">
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-6xl font-black">$60</span>
                <span className="text-gray-500 text-sm font-medium">/month</span>
              </div>
              <p className="text-xs font-bold tracking-[0.15em] uppercase text-gray-400 mb-10">
                Billed monthly · Cancel anytime
              </p>
              <ul className="space-y-4 mb-10">
                {[
                  "Unlimited screen analyses",
                  "Fact checking with source citations",
                  "AI-generated content detection",
                  "Scam link analysis",
                  "Misinformation flagging",
                  "Mac &amp; Windows desktop app",
                  "Priority AI processing",
                  "Email support",
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm">
                    <span className="w-4 h-px bg-black shrink-0" />
                    <span dangerouslySetInnerHTML={{ __html: item }} />
                  </li>
                ))}
              </ul>
              <Link href="/subscribe" className="btn-primary block text-center">
                Subscribe &amp; Download
              </Link>
            </div>
            <p className="text-xs text-gray-400 mt-4 text-center">
              Secure payment via Stripe · 30-day money-back guarantee
            </p>
          </div>
        </div>
      </section>

      {/* Download */}
      <section id="download" className="border-b border-black">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="mb-16">
            <p className="text-xs font-bold tracking-[0.2em] uppercase text-gray-400 mb-4">
              Download
            </p>
            <h2 className="text-5xl font-bold tracking-tight">
              Get the app.
              <br />
              Start stamping.
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-black max-w-2xl">
            <a
              href="https://github.com/ShortStamp/v0.1/releases/latest/download/ShortStamp-0.1.0-mac.dmg"
              className="bg-white hover:bg-gray-50 transition-colors duration-200 p-10 flex flex-col gap-5"
            >
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              <div>
                <p className="text-xs font-bold tracking-[0.15em] uppercase text-gray-400 mb-1">macOS</p>
                <p className="text-lg font-bold mb-1">Download .dmg</p>
                <p className="text-xs text-gray-500">Intel · Apple Silicon via Rosetta · v0.1.0</p>
              </div>
            </a>
            <div className="bg-white p-10 flex flex-col gap-5 opacity-40">
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              <div>
                <p className="text-xs font-bold tracking-[0.15em] uppercase text-gray-400 mb-1">Windows</p>
                <p className="text-lg font-bold mb-1">Coming Soon</p>
                <p className="text-xs text-gray-500">Windows build in progress</p>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-6">
            Requires an active subscription · <Link href="/subscribe" className="underline hover:text-black transition-colors">Subscribe for $60/mo</Link>
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-6 py-12 flex items-center justify-between">
        <span className="text-sm font-bold tracking-[0.15em] uppercase">
          ShortStamp
        </span>
        <p className="text-xs text-gray-400 tracking-wide">
          &copy; {new Date().getFullYear()} ShortStamp. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
