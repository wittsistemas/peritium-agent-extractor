/**
 * Normalização de nomes de empresa e cidade.
 * ATENÇÃO: este arquivo é idêntico nos projetos organizador-laudos e
 * peritium-agent-extractor. Se mudar um, mude o outro.
 */

const SUFIXOS_JURIDICOS = new Set([
  "LTDA", "LIMITADA", "ME", "EPP", "EIRELI", "SA", "SS", "MEI", "EI",
]);

/** Remove acentos e deixa em maiúsculas. */
function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
}

/**
 * Chave de comparação de empresa: ignora acento, maiúsculas, pontuação, `_`
 * e sufixos jurídicos no fim (LTDA, ME, EPP, EIRELI, S.A. ...).
 * "X LTDA" e "X LTDA ME" geram a mesma chave "X".
 */
export function chaveEmpresa(nome: string): string {
  let s = semAcento(nome);
  s = s.replace(/\bS\s*[\/.]\s*A\b\.?/g, " SA ");
  s = s.replace(/[^A-Z0-9]+/g, " ").trim();
  s = s.replace(/\bS A$/, "SA");
  const tokens = s.split(" ").filter(Boolean);
  while (tokens.length > 1 && SUFIXOS_JURIDICOS.has(tokens[tokens.length - 1]!)) {
    tokens.pop();
  }
  return tokens.join(" ");
}

/** Chave de comparação de cidade: ignora acento, maiúsculas e `_`. */
export function chaveCidade(nome: string): string {
  return semAcento(nome).replace(/[^A-Z0-9]+/g, " ").trim();
}

const PREPOSICOES = new Set(["DE", "DA", "DO", "DAS", "DOS", "E"]);

/** "ANGRA DOS REIS" -> "Angra dos Reis"; mantém acentos. */
export function formatarCidade(nome: string): string {
  return nome
    .trim()
    .replace(/[\/\\?%*:|"<>.]/g, "")
    .replace(/[_\s]+/g, " ")
    .toLowerCase()
    .split(" ")
    .map((p, i) =>
      i > 0 && PREPOSICOES.has(p.toUpperCase())
        ? p
        : p.charAt(0).toUpperCase() + p.slice(1),
    )
    .join(" ");
}
