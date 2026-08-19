import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api, { formatDate } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import ChildForm from "@/components/ChildForm";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, MapPin, Calendar, Users2, Home, Edit3 } from "lucide-react";

export default function AnakAsuhDetailPage() {
  const { id } = useParams();
  const [c, setC] = useState(null);
  const [editOpen, setEditOpen] = useState(false);

  const load = () => api.get(`/children/${id}`).then((r) => setC(r.data));
  useEffect(() => { load(); }, [id]);
  if (!c) return <div className="text-sm text-[var(--pota-text-muted)]">Memuat...</div>;

  const grouped = (c.developments || []).reduce((acc, d) => {
    const key = `${d.academic_year} · ${d.semester}`;
    (acc[key] ||= []).push(d);
    return acc;
  }, {});

  const photoUrl = c.photo_url && c.photo_url.startsWith('/api') ? `${process.env.REACT_APP_BACKEND_URL}${c.photo_url}` : c.photo_url;

  return (
    <div className="space-y-6" data-testid="page-child-detail">
      <Link to="/admin/anak-asuh" className="inline-flex items-center gap-1.5 text-sm text-[var(--pota-text-muted)] hover:text-[var(--pota-green)]">
        <ArrowLeft className="w-4 h-4" /> Kembali
      </Link>

      <div className="pota-card p-6">
        <div className="flex flex-col md:flex-row items-start gap-6">
          <div className="w-40 h-40 rounded-2xl overflow-hidden bg-[var(--pota-surface)] flex items-center justify-center flex-shrink-0">
            {photoUrl ? <img src={photoUrl} alt={c.name} className="w-full h-full object-cover" /> : <span className="font-display text-6xl text-[var(--pota-green)]">{c.name[0]}</span>}
          </div>
          <div className="flex-1">
            <div className="gold-divider mb-3" />
            <div className="flex items-start justify-between gap-3">
              <h1 className="font-display text-3xl text-[var(--pota-green)]">{c.name}</h1>
              <button data-testid="btn-edit-child" onClick={()=>setEditOpen(true)} className="inline-flex items-center gap-2 border border-[var(--pota-border)] px-3 py-2 rounded-xl text-sm font-semibold hover:border-[var(--pota-gold)]">
                <Edit3 className="w-4 h-4" /> Edit
              </button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2 text-sm">
              <span className="pota-pill-gold">NIM {c.nim}</span>
              <span className="pota-pill-gold">Angkatan {c.generation}</span>
              <StatusBadge status={c.status} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 text-sm text-[var(--pota-text-muted)]">
              {c.birth_date && <div className="flex items-center gap-2"><Calendar className="w-4 h-4" /> {formatDate(c.birth_date)}</div>}
              {c.address && <div className="flex items-center gap-2"><MapPin className="w-4 h-4" /> {c.address}</div>}
              {c.school && <div className="flex items-center gap-2"><Home className="w-4 h-4" /> {c.school}</div>}
              {c.aspiration && <div className="flex items-center gap-2">✨ {c.aspiration}</div>}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="pota-card p-6 lg:col-span-1">
          <div className="text-[11px] uppercase tracking-widest font-semibold text-[var(--pota-text-muted)]">Profil Keluarga</div>
          <div className="mt-3 space-y-3 text-sm">
            <div>
              <div className="text-[var(--pota-text-muted)] text-xs">Ayah</div>
              <div className="font-semibold">{c.father_name || "-"}</div>
              <div className="text-xs text-[var(--pota-text-muted)]">{c.father_job || "-"}</div>
            </div>
            <div>
              <div className="text-[var(--pota-text-muted)] text-xs">Ibu</div>
              <div className="font-semibold">{c.mother_name || "-"}</div>
              <div className="text-xs text-[var(--pota-text-muted)]">{c.mother_job || "-"}</div>
            </div>
          </div>
        </div>

        <div className="pota-card p-6 lg:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <Users2 className="w-4 h-4 text-[var(--pota-gold)]" />
            <div className="text-[11px] uppercase tracking-widest font-semibold text-[var(--pota-text-muted)]">Orang Tua Asuh Terkait</div>
          </div>
          {c.guardians.length === 0 ? (
            <div className="text-sm text-[var(--pota-text-muted)]">Belum terhubung dengan Orang Tua Asuh.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {c.guardians.map((g) => (
                <Link key={g.id} to={`/admin/orang-tua-asuh/${g.id}`} className="border border-[var(--pota-border)] rounded-xl p-3 hover:border-[var(--pota-gold)]">
                  <div className="font-semibold text-[var(--pota-green)]">{g.name}</div>
                  <div className="mt-1"><StatusBadge status={g.status} /></div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="pota-card p-6">
        <div className="gold-divider mb-2" />
        <h2 className="font-display text-2xl text-[var(--pota-green)]">Capaian/Perkembangan Anak Asuh</h2>
        {Object.keys(grouped).length === 0 ? (
          <div className="mt-4 text-sm text-[var(--pota-text-muted)]">Belum ada capaian tercatat.</div>
        ) : (
          <Accordion type="multiple" className="mt-4">
            {Object.entries(grouped).map(([key, list]) => (
              <AccordionItem key={key} value={key}>
                <AccordionTrigger className="font-semibold text-[var(--pota-green)]">{key} · {list.length} capaian</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3">
                    {list.map((d, i) => (
                      <div key={i} className="border-l-2 border-[var(--pota-gold)] pl-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="pota-pill-gold">{d.category}</span>
                          {d.period_month && <span className="text-xs text-[var(--pota-text-muted)]">{d.period_month}</span>}
                        </div>
                        <div className="font-semibold mt-1">{d.title}</div>
                        <div className="text-sm text-[var(--pota-text-muted)] mt-1">{d.content}</div>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle className="font-display text-[var(--pota-green)]">Edit Anak Asuh</DialogTitle></DialogHeader>
          <ChildForm initial={c} onSaved={()=>{ setEditOpen(false); load(); }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
