"use client";

import { useEffect } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import { analytics } from "@/lib/analytics";

function AppOpenedTracker() {
  useEffect(() => {
    if (!sessionStorage.getItem("app_opened_fired")) {
      analytics.appOpened();
      sessionStorage.setItem("app_opened_fired", "1");
    }
  }, []);
  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AppOpenedTracker />
      {children}
    </AuthProvider>
  );
}
