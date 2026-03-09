"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Search, CalendarDays, CalendarCheck, User, CheckCircle } from "lucide-react";
import ShuttlecockIcon from "./ShuttlecockIcon";
import { useEffect, useState } from "react";
import PlayerProfileModalHost from "./PlayerProfileModalHost";

const navItems = [
  { href: "/browse", label: "勒戒看板", icon: Search },
  { href: "/enrolled", label: "已報名", icon: CalendarCheck },
  { href: "/schedule", label: "排程管理", icon: CalendarDays },
];

const bottomBarItems = [
  ...navItems,
  { href: "/profile", label: "病歷", icon: User },
];

export default function AppHeader() {
  const pathname = usePathname();
  const [userInfo, setUserInfo] = useState<any>(null);

  useEffect(() => {
    const saved = localStorage.getItem("user");
    if (saved) setUserInfo(JSON.parse(saved));
  }, []);

  return (
    <>
      <PlayerProfileModalHost />
      {/* Desktop Header */}
      <nav className="sticky top-0 z-30 hidden md:block bg-paper border-b-2 border-ink">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/browse" className="flex items-center gap-1.5 mr-1">
              <ShuttlecockIcon size={18} className="text-sage" />
              <span className="text-base tracking-[0.1em] text-sage font-bold">羽球勒戒所</span>
            </Link>
            <div className="h-5 w-[1px] bg-stone/60" />
            <div className="flex items-center gap-1">
              {navItems.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(href + "/");
                return (
                  <Link key={href} href={href}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-sm tracking-[0.05em] transition-all duration-200 ${
                      active
                        ? "neu-inset text-sage font-bold"
                        : "text-stone-500 hover:text-sage"
                    }`}>
                    <Icon size={16} strokeWidth={active ? 2.2 : 1.5} />
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>
          <Link href="/profile" className="flex items-center gap-2.5 group">
            <div className="flex flex-col items-end leading-none">
              <div className="flex items-center gap-0.5">
                <span className="text-sm text-ink font-bold">{userInfo?.username || "—"}</span>
                {(userInfo?.verified_matches || 0) >= 3 && <CheckCircle size={12} className="text-sage fill-paper" />}
              </div>
              <span className="text-[9px] tracking-[0.08em] text-sage font-bold mt-0.5">
                {userInfo?.badminton_level ? `Lv.${Math.floor(parseFloat(userInfo.badminton_level))}` : "待診斷"}
              </span>
            </div>
            <div className="w-9 h-9 rounded-full overflow-hidden neu-inset transition-all">
              {(userInfo?.avatarUrl || userInfo?.AvatarUrl) ? (
                <img src={userInfo?.avatarUrl || userInfo?.AvatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="flex items-center justify-center w-full h-full text-sage"><User size={16} /></div>
              )}
            </div>
          </Link>
        </div>
        </div>
      </nav>

      {/* Mobile Bottom Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-paper border-t-2 border-ink md:hidden [transform:translate3d(0,0,0)]">
        <div className="flex items-center justify-around h-16 px-2">
          {bottomBarItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link key={href} href={href}
                className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all duration-200 ${
                  active ? "text-sage font-bold" : "text-stone-500"
                }`}>
                <Icon size={20} strokeWidth={active ? 2.2 : 1.5} />
                <span className={`text-[10px] tracking-[0.02em] ${active ? "font-bold" : ""}`}>{label}</span>
              </Link>
            );
          })}
        </div>
        <div className="h-[env(safe-area-inset-bottom)]" />
      </nav>
    </>
  );
}
