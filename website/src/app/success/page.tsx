import Link from "next/link";

export default function SuccessPage() {
  return (
    <div className="min-h-screen bg-white text-black flex flex-col">
      {/* Nav */}
      <nav className="border-b border-black">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center">
          <Link
            href="/"
            className="text-sm font-bold tracking-[0.15em] uppercase"
          >
            ShortStamp
          </Link>
        </div>
      </nav>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-6 py-24">
        <div className="w-full max-w-lg text-center">
          {/* Stamp graphic */}
          <div className="inline-block border-[4px] border-black px-8 py-4 rotate-[-3deg] mb-12">
            <span className="text-4xl font-black tracking-[0.2em] uppercase">
              VERIFIED
            </span>
          </div>

          <div className="mb-10">
            <h1 className="text-5xl font-bold tracking-tight mb-4">
              You&apos;re in.
            </h1>
            <p className="text-gray-600 leading-relaxed max-w-md mx-auto">
              Your subscription is active. Download ShortStamp for your platform
              and start stamping.
            </p>
          </div>

          {/* Download options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-black mb-10">
            <a
              href="https://github.com/ShortStamp/v0.1/releases/latest/download/ShortStamp-0.1.0-mac.dmg"
              className="bg-white hover:bg-gray-50 transition-colors duration-200 p-8 flex flex-col items-start gap-3 group"
            >
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              <div className="text-left">
                <p className="text-xs font-bold tracking-[0.15em] uppercase text-gray-400 mb-1">
                  macOS
                </p>
                <p className="text-sm font-bold">Download .dmg</p>
                <p className="text-xs text-gray-400 mt-1">Intel · Apple Silicon via Rosetta</p>
              </div>
            </a>
            <div className="bg-white p-8 flex flex-col items-start gap-3 opacity-40 cursor-not-allowed">
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              <div className="text-left">
                <p className="text-xs font-bold tracking-[0.15em] uppercase text-gray-400 mb-1">
                  Windows
                </p>
                <p className="text-sm font-bold">Coming Soon</p>
                <p className="text-xs text-gray-400 mt-1">Windows build in progress</p>
              </div>
            </div>
          </div>

          {/* Setup instructions */}
          <div className="border border-black p-8 text-left mb-10">
            <h2 className="text-sm font-bold tracking-[0.15em] uppercase mb-6">
              Getting Started
            </h2>
            <ol className="space-y-4">
              {[
                "Install ShortStamp from the download above",
                "Open the app and log in with your account email + password",
                'Press Cmd+Shift+S (Mac) or Ctrl+Shift+S (Windows) to open the overlay',
                'Point it at anything on screen and hit "STAMP IT"',
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-4 text-sm">
                  <span className="font-bold text-gray-300 shrink-0 w-4">
                    {i + 1}.
                  </span>
                  <span className="text-gray-700">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <p className="text-xs text-gray-400">
            Need help?{" "}
            <a
              href="mailto:support@shortstamp.com"
              className="underline hover:text-black transition-colors duration-200"
            >
              support@shortstamp.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
