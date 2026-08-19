import React, { useRef, useState } from "react";
import api, { errText } from "@/lib/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, GraduationCap } from "lucide-react";
import { toast } from "sonner";

const STATUSES = ["Aktif", "Alumni", "Non-Aktif"];

export default function ChildForm({ onSaved, initial }) {
  const [f, setF] = useState(initial || {
    name: "", nim: "", generation: new Date().getFullYear().toString(),
    birth_date: "", address: "", father_name: "", father_job: "", mother_name: "", mother_job: "",
    school: "", aspiration: "", photo_url: "", status: "Aktif",
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();
  const isEdit = !!initial?.id;

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
      if (isEdit) await api.put(`/children/${initial.id}`, f);
      else await api.post("/children", f);
      toast.success(isEdit ? "Data Anak Asuh diperbarui" : "Anak Asuh disimpan");
      onSaved();
    } catch (e) { toast.error(errText(e)); }
    finally { setSaving(false); }
  };

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const photoSrc = f.photo_url && f.photo_url.startsWith('/api') ? `${process.env.REACT_APP_BACKEND_URL}${f.photo_url}` : f.photo_url;

  return (
    <form onSubmit={submit} className="space-y-3 max-h-[70vh] overflow-y-auto scrollbar-slim pr-1">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2 flex items-center gap-3">
          <div className="w-16 h-16 rounded-xl bg-[var(--pota-surface)] overflow-hidden flex items-center justify-center">
            {photoSrc ? <img src={photoSrc} alt="" className="w-full h-full object-cover" /> : <GraduationCap className="w-6 h-6 text-[var(--pota-green)]" />}
          </div>
          <button data-testid="btn-upload-photo" type="button" onClick={()=>fileRef.current.click()} className="inline-flex items-center gap-2 border border-[var(--pota-border)] px-3 py-2 rounded-lg text-sm">
            <Upload className="w-4 h-4" /> {uploading ? "Mengunggah..." : "Unggah Foto"}
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={upload} className="hidden" />
        </div>
        <div><label className="text-xs font-semibold uppercase">Nama *</label><input data-testid="input-child-name" required value={f.name} onChange={set("name")} className="w-full mt-1 px-3 py-2 border rounded-lg" /></div>
        <div><label className="text-xs font-semibold uppercase">NIM *</label><input data-testid="input-child-nim" required value={f.nim} onChange={set("nim")} className="w-full mt-1 px-3 py-2 border rounded-lg" /></div>
        <div><label className="text-xs font-semibold uppercase">Angkatan *</label><input required value={f.generation} onChange={set("generation")} className="w-full mt-1 px-3 py-2 border rounded-lg" /></div>
        <div><label className="text-xs font-semibold uppercase">Tanggal Lahir</label><input type="date" value={f.birth_date || ""} onChange={set("birth_date")} className="w-full mt-1 px-3 py-2 border rounded-lg" /></div>
        <div className="sm:col-span-2"><label className="text-xs font-semibold uppercase">Alamat</label><input value={f.address || ""} onChange={set("address")} className="w-full mt-1 px-3 py-2 border rounded-lg" /></div>
        <div><label className="text-xs font-semibold uppercase">Nama Ayah</label><input value={f.father_name || ""} onChange={set("father_name")} className="w-full mt-1 px-3 py-2 border rounded-lg" /></div>
        <div><label className="text-xs font-semibold uppercase">Pekerjaan Ayah</label><input value={f.father_job || ""} onChange={set("father_job")} className="w-full mt-1 px-3 py-2 border rounded-lg" /></div>
        <div><label className="text-xs font-semibold uppercase">Nama Ibu</label><input value={f.mother_name || ""} onChange={set("mother_name")} className="w-full mt-1 px-3 py-2 border rounded-lg" /></div>
        <div><label className="text-xs font-semibold uppercase">Pekerjaan Ibu</label><input value={f.mother_job || ""} onChange={set("mother_job")} className="w-full mt-1 px-3 py-2 border rounded-lg" /></div>
        <div><label className="text-xs font-semibold uppercase">Sekolah/Pesantren</label><input value={f.school || ""} onChange={set("school")} className="w-full mt-1 px-3 py-2 border rounded-lg" /></div>
        <div><label className="text-xs font-semibold uppercase">Cita-cita</label><input value={f.aspiration || ""} onChange={set("aspiration")} className="w-full mt-1 px-3 py-2 border rounded-lg" /></div>
        <div>
          <label className="text-xs font-semibold uppercase">Status</label>
          <Select value={f.status} onValueChange={(v)=>setF({...f, status:v})}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <button data-testid="btn-save-child" disabled={saving} className="w-full bg-[var(--pota-green)] text-white py-2.5 rounded-lg font-semibold">
        {saving ? "Menyimpan..." : (isEdit ? "Perbarui" : "Simpan")}
      </button>
    </form>
  );
}
