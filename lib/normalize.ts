// Normalização acento-insensitive para busca client-side (fonte única — não divergir).
// NFD decompõe o acento em diacrítico combinante; o range U+0300–U+036F remove os diacríticos; lowercase.
export const norm = (s: unknown) =>
  (s ?? "").toString().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
