"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const GROUPS: { key: string; label: string }[] = [
  { key: "hamburguer",       label: "Hambúrguer" },
  { key: "espeto",           label: "Espeto" },
  { key: "boteco",           label: "Boteco" },
  { key: "cortes_especiais", label: "Cortes Especiais" },
  { key: "mercearia",        label: "Mercearia" },
  { key: "molhos",           label: "Molhos" },
  { key: "defumados",        label: "Defumados" },
  { key: "paes",             label: "Pães" },
  { key: "embalagens",       label: "Embalagens" },
];

export function ProductGroupSelector({
  phone,
  initial,
}: {
  phone: string;
  initial: string[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initial));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function toggle(key: string) {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);

    setSaving(true);
    setSaved(false);
    const supabase = createClient();
    await supabase
      .from("ai_sdr_leads")
      .update({ product_groups: [...next] })
      .eq("phone", phone);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-gray-500">Clique para selecionar/remover</p>
        {saving && <span className="text-xs text-gray-400">Salvando…</span>}
        {saved && <span className="text-xs text-green-600">Salvo ✓</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        {GROUPS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => toggle(key)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              selected.has(key)
                ? "bg-blue-600 border-blue-600 text-white"
                : "bg-white border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600"
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
