// Anonymous-first, fire-and-forget analytics tracker.
// Uses navigator.sendBeacon (survives page unload), with fetch({keepalive:true}) fallback.
// All errors are swallowed — never throws, never blocks UI.

const ENDPOINT = "/api/v1/analytics/event";

function getAnonymousId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("anon_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("anon_id", id);
  }
  return id;
}

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = sessionStorage.getItem("session_id");
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem("session_id", id);
  }
  return id;
}

function track(event_name: string, properties: Record<string, unknown> = {}): void {
  if (typeof window === "undefined") return;

  const payload = JSON.stringify({
    anonymous_id: getAnonymousId(),
    session_id: getSessionId(),
    event_name,
    properties,
  });

  try {
    const blob = new Blob([payload], { type: "application/json" });
    if (navigator.sendBeacon(ENDPOINT, blob)) return;
  } catch {
    // sendBeacon not available or failed — fall through to fetch
  }

  // Fallback: keepalive fetch (survives page unload in modern browsers)
  fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {
    // Silently swallow all errors
  });
}

export const analytics = {
  appOpened: () => track("app_opened"),
  quizStarted: () => track("quiz_started"),
  quizCompleted: (profile: Record<string, unknown>) => track("quiz_completed", profile),
  productAddedToBuild: (data: {
    product_id: string;
    product_name: string;
    product_brand: string;
    category: string;
  }) => track("product_added_to_build", data),
  affiliateLinkClicked: (data: {
    product_id: string;
    product_name: string;
    retailer: string;
  }) => track("affiliate_link_clicked", data),
  accountCreated: () => track("account_created"),
  userLogin: () => track("user_login"),
};
