import React, { useState } from "react";
import api, { errText } from "@/lib/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const STATUSES = ["Rutin", "Tidak Rutin", "Insidentil", "Tidak Aktif"];

export default function GuardianForm({ onSaved, initial }) {
  const [f, setF] = useState(initial || { name: "", contact: "", email: "", address: "", status: "Rutin", notes: "" });
  const [saving, setSaving] = useState(false);
  const isEdit = !!initial?.id;

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit) await api.put(`/guardians/${initial.id}`, f);
      else await api.post("/guardians", f);
      toast.success(isEdit ? "Data Orang Tua Asuh diperbarui" : "Orang Tua Asuh disimpan");
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
          <input data-testid="input-ota-contact" value={f.contact || ""} onChange={(e)=>setF({...f, contact:e.target.value})} className="w-full mt-1 px-3 py-2 border rounded-lg" placeholder="+62 812-..." />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide">Email</label>
          <input value={f.email || ""} onChange={(e)=>setF({...f, email:e.target.value})} className="w-full mt-1 px-3 py-2 border rounded-lg" />
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide">Alamat</label>
        <input value={f.address || ""} onChange={(e)=>setF({...f, address:e.target.value})} className="w-full mt-1 px-3 py-2 border rounded-lg" />
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
        <textarea value={f.notes || ""} onChange={(e)=>setF({...f, notes:e.target.value})} className="w-full mt-1 px-3 py-2 border rounded-lg" rows={2} />
      </div>
      <button data-testid="btn-save-ota" disabled={saving} className="w-full bg-[var(--pota-green)] text-white py-2.5 rounded-lg font-semibold">
        {saving ? "Menyimpan..." : (isEdit ? "Perbarui" : "Simpan")}
      </button>
    </form>
  );
}
