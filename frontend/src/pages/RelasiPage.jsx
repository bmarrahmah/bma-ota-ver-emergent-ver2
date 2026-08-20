import React, { useEffect, useMemo, useState } from "react";
import api, { errText } from "@/lib/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Link2, Trash2, Search, X, Users, GraduationCap, Filter } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "sonner";

export default function RelasiPage() {
  const [rels, setRels] = useState([]);
  const [guardians, setGuardians] = useState([]);
  const [children, setChildren] = useState([]);
  const [g, setG] = useState("");
  const [c, setC] = useState("");
  const [q, setQ] = useState("");
  const [fGuardian, setFGuardian] = useState("all");
  const [fChild, setFChild] = useState("all");
  const [fStatus, setFStatus] = useState("all");
  const [view, setView] = useState("ota"); // "ota" | "anak" | "list"

  const load = async () => {
    const [r1, r2, r3] = await Promise.all([
      api.get("/relations"), api.get("/guardians"), api.get("/children"),
    ]);
    setRels(r1.data); setGuardians(r2.data); setChildren(r3.data);
  };
  useEffect(() => { load(); }, []);

  const guardianById = useMemo(() => Object.fromEntries(guardians.map((x) => [x.id, x])), [guardians]);
  const childById = useMemo(() => Object.fromEntries(children.map((x) => [x.id, x])), [children]);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return rels.filter((r) => {
      if (fGuardian !== "all" && r.guardian_id !== fGuardian) return false;
      if (fChild !== "all" && r.child_id !== fChild) return false;
      if (fStatus !== "all" && guardianById[r.guardian_id]?.status !== fStatus) return false;
      if (ql) {
        const hay = `${r.guardian_name} ${r.child_name} ${r.child_nim}`.toLowerCase();
        if (!hay.includes(ql)) return false;
      }
      return true;
    });
  }, [rels, q, fGuardian, fChild, fStatus, guardianById]);

  const groupedByOta = useMemo(() => {
    const map = {};
    filtered.forEach((r) => {
      if (!map[r.guardian_id]) map[r.guardian_id] = { guardian: guardianById[r.guardian_id], rels: [] };
      map[r.guardian_id].rels.push(r);
    });
    return Object.values(map).sort((a, b) => (a.guardian?.name || "").localeCompare(b.guardian?.name || ""));
  }, [filtered, guardianById]);

  const groupedByChild = useMemo(() => {
    const map = {};
    filtered.forEach((r) => {
      if (!map[r.child_id]) map[r.child_id] = { child: childById[r.child_id], rels: [] };
      map[r.child_id].rels.push(r);
    });
    return Object.values(map).sort((a, b) => (a.child?.name || "").localeCompare(b.child?.name || ""));
  }, [filtered, childById]);

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

  const resetFilters = () => { setQ(""); setFGuardian("all"); setFChild("all"); setFStatus("all"); };
  const activeFilters = (q ? 1 : 0) + (fGuardian !== "all" ? 1 : 0) + (fChild !== "all" ? 1 : 0) + (fStatus !== "all" ? 1 : 0);

  const ViewButton = ({ v, icon: Icon, label }) => (
    <button
      data-testid={`btn-view-${v}`}
      onClick={() => setView(v)}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${view === v ? "bg-[var(--pota-green)] text-white" : "text-[var(--pota-text-muted)] hover:bg-[var(--pota-surface)]"}`}
    >
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  );

  return (
    <div className="space-y-6" data-testid="page-relasi">
      <div>
        <div className="gold-divider mb-3" />
        <h1 className="font-display text-2xl sm:text-3xl text-[var(--pota-green)]">Kelola Relasi</h1>
        <p className="text-sm text-[var(--pota-text-muted)] mt-1">Hubungkan banyak Orang Tua Asuh dengan banyak Anak Asuh (many-to-many).</p>
      </div>

      {/* Form tambah relasi */}
      <div className="pota-card p-5">
        <div className="text-[11px] uppercase tracking-widest text-[var(--pota-text-muted)] font-semibold mb-3">Tambah Relasi Baru</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Select value={g} onValueChange={setG}>
            <SelectTrigger data-testid="select-rel-guardian"><SelectValue placeholder="Pilih Orang Tua Asuh" /></SelectTrigger>
            <SelectContent>{guardians.map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={c} onValueChange={setC}>
            <SelectTrigger data-testid="select-rel-child"><SelectValue placeholder="Pilih Anak Asuh" /></SelectTrigger>
            <SelectContent>{children.map((x) => <SelectItem key={x.id} value={x.id}>{x.name} · {x.nim}</SelectItem>)}</SelectContent>
          </Select>
          <button data-testid="btn-add-relation" onClick={add} className="inline-flex items-center justify-center gap-2 bg-[var(--pota-green)] hover:bg-[var(--pota-green-2)] text-white px-4 py-2 rounded-lg font-semibold">
            <Plus className="w-4 h-4" /> Hubungkan
          </button>
        </div>
      </div>

      {/* Filter panel */}
      <div className="pota-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-widest text-[var(--pota-text-muted)] font-semibold">
            <Filter className="w-3.5 h-3.5" /> Filter & Pencarian
            {activeFilters > 0 && <span className="pota-pill-gold ml-1">{activeFilters} aktif</span>}
          </div>
          {activeFilters > 0 && (
            <button data-testid="btn-reset-filter" onClick={resetFilters} className="text-xs font-semibold text-[var(--pota-text-muted)] hover:text-[var(--pota-green)] inline-flex items-center gap-1">
              <X className="w-3.5 h-3.5" /> Reset
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="pota-input flex items-center gap-2 bg-white border rounded-lg px-3 py-2 md:col-span-2 lg:col-span-1">
            <Search className="w-4 h-4 text-[var(--pota-text-muted)]" />
            <input data-testid="input-search-rel" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama atau NIM..." className="flex-1 bg-transparent outline-none text-sm" />
          </div>

          <Select value={fGuardian} onValueChange={setFGuardian}>
            <SelectTrigger data-testid="filter-guardian" className="bg-white"><SelectValue placeholder="Semua Orang Tua Asuh" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Orang Tua Asuh</SelectItem>
              {guardians.map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={fChild} onValueChange={setFChild}>
            <SelectTrigger data-testid="filter-child" className="bg-white"><SelectValue placeholder="Semua Anak Asuh" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Anak Asuh</SelectItem>
              {children.map((x) => <SelectItem key={x.id} value={x.id}>{x.name} · {x.nim}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={fStatus} onValueChange={setFStatus}>
            <SelectTrigger data-testid="filter-status" className="bg-white"><SelectValue placeholder="Semua Status OTA" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status OTA</SelectItem>
              <SelectItem value="Rutin">Rutin</SelectItem>
              <SelectItem value="Tidak Rutin">Tidak Rutin</SelectItem>
              <SelectItem value="Insidentil">Insidentil</SelectItem>
              <SelectItem value="Tidak Aktif">Tidak Aktif</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[var(--pota-border)]">
          <div className="text-xs text-[var(--pota-text-muted)]">
            Menampilkan <span className="font-semibold text-[var(--pota-green)]">{filtered.length}</span> dari {rels.length} relasi
            {filtered.length > 0 && view === "ota" && ` · ${groupedByOta.length} Orang Tua Asuh`}
            {filtered.length > 0 && view === "anak" && ` · ${groupedByChild.length} Anak Asuh`}
          </div>
          <div className="inline-flex items-center gap-1 bg-[var(--pota-surface)] rounded-lg p-1">
            <ViewButton v="ota" icon={Users} label="Per OTA" />
            <ViewButton v="anak" icon={GraduationCap} label="Per Anak" />
            <ViewButton v="list" icon={Link2} label="Daftar" />
          </div>
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 ? (
        <div className="pota-card p-10 text-center">
          <Link2 className="w-10 h-10 mx-auto text-[var(--pota-gold)]" />
          <div className="mt-3 font-display text-lg text-[var(--pota-green)]">
            {rels.length === 0 ? "Belum ada relasi" : "Tidak ada relasi yang cocok"}
          </div>
          <div className="text-sm text-[var(--pota-text-muted)] mt-1">
            {rels.length === 0 ? "Tambahkan relasi pertama menggunakan formulir di atas." : "Sesuaikan filter atau kata kunci pencarian."}
          </div>
        </div>
      ) : view === "ota" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {groupedByOta.map(({ guardian, rels }) => (
            <div key={guardian?.id} data-testid={`group-ota-${guardian?.id}`} className="pota-card p-5">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="min-w-0">
                  <div className="font-display text-lg text-[var(--pota-green)] truncate">{guardian?.name || "-"}</div>
                  <div className="mt-1 flex items-center gap-2">
                    {guardian?.status && <StatusBadge status={guardian.status} />}
                    <span className="text-xs text-[var(--pota-text-muted)]">{rels.length} anak</span>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                {rels.map((r) => (
                  <div key={r.id} className="flex items-center justify-between bg-[var(--pota-surface)] rounded-lg px-3 py-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[var(--pota-text)] truncate">{r.child_name}</div>
                      <div className="text-[11px] text-[var(--pota-text-muted)]">NIM {r.child_nim}</div>
                    </div>
                    <button data-testid={`btn-remove-rel-${r.id}`} onClick={() => remove(r.id)} title="Putuskan relasi" className="text-red-600 hover:text-red-700 p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : view === "anak" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {groupedByChild.map(({ child, rels }) => (
            <div key={child?.id} data-testid={`group-anak-${child?.id}`} className="pota-card p-5">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="min-w-0">
                  <div className="font-display text-lg text-[var(--pota-green)] truncate">{child?.name || "-"}</div>
                  <div className="text-xs text-[var(--pota-text-muted)]">NIM {child?.nim} · Angkatan {child?.generation}</div>
                  <div className="mt-1"><span className="pota-pill-gold">{rels.length} Orang Tua Asuh</span></div>
                </div>
              </div>
              <div className="space-y-2">
                {rels.map((r) => {
                  const gg = guardianById[r.guardian_id];
                  return (
                    <div key={r.id} className="flex items-center justify-between bg-[var(--pota-surface)] rounded-lg px-3 py-2">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[var(--pota-text)] truncate">{r.guardian_name}</div>
                        {gg?.status && <div className="mt-1"><StatusBadge status={gg.status} /></div>}
                      </div>
                      <button data-testid={`btn-remove-rel-${r.id}`} onClick={() => remove(r.id)} title="Putuskan relasi" className="text-red-600 hover:text-red-700 p-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="pota-card divide-y">
          {filtered.map((r) => (
            <div key={r.id} className="p-4 flex items-center justify-between">
              <div className="min-w-0">
                <div className="font-semibold text-[var(--pota-green)] truncate">
                  {r.guardian_name} <span className="text-[var(--pota-gold)] mx-2">↔</span> {r.child_name}
                </div>
                <div className="text-xs text-[var(--pota-text-muted)]">NIM {r.child_nim}</div>
              </div>
              <button data-testid={`btn-remove-rel-${r.id}`} onClick={() => remove(r.id)} className="text-sm text-red-600 inline-flex items-center gap-1">
                <Trash2 className="w-4 h-4" /> Hapus
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
