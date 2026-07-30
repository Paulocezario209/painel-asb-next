// tests/fakeSupabase.ts — fake mínimo do client Supabase server-side, usado pelos testes
// de rota do pipeline (suggest/deal-desk/deal-suggestion-event). Cobre só o padrão que
// essas rotas usam: .from(table).select().eq().limit() | .single() (leitura) e
// .from(table).update(patch).eq() (escrita). Não é passado ao "test" do package.json —
// é um helper importado pelos *.test.ts, não um teste em si.
type Row = Record<string, unknown>;

export function makeFakeSupabase(
  tables: Record<string, Row[] | (() => Row[])>,
  captured?: Array<{ table: string; patch: Row }>,
) {
  const resolve = (table: string): Row[] => {
    const raw = tables[table] ?? [];
    return typeof raw === "function" ? raw() : raw;
  };

  const from = (table: string) => {
    const data = resolve(table);
    const chain = {
      select: () => chain,
      eq: () => chain,
      order: () => chain,
      limit: (_n: number) => Promise.resolve({ data, error: null }),
      single: () =>
        data.length > 0
          ? Promise.resolve({ data: data[0], error: null })
          : Promise.resolve({ data: null, error: { message: "not found" } }),
      update: (patch: Row) => {
        captured?.push({ table, patch });
        return { eq: () => Promise.resolve({ data: null, error: null }) };
      },
    };
    return chain;
  };

  return { from };
}
