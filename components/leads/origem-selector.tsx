"use client";

// M2: edição inline do canal de aquisição (origem_canal) no card do lead.
// Espelha o padrão do ProductGroupSelector (client + update direto no Supabase).
// "Indicação" é o caso de uso novo — correção manual quando o lead chega por referral.
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const CANAIS: { key: string; label: string }[] = [
  { key: "organico",  label: "Orgânico" },
  { key: "instagram", label: "Instagram (CTWA)" },
  { key: "lp",        label: "Landing Page" },
  { key: "indicacao", label: "Indicação" },
  { key: "outro",     label: "Outro" },
];

export function OrigemSelector({ phone, initial }: { phone: string; initial: string | null }) {
  const [value, setValue] = useState(initial ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function onChange(v: string) {
    setValue(v);
    setSaving(true);
    setSaved(false);
    const supabase = createClient();
    await supabase.from("ai_sdr_leads").update({ origem_canal: v }).eq("phone", phone);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background: "#0d1117", border: "1px solid #2A3F8F", borderRadius: 4,
          color: "#c9d1d9", fontSize: 11, fontFamily: "'Courier New', monospace",
          padding: "4px 8px", cursor: "pointer", outline: "none",
        }}
      >
        {!value && <option value="">—</option>}
        {CANAIS.map(({ key, label }) => (
          <option key={key} value={key}>{label}</option>
        ))}
      </select>
      {saving && <span style={{ fontSize: 9, color: "#c0d0e0", fontFamily: "'Courier New', monospace" }}>salvando…</span>}
      {saved && <span style={{ fontSize: 9, color: "#22c55e", fontFamily: "'Courier New', monospace" }}>salvo ✓</span>}
    </div>
  );
}
