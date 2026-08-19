import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api, { formatIDR, formatMonth, formatDate, errText, API } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import GuardianForm from "@/components/GuardianForm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Copy, ExternalLink, Phone, MapPin, Mail, ArrowLeft, RefreshCcw, Edit3, MessageCircle } from "lucide-react";
import { toast } from "sonner";

export default function OrangTuaAsuhDetailPage() {
  const { id } = useParams();
  const [g, setG] = useState(null);
  const [children, setChildren] = useState([]);
  const [donations, setDonations] = useState([]);
  const [devs, setDevs] = useState([]);
  const [editOpen, setEditOpen] = useState(false);

  const load = async () => {
    const r = await api.get(`/guardians/${id}`);
    setG(r.data);
    const rels = await api.get("/relations");
    const myRels = rels.data.filter((x) => x.guardian_id === id);
    const kids = await Promise.all(myRels.map((r) => api.get(`/children/${r.child_id}`).then(x => x.data)));
    setChildren(kids);
    const d = await api.get(`/donations`, { params: { guardian_id: id } });
    setDonations(d.data);
    const allDevs = kids.flatMap((c) => (c.developments || []).map(d => ({ ...d, child_name: c.name })));
    setDevs(allDevs);
  };
  useEffect(() => { load(); }, [id]);

  if (!g) return <div className="text-sm text-[var(--pota-text-muted)]">Memuat...</div>;

  const portalUrl = `${window.location.origin}/portal/${g.portal_token}`;
  const copy = () => { navigator.clipboard.writeText(portalUrl); toast.success("Tautan portal disalin"); };
  const regenerate = async () => {
    try {
      await api.post(`/guardians/${id}/regenerate-token`);
      toast.success("Tautan portal diperbarui");
      load();
    } catch (e) { toast.error(errText(e)); }
  };
  const sendWA = () => {
    const msg =
      `Assalamu'alaikum warahmatullahi wabarakatuh,\n\nBapak/Ibu ${g.name} yang kami hormati.\n\n` +
      `Jazakumullah khairan atas kebaikan menjadi Orang Tua Asuh. Berikut kami sampaikan tautan portal pribadi Anda untuk melihat perkembangan anak asuh, riwayat donasi, dan laporan bulanan:\n\n${portalUrl}\n\n` +
      `Semoga menjadi amal jariyah yang mengalir. Barakallahu fiikum.`;
    const phone = (g.contact || "").replace(/\D/g, "");
    const wa = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(wa, "_blank");
  };

  return (
    <div className="space-y-6" data-testid="page-ota-detail">
      <Link to="/admin/orang-tua-asuh" className="inline-flex items-center gap-1.5 text-sm text-[var(--pota-text-muted)] hover:text-[var(--pota-green)]">
        <ArrowLeft className="w-4 h-4" /> Kembali ke daftar
      </Link>

      <div className="pota-card p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="gold-divider mb-3" />
            <h1 className="font-display text-3xl text-[var(--pota-green)]">{g.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-[var(--pota-text-muted)]">
              <StatusBadge status={g.status} />
              {g.contact && <span className="inline-flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {g.contact}</span>}
              {g.email && <span className="inline-flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> {g.email}</span>}
              {g.address && <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {g.address}</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button data-testid="btn-edit-ota" onClick={()=>setEditOpen(true)} className="inline-flex items-center gap-2 border border-[var(--pota-border)] px-3 py-2.5 rounded-xl text-sm font-semibold hover:border-[var(--pota-gold)]">
              <Edit3 className="w-4 h-4" /> Edit Data
            </button>
            <button data-testid="btn-copy-portal" onClick={copy} className="inline-flex items-center gap-2 bg-[var(--pota-green)] text-white px-3 py-2.5 rounded-xl text-sm font-semibold">
              <Copy className="w-4 h-4" /> Salin Link
            </button>
            <button data-testid="btn-send-wa" onClick={sendWA} className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white px-3 py-2.5 rounded-xl text-sm font-semibold">
              <MessageCircle className="w-4 h-4" /> Kirim WhatsApp
            </button>
            <a data-testid="btn-open-portal" href={`/portal/${g.portal_token}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 border border-[var(--pota-green)] text-[var(--pota-green)] px-3 py-2.5 rounded-xl text-sm font-semibold">
              <ExternalLink className="w-4 h-4" /> Buka Portal
            </a>
            <button onClick={regenerate} title="Regenerate token" className="inline-flex items-center gap-2 text-sm text-[var(--pota-text-muted)] px-2 py-2.5 rounded-xl hover:text-[var(--pota-green)]">
              <RefreshCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="mt-4 text-xs font-mono bg-[var(--pota-surface)] rounded-lg p-3 truncate text-[var(--pota-text-muted)]">{portalUrl}</div>
      </div>

      <Tabs defaultValue="ringkasan">
        <TabsList className="bg-white border border-[var(--pota-border)]">
          <TabsTrigger data-testid="tab-ringkasan" value="ringkasan">Ringkasan</TabsTrigger>
          <TabsTrigger data-testid="tab-anak-asuh" value="anak">Anak Asuh</TabsTrigger>
          <TabsTrigger data-testid="tab-perkembangan" value="perkembangan">Perkembangan</TabsTrigger>
          <TabsTrigger data-testid="tab-donasi" value="donasi">Riwayat Donasi</TabsTrigger>
        </TabsList>

        <TabsContent value="ringkasan">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {[
              { label: "Jumlah Anak Asuh", value: g.children_count },
              { label: "Total Donasi", value: formatIDR(g.total_donation) },
              { label: "Donasi Terakhir", value: g.last_donation ? formatIDR(g.last_donation.amount) : "-" },
              { label: "Laporan Bulan Ini", value: g.current_month_reported ? "Terlapor" : "Belum" },
            ].map((s, i) => (
              <div key={i} className="pota-card p-4">
                <div className="text-[11px] tracking-wider uppercase text-[var(--pota-text-muted)] font-semibold">{s.label}</div>
                <div className="mt-1 font-display text-xl text-[var(--pota-green)]">{s.value}</div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="anak">
          {children.length === 0 ? (
            <div className="pota-card p-8 text-center text-sm text-[var(--pota-text-muted)]">Belum ada anak asuh yang terhubung.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {children.map((c) => (
                <Link to={`/admin/anak-asuh/${c.id}`} key={c.id} className="pota-card p-4 flex gap-4">
                  <div className="w-16 h-16 rounded-xl bg-[var(--pota-surface)] overflow-hidden flex-shrink-0">
                    {c.photo_url ? <img src={c.photo_url.startsWith('/api') ? `${process.env.REACT_APP_BACKEND_URL}${c.photo_url}` : c.photo_url} alt={c.name} className="w-full h-full object-cover" /> :
                      <div className="w-full h-full flex items-center justify-center text-[var(--pota-green)] font-display text-xl">{c.name[0]}</div>}
                  </div>
                  <div className="min-w-0">
                    <div className="font-display text-lg text-[var(--pota-green)] truncate">{c.name}</div>
                    <div className="text-xs text-[var(--pota-text-muted)]">NIM {c.nim} · Angkatan {c.generation}</div>
                    {c.school && <div className="text-xs text-[var(--pota-text-muted)] mt-1">{c.school}</div>}
                    <div className="mt-2"><StatusBadge status={c.status} /></div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="perkembangan">
          {devs.length === 0 ? (
            <div className="pota-card p-8 text-center text-sm text-[var(--pota-text-muted)]">Belum ada capaian perkembangan.</div>
          ) : (
            <div className="space-y-4">
              {Object.entries(devs.reduce((acc, d) => { (acc[d.child_name] ||= []).push(d); return acc; }, {})).map(([name, list]) => (
                <div key={name} className="pota-card p-5">
                  <div className="font-display text-xl text-[var(--pota-green)]">{name}</div>
                  <div className="mt-3 space-y-3">
                    {list.map((d, i) => (
                      <div key={i} className="border-l-2 border-[var(--pota-gold)] pl-4">
                        <div className="flex items-center gap-2">
                          <span className="pota-pill-gold">{d.category}</span>
                          <span className="text-xs text-[var(--pota-text-muted)]">{d.semester} · {d.academic_year}</span>
                        </div>
                        <div className="font-semibold mt-1">{d.title}</div>
                        <div className="text-sm text-[var(--pota-text-muted)] mt-1">{d.content}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="donasi">
          {donations.length === 0 ? (
            <div className="pota-card p-8 text-center text-sm text-[var(--pota-text-muted)]">Belum ada riwayat donasi.</div>
          ) : (
            <div className="pota-card divide-y">
              {donations.map((d) => (
                <div key={d.id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-[var(--pota-green)]">{formatMonth(d.donation_month)}</div>
                    <div className="text-xs text-[var(--pota-text-muted)]">{formatDate(d.donation_date)} · {d.method}</div>
                  </div>
                  <div className="font-display text-lg text-[var(--pota-green)]">{formatIDR(d.amount)}</div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="font-display text-[var(--pota-green)]">Edit Orang Tua Asuh</DialogTitle></DialogHeader>
          <GuardianForm initial={g} onSaved={()=>{ setEditOpen(false); load(); }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
