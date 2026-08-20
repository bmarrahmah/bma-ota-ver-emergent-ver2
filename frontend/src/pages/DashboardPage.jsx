import React, { useEffect, useMemo, useState } from "react";
import api, { formatIDR, formatMonth, errText } from "@/lib/api";
import { Users, GraduationCap, HandCoins, ClipboardCheck, Sparkles, TrendingUp, Target, Edit3 } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { toast } from "sonner";

const StatCard = ({ icon: Icon, label, value, sub, testid }) => (
  <div data-testid={testid} className="pota-card p-5">
    <div className="flex items-start justify-between">
      <div>
        <div className="text-[11px] tracking-[0.16em] uppercase text-[var(--pota-text-muted)] font-semibold">{label}</div>
        <div className="mt-2 font-display text-2xl sm:text-3xl text-[var(--pota-green)]">{value}</div>
        {sub && <div className="text-xs text-[var(--pota-text-muted)] mt-1">{sub}</div>}
      </div>
      <div className="w-10 h-10 rounded-xl bg-[#F1F8E9] border border-[#C5E1A5] text-[#33691E] flex items-center justify-center">
        <Icon className="w-5 h-5" />
      </div>
    </div>
  </div>
);

const compactIDR = (n) => {
  if (!n) return "0";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}M`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}Jt`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}rb`;
  return String(n);
};

const monthOptions = () => {
  const now = new Date();
  const opts = [];
  for (let i = -1; i < 11; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    opts.push(d.toISOString().slice(0, 7));
  }
  return opts;
};

function TargetCard() {
  const months = useMemo(monthOptions, []);
  const [month, setMonth] = useState(months[1]); // current month
  const [data, setData] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const r = await api.get("/donation-target", { params: { month } });
    setData(r.data);
    setAmount(String(r.data.target || ""));
  };
  useEffect(() => { load(); }, [month]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put("/donation-target", { month, amount: parseFloat(amount) || 0 });
      toast.success(`Target ${formatMonth(month)} tersimpan`);
      setEditOpen(false);
      load();
    } catch (e) { toast.error(errText(e)); }
    finally { setSaving(false); }
  };

  if (!data) return null;
  const pct = Math.min(100, data.percentage || 0);
  const surplus = data.target > 0 && data.collected >= data.target;

  return (
    <div className="pota-card p-6" data-testid="card-target">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div className="min-w-0">
          <div className="text-[11px] tracking-[0.16em] uppercase text-[var(--pota-text-muted)] font-semibold inline-flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-[var(--pota-gold)]" /> Target Anggaran Bulanan
          </div>
          <div className="font-display text-xl text-[var(--pota-green)] mt-1">{formatMonth(month)}</div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger data-testid="select-target-month" className="bg-white w-44"><SelectValue /></SelectTrigger>
            <SelectContent>{months.map(m => <SelectItem key={m} value={m}>{formatMonth(m)}</SelectItem>)}</SelectContent>
          </Select>
          <button data-testid="btn-edit-target" onClick={() => setEditOpen(true)} className="inline-flex items-center gap-1.5 bg-[var(--pota-green)] hover:bg-[var(--pota-green-2)] text-white px-3 py-2 rounded-lg text-xs font-semibold">
            <Edit3 className="w-3.5 h-3.5" /> Ubah Target
          </button>
        </div>
      </div>

      {data.target > 0 ? (
        <>
          <div className="flex items-baseline justify-between gap-2 mb-2">
            <div>
              <div className="font-display text-2xl sm:text-3xl text-[var(--pota-green)]">{formatIDR(data.collected)}</div>
              <div className="text-xs text-[var(--pota-text-muted)] mt-1">dari target {formatIDR(data.target)}</div>
            </div>
            <div className="text-right">
              <div className={`font-display text-2xl ${surplus ? "text-[#2E7D32]" : "text-[var(--pota-green)]"}`}>{pct.toFixed(1)}%</div>
              <div className="text-xs text-[var(--pota-text-muted)]">{data.count} transaksi</div>
            </div>
          </div>
          <div className="relative h-3 rounded-full bg-[var(--pota-surface)] overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${pct}%`,
                background: surplus
                  ? "linear-gradient(90deg, #2E7D32 0%, #7CB342 100%)"
                  : "linear-gradient(90deg, #0F4A2A 0%, #4CAF50 60%, #9CCC65 100%)",
              }}
            />
          </div>
          <div className="mt-3 text-xs text-[var(--pota-text-muted)]">
            {surplus ? (
              <span className="text-[#2E7D32] font-semibold inline-flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" /> Alhamdulillah, target terlampaui sebesar {formatIDR(data.collected - data.target)}
              </span>
            ) : (
              <>Selisih <span className="font-semibold text-[var(--pota-green)]">{formatIDR(data.remaining)}</span> hingga target tercapai</>
            )}
          </div>
        </>
      ) : (
        <div className="text-center py-6">
          <Target className="w-8 h-8 mx-auto text-[var(--pota-gold)]" />
          <div className="mt-2 font-display text-lg text-[var(--pota-green)]">Belum ada target</div>
          <div className="text-sm text-[var(--pota-text-muted)]">Tetapkan target donasi bulanan untuk memantau progres.</div>
        </div>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-display text-[var(--pota-green)]">Ubah Target {formatMonth(month)}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide">Nominal Target (IDR)</label>
              <input
                data-testid="input-target-amount"
                type="number" min="0" step="10000" required
                value={amount} onChange={(e) => setAmount(e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-lg"
                placeholder="10000000"
              />
              <div className="text-xs text-[var(--pota-text-muted)] mt-1">
                Pratinjau: <span className="font-semibold text-[var(--pota-green)]">{formatIDR(parseFloat(amount || 0))}</span>
              </div>
            </div>
            <button data-testid="btn-save-target" disabled={saving} className="w-full bg-[var(--pota-green)] text-white py-2.5 rounded-lg font-semibold">
              {saving ? "Menyimpan..." : "Simpan Target"}
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [trend, setTrend] = useState([]);

  useEffect(() => {
    api.get("/dashboard/stats").then((r) => setStats(r.data));
    api.get("/dashboard/donation-trend").then((r) => setTrend(r.data));
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
  const trendTotal = trend.reduce((s, t) => s + t.amount, 0);

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

      <TargetCard />

      <div className="pota-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[11px] tracking-[0.16em] uppercase text-[var(--pota-text-muted)] font-semibold">Tren Donasi 12 Bulan</div>
            <div className="font-display text-xl text-[var(--pota-green)] mt-1">Momentum Kebaikan</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wider text-[var(--pota-text-muted)]">Akumulasi</div>
            <div className="font-display text-lg text-[var(--pota-green)] inline-flex items-center gap-1"><TrendingUp className="w-4 h-4 text-[var(--pota-gold)]" /> {formatIDR(trendTotal)}</div>
          </div>
        </div>
        <div className="w-full h-64">
          <ResponsiveContainer>
            <AreaChart data={trend} margin={{ top: 8, right: 8, left: -6, bottom: 0 }}>
              <defs>
                <linearGradient id="donaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7CB342" stopOpacity={0.55}/>
                  <stop offset="100%" stopColor="#0F4A2A" stopOpacity={0.05}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#DDE6DA" vertical={false} />
              <XAxis dataKey="label" stroke="#4E6656" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#4E6656" fontSize={11} tickLine={false} axisLine={false} tickFormatter={compactIDR} width={50} />
              <Tooltip
                contentStyle={{ background: "#fff", border: "1px solid #DDE6DA", borderRadius: 12, fontSize: 12 }}
                formatter={(v) => [formatIDR(v), "Donasi"]}
                labelStyle={{ color: "#0F4A2A", fontWeight: 600 }}
              />
              <Area type="monotone" dataKey="amount" stroke="#0F4A2A" strokeWidth={2.5} fill="url(#donaGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
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
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${a.type === "donation" ? "bg-[#F1F8E9] text-[#33691E] border border-[#C5E1A5]" : "bg-[#E6F4EA] text-[#0F5B38] border border-[#C9E6D3]"}`}>
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
