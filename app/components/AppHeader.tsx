"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Search, CalendarCheck, ClipboardList, User, CheckCircle } from "lucide-react";
import ShuttlecockIcon from "./ShuttlecockIcon";
import { useEffect, useState } from "react";

const navItems = [
  { href: "/browse", label: "搜尋球局", icon: Search },
  { href: "/enrolled", label: "已報名", icon: CalendarCheck },
  { href: "/manage", label: "管理球局", icon: ClipboardList },
];

const bottomBarItems = [
  ...navItems,
  { href: "/profile", label: "帳號", icon: User },
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
      {/* Desktop Header */}
      <nav className="sticky top-0 z-30 bg-white/80 backdrop-blur-sm border-b border-stone hidden md:block">
        <div className="max-w-4xl mx-auto px-4 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <Link href="/browse" className="flex items-center gap-1.5 mr-1">
              <ShuttlecockIcon size={18} className="text-sage" />
              <span className="text-sm tracking-[0.1em] text-sage font-bold">羽球勒戒所</span>
            </Link>
            <div className="h-5 w-[1px] bg-stone/30" />
            <div className="flex items-center gap-1">
              {navItems.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(href + "/");
                return (
                  <Link key={href} href={href}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs tracking-[0.05em] transition-all duration-200 ${
                      active ? "bg-sage/10 text-sage font-bold" : "text-stone-400 hover:text-sage"
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
                <span className="text-xs text-stone-700 font-bold">{userInfo?.username || "—"}</span>
                {(userInfo?.verified_matches || 0) >= 3 && <CheckCircle size={12} className="text-blue-500 fill-blue-50" />}
              </div>
              <span className="text-[9px] tracking-[0.08em] text-sage font-bold mt-0.5">
                {userInfo?.badminton_level ? `Lv.${Math.floor(parseFloat(userInfo.badminton_level))}` : "Diagnostic"}
              </span>
            </div>
            <div className="w-9 h-9 rounded-full overflow-hidden bg-stone-100 border border-stone/20 group-hover:ring-1 group-hover:ring-sage/30 transition-all">
              {(userInfo?.avatarUrl || userInfo?.AvatarUrl) ? (
                <img src={userInfo?.avatarUrl || userInfo?.AvatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="flex items-center justify-center w-full h-full text-sage"><User size={16} /></div>
              )}
            </div>
          </Link>
        </div>
      </nav>

      {/* Mobile Bottom Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white/90 backdrop-blur-sm border-t border-stone md:hidden">
        <div className="flex items-center justify-around h-16 px-2">
          {bottomBarItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link key={href} href={href}
                className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all duration-200 ${
                  active ? "text-sage" : "text-stone-400"
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
