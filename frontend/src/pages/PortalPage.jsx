import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { formatIDR, formatMonth, formatDate, API } from "@/lib/api";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Sparkles, GraduationCap, HandCoins, ClipboardCheck, Heart, Phone, ChevronDown } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";

export default function PortalPage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [selectedChild, setSelectedChild] = useState(null);

  useEffect(() => {
    axios.get(`${API}/portal/${token}`)
      .then((r) => setData(r.data))
      .catch(() => setError("Tautan tidak valid atau telah kedaluwarsa."));
  }, [token]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--pota-canvas)]">
        <div className="pota-card p-8 max-w-md text-center">
          <div className="w-14 h-14 mx-auto rounded-xl bg-red-50 text-red-600 flex items-center justify-center"><Heart className="w-6 h-6" /></div>
          <div className="mt-4 font-display text-xl text-[var(--pota-green)]">Portal Tidak Ditemukan</div>
          <div className="text-sm text-[var(--pota-text-muted)] mt-2">{error}</div>
        </div>
      </div>
    );
  }

  if (!data) return <div className="min-h-screen flex items-center justify-center text-sm text-[var(--pota-text-muted)]">Memuat portal...</div>;

  const { guardian, institution, summary, children, donations, reports } = data;

  return (
    <div className="min-h-screen bg-[#F6F8F6]" data-testid="page-portal">
      <div className="pota-hero-portal border-b-4 border-[var(--pota-gold)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl overflow-hidden bg-[#7CB342]/15 border border-[#7CB342]/40 flex items-center justify-center">
              {institution.logo_url ? (
                <img src={institution.logo_url.startsWith('/api') ? `${process.env.REACT_APP_BACKEND_URL}${institution.logo_url}` : institution.logo_url} alt="Logo" className="w-full h-full object-cover" />
              ) : <Sparkles className="w-6 h-6 text-[#9CCC65]" />}
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-[#9CCC65]">Portal Orang Tua Asuh</div>
              <div className="font-display text-lg">{institution.name}</div>
            </div>
          </div>
          <div className="gold-divider mt-8 mb-4" />
          <div className="text-[#D8E5DE] text-sm">Assalamu'alaikum warahmatullahi wabarakatuh,</div>
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl mt-2 leading-tight">{guardian.name}</h1>
          <p className="mt-4 text-[#E5EEE8] max-w-2xl leading-relaxed">
            Jazakumullah khairan atas kebaikan Bapak/Ibu menjadi bagian dari perjalanan pendidikan anak asuh kami. Semoga menjadi amal jariyah yang mengalir tanpa henti.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-10">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {[
            { icon: GraduationCap, label: "Anak Asuh", value: summary.children_count },
            { icon: HandCoins, label: "Total Donasi", value: formatIDR(summary.total_donation) },
            { icon: HandCoins, label: "Donasi Terakhir", value: summary.last_donation ? formatIDR(summary.last_donation.amount) : "-" },
            { icon: ClipboardCheck, label: `Laporan ${formatMonth(summary.current_month).split(" ")[0]}`, value: summary.current_month_reported ? "Terlapor" : "Belum" },
          ].map((s, i) => (
            <div key={i} className="pota-card p-4">
              <s.icon className="w-4 h-4 text-[var(--pota-gold)]" />
              <div className="text-[10px] uppercase tracking-wider text-[var(--pota-text-muted)] font-semibold mt-2">{s.label}</div>
              <div className="mt-1 font-display text-lg sm:text-xl text-[var(--pota-green)] leading-tight">{s.value}</div>
            </div>
          ))}
        </div>

        <section>
          <div className="gold-divider mb-3" />
          <h2 className="font-display text-2xl text-[var(--pota-green)]">Anak Asuh Anda</h2>
          {children.length === 0 ? (
            <div className="pota-card p-6 text-sm text-[var(--pota-text-muted)] mt-4">Belum ada anak asuh yang terhubung.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
              {children.map((c) => {
                const photoUrl = c.photo_url && c.photo_url.startsWith('/api') ? `${process.env.REACT_APP_BACKEND_URL}${c.photo_url}` : c.photo_url;
                const grouped = (c.developments || []).reduce((acc, d) => {
                  const key = `${d.academic_year} · ${d.semester}`;
                  (acc[key] ||= []).push(d);
                  return acc;
                }, {});
                const open = selectedChild === c.id;
                return (
                  <div key={c.id} className="pota-card overflow-hidden">
                    <div className="p-5 flex gap-4">
                      <div className="w-20 h-20 rounded-xl overflow-hidden bg-[var(--pota-surface)] flex items-center justify-center flex-shrink-0">
                        {photoUrl ? <img src={photoUrl} alt={c.name} className="w-full h-full object-cover" /> : <span className="font-display text-2xl text-[var(--pota-green)]">{c.name[0]}</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-display text-lg text-[var(--pota-green)] truncate">{c.name}</div>
                        <div className="text-xs text-[var(--pota-text-muted)]">NIM {c.nim} · Angkatan {c.generation}</div>
                        {c.school && <div className="text-xs text-[var(--pota-text-muted)] mt-1 truncate">{c.school}</div>}
                        {c.aspiration && <div className="text-xs text-[var(--pota-gold)] mt-1">✨ {c.aspiration}</div>}
                      </div>
                    </div>
                    <button
                      data-testid={`btn-portal-child-${c.id}`}
                      onClick={() => setSelectedChild(open ? null : c.id)}
                      className="w-full px-5 py-3 border-t border-[var(--pota-border)] text-sm font-semibold text-[var(--pota-green)] flex items-center justify-between hover:bg-[var(--pota-surface)]"
                    >
                      <span>Lihat Profil & Capaian</span>
                      <ChevronDown className={`w-4 h-4 transition ${open ? "rotate-180" : ""}`} />
                    </button>
                    {open && (
                      <div className="p-5 bg-[var(--pota-surface)] border-t border-[var(--pota-border)] space-y-4">
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div><div className="text-[var(--pota-text-muted)]">Tanggal Lahir</div><div className="font-semibold">{formatDate(c.birth_date)}</div></div>
                          <div><div className="text-[var(--pota-text-muted)]">Alamat</div><div className="font-semibold">{c.address || "-"}</div></div>
                          <div><div className="text-[var(--pota-text-muted)]">Ayah</div><div className="font-semibold">{c.father_name || "-"}</div><div className="text-[var(--pota-text-muted)]">{c.father_job || "-"}</div></div>
                          <div><div className="text-[var(--pota-text-muted)]">Ibu</div><div className="font-semibold">{c.mother_name || "-"}</div><div className="text-[var(--pota-text-muted)]">{c.mother_job || "-"}</div></div>
                        </div>
                        <div>
                          <div className="text-[11px] uppercase tracking-widest font-semibold text-[var(--pota-text-muted)] mb-2">Capaian/Perkembangan</div>
                          {Object.keys(grouped).length === 0 ? (
                            <div className="text-sm text-[var(--pota-text-muted)]">Belum ada capaian tercatat.</div>
                          ) : (
                            <Accordion type="single" collapsible>
                              {Object.entries(grouped).map(([key, list]) => (
                                <AccordionItem key={key} value={key}>
                                  <AccordionTrigger className="text-sm font-semibold text-[var(--pota-green)]">{key}</AccordionTrigger>
                                  <AccordionContent>
                                    <div className="space-y-3">
                                      {list.map((d, i) => (
                                        <div key={i} className="border-l-2 border-[var(--pota-gold)] pl-3">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <span className="pota-pill-gold">{d.category}</span>
                                          </div>
                                          <div className="font-semibold mt-1 text-sm">{d.title}</div>
                                          <div className="text-xs text-[var(--pota-text-muted)] mt-1">{d.content}</div>
                                        </div>
                                      ))}
                                    </div>
                                  </AccordionContent>
                                </AccordionItem>
                              ))}
                            </Accordion>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <div className="gold-divider mb-3" />
          <h2 className="font-display text-2xl text-[var(--pota-green)]">Riwayat Donasi</h2>
          {donations.length === 0 ? (
            <div className="pota-card p-6 text-sm text-[var(--pota-text-muted)] mt-4">Belum ada riwayat donasi.</div>
          ) : (
            <div className="pota-card divide-y mt-5">
              {donations.map((d, i) => (
                <div key={i} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-[var(--pota-green)]">{formatMonth(d.donation_month)}</div>
                    <div className="text-xs text-[var(--pota-text-muted)]">{formatDate(d.donation_date)}</div>
                  </div>
                  <div className="font-display text-lg text-[var(--pota-green)]">{formatIDR(d.amount)}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="gold-divider mb-3" />
          <h2 className="font-display text-2xl text-[var(--pota-green)]">Laporan Perkembangan</h2>
          {reports.length === 0 ? (
            <div className="pota-card p-6 text-sm text-[var(--pota-text-muted)] mt-4">Belum ada laporan tersedia.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
              {reports.map((r, i) => (
                <div key={i} className="pota-card p-5" data-testid={`report-${r.month}`}>
                  <div className="flex items-center justify-between">
                    <div className="font-display text-lg text-[var(--pota-green)]">{formatMonth(r.month)}</div>
                    <StatusBadge status={r.status} />
                  </div>
                  <div className="text-sm text-[var(--pota-text-muted)] mt-3 leading-relaxed">
                    {r.status === "Terlapor" ? r.summary : "Laporan perkembangan untuk periode ini belum tersedia."}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <footer className="pota-card p-6 flex flex-col sm:flex-row items-center gap-4 justify-between">
          <div>
            <div className="font-display text-lg text-[var(--pota-green)]">{institution.name}</div>
            <div className="text-xs text-[var(--pota-text-muted)]">{institution.tagline}</div>
          </div>
          {institution.contact && (
            <a href={`https://wa.me/${institution.contact.replace(/\D/g,"")}`} className="inline-flex items-center gap-2 bg-[var(--pota-green)] text-white px-4 py-2.5 rounded-xl text-sm font-semibold">
              <Phone className="w-4 h-4" /> Hubungi Pengurus
            </a>
          )}
        </footer>
      </div>
    </div>
  );
}
