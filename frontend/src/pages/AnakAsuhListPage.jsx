import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import ChildForm from "@/components/ChildForm";
import { Search, Plus, GraduationCap } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function AnakAsuhListPage() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const load = async () => {
    const r = await api.get("/children", { params: { q: q || undefined } });
    setRows(r.data);
  };
  useEffect(() => { load(); }, [q]);

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

      <div className="pota-input flex items-center gap-2 bg-white border rounded-xl px-3.5 py-2.5">
        <Search className="w-4 h-4 text-[var(--pota-text-muted)]" />
        <input data-testid="input-search-child" placeholder="Cari nama, NIM, angkatan..." value={q} onChange={(e)=>setQ(e.target.value)} className="flex-1 bg-transparent outline-none text-sm" />
      </div>

      {rows.length === 0 ? (
        <div className="pota-card p-10 text-center">
          <GraduationCap className="w-10 h-10 mx-auto text-[var(--pota-gold)]" />
          <div className="mt-3 font-display text-lg text-[var(--pota-green)]">Belum ada Anak Asuh</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {rows.map((c) => (
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
