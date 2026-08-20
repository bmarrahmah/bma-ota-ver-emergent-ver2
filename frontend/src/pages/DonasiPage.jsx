import React, { useEffect, useMemo, useState } from "react";
import api, { formatIDR, formatMonth, formatDate, errText } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, HandCoins, Trash2, Filter, X, Search, FileDown, BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { toast } from "sonner";

function DonationForm({ guardians, onSaved }) {
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({ guardian_id: "", donation_date: today, donation_month: today.slice(0,7), amount: 0, method: "Transfer Bank", notes: "" });
  const [saving, setSaving] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!f.guardian_id) return toast.error("Pilih Orang Tua Asuh");
    setSaving(true);
    try { await api.post("/donations", { ...f, amount: parseFloat(f.amount) }); toast.success("Donasi tercatat"); onSaved(); }
    catch (e) { toast.error(errText(e)); }
    finally { setSaving(false); }
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="text-xs font-semibold uppercase">Orang Tua Asuh *</label>
        <Select value={f.guardian_id} onValueChange={(v)=>setF({...f, guardian_id:v})}>
          <SelectTrigger data-testid="select-donasi-ota" className="mt-1"><SelectValue placeholder="Pilih..." /></SelectTrigger>
          <SelectContent>{guardians.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-xs font-semibold uppercase">Tanggal *</label><input data-testid="input-donasi-date" type="date" required value={f.donation_date} onChange={(e)=>setF({...f, donation_date:e.target.value, donation_month:e.target.value.slice(0,7)})} className="w-full mt-1 px-3 py-2 border rounded-lg" /></div>
        <div><label className="text-xs font-semibold uppercase">Periode Bulan *</label><input required value={f.donation_month} onChange={(e)=>setF({...f, donation_month:e.target.value})} placeholder="YYYY-MM" className="w-full mt-1 px-3 py-2 border rounded-lg" /></div>
      </div>
      <div>
        <label className="text-xs font-semibold uppercase">Nominal (IDR) *</label>
        <input data-testid="input-donasi-amount" type="number" required min="0" value={f.amount} onChange={(e)=>setF({...f, amount:e.target.value})} className="w-full mt-1 px-3 py-2 border rounded-lg" />
      </div>
      <div>
        <label className="text-xs font-semibold uppercase">Metode</label>
        <Select value={f.method} onValueChange={(v)=>setF({...f, method:v})}>
          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Transfer Bank">Transfer Bank</SelectItem>
            <SelectItem value="QRIS">QRIS</SelectItem>
            <SelectItem value="Tunai">Tunai</SelectItem>
            <SelectItem value="Auto-Debit">Auto-Debit</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div><label className="text-xs font-semibold uppercase">Catatan</label><textarea value={f.notes} onChange={(e)=>setF({...f, notes:e.target.value})} className="w-full mt-1 px-3 py-2 border rounded-lg" rows={2} /></div>
      <button data-testid="btn-save-donasi" disabled={saving} className="w-full bg-[var(--pota-green)] text-white py-2.5 rounded-lg font-semibold">{saving ? "Menyimpan..." : "Simpan"}</button>
    </form>
  );
}

export default function DonasiPage() {
  const [donations, setDonations] = useState([]);
  const [guardians, setGuardians] = useState([]);
  const [open, setOpen] = useState(false);
  const [fMonth, setFMonth] = useState("all");
  const [fGuardian, setFGuardian] = useState("all");
  const [fMethod, setFMethod] = useState("all");
  const [q, setQ] = useState("");

  const load = async () => {
    const [d, g] = await Promise.all([api.get("/donations"), api.get("/guardians")]);
    setDonations(d.data); setGuardians(g.data);
  };
  useEffect(() => { load(); }, []);

  const monthOptions = useMemo(() => {
    const s = new Set(donations.map(d => d.donation_month).filter(Boolean));
    return Array.from(s).sort((a, b) => b.localeCompare(a));
  }, [donations]);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return donations.filter(d => {
      if (fMonth !== "all" && d.donation_month !== fMonth) return false;
      if (fGuardian !== "all" && d.guardian_id !== fGuardian) return false;
      if (fMethod !== "all" && d.method !== fMethod) return false;
      if (ql && !(d.guardian_name || "").toLowerCase().includes(ql)) return false;
      return true;
    });
  }, [donations, q, fMonth, fGuardian, fMethod]);

  const total = donations.reduce((s, d) => s + (d.amount || 0), 0);
  const currentMonth = new Date().toISOString().slice(0,7);
  const currentTotal = donations.filter(d => d.donation_month === currentMonth).reduce((s, d) => s + d.amount, 0);
  const filteredTotal = filtered.reduce((s, d) => s + (d.amount || 0), 0);

  const remove = async (id) => {
    if (!window.confirm("Hapus donasi ini?")) return;
    try { await api.delete(`/donations/${id}`); toast.success("Donasi dihapus"); load(); }
    catch (e) { toast.error(errText(e)); }
  };

  const resetFilters = () => { setQ(""); setFMonth("all"); setFGuardian("all"); setFMethod("all"); };
  const activeFilters = (q ? 1 : 0) + (fMonth !== "all" ? 1 : 0) + (fGuardian !== "all" ? 1 : 0) + (fMethod !== "all" ? 1 : 0);

  const otaAgg = useMemo(() => {
    const m = {};
    filtered.forEach((d) => {
      if (!m[d.guardian_id]) m[d.guardian_id] = { name: d.guardian_name, amount: 0, count: 0 };
      m[d.guardian_id].amount += d.amount || 0;
      m[d.guardian_id].count += 1;
    });
    return Object.values(m).sort((a, b) => b.amount - a.amount);
  }, [filtered]);

  const exportCSV = () => {
    if (filtered.length === 0) return toast.error("Tidak ada data untuk diekspor");
    const header = ["Tanggal", "Periode Bulan", "Orang Tua Asuh", "Metode", "Nominal (IDR)", "Catatan"];
    const rows = filtered.map((d) => [
      d.donation_date || "",
      d.donation_month || "",
      d.guardian_name || "",
      d.method || "",
      d.amount ?? 0,
      (d.notes || "").replace(/[\r\n]/g, " "),
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const suffix = fMonth !== "all" ? `_${fMonth}` : `_${new Date().toISOString().slice(0, 10)}`;
    a.href = url;
    a.download = `donasi${suffix}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast.success(`${filtered.length} donasi diekspor ke CSV`);
  };

  const compactIDR = (n) => {
    if (!n) return "0";
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}M`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}Jt`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}rb`;
    return String(n);
  };

  return (
    <div className="space-y-6" data-testid="page-donasi">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="gold-divider mb-3" />
          <h1 className="font-display text-2xl sm:text-3xl text-[var(--pota-green)]">Riwayat Donasi</h1>
          <p className="text-sm text-[var(--pota-text-muted)] mt-1">Catatan donasi berdasarkan Orang Tua Asuh — tanpa keterkaitan langsung dengan anak tertentu.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <div className="flex flex-wrap gap-2">
            <button data-testid="btn-export-donasi" onClick={exportCSV} className="inline-flex items-center gap-2 border border-[var(--pota-border)] hover:border-[var(--pota-gold)] text-[var(--pota-green)] px-4 py-2.5 rounded-xl text-sm font-semibold bg-white">
              <FileDown className="w-4 h-4" /> Ekspor CSV
            </button>
            <DialogTrigger asChild>
              <button data-testid="btn-add-donasi" className="inline-flex items-center gap-2 bg-[var(--pota-green)] text-white px-4 py-2.5 rounded-xl text-sm font-semibold">
                <Plus className="w-4 h-4" /> Tambah Donasi
              </button>
            </DialogTrigger>
          </div>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle className="font-display text-[var(--pota-green)]">Catat Donasi Baru</DialogTitle></DialogHeader>
            <DonationForm guardians={guardians} onSaved={()=>{ setOpen(false); load(); }} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="pota-card p-5">
          <div className="text-[11px] uppercase tracking-widest text-[var(--pota-text-muted)] font-semibold">Total Terkumpul</div>
          <div className="mt-2 font-display text-2xl text-[var(--pota-green)]">{formatIDR(total)}</div>
        </div>
        <div className="pota-card p-5">
          <div className="text-[11px] uppercase tracking-widest text-[var(--pota-text-muted)] font-semibold">Bulan Berjalan</div>
          <div className="mt-2 font-display text-2xl text-[var(--pota-green)]">{formatIDR(currentTotal)}</div>
        </div>
        <div className="pota-card p-5">
          <div className="text-[11px] uppercase tracking-widest text-[var(--pota-text-muted)] font-semibold">Total Transaksi</div>
          <div className="mt-2 font-display text-2xl text-[var(--pota-green)]">{donations.length}</div>
        </div>
      </div>

      <div className="pota-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-widest text-[var(--pota-text-muted)] font-semibold">
            <Filter className="w-3.5 h-3.5" /> Filter & Pencarian
            {activeFilters > 0 && <span className="pota-pill-gold ml-1">{activeFilters} aktif</span>}
          </div>
          {activeFilters > 0 && (
            <button data-testid="btn-reset-donasi-filter" onClick={resetFilters} className="text-xs font-semibold text-[var(--pota-text-muted)] hover:text-[var(--pota-green)] inline-flex items-center gap-1">
              <X className="w-3.5 h-3.5" /> Reset
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="pota-input flex items-center gap-2 bg-white border rounded-lg px-3 py-2">
            <Search className="w-4 h-4 text-[var(--pota-text-muted)]" />
            <input data-testid="input-search-donasi" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama OTA..." className="flex-1 bg-transparent outline-none text-sm" />
          </div>
          <Select value={fMonth} onValueChange={setFMonth}>
            <SelectTrigger data-testid="filter-donasi-month" className="bg-white"><SelectValue placeholder="Semua Bulan" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Bulan</SelectItem>
              {monthOptions.map(m => <SelectItem key={m} value={m}>{formatMonth(m)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fGuardian} onValueChange={setFGuardian}>
            <SelectTrigger data-testid="filter-donasi-ota" className="bg-white"><SelectValue placeholder="Semua Orang Tua Asuh" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Orang Tua Asuh</SelectItem>
              {guardians.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fMethod} onValueChange={setFMethod}>
            <SelectTrigger data-testid="filter-donasi-method" className="bg-white"><SelectValue placeholder="Semua Metode" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Metode</SelectItem>
              <SelectItem value="Transfer Bank">Transfer Bank</SelectItem>
              <SelectItem value="QRIS">QRIS</SelectItem>
              <SelectItem value="Tunai">Tunai</SelectItem>
              <SelectItem value="Auto-Debit">Auto-Debit</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="text-xs text-[var(--pota-text-muted)] pt-3 border-t border-[var(--pota-border)]">
          Menampilkan <span className="font-semibold text-[var(--pota-green)]">{filtered.length}</span> dari {donations.length} transaksi
          <span className="mx-2 text-[var(--pota-gold)]">·</span>
          Subtotal <span className="font-semibold text-[var(--pota-green)]">{formatIDR(filteredTotal)}</span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="pota-card p-10 text-center">
          <HandCoins className="w-10 h-10 mx-auto text-[var(--pota-gold)]" />
          <div className="mt-3 font-display text-lg text-[var(--pota-green)]">
            {donations.length === 0 ? "Belum ada donasi tercatat" : "Tidak ada donasi yang cocok"}
          </div>
          {donations.length > 0 && <div className="text-sm text-[var(--pota-text-muted)] mt-1">Sesuaikan filter atau kata kunci pencarian.</div>}
        </div>
      ) : (
        <>
          <div className="pota-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-[11px] tracking-[0.16em] uppercase text-[var(--pota-text-muted)] font-semibold inline-flex items-center gap-1.5"><BarChart3 className="w-3.5 h-3.5" /> Kontribusi Per Orang Tua Asuh</div>
                <div className="font-display text-xl text-[var(--pota-green)] mt-1">
                  {fMonth === "all" ? "Semua Periode" : formatMonth(fMonth)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-wider text-[var(--pota-text-muted)]">Total Filter</div>
                <div className="font-display text-lg text-[var(--pota-green)]">{formatIDR(filteredTotal)}</div>
              </div>
            </div>
            <div className="w-full" style={{ height: Math.max(180, otaAgg.length * 42) }}>
              <ResponsiveContainer>
                <BarChart data={otaAgg} layout="vertical" margin={{ top: 4, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8E4" />
                  <XAxis type="number" stroke="#5C6F67" fontSize={11} tickLine={false} axisLine={false} tickFormatter={compactIDR} />
                  <YAxis type="category" dataKey="name" stroke="#0B3D2E" fontSize={12} tickLine={false} axisLine={false} width={140} />
                  <Tooltip
                    contentStyle={{ background: "#fff", border: "1px solid #E2E8E4", borderRadius: 12, fontSize: 12 }}
                    labelStyle={{ color: "#0B3D2E", fontWeight: 600 }}
                    formatter={(v, _, p) => [formatIDR(v), `${p.payload.count} transaksi`]}
                  />
                  <Bar dataKey="amount" radius={[0, 6, 6, 0]}>
                    {otaAgg.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? "#C9A227" : i === 1 ? "#123F32" : "#164A3A"} fillOpacity={i === 0 ? 1 : 0.85 - i * 0.05} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="pota-card divide-y">
            {filtered.map((d) => (
              <div key={d.id} className="p-4 flex items-center justify-between" data-testid={`row-donasi-${d.id}`}>
                <div>
                  <div className="font-semibold text-[var(--pota-green)]">{d.guardian_name}</div>
                  <div className="text-xs text-[var(--pota-text-muted)]">{formatDate(d.donation_date)} · {formatMonth(d.donation_month)} · {d.method}</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="font-display text-lg text-[var(--pota-green)]">{formatIDR(d.amount)}</div>
                  <button onClick={()=>remove(d.id)} className="text-red-600"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
