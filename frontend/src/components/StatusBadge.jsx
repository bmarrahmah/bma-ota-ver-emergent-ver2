import React from "react";

export const StatusBadge = ({ status }) => {
  const map = {
    "Rutin": "status-rutin",
    "Tidak Rutin": "status-tidak-rutin",
    "Insidentil": "status-insidentil",
    "Tidak Aktif": "status-tidak-aktif",
    "Terlapor": "status-terlapor",
    "Belum Terlapor": "status-belum",
    "Aktif": "status-rutin",
    "Alumni": "status-insidentil",
    "Non-Aktif": "status-tidak-aktif",
  };
  const cls = map[status] || "status-tidak-aktif";
  return (
    <span data-testid={`status-${(status||'').toLowerCase().replace(/\s+/g,'-')}`} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${cls}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {status}
    </span>
  );
};
