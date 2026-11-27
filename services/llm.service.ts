import { GoogleGenAI } from "@google/genai";
import * as fs from "fs";

import "dotenv/config";

// Inicializa o SDK do Gemini com a chave de ambiente
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "API_KEY" });

// Melhores modelos FREE:
// gemini-3.5-flash-lite
// gemini-3.1-flash-lite
const modeloIA = process.env.MODELO_IA || "gemini-3.5-flash-lite";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type DadosLaudo = {
  titulo: string | null;
  descricao: string | null;
  agentesNocivos: string[];
  cnae: string | null;
  cnpj: string | null;
  ano: number | null;
  ramo: string | null;
  setores: string[];
  funcoes: string[];
};

/**
 * Regra de negócio: o laudo só é salvo se tiver pelo menos UMA destas
 * informações: agente nocivo, ramo, setor ou função.
 */
export function temDadosUteis(dados: DadosLaudo): boolean {
  return (
    dados.agentesNocivos.length > 0 ||
    !!dados.ramo ||
    dados.setores.length > 0 ||
    dados.funcoes.length > 0
  );
}

/**
 * Devolve os dados extraídos, ou null quando a chamada FALHOU (API fora do ar,
 * limite estourado, arquivo ausente, resposta inválida). Falha não é "laudo sem
 * dados": quem chama deve pular o arquivo e tentar de novo numa próxima execução.
 */
export async function analisarPdfComGemini(
  caminhoPdf: string,
): Promise<DadosLaudo | null> {
  if (!fs.existsSync(caminhoPdf)) {
    console.warn(`⚠️ Arquivo não encontrado: ${caminhoPdf}`);
    return null;
  }

  // Lê o arquivo PDF em buffer e converte para Base64
  const pdfBuffer = fs.readFileSync(caminhoPdf);
  const pdfBase64 = pdfBuffer.toString("base64");

  const MAX_TENTATIVAS = 3;
  let tentativaAtual = 0;
  let tempoEspera = 15000;

  while (tentativaAtual < MAX_TENTATIVAS) {
    try {
      // Envia o PDF diretamente para o Gemini de forma nativa e multimodal
      const response = await ai.models.generateContent({
        model: modeloIA,
        contents: [
          {
            inlineData: {
              data: pdfBase64,
              mimeType: "application/pdf",
            },
          },
          {
            text: `Você é um Analista de Dados sênior extraindo informações de laudos técnicos de segurança do trabalho (LTCAT, PPRA) para Advogados Previdenciários.
          
          Analise o documento PDF anexado e extraia os dados solicitados retornando ESTRITAMENTE em formato JSON.
          
          Retorne ESTRITAMENTE um objeto JSON com esta estrutura exata:
          {
            "titulo": "string",
            "descricao": "string",
            "agentesNocivos": ["string"],
            "cnae": "string ou null",
            "cnpj": "string ou null",
            "ano": numero ou null,
            "ramo": "string ou null",
            "setores": ["string"],
            "funcoes": ["string"]
          }

          DIRETRIZES DE PREENCHIMENTO OBRIGATÓRIO:
          1. TÍTULO: Formato "[SIGLA DO DOCUMENTO] - [NOME DA EMPRESA AVALIADA]". Ex: PPRA - ANTON MICHELZ - ME.
          2. DESCRIÇÃO: Breve resumo técnico dos riscos apontados nas conclusões. Não cite clínicas elaboradoras (ex: Cliomed).
          3. AGENTES NOCIVOS: OBRIGATÓRIO extrair todos os agentes físicos, químicos ou biológicos identificados nas tabelas de risco (ex: ruído, calor, radiações não ionizantes, hidrocarbonetos aromáticos). Se aparecem na descrição, DEVEM estar listados neste array.
          4. DADOS DA EMPRESA (CNPJ, CNAE, ANO, RAMO): Procure na seção "Dados da Empresa" (geralmente na página 4 do documento). 
             - CNPJ: Apenas números ou formato limpo.
             - CNAE: Apenas os números do CNAE principal.
             - ANO: O ano inicial de vigência do laudo como número inteiro (ex: 2017).
             - RAMO: A descrição do ramo de atividade da empresa.
          5. FUNÇÕES E SETORES: Cargos reais avaliados (ex: Mecânico) e setores físicos (ex: Operacional). Nunca liste médicos ou engenheiros autores do laudo.`,
          },
        ],
        config: {
          // Força o modelo a responder estritamente em JSON válido
          responseMimeType: "application/json",
          // Temperatura 0.0 para máxima precisão e zero alucinação
          temperature: 0.0,
        },
      });

      const textoResposta = response.text;
      if (!textoResposta) throw new Error("Resposta vazia da API do Gemini.");

      const dados = JSON.parse(textoResposta.trim());

      // Limpeza para garantir integridade com o banco de dados
      let cnpjFinal = null;
      if (dados.cnpj) {
        const nums = String(dados.cnpj).replace(/\D/g, "");
        if (nums.length === 14 && !/^(\d)\1+$/.test(nums)) cnpjFinal = nums;
      }

      let cnaeFinal = null;
      if (dados.cnae) {
        cnaeFinal = String(dados.cnae).replace(/\D/g, "");
      }

      let anoFinal = null;
      if (typeof dados.ano === "number") {
        anoFinal = dados.ano;
      } else if (dados.ano) {
        const parsed = parseInt(String(dados.ano).replace(/\D/g, ""), 10);
        if (!isNaN(parsed)) anoFinal = parsed;
      }

      return {
        titulo: dados.titulo || null,
        descricao: dados.descricao || null,
        agentesNocivos: Array.isArray(dados.agentesNocivos)
          ? dados.agentesNocivos.map((a: string) => a.trim())
          : [],
        cnae: cnaeFinal || null,
        cnpj: cnpjFinal || null,
        ano: anoFinal,
        ramo: dados.ramo || null,
        setores: Array.isArray(dados.setores)
          ? dados.setores.map((s: string) => s.trim())
          : [],
        funcoes: Array.isArray(dados.funcoes)
          ? dados.funcoes.map((f: string) => f.trim())
          : [],
      };
    } catch (error: any) {
      // 503 (servidor ocupado) e 429 (limite por minuto) são temporários: tenta de novo.
      if (error.status === 503 || error.status === 429) {
        tentativaAtual++;
        const motivo =
          error.status === 429 ? "Limite de requisições" : "Servidor ocupado";
        console.log(
          `\n   ⚠️ [${motivo} - Erro ${error.status}] Tentativa ${tentativaAtual} de ${MAX_TENTATIVAS}. Aguardando ${tempoEspera / 1000}s para tentar de novo...`,
        );

        if (tentativaAtual >= MAX_TENTATIVAS) {
          console.error(
            `❌ Falha definitiva após ${MAX_TENTATIVAS} tentativas (modelo ${modeloIA}) para o arquivo: ${caminhoPdf}`,
          );
          return null;
        }

        await sleep(tempoEspera);
        tempoEspera *= 2;
      } else {
        console.error(`❌ Erro ao processar PDF com Gemini:`, error);
        return null;
      }
    }
  }

  return null;
}
