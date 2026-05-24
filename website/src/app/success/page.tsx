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
              href="#"
              className="bg-white hover:bg-gray-50 transition-colors duration-200 p-8 flex flex-col items-start gap-3 group"
            >
              <svg
                className="w-8 h-8"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3"
                />
              </svg>
              <div className="text-left">
                <p className="text-xs font-bold tracking-[0.15em] uppercase text-gray-400 mb-1">
                  macOS
                </p>
                <p className="text-sm font-bold">Download .dmg</p>
              </div>
            </a>
            <a
              href="#"
              className="bg-white hover:bg-gray-50 transition-colors duration-200 p-8 flex flex-col items-start gap-3 group"
            >
              <svg
                className="w-8 h-8"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z"
                />
              </svg>
              <div className="text-left">
                <p className="text-xs font-bold tracking-[0.15em] uppercase text-gray-400 mb-1">
                  Windows
                </p>
                <p className="text-sm font-bold">Download .exe</p>
              </div>
            </a>
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
