import React, { useEffect, useState } from "react";
import api, { formatIDR, formatMonth } from "@/lib/api";
import { Users, GraduationCap, HandCoins, ClipboardCheck, Sparkles, ArrowUpRight } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";

const StatCard = ({ icon: Icon, label, value, sub, testid }) => (
  <div data-testid={testid} className="pota-card p-5">
    <div className="flex items-start justify-between">
      <div>
        <div className="text-[11px] tracking-[0.16em] uppercase text-[var(--pota-text-muted)] font-semibold">{label}</div>
        <div className="mt-2 font-display text-2xl sm:text-3xl text-[var(--pota-green)]">{value}</div>
        {sub && <div className="text-xs text-[var(--pota-text-muted)] mt-1">{sub}</div>}
      </div>
      <div className="w-10 h-10 rounded-xl bg-[#FCF7E8] border border-[#E8D38A] text-[#8C6D14] flex items-center justify-center">
        <Icon className="w-5 h-5" />
      </div>
    </div>
  </div>
);

export default function DashboardPage() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get("/dashboard/stats").then((r) => setStats(r.data));
  }, []);

  if (!stats) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[1,2,3,4].map((i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
      </div>
    );
  }

  const dist = stats.status_distribution;
  const total = Math.max(1, stats.total_guardians);

  return (
    <div className="space-y-6" data-testid="page-dashboard">
      <div>
        <div className="gold-divider mb-3" />
        <h1 className="font-display text-2xl sm:text-3xl text-[var(--pota-green)]">Ringkasan Program</h1>
        <p className="text-sm text-[var(--pota-text-muted)] mt-1">Ikhtisar Orang Tua Asuh, Anak Asuh, donasi, dan laporan periode {formatMonth(stats.current_month)}.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard testid="stat-total-ota" icon={Users} label="Orang Tua Asuh" value={stats.total_guardians} sub={`${stats.active_guardians} aktif`} />
        <StatCard testid="stat-total-anak" icon={GraduationCap} label="Anak Asuh" value={stats.total_children} sub="Binaan aktif" />
        <StatCard testid="stat-donasi-bulan" icon={HandCoins} label={`Donasi ${formatMonth(stats.current_month)}`} value={formatIDR(stats.donation_this_month)} sub={`Total ${formatIDR(stats.total_donation)}`} />
        <StatCard testid="stat-laporan" icon={ClipboardCheck} label="Laporan Terlapor" value={`${stats.reports_this_month}/${stats.active_guardians}`} sub={`${stats.reports_pending} belum terlapor`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="pota-card p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[11px] tracking-[0.16em] uppercase text-[var(--pota-text-muted)] font-semibold">Distribusi Status</div>
              <div className="font-display text-xl text-[var(--pota-green)] mt-1">Komitmen Orang Tua Asuh</div>
            </div>
            <Sparkles className="w-5 h-5 text-[var(--pota-gold)]" />
          </div>
          <div className="space-y-4">
            {Object.entries(dist).map(([k, v]) => {
              const pct = Math.round((v / total) * 100);
              return (
                <div key={k}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={k} />
                    </div>
                    <div className="text-sm font-semibold text-[var(--pota-text)]">{v} <span className="text-xs text-[var(--pota-text-muted)]">({pct}%)</span></div>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--pota-surface)] overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[var(--pota-green)] to-[var(--pota-gold)]" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="pota-card p-6">
          <div className="text-[11px] tracking-[0.16em] uppercase text-[var(--pota-text-muted)] font-semibold">Aktivitas Terbaru</div>
          <div className="font-display text-xl text-[var(--pota-green)] mt-1 mb-4">Perkembangan & Donasi</div>
          <div className="space-y-3">
            {stats.recent_activity.length === 0 && (
              <div className="text-sm text-[var(--pota-text-muted)]">Belum ada aktivitas.</div>
            )}
            {stats.recent_activity.map((a, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${a.type === "donation" ? "bg-[#FCF7E8] text-[#8C6D14] border border-[#E8D38A]" : "bg-[#E6F4EA] text-[#0F5B38] border border-[#C9E6D3]"}`}>
                  {a.type === "donation" ? <HandCoins className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-[var(--pota-text)] truncate">{a.title}</div>
                  {a.amount && <div className="text-xs font-semibold text-[var(--pota-green)]">{formatIDR(a.amount)}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
