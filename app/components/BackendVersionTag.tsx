"use client";

import { useEffect } from "react";

const isBrowserProduction =
  typeof window !== "undefined" && window.location.hostname !== "localhost";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (isBrowserProduction ? "" : "http://localhost:3000");

export default function BackendVersionTag() {
  useEffect(() => {
    const fetchVersion = async () => {
      try {
        if (!API_URL) {
          document.documentElement.setAttribute("data-backend-version", "unknown");
          return;
        }

        const res = await fetch(`${API_URL}/version`, {
          headers: { "ngrok-skip-browser-warning": "true" },
        });

        if (!res.ok) {
          document.documentElement.setAttribute("data-backend-version", "unknown");
          return;
        }

        const json = await res.json();
        const version = json?.version || "unknown";
        document.documentElement.setAttribute("data-backend-version", version);
      } catch {
        document.documentElement.setAttribute("data-backend-version", "unknown");
      }
    };

    fetchVersion();
  }, []);

  return null;
}
