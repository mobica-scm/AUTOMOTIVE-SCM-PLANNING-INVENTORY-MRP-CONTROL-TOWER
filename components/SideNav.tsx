"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Dashboard", icon: "◧" },
  { href: "/exceptions", label: "Exceptions", icon: "!" },
  { href: "/mrp", label: "MRP Grid", icon: "▦" },
  { href: "/planned-orders", label: "Planned Orders", icon: "▤" },
  { href: "/purchase-orders", label: "Purchase Orders", icon: "▣" },
  { href: "/shipments", label: "Shipments", icon: "⇢" },
  { href: "/forecast", label: "Forecast", icon: "≈" },
  { href: "/materials", label: "Materials", icon: "◆" },
  { href: "/suppliers", label: "Suppliers", icon: "⌂" },
];

export function SideNav() {
  const pathname = usePathname();
  return (
    <nav className="w-56 shrink-0 border-r border-[var(--line)] bg-[var(--surface)] flex flex-col">
      <div className="px-4 py-4 border-b border-[var(--line)]">
        <div className="text-[10px] tracking-widest uppercase text-[var(--ink-soft)] font-semibold">Mobica</div>
        <div className="text-sm font-bold leading-tight mt-0.5">SCM Control Tower</div>
      </div>
      <div className="flex-1 py-3">
        {LINKS.map((l) => {
          const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`flex items-center gap-2.5 px-4 py-2 text-sm mx-2 rounded-md mb-0.5 ${
                active ? "bg-[var(--accent)] text-white font-semibold" : "text-[var(--ink)] hover:bg-[var(--surface-2)]"
              }`}
            >
              <span className="w-4 text-center opacity-80">{l.icon}</span>
              {l.label}
            </Link>
          );
        })}
      </div>
      <div className="px-4 py-3 border-t border-[var(--line)] text-xs text-[var(--ink-soft)]">
        <div className="font-semibold text-[var(--ink)]">Supply Chain Specialist</div>
        <div>Planner console — demo session</div>
      </div>
    </nav>
  );
}
