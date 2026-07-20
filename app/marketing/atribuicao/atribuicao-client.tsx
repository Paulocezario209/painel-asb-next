"use client";

import { theme } from "@/lib/theme";
import { S } from "@/app/dashboard/lib/dashboard-tokens";
import { SectionHead, KpiCard } from "@/app/dashboard/lib/ui";
import { Megaphone, Target, TriangleAlert, Route, DollarSign, Users } from "lucide-react";

export type CampanhaRow = {
  campaign_id: string; campaign_name: string; anuncios: number; gasto_total: number;
  leads: number; qualificados: number; agendamentos: number; propostas: number;
  convertidos: number; receita_brl: number; cpl: number | null; cpql: number | null;
  cac: number | null; roas: number | null; taxa_conversao: number | null;
};
export type AnuncioRow = {
  ad_id: string; ad_name: string | null; campaign_name: string | null; gasto_total: number;
  leads: number; qualificados: number; agendamentos: number; propostas: number;
  convertidos: number; receita_brl: number; cpl: number | null; cpql: number | null;
  cac: number | null; roas: number | null; taxa_conversao: number | null;
};
export type SemRetornoRow = { ad_id: string; ad_name: string | null; campaign_name: string | null; gasto_total: number };
export type NaoAtribRow = { origem_canal: string; leads_sem_ad: number; qualificados: number; convertidos: number };
export type CanalJornadaCell = { channel: string; journey: string; count: number };

const brl = (n: number | null | undefined) =>
  n == null ? "—" : "R$ " + Math.round(n).toLocaleString("pt-BR");
const num = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("pt-BR"));
const pct = (n: number | null | undefined) => (n == null ? "—" : (n * 100).toFixed(1).replace(".", ",") + "%");
const roasFmt = (n: number | null | undefined) => (n == null ? "—" : n.toFixed(2).replace(".", ",") + "×");

const CH_COLOR: Record<string, string> = {
  "Meta Ads": "#4d7cff", "Google Ads": "#22c55e", Organic: "#a78bfa", Referral: "#f59e0b", Direct: "#83879a",
};

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th style={{ ...S.label, fontSize: 10, textAlign: right ? "right" : "left", padding: "8px 10px", borderBottom: "1px solid var(--asb-border)", whiteSpace: "nowrap" }}>{children}</th>;
}
function Td({ children, right, mono, color }: { children: React.ReactNode; right?: boolean; mono?: boolean; color?: string }) {
  return (
    <td style={{
      padding: "9px 10px", textAlign: right ? "right" : "left", whiteSpace: "nowrap",
      fontFamily: mono ? theme.font.num : theme.font.label, fontVariantNumeric: mono ? "tabular-nums" : undefined,
      fontSize: mono ? 12.5 : 12.5, color: color ?? (mono ? "#e6ebf5" : "#c8d2e6"), borderBottom: "1px solid rgba(255,255,255,.04)",
    }}>{children}</td>
  );
}
function Card({ children }: { children: React.ReactNode }) {
  return <div style={{ ...S.card, padding: 20 }}>{children}</div>;
}
function ScrollX({ children }: { children: React.ReactNode }) {
  return <div style={{ overflowX: "auto", width: "100%" }}>{children}</div>;
}

export function AtribuicaoClient({
  campanhas, anuncios, semRetorno, naoAtrib, canalJornada,
}: {
  campanhas: CampanhaRow[]; anuncios: AnuncioRow[]; semRetorno: SemRetornoRow[];
  naoAtrib: NaoAtribRow[]; canalJornada: CanalJornadaCell[];
}) {
  const tot = campanhas.reduce(
    (a, c) => ({
      gasto: a.gasto + (c.gasto_total || 0), leads: a.leads + (c.leads || 0),
      conv: a.conv + (c.convertidos || 0), receita: a.receita + (c.receita_brl || 0),
    }),
    { gasto: 0, leads: 0, conv: 0, receita: 0 },
  );
  const roasGeral = tot.gasto > 0 ? tot.receita / tot.gasto : null;
  const gastoSemRetorno = semRetorno.reduce((a, r) => a + (r.gasto_total || 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* KPIs herói */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14 }}>
        <KpiCard label="Gasto Atribuído" value={brl(tot.gasto)} Icon={DollarSign} accent="#4d7cff" />
        <KpiCard label="Leads" value={num(tot.leads)} Icon={Users} accent="#22c55e" />
        <KpiCard label="Convertidos" value={num(tot.conv)} Icon={Target} accent="#a78bfa" note="1º pedido" />
        <KpiCard label="ROAS Geral" value={roasFmt(roasGeral)} Icon={Megaphone} accent="#f59e0b" note="receita ÷ gasto (aprox.)" />
      </div>

      {/* #10 — por campanha */}
      <Card>
        <SectionHead Icon={Megaphone} color="#4d7cff" title="Por Campanha" desc="Gasto · funil completo · CPL · CPQL · CAC · ROAS · taxa" />
        <ScrollX>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 900 }}>
            <thead><tr>
              <Th>Campanha</Th><Th right>Anúncios</Th><Th right>Gasto</Th><Th right>Leads</Th><Th right>Qualif.</Th>
              <Th right>Agend.</Th><Th right>Prop.</Th><Th right>Conv.</Th><Th right>Receita</Th>
              <Th right>CPL</Th><Th right>CPQL</Th><Th right>CAC</Th><Th right>ROAS</Th><Th right>Taxa</Th>
            </tr></thead>
            <tbody>
              {campanhas.length === 0 && <tr><Td>Sem dados.</Td></tr>}
              {campanhas.map((c) => (
                <tr key={c.campaign_id}>
                  <Td>{c.campaign_name}</Td>
                  <Td right mono>{num(c.anuncios)}</Td>
                  <Td right mono>{brl(c.gasto_total)}</Td>
                  <Td right mono>{num(c.leads)}</Td>
                  <Td right mono>{num(c.qualificados)}</Td>
                  <Td right mono>{num(c.agendamentos)}</Td>
                  <Td right mono>{num(c.propostas)}</Td>
                  <Td right mono color="#22c55e">{num(c.convertidos)}</Td>
                  <Td right mono>{brl(c.receita_brl)}</Td>
                  <Td right mono>{brl(c.cpl)}</Td>
                  <Td right mono>{brl(c.cpql)}</Td>
                  <Td right mono>{brl(c.cac)}</Td>
                  <Td right mono color={c.roas != null && c.roas >= 1 ? "#22c55e" : "#ff5a72"}>{roasFmt(c.roas)}</Td>
                  <Td right mono>{pct(c.taxa_conversao)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollX>
      </Card>

      {/* #10 — por anúncio (top gasto) */}
      <Card>
        <SectionHead Icon={Target} color="#a78bfa" title="Por Anúncio" desc="Top por gasto · granularidade de criativo (Meta) / campanha (Google)" />
        <ScrollX>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 820 }}>
            <thead><tr>
              <Th>Anúncio</Th><Th>Campanha</Th><Th right>Gasto</Th><Th right>Leads</Th><Th right>Qualif.</Th>
              <Th right>Conv.</Th><Th right>CPL</Th><Th right>CAC</Th><Th right>ROAS</Th>
            </tr></thead>
            <tbody>
              {anuncios.slice(0, 60).map((a) => (
                <tr key={a.ad_id}>
                  <Td>{a.ad_name || a.ad_id}</Td>
                  <Td>{a.campaign_name || "—"}</Td>
                  <Td right mono>{brl(a.gasto_total)}</Td>
                  <Td right mono>{num(a.leads)}</Td>
                  <Td right mono>{num(a.qualificados)}</Td>
                  <Td right mono color="#22c55e">{num(a.convertidos)}</Td>
                  <Td right mono>{brl(a.cpl)}</Td>
                  <Td right mono>{brl(a.cac)}</Td>
                  <Td right mono color={a.roas != null && a.roas >= 1 ? "#22c55e" : "#ff5a72"}>{roasFmt(a.roas)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollX>
      </Card>

      {/* #11 — gasto sem retorno (2 baldes SEPARADOS) */}
      <Card>
        <SectionHead Icon={TriangleAlert} color="#f59e0b" title="Gasto Sem Retorno" desc="Dois problemas distintos — nunca somados" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
          {/* balde A: anúncio com gasto e 0 lead */}
          <div>
            <p style={{ ...S.label, marginBottom: 8 }}>Anúncios com gasto e 0 lead — {brl(gastoSemRetorno)}</p>
            <ScrollX>
              <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 320 }}>
                <thead><tr><Th>Anúncio</Th><Th>Campanha</Th><Th right>Gasto perdido</Th></tr></thead>
                <tbody>
                  {semRetorno.length === 0 && <tr><Td color="#83879a">Nenhum — todo gasto teve ao menos 1 lead. ✓</Td></tr>}
                  {semRetorno.map((r) => (
                    <tr key={r.ad_id}>
                      <Td>{r.ad_name || r.ad_id}</Td>
                      <Td>{r.campaign_name || "—"}</Td>
                      <Td right mono color="#ff5a72">{brl(r.gasto_total)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollX>
          </div>
          {/* balde B: lead pago sem ad_id */}
          <div>
            <p style={{ ...S.label, marginBottom: 8 }}>Leads de canal pago SEM anúncio identificado</p>
            <ScrollX>
              <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 320 }}>
                <thead><tr><Th>Canal</Th><Th right>Leads</Th><Th right>Qualif.</Th><Th right>Conv.</Th></tr></thead>
                <tbody>
                  {naoAtrib.length === 0 && <tr><Td color="#83879a">Nenhum — todo lead pago amarrou a um anúncio. ✓</Td></tr>}
                  {naoAtrib.map((r) => (
                    <tr key={r.origem_canal}>
                      <Td>{r.origem_canal}</Td>
                      <Td right mono>{num(r.leads_sem_ad)}</Td>
                      <Td right mono>{num(r.qualificados)}</Td>
                      <Td right mono color="#22c55e">{num(r.convertidos)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollX>
            <p style={{ ...S.muted, marginTop: 8, fontSize: 11 }}>
              Não é o mesmo que “sem lead”: aqui HÁ lead, mas ele não amarrou ao criativo (ad_id nulo).
            </p>
          </div>
        </div>
      </Card>

      {/* #8 — canal × jornada */}
      <Card>
        <SectionHead Icon={Route} color="#22c55e" title="Canal · Jornada" desc="Como o lead chegou (channel × journey)" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          {canalJornada.map((c) => (
            <div key={`${c.channel}-${c.journey}`} style={{ ...S.card, padding: "14px 16px", borderTop: `3px solid ${CH_COLOR[c.channel] ?? "#83879a"}` }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "#fff", fontFamily: theme.font.label }}>{c.channel}</div>
              <div style={{ fontSize: 11.5, color: "#aeb7cc", fontFamily: theme.font.label, marginTop: 1 }}>{c.journey}</div>
              <div style={{ ...S.value, fontSize: 26, marginTop: 8 }}>{num(c.count)}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
