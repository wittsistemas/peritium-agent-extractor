/**
 * Normalização de nomes de empresa e cidade.
 * ATENÇÃO: este arquivo é idêntico nos projetos organizador-laudos e
 * peritium-agent-extractor. Se mudar um, mude o outro.
 */

// Formas jurídicas ignoradas em qualquer posição ("ELIANE SA REVESTIMENTOS" = "ELIANE REVESTIMENTOS SA").
const FORMAS_EM_QUALQUER_LUGAR = new Set(["LTDA", "LIMITADA", "EPP", "EIRELI", "SA"]);
// Siglas curtas: ignoradas só no fim do nome, para não apagar palavra de verdade.
const FORMAS_NO_FIM = new Set(["ME", "SS", "MEI", "EI"]);

/** Remove acentos e deixa em maiúsculas. */
function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
}

/**
 * Chave de comparação de empresa: ignora acento, maiúsculas, pontuação, `_`,
 * formas jurídicas (LTDA, ME, EPP, EIRELI, S.A...), troca "&" por "E" e
 * ignora a ORDEM das palavras. "X LTDA" e "X LTDA ME" geram a mesma chave "X";
 * "SESI SERVIÇO SOCIAL DA INDÚSTRIA" e "SERVIÇO SOCIAL DA INDÚSTRIA SESI" também.
 */
export function chaveEmpresa(nome: string): string {
  let s = semAcento(nome).replace(/&/g, " E ");
  s = s.replace(/\bS\s*[\/.]\s*A\b\.?/g, " SA ");
  s = s.replace(/[^A-Z0-9]+/g, " ").trim();
  s = s.replace(/\bS A\b/g, "SA");
  const todas = s.split(" ").filter(Boolean);
  const tokens = todas.filter((t) => !FORMAS_EM_QUALQUER_LUGAR.has(t));
  while (tokens.length > 1 && FORMAS_NO_FIM.has(tokens[tokens.length - 1]!)) {
    tokens.pop();
  }
  return (tokens.length ? tokens : todas).sort().join(" ");
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
