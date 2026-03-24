/***************************************
 * 07_members_seletivo_import_v2.gs
 *
 * Versão progressiva do fluxo de importação do seletivo.
 *
 * Objetivo:
 * - usar a nova camada de records/adapters
 * - reduzir repetição de leitura manual
 * - manter o fluxo antigo intacto até validação
 ***************************************/

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

    if (members_futureHasRgaOrEmail_v2_(rga, emailPrincipal)) {
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

    var newRow = futureSheet.getLastRow();
    var futureHeaders = futureSheet.getRange(1, 1, 1, futureSheet.getLastColumn()).getValues()[0]
      .map(function(h) { return String(h || '').trim(); });

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
