import React, { useEffect, useState } from "react";
import api, { errText } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = ["Akademik", "Keagamaan", "Hafalan", "Karakter", "Kedisiplinan", "Kehadiran", "Prestasi", "Lainnya"];

function DevForm({ childrenList, onSaved }) {
  const children = childrenList;
  const [f, setF] = useState({ child_id: "", academic_year: "2025/2026", semester: "Semester 2", period_month: new Date().toISOString().slice(0,7), category: "Akademik", title: "", content: "", note: "" });
  const [saving, setSaving] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!f.child_id) return toast.error("Pilih Anak Asuh");
    setSaving(true);
    try { await api.post("/developments", f); toast.success("Capaian tersimpan"); onSaved(); }
    catch (e) { toast.error(errText(e)); }
    finally { setSaving(false); }
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="text-xs font-semibold uppercase">Anak Asuh *</label>
        <Select value={f.child_id} onValueChange={(v)=>setF({...f, child_id:v})}>
          <SelectTrigger data-testid="select-dev-child" className="mt-1"><SelectValue placeholder="Pilih..." /></SelectTrigger>
          <SelectContent>{children.map(c => <SelectItem key={c.id} value={c.id}>{c.name} · {c.nim}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold uppercase">Tahun Akademik</label>
          <input value={f.academic_year} onChange={(e)=>setF({...f, academic_year:e.target.value})} className="w-full mt-1 px-3 py-2 border rounded-lg" placeholder="2025/2026" />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase">Semester</label>
          <Select value={f.semester} onValueChange={(v)=>setF({...f, semester:v})}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Semester 1">Semester 1</SelectItem>
              <SelectItem value="Semester 2">Semester 2</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold uppercase">Periode</label>
          <input value={f.period_month} onChange={(e)=>setF({...f, period_month:e.target.value})} className="w-full mt-1 px-3 py-2 border rounded-lg" placeholder="YYYY-MM" />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase">Kategori *</label>
          <Select value={f.category} onValueChange={(v)=>setF({...f, category:v})}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold uppercase">Judul *</label>
        <input data-testid="input-dev-title" required value={f.title} onChange={(e)=>setF({...f, title:e.target.value})} className="w-full mt-1 px-3 py-2 border rounded-lg" />
      </div>
      <div>
        <label className="text-xs font-semibold uppercase">Isi Capaian *</label>
        <textarea data-testid="input-dev-content" required rows={4} value={f.content} onChange={(e)=>setF({...f, content:e.target.value})} className="w-full mt-1 px-3 py-2 border rounded-lg" />
      </div>
      <button data-testid="btn-save-dev" disabled={saving} className="w-full bg-[var(--pota-green)] text-white py-2.5 rounded-lg font-semibold">{saving ? "Menyimpan..." : "Simpan"}</button>
    </form>
  );
}

export default function PerkembanganPage() {
  const [devs, setDevs] = useState([]);
  const [children, setChildren] = useState([]);
  const [open, setOpen] = useState(false);
  const [filterChild, setFilterChild] = useState("all");
  const [filterCat, setFilterCat] = useState("all");

  const load = async () => {
    const [d, c] = await Promise.all([api.get("/developments"), api.get("/children")]);
    setDevs(d.data); setChildren(c.data);
  };
  useEffect(() => { load(); }, []);

  const filtered = devs.filter(d =>
    (filterChild === "all" || d.child_id === filterChild) &&
    (filterCat === "all" || d.category === filterCat)
  );

  const grouped = filtered.reduce((acc, d) => {
    (acc[d.child_name] ||= []).push(d);
    return acc;
  }, {});

  return (
    <div className="space-y-6" data-testid="page-perkembangan">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="gold-divider mb-3" />
          <h1 className="font-display text-2xl sm:text-3xl text-[var(--pota-green)]">Capaian/Perkembangan Anak Asuh</h1>
          <p className="text-sm text-[var(--pota-text-muted)] mt-1">Kumpulan catatan capaian akademik, keagamaan, karakter, dan lainnya.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button data-testid="btn-add-dev" className="inline-flex items-center gap-2 bg-[var(--pota-green)] text-white px-4 py-2.5 rounded-xl text-sm font-semibold">
              <Plus className="w-4 h-4" /> Tambah Capaian
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle className="font-display text-[var(--pota-green)]">Tambah Capaian</DialogTitle></DialogHeader>
            <DevForm childrenList={children} onSaved={()=>{ setOpen(false); load(); }} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Select value={filterChild} onValueChange={setFilterChild}>
          <SelectTrigger className="bg-white"><SelectValue placeholder="Semua Anak" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Anak</SelectItem>
            {children.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="bg-white"><SelectValue placeholder="Semua Kategori" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Kategori</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {Object.keys(grouped).length === 0 ? (
        <div className="pota-card p-10 text-center">
          <Sparkles className="w-10 h-10 mx-auto text-[var(--pota-gold)]" />
          <div className="mt-3 font-display text-lg text-[var(--pota-green)]">Belum ada capaian</div>
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(grouped).map(([name, list]) => (
            <Accordion type="single" collapsible key={name} className="pota-card">
              <AccordionItem value={name} className="border-none">
                <AccordionTrigger className="px-5 hover:no-underline">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#FCF7E8] text-[#8C6D14] border border-[#E8D38A] flex items-center justify-center font-display">{name[0]}</div>
                    <div className="text-left">
                      <div className="font-display text-lg text-[var(--pota-green)]">{name}</div>
                      <div className="text-xs text-[var(--pota-text-muted)]">{list.length} capaian</div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-5 pb-5">
                  <div className="space-y-3">
                    {list.map((d, i) => (
                      <div key={i} className="border-l-2 border-[var(--pota-gold)] pl-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="pota-pill-gold">{d.category}</span>
                          <span className="text-xs text-[var(--pota-text-muted)]">{d.semester} · {d.academic_year}</span>
                        </div>
                        <div className="font-semibold mt-1">{d.title}</div>
                        <div className="text-sm text-[var(--pota-text-muted)] mt-1">{d.content}</div>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          ))}
        </div>
      )}
    </div>
  );
}
