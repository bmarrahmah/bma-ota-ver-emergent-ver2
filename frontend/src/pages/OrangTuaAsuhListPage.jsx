import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { formatIDR, errText } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import { Search, Plus, Copy, ExternalLink, Users2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const STATUSES = ["Rutin", "Tidak Rutin", "Insidentil", "Tidak Aktif"];

function GuardianForm({ onSaved, initial }) {
  const [f, setF] = useState(initial || { name: "", contact: "", email: "", address: "", status: "Rutin", notes: "" });
  const [saving, setSaving] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (initial?.id) await api.put(`/guardians/${initial.id}`, f);
      else await api.post("/guardians", f);
      toast.success("Orang Tua Asuh disimpan");
      onSaved();
    } catch (e) { toast.error(errText(e)); }
    finally { setSaving(false); }
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide">Nama Lengkap *</label>
        <input data-testid="input-ota-name" required value={f.name} onChange={(e)=>setF({...f, name:e.target.value})} className="w-full mt-1 px-3 py-2 border rounded-lg" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide">Nomor Kontak</label>
          <input data-testid="input-ota-contact" value={f.contact} onChange={(e)=>setF({...f, contact:e.target.value})} className="w-full mt-1 px-3 py-2 border rounded-lg" />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide">Email</label>
          <input value={f.email} onChange={(e)=>setF({...f, email:e.target.value})} className="w-full mt-1 px-3 py-2 border rounded-lg" />
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide">Alamat</label>
        <input value={f.address} onChange={(e)=>setF({...f, address:e.target.value})} className="w-full mt-1 px-3 py-2 border rounded-lg" />
      </div>
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide">Status Komitmen</label>
        <Select value={f.status} onValueChange={(v)=>setF({...f, status:v})}>
          <SelectTrigger data-testid="select-ota-status" className="mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide">Catatan</label>
        <textarea value={f.notes} onChange={(e)=>setF({...f, notes:e.target.value})} className="w-full mt-1 px-3 py-2 border rounded-lg" rows={2} />
      </div>
      <button data-testid="btn-save-ota" disabled={saving} className="w-full bg-[var(--pota-green)] text-white py-2.5 rounded-lg font-semibold">{saving ? "Menyimpan..." : "Simpan"}</button>
    </form>
  );
}

export default function OrangTuaAsuhListPage() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const r = await api.get("/guardians", { params: { q: q || undefined, status } });
    setRows(r.data);
    setLoading(false);
  };
  useEffect(() => { load(); }, [q, status]);

  const copyPortal = (token) => {
    const url = `${window.location.origin}/portal/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Tautan portal disalin");
  };

  return (
    <div className="space-y-6" data-testid="page-ota">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="gold-divider mb-3" />
          <h1 className="font-display text-2xl sm:text-3xl text-[var(--pota-green)]">Orang Tua Asuh</h1>
          <p className="text-sm text-[var(--pota-text-muted)] mt-1">Kelola para donatur pengasuh dan tautan portal privat mereka.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button data-testid="btn-add-ota" className="inline-flex items-center gap-2 bg-[var(--pota-green)] hover:bg-[var(--pota-green-2)] text-white px-4 py-2.5 rounded-xl text-sm font-semibold">
              <Plus className="w-4 h-4" /> Tambah Orang Tua Asuh
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle className="font-display text-[var(--pota-green)]">Tambah Orang Tua Asuh</DialogTitle></DialogHeader>
            <GuardianForm onSaved={() => { setOpen(false); load(); }} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="pota-input flex-1 flex items-center gap-2 bg-white border rounded-xl px-3.5 py-2.5">
          <Search className="w-4 h-4 text-[var(--pota-text-muted)]" />
          <input data-testid="input-search-ota" placeholder="Cari nama atau kontak..." value={q} onChange={(e)=>setQ(e.target.value)} className="flex-1 bg-transparent outline-none text-sm" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger data-testid="select-filter-status" className="w-full sm:w-56 bg-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-sm text-[var(--pota-text-muted)]">Memuat...</div>
      ) : rows.length === 0 ? (
        <div className="pota-card p-10 text-center">
          <Users2 className="w-10 h-10 mx-auto text-[var(--pota-gold)]" />
          <div className="mt-3 font-display text-lg text-[var(--pota-green)]">Belum ada Orang Tua Asuh</div>
          <div className="text-sm text-[var(--pota-text-muted)]">Tambahkan Orang Tua Asuh untuk memulai program.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {rows.map((g) => (
            <div key={g.id} data-testid={`card-ota-${g.id}`} className="pota-card p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link to={`/admin/orang-tua-asuh/${g.id}`} className="font-display text-lg text-[var(--pota-green)] hover:text-[var(--pota-gold)] truncate block">{g.name}</Link>
                  <div className="text-xs text-[var(--pota-text-muted)] truncate">{g.contact || "—"}</div>
                </div>
                <StatusBadge status={g.status} />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-[var(--pota-surface)] rounded-lg p-2">
                  <div className="text-[var(--pota-text-muted)] uppercase tracking-wider text-[10px]">Anak Asuh</div>
                  <div className="font-semibold text-[var(--pota-text)]">{g.children_count}</div>
                </div>
                <div className="bg-[var(--pota-surface)] rounded-lg p-2">
                  <div className="text-[var(--pota-text-muted)] uppercase tracking-wider text-[10px]">Total Donasi</div>
                  <div className="font-semibold text-[var(--pota-text)]">{formatIDR(g.total_donation)}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-[var(--pota-border)]">
                <button data-testid={`btn-copy-token-${g.id}`} onClick={()=>copyPortal(g.portal_token)} className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-[var(--pota-green)] hover:text-[var(--pota-gold)]">
                  <Copy className="w-3.5 h-3.5" /> Salin Portal
                </button>
                <a data-testid={`btn-open-portal-${g.id}`} href={`/portal/${g.portal_token}`} target="_blank" rel="noreferrer" className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-[var(--pota-green)] hover:text-[var(--pota-gold)]">
                  <ExternalLink className="w-3.5 h-3.5" /> Buka Portal
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
