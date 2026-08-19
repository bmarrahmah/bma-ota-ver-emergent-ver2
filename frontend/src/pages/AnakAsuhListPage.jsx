import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api, { errText } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import { Search, Plus, Upload, GraduationCap } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

function ChildForm({ onSaved }) {
  const [f, setF] = useState({
    name: "", nim: "", generation: new Date().getFullYear().toString(),
    birth_date: "", address: "", father_name: "", father_job: "", mother_name: "", mother_job: "",
    school: "", aspiration: "", photo_url: "", status: "Aktif",
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  const upload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await api.post("/upload/photo", fd, { headers: { "Content-Type": "multipart/form-data" }});
      setF((prev) => ({ ...prev, photo_url: r.data.url }));
      toast.success("Foto berhasil diunggah");
    } catch (e) { toast.error(errText(e)); }
    finally { setUploading(false); }
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/children", f);
      toast.success("Anak Asuh disimpan");
      onSaved();
    } catch (e) { toast.error(errText(e)); }
    finally { setSaving(false); }
  };

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <form onSubmit={submit} className="space-y-3 max-h-[70vh] overflow-y-auto scrollbar-slim pr-1">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2 flex items-center gap-3">
          <div className="w-16 h-16 rounded-xl bg-[var(--pota-surface)] overflow-hidden flex items-center justify-center">
            {f.photo_url ? <img src={f.photo_url.startsWith('/api') ? `${process.env.REACT_APP_BACKEND_URL}${f.photo_url}` : f.photo_url} className="w-full h-full object-cover" /> : <GraduationCap className="w-6 h-6 text-[var(--pota-green)]" />}
          </div>
          <button data-testid="btn-upload-photo" type="button" onClick={()=>fileRef.current.click()} className="inline-flex items-center gap-2 border border-[var(--pota-border)] px-3 py-2 rounded-lg text-sm">
            <Upload className="w-4 h-4" /> {uploading ? "Mengunggah..." : "Unggah Foto"}
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={upload} className="hidden" />
        </div>
        <div><label className="text-xs font-semibold uppercase">Nama *</label><input data-testid="input-child-name" required value={f.name} onChange={set("name")} className="w-full mt-1 px-3 py-2 border rounded-lg" /></div>
        <div><label className="text-xs font-semibold uppercase">NIM *</label><input data-testid="input-child-nim" required value={f.nim} onChange={set("nim")} className="w-full mt-1 px-3 py-2 border rounded-lg" /></div>
        <div><label className="text-xs font-semibold uppercase">Angkatan *</label><input required value={f.generation} onChange={set("generation")} className="w-full mt-1 px-3 py-2 border rounded-lg" /></div>
        <div><label className="text-xs font-semibold uppercase">Tanggal Lahir</label><input type="date" value={f.birth_date} onChange={set("birth_date")} className="w-full mt-1 px-3 py-2 border rounded-lg" /></div>
        <div className="sm:col-span-2"><label className="text-xs font-semibold uppercase">Alamat</label><input value={f.address} onChange={set("address")} className="w-full mt-1 px-3 py-2 border rounded-lg" /></div>
        <div><label className="text-xs font-semibold uppercase">Nama Ayah</label><input value={f.father_name} onChange={set("father_name")} className="w-full mt-1 px-3 py-2 border rounded-lg" /></div>
        <div><label className="text-xs font-semibold uppercase">Pekerjaan Ayah</label><input value={f.father_job} onChange={set("father_job")} className="w-full mt-1 px-3 py-2 border rounded-lg" /></div>
        <div><label className="text-xs font-semibold uppercase">Nama Ibu</label><input value={f.mother_name} onChange={set("mother_name")} className="w-full mt-1 px-3 py-2 border rounded-lg" /></div>
        <div><label className="text-xs font-semibold uppercase">Pekerjaan Ibu</label><input value={f.mother_job} onChange={set("mother_job")} className="w-full mt-1 px-3 py-2 border rounded-lg" /></div>
        <div><label className="text-xs font-semibold uppercase">Sekolah/Pesantren</label><input value={f.school} onChange={set("school")} className="w-full mt-1 px-3 py-2 border rounded-lg" /></div>
        <div><label className="text-xs font-semibold uppercase">Cita-cita</label><input value={f.aspiration} onChange={set("aspiration")} className="w-full mt-1 px-3 py-2 border rounded-lg" /></div>
      </div>
      <button data-testid="btn-save-child" disabled={saving} className="w-full bg-[var(--pota-green)] text-white py-2.5 rounded-lg font-semibold">{saving ? "Menyimpan..." : "Simpan"}</button>
    </form>
  );
}

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
