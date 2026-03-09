"use client";
import { useEffect, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PageLoading from "../components/PageLoading";

const isDev = process.env.NODE_ENV === "development";
const API_URL = process.env.NEXT_PUBLIC_API_URL || (isDev ? "http://localhost:3000" : "");

function LoginSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const token = searchParams.get("token");
    const code = searchParams.get("code");
    const hasCode = !!code;
    const speed = searchParams.get("speed");

    // Prevent duplicate one-time code exchange in React dev strict-mode remounts.
    if (typeof window !== "undefined" && code) {
      const url = new URL(window.location.href);
      url.searchParams.delete("code");
      window.history.replaceState({}, "", url.toString());
    }

    const syncAndRedirect = async () => {
      try {
        let finalToken = token;

        if (!finalToken && code) {
          const exchangeRes = await fetch(`${API_URL}/api/user/exchange-login-code`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
            body: JSON.stringify({ code }),
          });
          const exchangeData = await exchangeRes.json();
          if (!exchangeData.success || !exchangeData.token) {
            throw new Error("exchange-login-code failed");
          }
          finalToken = exchangeData.token as string;
          if (exchangeData.user) {
            localStorage.setItem("user", JSON.stringify(exchangeData.user));
          }
        }

        if (!finalToken) {
          // If social-login callback provides a one-time code, we must not fallback
          // to an old token in localStorage (can show wrong account provider).
          if (hasCode) {
            throw new Error("missing token after code exchange");
          }
          router.push("/login");
          return;
        }

        localStorage.setItem("token", finalToken);

        const meRes = await fetch(`${API_URL}/api/user/me`, {
          headers: {
            "Authorization": `Bearer ${finalToken}`,
            "ngrok-skip-browser-warning": "true"
          }
        });
        const meData = await meRes.json();
        if (!meData.success || !meData.user) {
          throw new Error("get-me failed");
        }

        localStorage.setItem("user", JSON.stringify(meData.user));

        const waitTime = speed === "slow" ? 600 : 1000;
        const nextParam = searchParams.get("next");
        const returnPath = localStorage.getItem("loginReturnPath");

        const isFinished = meData.user.is_profile_completed === true;
        let targetPath = "/browse";

        if (!isFinished) {
          targetPath = "/rating";
        } else if (nextParam) {
          targetPath = nextParam;
        } else if (returnPath) {
          targetPath = returnPath;
        }

        localStorage.removeItem("loginReturnPath");
        if (waitTime > 0) {
          setTimeout(() => {
            router.replace(targetPath);
          }, waitTime);
        } else {
          router.replace(targetPath);
        }
      } catch (e) {
        console.error("login-success failed", e);
        router.replace("/login");
      }
    };

    syncAndRedirect();
  }, [searchParams, router]);

  return (
    <main className="min-h-dvh neu-page flex flex-col items-center justify-center p-6 font-serif text-center">
      <div className="animate-fade-in space-y-6 neu-card p-8 max-w-xl">
        <h1 className="text-4xl font-light tracking-[0.5em] text-sage">勒戒中心</h1>
        
        <div className="space-y-2">
          <p className="text-2xl text-ink">檢測到您的羽球成癮指數已超標。</p>
          <p className="text-base text-ink/70 italic">「 勒戒通道已開啟，即刻進入場地。 」</p>
        </div>
        <div className="flex justify-center mt-8">
          <div className="w-12 h-[1px] bg-sage animate-pulse"></div>
        </div>
      </div>
    </main>
  );
}

export default function LoginSuccessPage() {
  return (
    <Suspense fallback={<PageLoading message="Loading..." showHeader={false} />}>
      <LoginSuccessContent />
    </Suspense>
  );
}
