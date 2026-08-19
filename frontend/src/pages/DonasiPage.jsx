import React, { useEffect, useState } from "react";
import api, { formatIDR, formatMonth, formatDate, errText } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, HandCoins, Trash2 } from "lucide-react";
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

  const load = async () => {
    const [d, g] = await Promise.all([api.get("/donations"), api.get("/guardians")]);
    setDonations(d.data); setGuardians(g.data);
  };
  useEffect(() => { load(); }, []);

  const total = donations.reduce((s, d) => s + (d.amount || 0), 0);
  const currentMonth = new Date().toISOString().slice(0,7);
  const currentTotal = donations.filter(d => d.donation_month === currentMonth).reduce((s, d) => s + d.amount, 0);

  const remove = async (id) => {
    if (!window.confirm("Hapus donasi ini?")) return;
    try { await api.delete(`/donations/${id}`); toast.success("Donasi dihapus"); load(); }
    catch (e) { toast.error(errText(e)); }
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
          <DialogTrigger asChild>
            <button data-testid="btn-add-donasi" className="inline-flex items-center gap-2 bg-[var(--pota-green)] text-white px-4 py-2.5 rounded-xl text-sm font-semibold">
              <Plus className="w-4 h-4" /> Tambah Donasi
            </button>
          </DialogTrigger>
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

      {donations.length === 0 ? (
        <div className="pota-card p-10 text-center">
          <HandCoins className="w-10 h-10 mx-auto text-[var(--pota-gold)]" />
          <div className="mt-3 font-display text-lg text-[var(--pota-green)]">Belum ada donasi tercatat</div>
        </div>
      ) : (
        <div className="pota-card divide-y">
          {donations.map((d) => (
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
      )}
    </div>
  );
}
