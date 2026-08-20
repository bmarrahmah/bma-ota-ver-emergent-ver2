import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import ChildForm from "@/components/ChildForm";
import { Search, Plus, GraduationCap, Filter, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STATUSES = ["Aktif", "Alumni", "Non-Aktif"];

export default function AnakAsuhListPage() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [fGen, setFGen] = useState("all");
  const [fStatus, setFStatus] = useState("all");
  const [open, setOpen] = useState(false);

  const load = async () => {
    const r = await api.get("/children");
    setRows(r.data);
  };
  useEffect(() => { load(); }, []);

  const generations = useMemo(() => {
    const s = new Set(rows.map((c) => c.generation).filter(Boolean));
    return Array.from(s).sort((a, b) => b.localeCompare(a));
  }, [rows]);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return rows.filter((c) => {
      if (fGen !== "all" && c.generation !== fGen) return false;
      if (fStatus !== "all" && c.status !== fStatus) return false;
      if (ql) {
        const hay = `${c.name || ""} ${c.nim || ""} ${c.generation || ""} ${c.school || ""}`.toLowerCase();
        if (!hay.includes(ql)) return false;
      }
      return true;
    });
  }, [rows, q, fGen, fStatus]);

  const resetFilters = () => { setQ(""); setFGen("all"); setFStatus("all"); };
  const activeFilters = (q ? 1 : 0) + (fGen !== "all" ? 1 : 0) + (fStatus !== "all" ? 1 : 0);

  return (
    <div className="space-y-6" data-testid="page-anak">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="gold-divider mb-3" />
          <h1 className="font-display text-2xl sm:text-3xl text-[var(--pota-green)]">Anak Asuh</h1>
          <p className="text-sm text-[var(--pota-text-muted)] mt-1">Data lengkap anak-anak binaan program.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button data-testid="btn-add-child" className="inline-flex items-center gap-2 bg-[var(--pota-green)] hover:bg-[var(--pota-green-2)] text-white px-4 py-2.5 rounded-xl text-sm font-semibold">
              <Plus className="w-4 h-4" /> Tambah Anak Asuh
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle className="font-display text-[var(--pota-green)]">Tambah Anak Asuh</DialogTitle></DialogHeader>
            <ChildForm onSaved={() => { setOpen(false); load(); }} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="pota-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-widest text-[var(--pota-text-muted)] font-semibold">
            <Filter className="w-3.5 h-3.5" /> Filter & Pencarian
            {activeFilters > 0 && <span className="pota-pill-gold ml-1">{activeFilters} aktif</span>}
          </div>
          {activeFilters > 0 && (
            <button data-testid="btn-reset-anak-filter" onClick={resetFilters} className="text-xs font-semibold text-[var(--pota-text-muted)] hover:text-[var(--pota-green)] inline-flex items-center gap-1">
              <X className="w-3.5 h-3.5" /> Reset
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="pota-input flex items-center gap-2 bg-white border rounded-lg px-3 py-2">
            <Search className="w-4 h-4 text-[var(--pota-text-muted)]" />
            <input data-testid="input-search-child" placeholder="Cari nama, NIM, sekolah..." value={q} onChange={(e) => setQ(e.target.value)} className="flex-1 bg-transparent outline-none text-sm" />
          </div>
          <Select value={fGen} onValueChange={setFGen}>
            <SelectTrigger data-testid="filter-anak-generation" className="bg-white"><SelectValue placeholder="Semua Angkatan" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Angkatan</SelectItem>
              {generations.map((g) => <SelectItem key={g} value={g}>Angkatan {g}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fStatus} onValueChange={setFStatus}>
            <SelectTrigger data-testid="filter-anak-status" className="bg-white"><SelectValue placeholder="Semua Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="text-xs text-[var(--pota-text-muted)] pt-3 border-t border-[var(--pota-border)]">
          Menampilkan <span className="font-semibold text-[var(--pota-green)]">{filtered.length}</span> dari {rows.length} anak asuh
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="pota-card p-10 text-center">
          <GraduationCap className="w-10 h-10 mx-auto text-[var(--pota-gold)]" />
          <div className="mt-3 font-display text-lg text-[var(--pota-green)]">
            {rows.length === 0 ? "Belum ada Anak Asuh" : "Tidak ada anak yang cocok"}
          </div>
          {rows.length > 0 && <div className="text-sm text-[var(--pota-text-muted)] mt-1">Sesuaikan filter atau kata kunci pencarian.</div>}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((c) => (
            <Link key={c.id} to={`/admin/anak-asuh/${c.id}`} className="pota-card p-4" data-testid={`card-child-${c.id}`}>
              <div className="w-full aspect-square rounded-xl bg-[var(--pota-surface)] overflow-hidden flex items-center justify-center mb-3">
                {c.photo_url ? <img src={c.photo_url.startsWith('/api') ? `${process.env.REACT_APP_BACKEND_URL}${c.photo_url}` : c.photo_url} alt={c.name} className="w-full h-full object-cover" /> : <span className="font-display text-4xl text-[var(--pota-green)]">{c.name[0]}</span>}
              </div>
              <div className="font-display text-lg text-[var(--pota-green)] truncate">{c.name}</div>
              <div className="text-xs text-[var(--pota-text-muted)]">NIM {c.nim} · Angkatan {c.generation}</div>
              <div className="text-xs text-[var(--pota-text-muted)] truncate mt-0.5">{c.school}</div>
              <div className="flex items-center justify-between mt-3">
                <span className="pota-pill-gold">{c.guardians_count} OTA</span>
                <StatusBadge status={c.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
