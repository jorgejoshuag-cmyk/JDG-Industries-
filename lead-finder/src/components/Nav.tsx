"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type Item = { href: string; label: string; badge?: number };

export function Nav({ items, adminItems, userName, logout }: { items: Item[]; adminItems: Item[]; userName: string; logout: () => Promise<void> }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const link = (i: Item) => (
    <Link
      key={i.href}
      href={i.href}
      onClick={() => setOpen(false)}
      aria-current={active(i.href) ? "page" : undefined}
      className={`flex items-center justify-between rounded-md px-3 py-2 text-sm no-underline hover:no-underline ${active(i.href) ? "bg-white font-semibold text-navy-900" : "text-navy-100 hover:bg-navy-700"}`}
    >
      {i.label}
      {i.badge ? <span className={`ml-2 rounded-full px-1.5 text-xs font-semibold ${active(i.href) ? "bg-navy-800 text-white" : "bg-white text-navy-900"}`}>{i.badge}</span> : null}
    </Link>
  );
  return (
    <aside className="bg-navy-900 text-white md:fixed md:inset-y-0 md:left-0 md:w-56 md:overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-3">
        <Link href="/" className="text-white no-underline hover:no-underline">
          <span className="block text-[10px] font-semibold uppercase tracking-widest text-navy-200">JDG Aggregates</span>
          <span className="block text-lg font-semibold leading-tight">Lead Finder</span>
        </Link>
        <button type="button" className="rounded-md border border-navy-400 px-3 py-1.5 text-sm md:hidden" aria-expanded={open} aria-controls="main-nav" onClick={() => setOpen(!open)}>
          {open ? "Close" : "Menu"}
        </button>
      </div>
      <nav id="main-nav" className={`${open ? "block" : "hidden"} space-y-1 px-2 pb-4 md:block`}>
        {items.map(link)}
        {adminItems.length ? <p className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-widest text-navy-200">Admin</p> : null}
        {adminItems.map(link)}
        <div className="mt-4 border-t border-navy-700 px-3 pt-3 text-sm">
          <p className="truncate text-navy-100">{userName}</p>
          <div className="mt-1 flex gap-3">
            <Link href="/account" onClick={() => setOpen(false)} className="text-navy-200">Account</Link>
            <form action={logout}>
              <button type="submit" className="text-navy-200 hover:underline">Sign out</button>
            </form>
          </div>
        </div>
      </nav>
    </aside>
  );
}
