/***************************************
 * 05_members_seletivo_import.gs
 *
 * Importa candidatos aprovados do seletivo
 * para MEMBERS_FUTURO, usando a planilha de
 * inscricao como fonte dos dados cadastrais.
 *
 * Regra:
 * - Avaliacao decide o destino
 * - Inscricao fornece os dados completos
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
  return members_buildHeaderMapCompat_(headers, { normalize: false, oneBased: true });
}

function members_onlyDigits_(value) {
  return members_onlyDigitsCompat_(value);
}

function members_normalizeEmail_(value) {
  return members_normalizeEmailCompat_(value);
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

  const at = s.match(/@([A-Za-z0-9._]+)/);
  if (at && at[1]) return at[1];

  s = s.replace(/[^A-Za-z0-9._]/g, "");
  return s;
}

function members_formulaInstagram_(instagram) {
  const handle = members_normalizeInstagramHandle_(instagram);
  if (!handle) return "";
  return `=HYPERLINK("https://instagram.com/${handle}";"@${handle}")`;
}

function members_findInscricaoByRgaOrEmail_(rga, email) {
  const records = members_readRecordsByKey_(SETTINGS.seletivo.inscricaoKey);
  if (!records.length) return null;

  const rgaNorm = String(rga || "").trim();
  const emailNorm = members_normalizeEmail_(email);
  let bestByEmail = null;

  for (let i = records.length - 1; i >= 0; i--) {
    const obj = records[i];

    const rowRga = String(obj["RGA"] || "").trim();
    const rowEmail =
      members_normalizeEmail_(obj["Email (OBS: Este será utilizado para a comunicação oficial do grupo, portanto coloque seu principal email)."] || "") ||
      members_normalizeEmail_(obj["Endereço de e-mail"] || "");

    if (rgaNorm && rowRga === rgaNorm) {
      return obj;
    }

    if (!bestByEmail && emailNorm && rowEmail === emailNorm) {
      bestByEmail = obj;
    }
  }

  return bestByEmail;
}

function members_findAvaliacaoRowsPendentesImport_() {
  return members_readRecordsByKey_(SETTINGS.seletivo.avaliacaoKey).filter(obj => {
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
  const rgaNorm = String(rga || "").trim();
  const emailNorm = members_normalizeEmail_(email);

  return members_readRecordsByKey_(SETTINGS.futureKey).some(obj => {
    const rowRga = String(obj["RGA"] || "").trim();
    const rowEmail = members_normalizeEmail_(
      members_getRecordValueByAliases_(obj, members_getHeaderAliases_("future", "email"))
    );
    return (rgaNorm && rowRga === rgaNorm) || (emailNorm && rowEmail === emailNorm);
  });
}

function members_buildFutureRowFromInscricao_(insc, processStatus) {
  const emailPrincipal =
    members_normalizeEmail_(insc["Email (OBS: Este será utilizado para a comunicação oficial do grupo, portanto coloque seu principal email)."]) ||
    members_normalizeEmail_(insc["Endereço de e-mail"]);

  return {
    "Nome": String(insc["Nome Completo"] || "").trim(),
    "Semestre de inscriÃ§Ã£o": insc["Seletivo Semestre"] || "",
    "RGA": String(insc["RGA"] || "").trim(),
    "CPF": members_formatCpf_(insc["CPF (000.000.000-00)"]),
    "TELEFONE": members_formulaWhatsapp_(insc["Telefone (DDD) XXXXX-XXXX"]),
    "EMAIL": members_formulaEmail_(emailPrincipal),
    "DATA DE NASCIMENTO": insc["Data de nascimento (00/00/0000)"] || "",
    "@ Instagram": members_formulaInstagram_(insc["JÃ¡ segue nosso Instagram ( (9) Instagram)? (Obs. inscritos que possuí­rem conta e não seguirem serão imediatamente desclassificados.)"]),
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

function members_buildFutureRowFromInscricao_legacyEncoding_(insc, processStatus) {
  const emailPrincipal =
    members_normalizeEmail_(
      members_getInscricaoFieldByCandidates_(insc, [
        "Email (OBS: Este sera utilizado para a comunicacao oficial do grupo, portanto coloque seu principal email).",
        "Endereco de e-mail"
      ])
    );
  const instagramValue = members_getInscricaoInstagram_(insc);
  const academicHistory = members_getInscricaoAcademicHistory_(insc);

  return {
    "NOME_MEMBRO": String(insc["Nome Completo"] || "").trim(),
    "SEMESTRE_INSCRICAO": insc["Seletivo Semestre"] || "",
    "RGA": String(insc["RGA"] || "").trim(),
    "CPF": members_formatCpf_(insc["CPF (000.000.000-00)"]),
    "TELEFONE": members_formulaWhatsapp_(insc["Telefone (DDD) XXXXX-XXXX"]),
    "EMAIL": members_formulaEmail_(emailPrincipal),
    "DATA_NASCIMENTO": insc["Data de nascimento (00/00/0000)"] || "",
    "INSTAGRAM": members_formulaInstagram_(instagramValue),
    "NATURALIDADE": String(insc["Naturalidade, Ex: Sinop - MT"] || "").trim(),
    "SEXO": String(insc["Sexo"] || "").trim(),
    "HISTORICO_ATIVIDADES_ACADEMICAS": String(academicHistory || "").trim(),
    "SEMESTRE_ATUAL": String(insc["Semestre atual"] || "").trim(),
    "STATUS_CADASTRAL": SETTINGS.values.waiting,
    "STATUS_PROCESSO_INGRESSO": processStatus,
    "DATA_ENVIO_CONVITE": "",
    "THREAD_ID_CONVITE": "",
    "DATA_RESPOSTA": "",
    "MESSAGE_ID_RESPOSTA": "",
    "OBSERVACAO_PROCESSO": ""
  };
}

function members_buildFutureRowFromInscricao_(insc, processStatus) {
  const emailPrincipal =
    members_normalizeEmail_(
      members_getInscricaoFieldByCandidates_(insc, [
        "Email (OBS: Este sera utilizado para a comunicacao oficial do grupo, portanto coloque seu principal email).",
        "Endereco de e-mail"
      ])
    );
  const instagramValue = members_getInscricaoInstagram_(insc);
  const academicHistory = members_getInscricaoAcademicHistory_(insc);

  return {
    "NOME_MEMBRO": String(insc["Nome Completo"] || "").trim(),
    "SEMESTRE_INSCRICAO": insc["Seletivo Semestre"] || "",
    "RGA": String(insc["RGA"] || "").trim(),
    "CPF": members_formatCpf_(insc["CPF (000.000.000-00)"]),
    "TELEFONE": members_formulaWhatsapp_(insc["Telefone (DDD) XXXXX-XXXX"]),
    "EMAIL": members_formulaEmail_(emailPrincipal),
    "DATA_NASCIMENTO": insc["Data de nascimento (00/00/0000)"] || "",
    "INSTAGRAM": members_formulaInstagram_(instagramValue),
    "NATURALIDADE": String(insc["Naturalidade, Ex: Sinop - MT"] || "").trim(),
    "SEXO": String(insc["Sexo"] || "").trim(),
    "HISTORICO_ATIVIDADES_ACADEMICAS": String(academicHistory || "").trim(),
    "SEMESTRE_ATUAL": String(insc["Semestre atual"] || "").trim(),
    "STATUS_CADASTRAL": SETTINGS.values.waiting,
    "STATUS_PROCESSO_INGRESSO": processStatus,
    "DATA_ENVIO_CONVITE": "",
    "THREAD_ID_CONVITE": "",
    "DATA_RESPOSTA": "",
    "MESSAGE_ID_RESPOSTA": "",
    "OBSERVACAO_PROCESSO": ""
  };
}

function members_appendObjectByHeaders_(sheet, payload) {
  return members_appendObjectByHeadersCompat_(sheet, members_adaptPayloadToSheetHeaders_(sheet, payload, "future"));
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
function members_findInscricaoByRgaOrEmail_v2_(rga, email) {
  var records = members_readRecordsByKey_(SETTINGS.seletivo.inscricaoKey);
  if (!records.length) return null;

  var rgaNorm = String(rga || '').trim();
  var emailNorm = members_normalizeEmail_(email);
  var bestByEmail = null;

  for (var i = records.length - 1; i >= 0; i--) {
    var obj = records[i];
    var rowRga = String(obj['RGA'] || '').trim();
    var rowEmail =
      members_normalizeEmail_(obj['Email (OBS: Este será utilizado para a comunicação oficial do grupo, portanto coloque seu principal email).'] || '') ||
      members_normalizeEmail_(obj['Endereço de e-mail'] || '');

    if (rgaNorm && rowRga === rgaNorm) return obj;

    if (!bestByEmail && emailNorm && rowEmail === emailNorm) {
      bestByEmail = obj;
    }
  }

  return bestByEmail;
}

function members_findAvaliacaoRowsPendentesImport_v2_() {
  var records = members_readRecordsByKey_(SETTINGS.seletivo.avaliacaoKey);

  return records.filter(function(obj) {
    var resultado = String(obj['Resultado'] || '').trim();
    var processado = String(obj[SETTINGS.seletivo.processadoHeader] || '').trim().toUpperCase();

    return (
      (
        resultado === SETTINGS.seletivo.resultadoAprovadoImediato ||
        resultado === SETTINGS.seletivo.resultadoAprovadoEspera
      ) &&
      processado !== 'SIM'
    );
  });
}

function members_futureHasRgaOrEmail_v2_(rga, email) {
  var records = members_readRecordsByKey_(SETTINGS.futureKey);
  if (!records.length) return false;

  var rgaNorm = String(rga || '').trim();
  var emailNorm = members_normalizeEmail_(email);

  return records.some(function(obj) {
    var rowRga = String(obj['RGA'] || '').trim();
    var rowEmail = members_normalizeEmail_(obj['EMAIL']);
    return (rgaNorm && rowRga === rgaNorm) || (emailNorm && rowEmail === emailNorm);
  });
}

function members_importFromSeletivoResults_v2() {
  members_assertCore_();

  var pendentes = members_findAvaliacaoRowsPendentesImport_v2_();
  Logger.log('members_importFromSeletivoResults_v2: pendentes=' + pendentes.length);

  var futureSheet = members_sheetByKey_(SETTINGS.futureKey);
  if (!futureSheet) {
    throw new Error('Não foi possível localizar MEMBERS_FUTURO.');
  }
  var futureHeaders = futureSheet.getRange(1, 1, 1, futureSheet.getLastColumn()).getValues()[0]
    .map(function(h) { return String(h || '').trim(); });
  var futureIdentityIndex = members_buildFutureIdentityIndex_v2_();

  pendentes.forEach(function(av) {
    var rga = String(av['RGA'] || '').trim();
    var email = members_normalizeEmail_(av['Email']);
    var resultado = String(av['Resultado'] || '').trim();

    var insc = members_findInscricaoByRgaOrEmail_v2_(rga, email);
    if (!insc) {
      Logger.log('V2: sem inscrição encontrada para RGA=' + rga + ' | Email=' + email);
      return;
    }

    var emailPrincipal =
      members_normalizeEmail_(insc['Email (OBS: Este será utilizado para a comunicação oficial do grupo, portanto coloque seu principal email).']) ||
      members_normalizeEmail_(insc['Endereço de e-mail']);

    if (members_futureIndexHasRgaOrEmail_v2_(futureIdentityIndex, rga, emailPrincipal)) {
      Logger.log('V2: candidato já existe em MEMBERS_FUTURO. RGA=' + rga + ' | Email=' + emailPrincipal);
      members_markAvaliacaoImportada_(av.__rowNumber);
      return;
    }

    var processStatus = '';
    if (resultado === SETTINGS.seletivo.resultadoAprovadoImediato) {
      processStatus = SETTINGS.values.sendEmail;
    } else if (resultado === SETTINGS.seletivo.resultadoAprovadoEspera) {
      processStatus = SETTINGS.seletivo.waitingProcessStatus;
    } else {
      return;
    }

    var payload = members_buildFutureRowFromInscricao_(insc, processStatus);
    members_appendObjectByHeaders_(futureSheet, payload);
    members_registerFutureIdentity_v2_(futureIdentityIndex, rga, emailPrincipal);

    var newRow = futureSheet.getLastRow();

    if (processStatus === SETTINGS.values.sendEmail) {
      members_sendInviteByRow_(futureSheet, newRow, futureHeaders);
    }

    members_markAvaliacaoImportada_(av.__rowNumber);

    Logger.log(
      'V2: importado do seletivo para MEMBERS_FUTURO: ' +
      (payload['Nome'] || '') + ' | processo=' + processStatus
    );
  });
}

function members_buildFutureIdentityIndex_v2_() {
  var records = members_readRecordsByKey_(SETTINGS.futureKey);
  var index = {
    byRga: {},
    byEmail: {}
  };

  records.forEach(function(obj) {
    members_registerFutureIdentity_v2_(index, obj['RGA'], obj['EMAIL']);
  });

  return index;
}

function members_registerFutureIdentity_v2_(index, rga, email) {
  var rgaNorm = String(rga || '').trim();
  var emailNorm = members_normalizeEmail_(email);

  if (rgaNorm) index.byRga[rgaNorm] = true;
  if (emailNorm) index.byEmail[emailNorm] = true;
}

function members_futureIndexHasRgaOrEmail_v2_(index, rga, email) {
  var rgaNorm = String(rga || '').trim();
  var emailNorm = members_normalizeEmail_(email);

  return !!(
    (rgaNorm && index.byRga[rgaNorm]) ||
    (emailNorm && index.byEmail[emailNorm])
  );
}

function members_getInscricaoFieldByCandidates_(insc, candidates) {
  const record = insc || {};
  const keys = Object.keys(record);
  const list = Array.isArray(candidates) ? candidates : [candidates];

  for (let i = 0; i < list.length; i++) {
    const target = members_normalizeOffboardingHeader_(list[i]);
    for (let j = 0; j < keys.length; j++) {
      if (members_normalizeOffboardingHeader_(keys[j]) === target) {
        return record[keys[j]];
      }
    }
  }

  return "";
}

function members_findInscricaoFieldContainingAll_(insc, requiredTerms) {
  const record = insc || {};
  const keys = Object.keys(record);
  const terms = (Array.isArray(requiredTerms) ? requiredTerms : [requiredTerms])
    .map(term => members_normalizeOffboardingHeader_(term))
    .filter(Boolean);

  for (let i = 0; i < keys.length; i++) {
    const normalizedKey = members_normalizeOffboardingHeader_(keys[i]);
    const matchesAll = terms.every(term => normalizedKey.indexOf(term) >= 0);
    if (matchesAll) return record[keys[i]];
  }

  return "";
}

function members_getInscricaoInstagram_(insc) {
  return (
    members_getInscricaoFieldByCandidates_(insc, ["Instagram", "@ Instagram", "INSTAGRAM"]) ||
    members_findInscricaoFieldContainingAll_(insc, ["instagram"])
  );
}

function members_getInscricaoAcademicHistory_(insc) {
  return (
    members_getInscricaoFieldByCandidates_(insc, [
      "Participa/Participou de algum/alguns laboratorio(s), projeto(s), pesquisa(s), empresa junior, monitoria, etc? se sim, citar qual/quais.",
      "HISTORICO_ATIVIDADES_ACADEMICAS"
    ]) ||
    members_findInscricaoFieldContainingAll_(insc, ["participa", "participou"]) ||
    members_findInscricaoFieldContainingAll_(insc, ["laboratorio", "projeto", "pesquisa"])
  );
}

function members_buildFutureRowFromInscricao_legacyEncodingFinal_(insc, processStatus) {
  const emailPrincipal =
    members_normalizeEmail_(
      members_getInscricaoFieldByCandidates_(insc, [
        "Email (OBS: Este sera utilizado para a comunicacao oficial do grupo, portanto coloque seu principal email).",
        "Endereco de e-mail"
      ])
    );
  const instagramValue = members_getInscricaoInstagram_(insc);
  const academicHistory = members_getInscricaoAcademicHistory_(insc);

  return {
    "Nome": String(insc["Nome Completo"] || "").trim(),
    "Semestre de inscriÃƒÂ§ÃƒÂ£o": insc["Seletivo Semestre"] || "",
    "RGA": String(insc["RGA"] || "").trim(),
    "CPF": members_formatCpf_(insc["CPF (000.000.000-00)"]),
    "TELEFONE": members_formulaWhatsapp_(insc["Telefone (DDD) XXXXX-XXXX"]),
    "EMAIL": members_formulaEmail_(emailPrincipal),
    "DATA DE NASCIMENTO": insc["Data de nascimento (00/00/0000)"] || "",
    "@ Instagram": members_formulaInstagram_(instagramValue),
    "Naturalidade": String(insc["Naturalidade, Ex: Sinop - MT"] || "").trim(),
    "Sexo": String(insc["Sexo"] || "").trim(),
    "Participa/Participou de algum/alguns laboratÃ³rio(s), projeto(s), pesquisa(s), empresa jÃºnior, monitoria, etc? se sim, citar qual/quais.":
      String(academicHistory || "").trim(),
    "Semestre atual": String(insc["Semestre atual"] || "").trim(),
    "Status": SETTINGS.values.waiting,
    "Status do processo": processStatus,
    "Data envio convite": "",
    "ThreadId convite": "",
    "Data resposta": "",
    "MessageId resposta": "",
    "ObservaÃ§Ãµes do processo": ""
  };
}
