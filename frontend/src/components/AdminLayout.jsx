import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, GraduationCap, Link2, HandCoins, Sparkles, ClipboardList, Settings, LogOut, Menu, X,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const items = [
  { to: "/admin", icon: LayoutDashboard, label: "Dashboard", end: true },
  { to: "/admin/orang-tua-asuh", icon: Users, label: "Orang Tua Asuh" },
  { to: "/admin/anak-asuh", icon: GraduationCap, label: "Anak Asuh" },
  { to: "/admin/relasi", icon: Link2, label: "Relasi" },
  { to: "/admin/donasi", icon: HandCoins, label: "Donasi" },
  { to: "/admin/perkembangan", icon: Sparkles, label: "Perkembangan" },
  { to: "/admin/laporan", icon: ClipboardList, label: "Laporan" },
  { to: "/admin/pengaturan", icon: Settings, label: "Pengaturan" },
];

const NavItems = ({ onClick }) => (
  <nav className="flex-1 p-3 space-y-1">
    {items.map((it) => (
      <NavLink
        key={it.to}
        to={it.to}
        end={it.end}
        onClick={onClick}
        data-testid={`nav-${it.label.toLowerCase().replace(/\s+/g,'-')}`}
        className={({ isActive }) =>
          `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
            isActive
              ? "bg-white/10 text-[#F5E7A6] border-l-2 border-[#C9A227] pl-[10px]"
              : "text-[#C7D6CE] hover:bg-white/5 hover:text-white"
          }`
        }
      >
        <it.icon className="w-4 h-4" />
        <span className="font-medium">{it.label}</span>
      </NavLink>
    ))}
  </nav>
);

const SidebarInner = ({ onNav, onLogout }) => (
  <div className="pota-sidebar flex flex-col h-full w-64">
    <div className="p-5 border-b border-white/10">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#C9A227]/15 border border-[#C9A227]/30 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-[#D4AF37]" />
        </div>
        <div>
          <div className="font-display text-lg leading-none text-white">Portal OTA</div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-[#C9A227] mt-1">Orang Tua Asuh</div>
        </div>
      </div>
    </div>
    <NavItems onClick={onNav} />
    <button
      data-testid="btn-logout"
      onClick={onLogout}
      className="m-3 flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-[#C7D6CE] hover:bg-white/5 hover:text-white transition"
    >
      <LogOut className="w-4 h-4" /> Keluar
    </button>
  </div>
);

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = React.useState(false);

  const onLogout = async () => {
    await logout();
    nav("/login");
  };

  return (
    <div className="min-h-screen flex bg-[var(--pota-canvas)]">
      <aside className="hidden lg:flex sticky top-0 h-screen">
        <SidebarInner onLogout={onLogout} />
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white/90 backdrop-blur border-b border-[var(--pota-border)] px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <button data-testid="btn-open-sidebar" className="lg:hidden p-2 rounded-lg hover:bg-[var(--pota-surface)]">
                  <Menu className="w-5 h-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-64 border-0">
                <SidebarInner onNav={() => setOpen(false)} onLogout={onLogout} />
              </SheetContent>
            </Sheet>
            <div>
              <div className="text-[11px] tracking-widest uppercase text-[var(--pota-text-muted)]">Portal Admin</div>
              <div className="font-display text-lg text-[var(--pota-green)]">Manajemen Orang Tua Asuh</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-semibold text-[var(--pota-text)]">{user?.name || "Admin"}</div>
              <div className="text-xs text-[var(--pota-text-muted)]">{user?.email}</div>
            </div>
            <div className="w-10 h-10 rounded-full overflow-hidden bg-[var(--pota-green)] text-[#F5E7A6] flex items-center justify-center font-semibold border border-[var(--pota-border)]">
              {user?.avatar_url ? (
                <img src={user.avatar_url.startsWith('/api') ? `${process.env.REACT_APP_BACKEND_URL}${user.avatar_url}` : user.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (user?.name || "A").charAt(0)}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6 pattern-bg">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
