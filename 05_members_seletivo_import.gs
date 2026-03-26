/***************************************
 * 05_members_seletivo_import.gs
 *
 * Importa candidatos aprovados do seletivo
 * para MEMBERS_FUTURO, usando a planilha de
 * inscrição como fonte dos dados cadastrais.
 *
 * Regra:
 * - Avaliação decide o destino
 * - Inscrição fornece os dados completos
 * - Aprovado imediato -> MEMBERS_FUTURO com "Enviar e-mail"
 * - Aprovado em espera -> MEMBERS_FUTURO com "Aguardando vaga"
 ***************************************/

function members_sheetByKey_(key) {
  members_assertCore_();
  return GEAPA_CORE.coreGetSheetByKey(key);
}

function members_getHeaderMap1Based_(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(h => String(h || "").trim());

  const map = {};
  headers.forEach((h, i) => {
    if (h) map[h] = i + 1;
  });
  return map;
}

function members_rowToObject_(headers, row) {
  const obj = {};
  for (let i = 0; i < headers.length; i++) obj[headers[i]] = row[i];
  return obj;
}

function members_onlyDigits_(value) {
  return String(value || "").replace(/\D+/g, "");
}

function members_normalizeEmail_(value) {
  return String(value || "").trim().toLowerCase();
}

function members_formatCpf_(value) {
  const d = members_onlyDigits_(value);
  if (d.length !== 11) return String(value || "").trim();
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function members_formatTelefoneDisplay_(value) {
  const d = members_onlyDigits_(value);

  if (d.length === 11) return d.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  if (d.length === 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");

  return String(value || "").trim();
}

function members_formulaWhatsapp_(telefone) {
  const digits = members_onlyDigits_(telefone);
  if (!digits) return "";

  const br = digits.length >= 10 ? `55${digits}` : digits;
  const display = members_formatTelefoneDisplay_(telefone);

  return `=HYPERLINK("https://wa.me/${br}";"${display}")`;
}

function members_formulaEmail_(email) {
  const e = members_normalizeEmail_(email);
  if (!e) return "";
  return `=HYPERLINK("mailto:${e}";"${e}")`;
}

function members_normalizeInstagramHandle_(value) {
  let s = String(value || "").trim();

  s = s.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "");
  s = s.replace(/^@+/, "");
  s = s.replace(/\/+$/, "");
  s = s.trim();

  // casos tipo "Sim, @usuario"
  const at = s.match(/@([A-Za-z0-9._]+)/);
  if (at && at[1]) return at[1];

  // se sobrou texto solto, tenta manter só caracteres válidos
  s = s.replace(/[^A-Za-z0-9._]/g, "");

  return s;
}

function members_formulaInstagram_(instagram) {
  const handle = members_normalizeInstagramHandle_(instagram);
  if (!handle) return "";
  return `=HYPERLINK("https://instagram.com/${handle}";"@${handle}")`;
}

function members_findInscricaoByRgaOrEmail_(rga, email) {
  const sh = members_sheetByKey_(SETTINGS.seletivo.inscricaoKey);
  if (!sh) throw new Error("SELETIVO_INSCRICAO não encontrada.");

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2) return null;

  const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h || "").trim());
  const values = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();

  const rgaNorm = String(rga || "").trim();
  const emailNorm = members_normalizeEmail_(email);

  let bestByEmail = null;

  for (let i = values.length - 1; i >= 0; i--) {
    const obj = members_rowToObject_(headers, values[i]);

    const rowRga = String(obj["RGA"] || "").trim();
    const rowEmail =
      members_normalizeEmail_(obj["Email (OBS: Este será utilizado para a comunicação oficial do grupo, portanto coloque seu principal email)."] || "") ||
      members_normalizeEmail_(obj["Endereço de e-mail"] || "");

    if (rgaNorm && rowRga === rgaNorm) {
      obj.__rowNumber = i + 2;
      return obj;
    }

    if (!bestByEmail && emailNorm && rowEmail === emailNorm) {
      obj.__rowNumber = i + 2;
      bestByEmail = obj;
    }
  }

  return bestByEmail;
}

function members_findAvaliacaoRowsPendentesImport_() {
  const sh = members_sheetByKey_(SETTINGS.seletivo.avaliacaoKey);
  if (!sh) throw new Error("SELETIVO_AVALIACAO não encontrada.");

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2) return [];

  const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h || "").trim());
  const values = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();

  return values.map((row, idx) => {
    const obj = members_rowToObject_(headers, row);
    obj.__rowNumber = idx + 2;
    return obj;
  }).filter(obj => {
    const resultado = String(obj["Resultado"] || "").trim();
    const processado = String(obj[SETTINGS.seletivo.processadoHeader] || "").trim().toUpperCase();

    return (
      (
        resultado === SETTINGS.seletivo.resultadoAprovadoImediato ||
        resultado === SETTINGS.seletivo.resultadoAprovadoEspera
      ) &&
      processado !== "SIM"
    );
  });
}

function members_futureHasRgaOrEmail_(rga, email) {
  const sh = members_sheetByKey_(SETTINGS.futureKey);
  if (!sh) throw new Error("MEMBERS_FUTURO não encontrada.");

  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(h => String(h || "").trim());
  const idx = getMembersHeaderIndexMap_(headers);

  const lastRow = sh.getLastRow();
  if (lastRow < 2) return false;

  const values = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();

  const rgaNorm = String(rga || "").trim();
  const emailNorm = members_normalizeEmail_(email);

  return values.some(row => {
    const rowRga = idx.rga >= 0 ? String(row[idx.rga] || "").trim() : "";
    const rowEmail = idx.email >= 0 ? members_normalizeEmail_(row[idx.email]) : "";
    return (rgaNorm && rowRga === rgaNorm) || (emailNorm && rowEmail === emailNorm);
  });
}

function members_buildFutureRowFromInscricao_(insc, processStatus) {
  const emailPrincipal =
    members_normalizeEmail_(insc["Email (OBS: Este será utilizado para a comunicação oficial do grupo, portanto coloque seu principal email)."]) ||
    members_normalizeEmail_(insc["Endereço de e-mail"]);

  return {
    "Nome": String(insc["Nome Completo"] || "").trim(),
    "Semestre de inscrição": insc["Seletivo Semestre"] || "",
    "RGA": String(insc["RGA"] || "").trim(),
    "CPF": members_formatCpf_(insc["CPF (000.000.000-00)"]),
    "TELEFONE": members_formulaWhatsapp_(insc["Telefone (DDD) XXXXX-XXXX"]),
    "EMAIL": members_formulaEmail_(emailPrincipal),
    "DATA DE NASCIMENTO": insc["Data de nascimento (00/00/0000)"] || "",
    "@ Instagram": members_formulaInstagram_(insc["Já segue nosso Instagram ( (9) Instagram)? (Obs. inscritos que possuírem conta e não seguirem serão imediatamente desclassificados.)"]),
    "Naturalidade": String(insc["Naturalidade, Ex: Sinop - MT"] || "").trim(),
    "Sexo": String(insc["Sexo"] || "").trim(),
    "Participa/Participou de algum/alguns laboratório(s), projeto(s), pesquisa(s), empresa júnior, monitoria, etc? se sim, citar qual/quais.":
      String(insc["Participa/Participou de algum/alguns laboratório(s), projeto(s), pesquisa(s), empresa júnior, monitoria, etc? se sim, citar qual/quais."] || "").trim(),
    "Semestre atual": String(insc["Semestre atual"] || "").trim(),
    "Status": SETTINGS.values.waiting,
    "Status do processo": processStatus,
    "Data envio convite": "",
    "ThreadId convite": "",
    "Data resposta": "",
    "MessageId resposta": "",
    "Observações do processo": ""
  };
}

function members_appendObjectByHeaders_(sheet, payload) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(h => String(h || "").trim());

  const row = headers.map(h => Object.prototype.hasOwnProperty.call(payload, h) ? payload[h] : "");
  sheet.appendRow(row);
}

function members_markAvaliacaoImportada_(rowNumber) {
  const sh = members_sheetByKey_(SETTINGS.seletivo.avaliacaoKey);
  const map = members_getHeaderMap1Based_(sh);

  if (map[SETTINGS.seletivo.processadoHeader]) {
    sh.getRange(rowNumber, map[SETTINGS.seletivo.processadoHeader]).setValue("SIM");
  }
  if (map[SETTINGS.seletivo.processedAtHeader]) {
    sh.getRange(rowNumber, map[SETTINGS.seletivo.processedAtHeader]).setValue(new Date());
  }
}

function members_importFromSeletivoResults() {
  return members_importFromSeletivoResults_v2();
}