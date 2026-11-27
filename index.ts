import "reflect-metadata";
import * as fs from "fs";
import * as path from "path";

import { AppDataSource } from "./config/database.js";
import { Empresa } from "./entities/empresa.entity.js";
import { Laudo } from "./entities/laudo.entity.js";

import { analisarPdfComGemini } from "./services/llm.service.js";

import "dotenv/config";

async function rodarAgenteExtractor() {
  try {
    console.log("⏳ Conectando ao PostgreSQL...");
    await AppDataSource.initialize();
    console.log("✅ Banco conectado!");

    const caminhoRaiz = process.env.FOLDER_PATH;

    const empresaRepo = AppDataSource.getRepository(Empresa);
    const laudoRepo = AppDataSource.getRepository(Laudo);

    const pastasEstados = fs
      .readdirSync(String(caminhoRaiz), { withFileTypes: true })
      .filter((d) => d.isDirectory());

    for (const pastaEstadoDir of pastasEstados) {
      const dadosEstado = pastaEstadoDir.name;
      const estadoPath = path.join(String(caminhoRaiz), pastaEstadoDir.name);

      for (const cidade of fs
        .readdirSync(estadoPath, { withFileTypes: true })
        .filter((d) => d.isDirectory())) {
        const cidadePath = path.join(estadoPath, cidade.name);

        for (const empresaPasta of fs
          .readdirSync(cidadePath, { withFileTypes: true })
          .filter((d) => d.isDirectory())) {
          const empresaPath = path.join(cidadePath, empresaPasta.name);
          const nomeEmpresaLimpo = empresaPasta.name
            .replace(/[_\-]/g, " ")
            .replace(/\s+/g, " ")
            .trim();

          const arquivos = fs
            .readdirSync(empresaPath, { withFileTypes: true })
            .filter((d) => d.isFile() && d.name.toLowerCase().endsWith(".pdf"));

          const sleep = (ms: number) =>
            new Promise((resolve) => setTimeout(resolve, ms));

          for (const arquivo of arquivos) {
            console.log(`\n📄 Lendo arquivo: ${arquivo.name}`);
            const caminhoCompletoPdf = path.join(empresaPath, arquivo.name);

            // Garante que a chave use barras normais (padrão web)
            const caminhoRelativo =
              `${pastaEstadoDir.name}/${cidade.name}/${empresaPasta.name}/${arquivo.name}`.replace(
                /\\/g,
                "/",
              );

            const tituloArquivo = arquivo.name
              .replace(/\.[^/.]+$/, "")
              .replace(/[_\-]/g, " ")
              .replace(/\s+/g, " ")
              .trim();

            try {
              // 🚀 O Gemini lê o PDF sem precisar do Tesseract!
              console.log(`   🤖 Enviando PDF direto para o Gemini...`);
              const ia = await analisarPdfComGemini(caminhoCompletoPdf);

              let empresaEntity = null;
              if (ia?.cnpj)
                empresaEntity = await empresaRepo.findOne({
                  where: { cnpj: ia.cnpj },
                });
              if (!empresaEntity)
                empresaEntity = await empresaRepo.findOne({
                  where: { razao_social: nomeEmpresaLimpo },
                });

              if (!empresaEntity) {
                empresaEntity = empresaRepo.create({
                  razao_social: nomeEmpresaLimpo,
                  ...(ia?.cnpj && { cnpj: ia.cnpj }),
                });
                await empresaRepo.save(empresaEntity);
              } else if (ia?.cnpj && !empresaEntity.cnpj) {
                empresaEntity.cnpj = ia.cnpj;
                await empresaRepo.save(empresaEntity);
              }

              const novoLaudo = laudoRepo.create({
                titulo: ia?.titulo || tituloArquivo,
                descricao: ia?.descricao || null,
                uf: dadosEstado,
                cidade: cidade.name,
                cnae: ia?.cnae || undefined,
                agentesNocivos: ia?.agentesNocivos,
                ano: ia?.ano,
                ramo: ia?.ramo,
                setores: ia?.setores,
                funcoes: ia?.funcoes,
                caminhoArquivo: caminhoRelativo,
                empresa: empresaEntity,
              } as any);

              await laudoRepo.save(novoLaudo);
              console.log(
                `💾 Laudo salvo: ${nomeEmpresaLimpo} (Setores: ${ia?.setores.join(", ") || "Nenhum"})`,
              );

              console.log(
                `⏳ Pausa de segurança (5s) para respeitar o limite de 15 RPM...`,
              );
              await sleep(5000);
            } catch (err: any) {
              console.error(
                `\n❌ ERRO REAL no arquivo ${arquivo.name}:`,
                err.message || err,
              );
            }
          }
        }
      }
    }
    console.log("\n🎉 IMPORTAÇÃO AUTÔNOMA CONCLUÍDA!");
  } catch (error) {
    console.error("\n❌ Erro crítico:", error);
  } finally {
    await AppDataSource.destroy();
  }
}

rodarAgenteExtractor();
