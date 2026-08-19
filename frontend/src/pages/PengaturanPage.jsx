import React, { useEffect, useState } from "react";
import api, { errText } from "@/lib/api";
import { toast } from "sonner";

export default function PengaturanPage() {
  const [f, setF] = useState({ institution_name: "", tagline: "", contact: "", address: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get("/settings").then(r => setF(r.data)); }, []);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try { await api.put("/settings", f); toast.success("Pengaturan disimpan"); }
    catch (e) { toast.error(errText(e)); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6" data-testid="page-pengaturan">
      <div>
        <div className="gold-divider mb-3" />
        <h1 className="font-display text-2xl sm:text-3xl text-[var(--pota-green)]">Pengaturan Portal</h1>
        <p className="text-sm text-[var(--pota-text-muted)] mt-1">Profil lembaga yang ditampilkan di portal Orang Tua Asuh.</p>
      </div>

      <form onSubmit={save} className="pota-card p-6 space-y-4 max-w-2xl">
        <div>
          <label className="text-xs font-semibold uppercase">Nama Lembaga *</label>
          <input required value={f.institution_name} onChange={(e)=>setF({...f, institution_name:e.target.value})} className="w-full mt-1 px-3 py-2 border rounded-lg" />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase">Tagline</label>
          <input value={f.tagline || ""} onChange={(e)=>setF({...f, tagline:e.target.value})} className="w-full mt-1 px-3 py-2 border rounded-lg" />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase">Kontak</label>
          <input value={f.contact || ""} onChange={(e)=>setF({...f, contact:e.target.value})} className="w-full mt-1 px-3 py-2 border rounded-lg" />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase">Alamat</label>
          <input value={f.address || ""} onChange={(e)=>setF({...f, address:e.target.value})} className="w-full mt-1 px-3 py-2 border rounded-lg" />
        </div>
        <button disabled={saving} className="bg-[var(--pota-green)] text-white px-6 py-2.5 rounded-lg font-semibold">{saving ? "Menyimpan..." : "Simpan"}</button>
      </form>
    </div>
  );
}
