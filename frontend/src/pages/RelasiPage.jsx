import React, { useEffect, useState } from "react";
import api, { errText } from "@/lib/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Link2, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function RelasiPage() {
  const [rels, setRels] = useState([]);
  const [guardians, setGuardians] = useState([]);
  const [children, setChildren] = useState([]);
  const [g, setG] = useState("");
  const [c, setC] = useState("");

  const load = async () => {
    const [r1, r2, r3] = await Promise.all([
      api.get("/relations"), api.get("/guardians"), api.get("/children"),
    ]);
    setRels(r1.data); setGuardians(r2.data); setChildren(r3.data);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!g || !c) return toast.error("Pilih Orang Tua Asuh dan Anak Asuh");
    try {
      await api.post("/relations", { guardian_id: g, child_id: c });
      toast.success("Relasi ditambahkan");
      setG(""); setC(""); load();
    } catch (e) { toast.error(errText(e)); }
  };

  const remove = async (id) => {
    try { await api.delete(`/relations/${id}`); toast.success("Relasi dihapus"); load(); }
    catch (e) { toast.error(errText(e)); }
  };

  return (
    <div className="space-y-6" data-testid="page-relasi">
      <div>
        <div className="gold-divider mb-3" />
        <h1 className="font-display text-2xl sm:text-3xl text-[var(--pota-green)]">Kelola Relasi</h1>
        <p className="text-sm text-[var(--pota-text-muted)] mt-1">Hubungkan banyak Orang Tua Asuh dengan banyak Anak Asuh (many-to-many).</p>
      </div>

      <div className="pota-card p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Select value={g} onValueChange={setG}>
            <SelectTrigger data-testid="select-rel-guardian"><SelectValue placeholder="Pilih Orang Tua Asuh" /></SelectTrigger>
            <SelectContent>{guardians.map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={c} onValueChange={setC}>
            <SelectTrigger data-testid="select-rel-child"><SelectValue placeholder="Pilih Anak Asuh" /></SelectTrigger>
            <SelectContent>{children.map((x) => <SelectItem key={x.id} value={x.id}>{x.name} · {x.nim}</SelectItem>)}</SelectContent>
          </Select>
          <button data-testid="btn-add-relation" onClick={add} className="inline-flex items-center justify-center gap-2 bg-[var(--pota-green)] text-white px-4 py-2 rounded-lg font-semibold">
            <Plus className="w-4 h-4" /> Hubungkan
          </button>
        </div>
      </div>

      {rels.length === 0 ? (
        <div className="pota-card p-10 text-center">
          <Link2 className="w-10 h-10 mx-auto text-[var(--pota-gold)]" />
          <div className="mt-3 font-display text-lg text-[var(--pota-green)]">Belum ada relasi</div>
        </div>
      ) : (
        <div className="pota-card divide-y">
          {rels.map((r) => (
            <div key={r.id} className="p-4 flex items-center justify-between">
              <div>
                <div className="font-semibold text-[var(--pota-green)]">{r.guardian_name} <span className="text-[var(--pota-gold)] mx-2">↔</span> {r.child_name}</div>
                <div className="text-xs text-[var(--pota-text-muted)]">NIM {r.child_nim}</div>
              </div>
              <button data-testid={`btn-remove-rel-${r.id}`} onClick={() => remove(r.id)} className="text-sm text-red-600 inline-flex items-center gap-1"><Trash2 className="w-4 h-4" /> Hapus</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
