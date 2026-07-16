"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { MessageCircle, CheckCircle, TrendingUp, AlertTriangle } from "lucide-react";
import { LeadScoreBadge } from "@/components/dashboard/lead-score-badge";
import { resolveOrigem, origemDetalhe, ORIGEM_FILTER_OPTIONS } from "@/lib/origem-canal";
import { VENDOR_LABELS } from "@/lib/vendor-labels";

type Lead = {
  phone: string;
  name: string | null;
  city: string | null;
  segment: string | null;
  weekly_volume_kg: number | null;
  lead_temperature: string | null;
  lead_status: string | null;
  routing_team: string | null;
  qual_stage: number | null;
  handoff_at: string | null;
  handoff_confirmed: boolean | null;
  handoff_confirmed_at: string | null;
  first_order_at: string | null;
  ai_active: boolean | null;
  human_active: boolean | null;
  created_at: string;
  updated_at: string | null;        // FIX1: proxy de tempo-na-etapa (SLA)
  followup_count: number | null;
  pain_point: string | null;
  product_groups: string[] | null;
  scheduled_at: string | null;
  origem_canal: string | null;
  origem_utm_source: string | null;
  origem_utm_campaign: string | null;
  ad_id: string | null;
  lead_score?: number | null;        // ETAPA 4: v_lead_score (via server) ou fallback
  lead_tier?: "A" | "B" | "C" | null;
};

// ── Design tokens — ASB brand ────────────────────────────────────
const C = {
  bg:     "#1a1a1a",
  bg2:    "#080b14",
  border: "#2a2a2a",
  border2:"#2A3F8F",
  text:   "#FFFFFF",
  muted:  "#c0d0e0",
  label:  "#e4e9f0",
  red:    "#C8102E",
  redBright: "#e8253f",
  gold:   "#22c55e",
  amber:  "#f59e0b",
  green:  "#22c55e",
};

const LABEL: React.CSSProperties = { fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase", color: C.label, fontFamily: "var(--font-geist-sans), system-ui, sans-serif" };

// ── Badge configs ────────────────────────────────────────────────
type BadgeCfg = { label: string; color: string; bg: string; border: string };

const TEMP_CFG: Record<string, BadgeCfg> = {
  HOT:          { label: "HOT",   color: "#C8102E", bg: "rgba(200,16,46,.12)",   border: "rgba(200,16,46,.45)" },
  WARM:         { label: "WARM",  color: C.amber,   bg: "rgba(245,158,11,.1)",   border: "rgba(245,158,11,.35)" },
  COLD:         { label: "COLD",  color: C.muted,   bg: "rgba(136,153,170,.08)", border: "rgba(136,153,170,.2)" },
  READY_TO_BUY: { label: "READY", color: "#22c55e", bg: "rgba(34,197,94,.1)",    border: "rgba(34,197,94,.35)" },
};

const STATUS_CFG: Record<string, BadgeCfg> = {
  new:              { label: "Novo",             color: "#8899bb", bg: "rgba(27,42,107,.27)",  border: "#2a2a2a" },
  qualified:        { label: "Qualificado",      color: "#C8102E", bg: "rgba(200,16,46,.13)",  border: "rgba(200,16,46,.5)" },
  handoff:          { label: "Agendamento",          color: "#D4A017", bg: "rgba(212,160,23,.12)", border: "rgba(212,160,23,.45)" },
  vendedor_assumiu: { label: "Vendedor assumiu", color: "#185FA5", bg: "rgba(24,95,165,.14)",  border: "rgba(24,95,165,.5)" },
  pedido_fechado:   { label: "Pedido fechado",   color: "#22c55e", bg: "rgba(34,197,94,.1)",   border: "rgba(34,197,94,.3)" },
  converted: { label: "Convertido",  color: "#22c55e", bg: "rgba(34,197,94,.1)",   border: "rgba(34,197,94,.3)" },
  optout:    { label: "Opt-out",     color: C.muted,   bg: "rgba(136,153,170,.06)", border: "rgba(136,153,170,.2)" },
};

const ABC_CFG: Record<"A" | "B" | "C", BadgeCfg> = {
  A: { label: "A", color: "#C8102E", bg: "rgba(200,16,46,.12)",   border: "rgba(200,16,46,.45)" },
  B: { label: "B", color: C.amber,   bg: "rgba(245,158,11,.1)",   border: "rgba(245,158,11,.35)" },
  C: { label: "C", color: C.muted,   bg: "rgba(136,153,170,.08)", border: "rgba(136,153,170,.2)" },
};

const PRODUCT_LABELS: Record<string, string> = {
  hamburguer: "Hambúrguer", espeto: "Espeto", boteco: "Boteco",
  cortes_especiais: "Cortes Esp.", mercearia: "Mercearia",
  molhos: "Molhos", defumados: "Defumados", paes: "Pães", embalagens: "Embalagens",
};

function abcCurve(vol: number | null): "A" | "B" | "C" {
  if ((vol ?? 0) >= 300) return "A";
  if ((vol ?? 0) >= 100) return "B";
  return "C";
}

// Status derivado — precedência do mais avançado p/ o mais inicial.
// handoff/vendedor_assumiu/pedido_fechado derivam de timestamps confiáveis
// (handoff_at, handoff_confirmed, first_order_at) — alinhado aos marcos do /funil.
function derivedStatus(lead: Lead): string {
  if (lead.lead_status === "optout") return "optout";
  if (lead.first_order_at) return "pedido_fechado";
  if (lead.handoff_confirmed === true) return "vendedor_assumiu";
  if (lead.handoff_at) return "handoff";
  if ((lead.qual_stage ?? 0) >= 7) return "qualified";
  return lead.lead_status ?? "new";
}

// FIX1: tempo-na-etapa + semáforo SLA. Proxy = updated_at (funnel_stage_updated_at
// inexistente no schema). verde <24h · âmbar 24-72h · vermelho >72h (pulsa).
function stageElapsed(ts: string | null): { label: string; color: string; pulse: boolean } | null {
  if (!ts) return null;
  const hrs = (Date.now() - new Date(ts).getTime()) / 3600000;
  if (!isFinite(hrs) || hrs < 0) return null;
  const d = Math.floor(hrs / 24);
  const h = Math.floor(hrs % 24);
  const label = d > 0 ? `${d}d ${h}h` : `${h}h`;
  if (hrs < 24)  return { label, color: C.green, pulse: false };
  if (hrs < 72)  return { label, color: C.amber, pulse: false };
  return { label, color: C.red, pulse: true };
}

function StageTimeBadge({ ts }: { ts: string | null }) {
  const s = stageElapsed(ts);
  if (!s) return <span style={{ color: C.muted, fontSize: 10 }}>—</span>;
  return (
    <>
      {s.pulse && (
        <style>{`@keyframes asb-pulse-sla{0%,100%{opacity:1}50%{opacity:.45}}.asb-pulse-sla{animation:asb-pulse-sla 1.4s ease-in-out infinite}`}</style>
      )}
      <span
        className={s.pulse ? "asb-pulse-sla" : undefined}
        style={{
          display: "inline-block", color: s.color, fontSize: 10, fontWeight: 700,
          fontFamily: "var(--font-geist-sans), system-ui, sans-serif", whiteSpace: "nowrap",
        }}
        title={`Tempo desde a última atualização — semáforo SLA`}
      >
        ● {s.label}
      </span>
    </>
  );
}

function Badge({ cfg }: { cfg: BadgeCfg }) {
  return (
    <span style={{
      display: "inline-block", padding: "2px 5px", borderRadius: 3,
      fontSize: 9, letterSpacing: ".10em", textTransform: "uppercase",
      fontFamily: "var(--font-geist-sans), system-ui, sans-serif", fontWeight: 700,
      color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
    }}>{cfg.label}</span>
  );
}

// Badge de ORIGEM (helper centralizado lib/origem-canal). Tooltip = campanha/ad_id quando houver.
function OrigemBadge({ lead }: { lead: Lead }) {
  const cfg = resolveOrigem(lead);
  const det = origemDetalhe(lead);
  return (
    <span
      title={det ? `${cfg.label} — ${det}` : cfg.label}
      style={{
        display: "inline-block", padding: "2px 5px", borderRadius: 3,
        fontSize: 9, letterSpacing: ".10em", textTransform: "uppercase",
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif", fontWeight: 700,
        color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
        cursor: det ? "help" : "default",
      }}
    >{cfg.label}</span>
  );
}

function Select({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        background: C.bg2, border: `1px solid ${C.border2}`, borderRadius: 4,
        color: C.muted, fontSize: 10, letterSpacing: ".10em", textTransform: "uppercase",
        padding: "5px 10px", fontFamily: "var(--font-geist-sans), system-ui, sans-serif", cursor: "pointer", outline: "none",
        flexShrink: 0,
      }}
    >
      {children}
    </select>
  );
}

export function LeadsTable({ leads: initialLeads, userEmail, initialStatus = "all", initialQ = "" }: { leads: Lead[]; userEmail: string; initialStatus?: string; initialQ?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [search, setSearch] = useState(initialQ);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [vendorFilter, setVendorFilter] = useState("all");
  const [abcFilter, setAbcFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const [origemFilter, setOrigemFilter] = useState("all");
  const [isPending, startTransition] = useTransition();

  // Item 6/DEBT-274: quando a busca server-side devolve novo conjunto, adota-o
  // (useState(initialLeads) não re-inicializa em prop nova por si só).
  useEffect(() => { setLeads(initialLeads); }, [initialLeads]);

  // Item 6/DEBT-274: sincroniza a busca com ?q= (server-side, varre TODAS as linhas).
  // Debounced + guardado no mount pra não re-navegar com o valor inicial vindo da URL.
  // O filtro client (matchSearch) fica como refino instantâneo sobre o que voltou.
  const didMount = useRef(false);
  useEffect(() => {
    if (!didMount.current) { didMount.current = true; return; }
    const t = setTimeout(() => {
      const s = search.trim();
      const currentQ = (searchParams.get("q") ?? "").trim();
      if (s === currentQ) return;   // já em sync com a URL → não re-navega (evita loop de replace)
      const params = new URLSearchParams(searchParams.toString());
      if (s) params.set("q", s); else params.delete("q");
      startTransition(() => router.replace(`/dashboard/leads?${params.toString()}`, { scroll: false }));
    }, 350);
    return () => clearTimeout(t);
  }, [search, searchParams, router]);

  const filtered = leads.filter((l) => {
    const q = search.toLowerCase();
    const matchSearch = !q || (l.name ?? "").toLowerCase().includes(q) || l.phone.includes(q) || (l.city ?? "").toLowerCase().includes(q);
    const matchStatus  = statusFilter === "all" || derivedStatus(l) === statusFilter;
    const matchVendor  = vendorFilter === "all" || l.routing_team === vendorFilter;
    const matchAbc     = abcFilter === "all" || abcCurve(l.weekly_volume_kg) === abcFilter;
    const matchProduct = productFilter === "all" || (l.product_groups ?? []).includes(productFilter);
    const matchOrigem  = origemFilter === "all" || resolveOrigem(l).key === origemFilter;
    return matchSearch && matchStatus && matchVendor && matchAbc && matchProduct && matchOrigem;
  });

  async function confirmHandoff(phone: string) {
    const now = new Date().toISOString();
    await createClient().from("ai_sdr_leads").update({ handoff_confirmed: true, handoff_confirmed_at: now }).eq("phone", phone);
    setLeads(prev => prev.map(l => l.phone === phone ? { ...l, handoff_confirmed: true, handoff_confirmed_at: now } : l));
  }

  async function convertLead(phone: string) {
    const res = await fetch("/api/lead/mark-converted", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    if (!res.ok) return;
    const data = await res.json();
    setLeads(prev => prev.map(l => l.phone === phone ? { ...l, first_order_at: data.first_order_at } : l));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Filters — horizontal scroll on mobile */}
      <div className="asb-filters-bar">
        <div style={{ position: "relative", minWidth: 160, flexShrink: 0 }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: C.muted, fontSize: 12 }}>›</span>
          <input
            type="text"
            placeholder="buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%", background: C.bg2, border: `1px solid ${C.border2}`, borderRadius: 4,
              color: C.text, fontSize: 11, padding: "5px 10px 5px 24px",
              fontFamily: "var(--font-geist-sans), system-ui, sans-serif", outline: "none", boxSizing: "border-box",
            }}
          />
        </div>
        <Select value={statusFilter} onChange={setStatusFilter}>
          <option value="all">status: todos</option>
          <option value="new">novo</option>
          <option value="qualified">qualificado</option>
          <option value="handoff">handoff</option>
          <option value="vendedor_assumiu">vendedor assumiu</option>
          <option value="pedido_fechado">pedido fechado</option>
          <option value="optout">opt-out</option>
        </Select>
        <Select value={vendorFilter} onChange={setVendorFilter}>
          <option value="all">vendedor: todos</option>
          <option value="SETOR_SOROCABA_SAO_PAULO">Ana Paula</option>
          <option value="SETOR_CAMPINAS_JUNDIAI">Alan</option>
          <option value="SETOR_CUIT">CUIT</option>
        </Select>
        <Select value={abcFilter} onChange={setAbcFilter}>
          <option value="all">ABC: todos</option>
          <option value="A">Tier A ≥300 kg</option>
          <option value="B">Tier B ≥100 kg</option>
          <option value="C">Tier C &lt;100 kg</option>
        </Select>
        <Select value={productFilter} onChange={setProductFilter}>
          <option value="all">produto: todos</option>
          {Object.entries(PRODUCT_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </Select>
        <Select value={origemFilter} onChange={setOrigemFilter}>
          {ORIGEM_FILTER_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </Select>
        <button
          onClick={() => startTransition(() => router.refresh())}
          disabled={isPending}
          style={{
            background: "transparent", border: `1px solid ${C.border2}`, borderRadius: 4,
            color: C.muted, fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase",
            padding: "5px 12px", cursor: "pointer", fontFamily: "var(--font-geist-sans), system-ui, sans-serif", flexShrink: 0,
          }}
        >
          {isPending ? "..." : "↺ atualizar"}
        </button>
      </div>

      <p style={{ ...LABEL, margin: 0 }}>{filtered.length} leads</p>

      {/* ── Camada de cima (cards de lead) — representação ÚNICA da aba Leads ─────
          Reversão Paulo 2026-07-14: restaurado EXATAMENTE o bloco original de cards
          (a "camada de cima": onde o vendedor confirma agendamento, vê a qualificação por
          etapas e age); removida a tabela densa de baixo. Só saiu o className
          `asb-mobile-only` para o bloco valer também no desktop. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.length === 0 && (
          <div style={{ ...LABEL, textAlign: "center", padding: "32px 0", color: C.muted }}>
            nenhum lead encontrado
          </div>
        )}
        {filtered.map((lead) => {
          const status = derivedStatus(lead);
          const abc    = abcCurve(lead.weekly_volume_kg);
          const showConfirm = !!lead.handoff_at && lead.handoff_confirmed === false;
          const showConvert = (lead.qual_stage ?? 0) >= 7 && !lead.first_order_at;
          const _now = new Date();
          const alertLevel =
            lead.scheduled_at && !lead.handoff_confirmed && new Date(lead.scheduled_at) < _now ? 'red' :
            lead.handoff_at && !lead.handoff_confirmed && !lead.scheduled_at && (_now.getTime() - new Date(lead.handoff_at).getTime()) > 4 * 3600000 ? 'amber' :
            null;

          return (
            <div
              key={lead.phone}
              style={{
                background: C.bg,
                border: `1px solid ${alertLevel === 'red' ? C.red : alertLevel === 'amber' ? C.amber : C.border2}`,
                borderRadius: 6,
                padding: "12px 14px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {/* Name + phone */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <Link
                    href={`/dashboard/leads/${encodeURIComponent(lead.phone)}`}
                    style={{ color: "#FFFFFF", textDecoration: "none", fontWeight: 600, fontSize: 12, fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}
                  >
                    {lead.name || "—"}
                  </Link>
                  <div style={{ color: C.muted, fontSize: 10, fontFamily: "var(--font-geist-sans), system-ui, sans-serif", marginTop: 1 }}>
                    {lead.phone}
                  </div>
                </div>
                {/* Action buttons */}
                <div style={{ display: "flex", gap: 6 }}>
                  <Link href={`/dashboard/leads/${encodeURIComponent(lead.phone)}`}>
                    <button style={{ background: "transparent", border: "none", color: C.muted, cursor: "pointer", padding: 4 }} title="Ver conversa">
                      <MessageCircle size={16} />
                    </button>
                  </Link>
                  {showConfirm && (
                    <button onClick={() => confirmHandoff(lead.phone)} style={{ background: "transparent", border: "none", color: C.amber, cursor: "pointer", padding: 4 }} title="Confirmar agendamento">
                      <CheckCircle size={16} />
                    </button>
                  )}
                  {showConvert && (
                    <button onClick={() => convertLead(lead.phone)} style={{ background: "transparent", border: "none", color: C.gold, cursor: "pointer", padding: 4 }} title="Marcar convertido">
                      <TrendingUp size={16} />
                    </button>
                  )}
                </div>
              </div>

              {/* Badges row */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                {lead.lead_score != null && lead.lead_tier && (
                  <LeadScoreBadge score={lead.lead_score} tier={lead.lead_tier} size="sm" />
                )}
                <Badge cfg={ABC_CFG[abc]} />
                <Badge cfg={TEMP_CFG[lead.lead_temperature ?? ""] ?? TEMP_CFG.COLD} />
                <Badge cfg={STATUS_CFG[status] ?? STATUS_CFG.new} />
                <OrigemBadge lead={lead} />
                {lead.city && (
                  <span style={{ color: C.muted, fontSize: 9, fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>
                    {lead.city}
                  </span>
                )}
              </div>

              {/* Volume + vendor */}
              <div style={{ display: "flex", gap: 16 }}>
                <span style={{ color: C.muted, fontSize: 9, fontFamily: "var(--font-geist-sans), system-ui, sans-serif", letterSpacing: ".10em" }}>
                  {lead.weekly_volume_kg ? `${lead.weekly_volume_kg} kg/sem` : "vol: —"}
                </span>
                <span style={{ color: C.muted, fontSize: 9, fontFamily: "var(--font-geist-sans), system-ui, sans-serif", letterSpacing: ".10em" }}>
                  {VENDOR_LABELS[lead.routing_team ?? ""] ?? lead.routing_team ?? "—"}
                </span>
                <span style={{ color: C.muted, fontSize: 9, fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>
                  etapa {lead.qual_stage ?? 0}/9
                </span>
                <StageTimeBadge ts={lead.updated_at} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
