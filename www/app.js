window.onerror = function(msg, url, line) {
  alert("Aviso de erro (linha " + line + "): " + msg);
};

var memStore = {};
var ITEM1 = "1. Das    às    - Assunção do serviço, limpeza, manutenção e equipagem da viatura, conferência do efetivo e preleção com BAEP Comando.";
var watchId = null, timerId = null, blkStart = null, bairros = new Array(), lastPos = null;
var NL = String.fromCharCode(10);
var IMAGEM_PADRAO = "./fundo.png";
var fotoQualBase64 = "";
var fotoQualFinalBase64 = "";
var resenhaEnvolvidos = new Array({ tipo: "Indiciado", nome: "", rg: "" });

function $(id) { return document.getElementById(id); }
function sGet(k) {
  try {
    var v = localStorage.getItem(k);
    return v !== null ? v : (memStore[k] || null);
  } catch (e) {
    return memStore[k] || null;
  }
}
function sSet(k, v) {
  memStore[k] = v;
  try { localStorage.setItem(k, v); } catch (e) {}
}
function sDel(k) {
  delete memStore[k];
  try { localStorage.removeItem(k); } catch (e) {}
}
function two(n) { var s = String(n); return s.length < 2 ? "0" + s : s; }
function isNum(s) { return s !== "" && !isNaN(Number(s)); }
function getToday() { var d = new Date(); return two(d.getDate()) + "/" + two(d.getMonth() + 1) + "/" + d.getFullYear(); }

function mostrarTela(telaId) {
  $("home-screen").style.display = "none";
  $("header-screen").style.display = "none";
  $("report-screen").style.display = "none";
  $("saved-screen").style.display = "none";
  $("qual-screen").style.display = "none";
  $("resenha-screen").style.display = "none";
  $(telaId).style.display = "block";
  window.scrollTo(0, 0);
}

function voltarInicio() { saveAll(); updateCount(); mostrarTela("home-screen"); }
function abrirCabecalho() { if (!$("f-data").value.trim()) $("f-data").value = getToday(); atualizarTelaCabecalho(); mostrarTela("header-screen"); }
function editarCabecalho() { saveAll(); atualizarTelaCabecalho(); mostrarTela("header-screen"); }
function abrirSalvos() { $("saved-detail").style.display = "none"; renderSaved(); mostrarTela("saved-screen"); }
function abrirResenha() { renderizarEnvolvidosResenha(); atualizarResenha(); mostrarTela("resenha-screen"); }

function atualizarFundo() {
  var home = $("home-screen");
  var btnRm = $("btn-rm-bg");
  var bgUsuario = sGet("qru_bg");
  if (bgUsuario) {
    home.style.backgroundImage = "url('" + bgUsuario + "')";
    if (btnRm) btnRm.style.display = "inline-block";
  } else {
    home.style.backgroundImage = "url('" + IMAGEM_PADRAO + "')";
    if (btnRm) btnRm.style.display = "none";
  }
}

function changeBg(e) {
  var f = e.target.files ? e.target.files.item(0) : null;
  if (!f) return;
  var r = new FileReader();
  r.onload = function(ev) {
    sSet("qru_bg", ev.target.result);
    atualizarFundo();
  };
  r.readAsDataURL(f);
}

function removeBg() {
  sDel("qru_bg");
  atualizarFundo();
}

function titleCase(s) {
  if (!s) return "";
  return s.trim().toLowerCase().split(" ").filter(function(x) { return x !== ""; }).map(function(w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join(" ");
}

function resolverNomeBatalhao(raw) {
  var v = (raw || "").trim(), up = v.toUpperCase(), res = v;
  if (!v) return "";
  var num = "";
  for (var i = 0; i < up.length; i++) {
    var c = up.charAt(i);
    if (c >= "0" && c <= "9") num += c;
  }
  var semNum = up.replace("°", "").replace("º", "").trim();
  if (num) semNum = semNum.slice(num.length).trim();

  if (up.indexOf("ROTA") > -1) {
    res = "Batalhão Tobias de Aguiar";
  } else if (up.indexOf("BPMI") > -1 || (num !== "" && semNum === "I")) {
    res = (num ? num + "º " : "") + "Batalhão de Polícia Militar do Interior";
  } else if (up.indexOf("BPMM") > -1 || (num !== "" && semNum === "M")) {
    res = (num ? num + "º " : "") + "Batalhão de Polícia Militar Metropolitano";
  } else if (up.indexOf("BPCHQ") > -1) {
    res = (num ? num + "º " : "") + "Batalhão de Polícia de Choque";
  } else if (up.indexOf("BAEP") > -1) {
    var idxB = up.indexOf("BAEP");
    var antesB = v.slice(0, idxB).replace("°", "").replace("º", "").trim();
    var depoisB = titleCase(v.slice(idxB + 4));
    res = (antesB ? antesB + "° " : "") + "Batalhão de Ações Especiais de Polícia" + (depoisB ? " " + depoisB : "");
  } else if (up.indexOf("CAEP") > -1) {
    var idxC = up.indexOf("CAEP");
    var depoisC = titleCase(v.slice(idxC + 4));
    res = "Companhia de Ações Especiais de Polícia" + (depoisC ? " " + depoisC : "");
  } else if (up.indexOf("PAEP") > -1) {
    var idxP = up.indexOf("PAEP");
    var antesP = v.slice(0, idxP).replace("°", "").replace("º", "").trim();
    var depoisP = titleCase(v.slice(idxP + 4));
    res = (antesP ? antesP + "° " : "") + "Pelotão de Ações Especiais de Polícia" + (depoisP ? " " + depoisP : "");
  }
  return res;
}
function onUnitChange() {
  var res = resolverNomeBatalhao($("f-uni").value);
  $("out-uni").value = res || "Batalhão de Ações Especiais de Polícia";
  saveAll();
}

function formatRankAndName(raw) {
  var txt = raw.trim();
  if (!txt) return "";
  var first = txt.slice(0, 1), second = txt.slice(1, 2);
  if ((first === "1" || first === "2" || first === "3") && second !== " " && second !== "°" && second !== "º") txt = first + " " + txt.slice(1);
  var words = txt.split(" ").filter(function(x) { return x !== ""; });
  var idx = 0, numPrefix = "";
  var w0 = words.slice(0, 1).join("").replace("°", "").replace("º", "");
  if (isNum(w0) && (w0 === "1" || w0 === "2" || w0 === "3")) { numPrefix = w0 + "° "; idx = 1; }
  var rank = "", cur = words.slice(idx, idx + 1).join("").toLowerCase().replace(".", ""), next = words.slice(idx + 1, idx + 2).join("").toLowerCase().replace(".", "");
  if ((cur === "tenente" || cur === "ten") && (next === "cel" || next === "coronel")) { rank = "Tenente Cel"; idx += 2; }
  else if (cur === "tc" || cur === "tencel") { rank = "Tenente Cel"; idx += 1; }
  else if (cur === "sd" || cur === "soldado") { rank = "Sd"; idx += 1; }
  else if (cur === "cb" || cur === "cabo") { rank = "Cb"; idx += 1; }
  else if (cur === "sgt" || cur === "sargento") { rank = "Sgt"; idx += 1; }
  else if (cur === "ten" || cur === "tenente") { rank = "Ten"; idx += 1; }
  else if (cur === "cap" || cur === "capitao" || cur === "capitão") { rank = "Cap"; idx += 1; }
  else if (cur === "maj" || cur === "major") { rank = "Maj"; idx += 1; }
  else if (cur === "cel" || cur === "coronel") { rank = "Cel"; idx += 1; }
  else if (cur === "subten" || cur === "st") { rank = "Subten"; idx += 1; }
  else if (cur === "asp" || cur === "aspirante") { rank = "Asp"; idx += 1; }
  else { return titleCase(txt); }
  var afterRank = words.slice(idx);
  if (afterRank.length > 0 && afterRank.slice(0, 1).join("").toUpperCase() === "PM") afterRank = afterRank.slice(1);
  var namePart = titleCase(afterRank.join(" "));
  return numPrefix + rank + " PM" + (namePart ? " " + namePart : "");
}

function formatAllEquipe() {
  var ids = new Array("f-cmt", "f-mot", "f-h3", "f-h4", "f-h5");
  for (var i = 0; i < ids.length; i++) {
    var el = $(ids.slice(i, i + 1).join(""));
    if (el && el.value.trim()) { el.value = formatRankAndName(el.value); addEquipe(el.value); }
  }
}

function extractTimes(str) {
  var parts = str.split(" "), found = new Array();
  for (var i = 0; i < parts.length; i++) {
    var p = parts.slice(i, i + 1).join("").trim();
    if (isNum(p) && p.length <= 2) found.push(two(p) + ":00");
    else if (p.indexOf(":") > -1) {
      var hp = p.split(":");
      if (hp.length === 2 && isNum(hp.slice(0, 1).join("")) && isNum(hp.slice(1, 2).join(""))) {
        found.push(two(hp.slice(0, 1).join("")) + ":" + two(hp.slice(1, 2).join("")));
      }
    }
  }
  return found;
}

function formatHourInput() {
  var el = $("f-hora"), v = el.value.trim();
  if (!v) return;
  var nums = extractTimes(v);
  if (nums.length >= 2) el.value = nums.slice(0, 1).join("") + " às " + nums.slice(1, 2).join("");
  else if (nums.length === 1) el.value = nums.slice(0, 1).join("");
  saveAll();
}

function formatCiaInput() {
  var v = $("f-cia").value.trim();
  var up = v.toUpperCase();
  if (up === "FT") { $("f-cia").value = "Força Tática"; saveAll(); }
  else if (up === "CANIL") { $("f-cia").value = "Canil"; saveAll(); }
  else if (up === "CAVALARIA") { $("f-cia").value = "Cavalaria"; saveAll(); }
  else if (up === "ROCAM") { $("f-cia").value = "ROCAM"; saveAll(); }
  else if (isNum(v)) { $("f-cia").value = v + "ª"; saveAll(); }
}

function formatPelInput() {
  var v = $("f-pel").value.trim();
  if (isNum(v)) { $("f-pel").value = v + "°"; saveAll(); }
}

function formatVtrInput() {
  var el = $("f-vtr");
  var v = el.value.trim();
  if (!v) return;
  var primeira = v.charAt(0).toUpperCase();
  if (primeira >= "A" && primeira <= "Z") {
    var resto = v.slice(1).trim();
    if (resto.charAt(0) === "-") resto = resto.slice(1).trim();
    el.value = resto ? primeira + "-" + resto : primeira;
    saveAll();
  }
}

function calcKm() {
  var i = $("f-kmi").value, f = $("f-kmf").value;
  $("f-kmp").value = (i !== "" && f !== "" && Number(f) >= Number(i)) ? (Number(f) - Number(i)) : "";
  saveAll();
}

function isModoRelatorio() {
  return $("f-doc").value === "RELATÓRIO DE PATRULHAMENTO";
}

function atualizarTelaCabecalho() {
  var rel = isModoRelatorio();
  var rows = document.querySelectorAll("#header-screen .row");
  for (var i = 1; i < rows.length; i++) {
    rows.item(i).style.display = rel ? "none" : "flex";
  }
  var btn = $("btn-hdr-ok");
  if (btn) btn.textContent = rel ? "Criar Relatório" : "Cabeçalho Preenchido";
}

function finishHeaderStep() {
  if (isModoRelatorio()) {
    document.querySelector("#print-box .line-1").style.display = "none";
    $("out-uni").style.display = "none";
    $("out-doc").style.display = "none";
    $("out-hdr").style.display = "none";
    document.querySelector("#print-box .space-2").style.display = "none";
    if (!$("txt-body").value.trim()) $("txt-body").value = ITEM1;
    saveAll();
    mostrarTela("report-screen");
  } else {
    document.querySelector("#print-box .line-1").style.display = "block";
    $("out-uni").style.display = "block";
    $("out-doc").style.display = "block";
    $("out-hdr").style.display = "block";
    document.querySelector("#print-box .space-2").style.display = "block";
    if (!$("f-data").value.trim()) $("f-data").value = getToday();
    formatHourInput(); formatCiaInput(); formatPelInput(); formatVtrInput(); onUnitChange(); formatAllEquipe();
    if (!$("txt-body").value.trim()) $("txt-body").value = ITEM1;
    refreshPreview();
    mostrarTela("report-screen");
  }
}

function refreshPreview() {
  $("out-doc").textContent = $("f-doc").value;
  var eq = new Array();
  if ($("f-cmt").value) eq.push("Cmt: " + $("f-cmt").value);
  if ($("f-mot").value) eq.push("Mot: " + $("f-mot").value);
  if ($("f-h3").value) eq.push("3° Homem: " + $("f-h3").value);
  if ($("f-h4").value) eq.push("4° Homem: " + $("f-h4").value);
  if ($("f-h5").value) eq.push("5° Homem: " + $("f-h5").value);
  $("out-hdr").innerHTML =
    "<b>Data:</b> " + $("f-data").value + " | <b>Horário:</b> " + $("f-hora").value + "<br>" +
    "<b>Cia:</b> " + $("f-cia").value + " | <b>Pel:</b> " + $("f-pel").value + " | <b>Viatura:</b> " + $("f-vtr").value + "<br>" +
    "<b>KM Ini:</b> " + $("f-kmi").value + " | <b>KM Fin:</b> " + $("f-kmf").value + " | <b>KM Perc:</b> " + $("f-kmp").value + "<br>" +
    "<b>Equipe:</b> " + eq.join(" | ");
  saveAll();
}

function addEquipe(val) {
  var n = formatRankAndName(val);
  if (!n) return;
  var arr = JSON.parse(sGet("qru_eq") || "[]");
  if (arr.indexOf(n) === -1) { arr.push(n); sSet("qru_eq", JSON.stringify(arr)); loadEquipe(); }
}

function loadEquipe() {
  var arr = JSON.parse(sGet("qru_eq") || "[]");
  $("dl-equipe").innerHTML = arr.map(function(x) { return '<option value="' + x + '">'; }).join("");
}

function getLineNum(line) {
  var dot = line.indexOf(".");
  if (dot > 0) { var p = line.slice(0, dot).trim(); if (isNum(p)) return parseInt(p, 10); }
  return 0;
}

function onBodyKey(e) {
  if (e.key === "Enter" || e.keyCode === 13) {
    var ta = e.target, pos = ta.selectionStart, val = ta.value, before = val.slice(0, pos);
    if (before.trim().slice(-1) === ".") {
      e.preventDefault();
      var lines = before.split(NL), last = 1;
      for (var i = lines.length - 1; i >= 0; i--) { var num = getLineNum(lines.slice(i, i + 1).join("")); if (num > 0) { last = num; break; } }
      var novo = before + NL + (last + 1) + ". " + val.slice(pos), c = 1;
      ta.value = novo.split(NL).map(function(l) { var n = getLineNum(l); return n > 0 ? (c++) + l.slice(l.indexOf(".")) : l; }).join(NL);
      var nPos = before.length + String(last + 1).length + 3;
      ta.setSelectionRange(nPos, nPos);
      saveAll();
    }
  }
}
function processarPosicaoGps(lat, lon) {
  var radioH = document.querySelector('input[name="gps-h"]:checked');
  var h = radioH ? parseInt(radioH.value, 10) : 1;
  if (blkStart && (new Date() - blkStart >= h * 3600000)) {
    fecharBlocoGps();
  }

  if (!lastPos || Math.abs(lat - lastPos.lat) + Math.abs(lon - lastPos.lon) > 0.0015) {
    lastPos = { lat: lat, lon: lon };
    fetch("https://openstreetmap.org" + lat + "&lon=" + lon + "&accept-language=pt-BR")
      .then(function(r) { return r.json(); })
      .then(function(j) {
        var b = (j.address && (j.address.suburb || j.address.neighbourhood || j.address.quarter || j.address.city_district)) || "";
        if (b && bairros.indexOf(b) === -1) {
          bairros.push(b);
          saveAll();
        }
        $("gps-info").textContent = "Bairros: " + (bairros.join(", ") || "buscando...");
      }).catch(function() {
        $("gps-info").textContent = "GPS ativo (aguardando rede para nome do bairro)...";
      });
  }
}

function startGps() {
  if (!blkStart) { blkStart = new Date(); bairros = new Array(); }
  $("b-gps-on").style.display = "none";
  $("b-gps-off").style.display = "inline-block";
  $("gps-info").textContent = "GPS ativo...";

  var BgGps = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.BackgroundGeolocation;

  if (BgGps) {
    watchId = BgGps.addWatcher(
      {
        backgroundTitle: "Patrulhamento GPS Ativo",
        backgroundMessage: "Registrando bairros para Folha de QRU.",
        requestPermissions: true,
        stale: false,
        distanceFilter: 20
      },
      function(location, error) {
        if (error) {
          if (error.code === "NOT_AUTHORIZED") {
            if (confirm("Ative a permissão de localização 'Permitir o tempo todo' nas configurações.")) {
              BgGps.openSettings();
            }
          }
          $("gps-info").textContent = "Aviso GPS: " + (error.message || error.code);
          return;
        }
        if (location) {
          processarPosicaoGps(location.latitude, location.longitude);
        }
      }
    );
  } else {
    if (!navigator.geolocation) return alert("Sem GPS neste aparelho.");
    watchId = navigator.geolocation.watchPosition(function(p) {
      processarPosicaoGps(p.coords.latitude, p.coords.longitude);
    }, function(err) {
      $("gps-info").textContent = "Aviso GPS: " + err.message;
    }, { enableHighAccuracy: true });
  }

  timerId = setInterval(function() {
    var radioH = document.querySelector('input[name="gps-h"]:checked');
    var h = radioH ? parseInt(radioH.value, 10) : 1;
    if (new Date() - blkStart >= h * 3600000) fecharBlocoGps();
  }, 20000);
}

function stopGps() {
  var BgGps = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.BackgroundGeolocation;
  if (watchId !== null && watchId !== undefined) {
    if (BgGps && typeof watchId === "string") {
      BgGps.removeWatcher({ id: watchId });
    } else if (navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId);
    }
    watchId = null;
  }
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
  $("b-gps-on").style.display = "inline-block";
  $("b-gps-off").style.display = "none";
  $("gps-info").textContent = "GPS pausado.";
}

function testarGpsAgora() {
  if (!navigator.geolocation) return alert("Sem GPS neste aparelho.");
  $("gps-info").textContent = "Consultando satélite e bairro atual...";
  navigator.geolocation.getCurrentPosition(function(p) {
    fetch("https://openstreetmap.org" + p.coords.latitude + "&lon=" + p.coords.longitude + "&accept-language=pt-BR")
      .then(function(r) { return r.json(); })
      .then(function(j) {
        var b = (j.address && (j.address.suburb || j.address.neighbourhood || j.address.quarter || j.address.city_district)) || "Bairro não identificado";
        var c = (j.address && (j.address.city || j.address.town || j.address.village)) || "";
        $("gps-info").textContent = "Teste OK: " + b + (c ? " (" + c + ")" : "") + (bairros.length ? " | Acumulados: " + bairros.join(", ") : "");
      }).catch(function() {
        $("gps-info").textContent = "GPS OK (" + p.coords.latitude.toFixed(4) + ", " + p.coords.longitude.toFixed(4) + "), mas sem internet para buscar o nome do bairro.";
      });
  }, function(err) {
    $("gps-info").textContent = "Erro no teste GPS: " + err.message;
  }, { enableHighAccuracy: true, timeout: 10000 });
}

function fmtHora(d) { return two(d.getHours()) + ":" + two(d.getMinutes()); }

function fecharBlocoGps() {
  var now = new Date(), ini = fmtHora(blkStart || now), fim = fmtHora(now);
  var txtB = bairros.length ? bairros.join(", ") : "área da companhia";
  addItem("Das " + ini + " às " + fim + " - Patrulhamento pelos bairros " + txtB + ".");
  blkStart = new Date(now.getTime() + 60000); bairros = new Array(); saveAll();
}

function addItem(txt) {
  var ta = $("txt-body"), lines = ta.value.trim().split(NL).filter(function(x) { return x.trim() !== ""; }), n = 1;
  lines.forEach(function(l) { var num = getLineNum(l); if (num > 0) n = num + 1; });
  lines.push(n + ". " + txt); ta.value = lines.join(NL);
}

function limparCampos() {
  $("f-doc").value = "FOLHA DE QRU";
  $("f-uni").value = "";
  $("out-uni").value = "Batalhão de Ações Especiais de Polícia";
  $("f-data").value = getToday();
  $("f-hora").value = "";
  $("f-cia").value = "";
  $("f-pel").value = "";
  $("f-vtr").value = "";
  $("f-kmi").value = "";
  $("f-kmf").value = "";
  $("f-kmp").value = "";
  $("f-cmt").value = "";
  $("f-mot").value = "";
  $("f-h3").value = "";
  $("f-h4").value = "";
  $("f-h5").value = "";
  $("txt-body").value = ITEM1;
  atualizarTelaCabecalho();
}

async function salvarNaPastaAndroid(nomeArquivo, conteudo, isBase64) {
  var Fs = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem;
  if (!Fs) return false;
  try {
    if (Fs.requestPermissions) {
      await Fs.requestPermissions().catch(function() {});
    }
    var diretorios = new Array("DOCUMENTS", "EXTERNAL", "DATA");
    for (var i = 0; i < diretorios.length; i++) {
      var dir = diretorios.slice(i, i + 1).join("");
      try {
        await Fs.mkdir({ path: "FolhaQRU", directory: dir, recursive: true }).catch(function() {});
        var opts = { path: "FolhaQRU/" + nomeArquivo, data: conteudo, directory: dir };
        if (!isBase64) opts.encoding = "utf8";
        await Fs.writeFile(opts);
        if (dir === "DOCUMENTS") return "Documentos/FolhaQRU/" + nomeArquivo;
        if (dir === "EXTERNAL") return "Android/data/br.gov.sp.pm.folhaqru/files/FolhaQRU/" + nomeArquivo;
        return "Pasta interna do App/FolhaQRU/" + nomeArquivo;
      } catch (errDir) {}
    }
    return false;
  } catch (e) {
    alert("Erro ao salvar arquivo: " + (e.message || e));
    return false;
  }
}

async function abrirModalKmFin() {
  if (isModoRelatorio()) {
    stopGps();
    var lines = $("txt-body").value.trim().split(NL), prevEnd = "   ";
    for (var i = lines.length - 1; i >= 0; i--) {
      var times = extractTimes(lines.slice(i, i + 1).join("").replace("-", " ").replace(",", " "));
      if (times.length > 0) { prevEnd = times.slice(-1).join(""); break; }
    }
    addItem("Das " + prevEnd + " às    - Pela base, preenchimento de RSO, desequipagem da viatura e encerramento do serviço.");
    var hoje = getToday();
    var textoFinal = $("txt-body").value;
    var list = JSON.parse(sGet("qru_saved") || "[]");
    list.unshift({ data: "Relatório - " + hoje, text: textoFinal });
    sSet("qru_saved", JSON.stringify(list));
    sDel("qru_draft");
    var caminhoSalvo = await salvarNaPastaAndroid("Relatorio_" + hoje.split("/").join("-") + ".txt", textoFinal, false);
    limparCampos();
    alert(caminhoSalvo ? "Relatório encerrado e salvo em:\n" + caminhoSalvo : "Relatório encerrado e salvo no app!");
    voltarInicio();
  } else {
    $("modal-kmi-info").textContent = "KM Inicial informado: " + ($("f-kmi").value.trim() || "não preenchido");
    $("modal-kmf-input").value = $("f-kmf").value.trim();
    $("modal-km").style.display = "flex";
  }
}

function confirmarEncerramento() {
  var kmf = $("modal-kmf-input").value.trim();
  if (kmf !== "") { $("f-kmf").value = kmf; calcKm(); }
  refreshPreview(); $("modal-km").style.display = "none"; encerrarRelatorio();
}

async function encerrarRelatorio() {
  stopGps(); formatHourInput();
  var dtCab = $("f-data").value.trim() || getToday();
  var lines = $("txt-body").value.trim().split(NL), prevEnd = "   ";
  for (var i = lines.length - 1; i >= 0; i--) {
    var times = extractTimes(lines.slice(i, i + 1).join("").replace("-", " ").replace(",", " "));
    if (times.length > 0) { prevEnd = times.slice(-1).join(""); break; }
  }
  var hCab = extractTimes($("f-hora").value), fimServ = hCab.length > 0 ? hCab.slice(-1).join("") : "   ";
  addItem("Das " + prevEnd + " às " + fimServ + " - Pela base, preenchimento de RSO, desequipagem da viatura e encerramento do serviço.");
  var textoFinal = getFullText();
  var list = JSON.parse(sGet("qru_saved") || "[]");
  list.unshift({ data: "Folha de QRU - " + dtCab, text: textoFinal });
  sSet("qru_saved", JSON.stringify(list));
  sDel("qru_draft");
  var caminhoSalvo = await salvarNaPastaAndroid("Folha_de_QRU_" + dtCab.split("/").join("-") + ".txt", textoFinal, false);
  limparCampos();
  alert(caminhoSalvo ? "Relatório encerrado e salvo em:\n" + caminhoSalvo : "Relatório encerrado e salvo no app!");
  voltarInicio();
}
function getFullText() {
  if (isModoRelatorio()) return $("txt-body").value;
  var doc = $("f-doc").value.trim().toUpperCase();
  var esp = Math.max(0, Math.floor((42 - doc.length) / 2));
  var docCent = " ".repeat(esp) + doc;
  return "Polícia Militar do Estado de São Paulo" + NL + $("out-uni").value + NL + NL + docCent + NL + $("out-hdr").innerText + NL + NL + NL + $("txt-body").value;
}

function enviarWpp(texto) {
  window.open("https://whatsapp.com" + encodeURIComponent(texto), "_blank");
}

function sendWhats() { enviarWpp(getFullText()); }

async function exportTxt() {
  var txt = getFullText();
  var dt = ($("f-data").value.trim() || getToday()).split("/").join("-");
  var nome = (isModoRelatorio() ? "Relatorio_" : "Folha_de_QRU_") + dt + ".txt";
  var caminhoSalvo = await salvarNaPastaAndroid(nome, txt, false);
  if (caminhoSalvo) {
    alert("Arquivo salvo em:\n" + caminhoSalvo);
    return;
  }
  if (navigator.share) {
    try {
      var f = new File(new Array(txt), nome, { type: "text/plain;charset=utf-8" });
      if (navigator.canShare && navigator.canShare({ files: new Array(f) })) {
        await navigator.share({ title: nome, text: txt, files: new Array(f) });
        return;
      }
      await navigator.share({ title: nome, text: txt });
      return;
    } catch (e) { if (e.name === "AbortError") return; }
  }
  var blob = new Blob(new Array(txt), { type: "text/plain;charset=utf-8" }), a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = nome; a.click();
}

function abrirCameraQualificacao() {
  var inp = $("cam-input");
  inp.value = "";
  inp.click();
}

function formatarRgTexto(raw) {
  var v = (raw || "").trim();
  if (!v) return "";
  var limpo = v.replace(/[^0-9a-zA-Z]/g, "").toUpperCase();
  if (limpo.length === 9 && /^[0-9]{8}[0-9X]$/.test(limpo)) {
    return limpo.slice(0, 2) + "." + limpo.slice(2, 5) + "." + limpo.slice(5, 8) + "-" + limpo.slice(8, 9);
  }
  return v;
}

function formatarRgQual() {
  var el = $("q-rg");
  el.value = formatarRgTexto(el.value);
}

function formatarDataQual(idCampo) {
  var el = $(idCampo);
  var v = el.value.trim();
  if (!v) return;
  var nums = v.replace(/[^0-9]/g, "");
  if (nums.length === 8) {
    el.value = nums.slice(0, 2) + "/" + nums.slice(2, 4) + "/" + nums.slice(4, 8);
  }
}

function onFotoCapturada(e) {
  var f = e.target.files ? e.target.files.item(0) : null;
  if (!f) return;
  var r = new FileReader();
  r.onload = function(ev) {
    fotoQualBase64 = ev.target.result;
    fotoQualFinalBase64 = "";
    $("qual-thumb").src = fotoQualBase64;
    $("qual-thumb").style.display = "block";
    $("qual-result-box").style.display = "none";
    if (!$("q-data").value.trim()) {
      $("q-data").value = getToday();
    }
    mostrarTela("qual-screen");
  };
  r.readAsDataURL(f);
}

function retanguloArredondado(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function desenharCampoPlaca(ctx, lbl, val, x, y, wColuna, fontLbl, fontVal) {
  ctx.fillStyle = "#000000";
  ctx.font = "bold " + fontLbl + "px Arial";
  ctx.fillText(lbl, x, y);
  var wLbl = ctx.measureText(lbl + " ").width;

  ctx.beginPath();
  ctx.moveTo(x + wLbl, y + 3);
  ctx.lineTo(x + wColuna, y + 3);
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  if (val) {
    ctx.font = "bold " + fontVal + "px Arial";
    ctx.fillText(val, x + wLbl + 4, y, wColuna - wLbl - 6);
  }
}

function gerarPlacaQualificacao() {
  if (!fotoQualBase64) return alert("Tire uma foto primeiro.");
  formatarRgQual();
  formatarDataQual("q-data");
  formatarDataQual("q-dtn");

  var img = new Image();
  img.onload = function() {
    var largura = img.width;
    var altura = img.height;
    if (largura > 1280) {
      var escala = 1280 / largura;
      largura = 1280;
      altura = Math.round(img.height * escala);
    }

    var canvas = document.createElement("canvas");
    canvas.width = largura;
    canvas.height = altura;
    var ctx = canvas.getContext("2d");

    ctx.drawImage(img, 0, 0, largura, altura);

    var margemExt = Math.round(largura * 0.015);
    var placaW = largura - (margemExt * 2);
    var padX = Math.round(placaW * 0.03);
    var innerW = placaW - (padX * 2);

    var fontTitulo = Math.max(24, Math.round(largura * 0.042));
    var fontLbl = Math.max(11, Math.round(largura * 0.016));
    var fontVal = Math.max(15, Math.round(largura * 0.023));
    var rowGap = Math.round(fontVal * 1.65);

    var placaH = Math.round(fontTitulo * 1.8) + (7 * rowGap) + Math.round(padX * 1.2);
    var placaX = margemExt;
    var placaY = altura - placaH - margemExt;
    if (placaY < 10) placaY = 10;

    ctx.save();
    retanguloArredondado(ctx, placaX, placaY, placaW, placaH, Math.round(largura * 0.03));
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#94a3b8";
    ctx.stroke();
    ctx.restore();

    var y = placaY + Math.round(fontTitulo * 1.15);
    var batalhao = $("q-uni").value.trim().toUpperCase();
    if (batalhao) {
      ctx.fillStyle = "#000000";
      ctx.font = "bold " + fontTitulo + "px Arial";
      ctx.textAlign = "center";
      ctx.fillText(batalhao, placaX + (placaW / 2), y, innerW);
    }

    ctx.textAlign = "left";
    var x0 = placaX + padX;
    var gapCol = Math.round(innerW * 0.02);
    y += Math.round(fontTitulo * 0.85);

    desenharCampoPlaca(ctx, "NOME:", $("q-nome").value.trim().toUpperCase(), x0, y, innerW, fontLbl, fontVal);
    y += rowGap;

    desenharCampoPlaca(ctx, "FILIAÇÃO:", $("q-filiacao").value.trim().toUpperCase(), x0, y, innerW, fontLbl, fontVal);
    y += rowGap;

    var wRg = Math.round(innerW * 0.48);
    var wVulgo = innerW - wRg - gapCol;
    desenharCampoPlaca(ctx, "RG:", $("q-rg").value.trim(), x0, y, wRg, fontLbl, fontVal);
    desenharCampoPlaca(ctx, "VULGO:", $("q-vulgo").value.trim(), x0 + wRg + gapCol, y, wVulgo, fontLbl, fontVal);
    y += rowGap;

    var wData = Math.round(innerW * 0.25);
    var wArt = Math.round(innerW * 0.21);
    var wDtn = Math.round(innerW * 0.26);
    var wDp = innerW - wData - wArt - wDtn - (gapCol * 3);
    var cx = x0;
    desenharCampoPlaca(ctx, "DATA:", $("q-data").value.trim(), cx, y, wData, fontLbl, fontVal);
    cx += wData + gapCol;
    desenharCampoPlaca(ctx, "ARTIGO:", $("q-artigo").value.trim(), cx, y, wArt, fontLbl, fontVal);
    cx += wArt + gapCol;
    desenharCampoPlaca(ctx, "DTN:", $("q-dtn").value.trim(), cx, y, wDtn, fontLbl, fontVal);
    cx += wDtn + gapCol;
    desenharCampoPlaca(ctx, "DP:", $("q-dp").value.trim().toUpperCase(), cx, y, wDp, fontLbl, fontVal);
    y += rowGap;

    var wCid = Math.round(innerW * 0.44);
    var wBopm = Math.round(innerW * 0.25);
    var wBopc = innerW - wCid - wBopm - (gapCol * 2);
    cx = x0;
    desenharCampoPlaca(ctx, "CIDADE:", $("q-cidade").value.trim().toUpperCase(), cx, y, wCid, fontLbl, fontVal);
    cx += wCid + gapCol;
    desenharCampoPlaca(ctx, "BOPM:", $("q-bopm").value.trim().toUpperCase(), cx, y, wBopm, fontLbl, fontVal);
    cx += wBopm + gapCol;
    desenharCampoPlaca(ctx, "BOPC:", $("q-bopc").value.trim().toUpperCase(), cx, y, wBopc, fontLbl, fontVal);
    y += rowGap;

    desenharCampoPlaca(ctx, "LOCALIDADE QUE ATUA:", $("q-local").value.trim().toUpperCase(), x0, y, innerW, fontLbl, fontVal);
    y += rowGap;

    desenharCampoPlaca(ctx, "OBS.:", $("q-obs").value.trim().toUpperCase(), x0, y, innerW, fontLbl, fontVal);

    fotoQualFinalBase64 = canvas.toDataURL("image/jpeg", 0.92);
    $("qual-final-img").src = fotoQualFinalBase64;
    $("qual-result-box").style.display = "block";
    $("qual-result-box").scrollIntoView({ behavior: "smooth" });
  };
  img.src = fotoQualBase64;
}
async function salvarFotoQualificacao() {
  if (!fotoQualFinalBase64) return alert("Gere a foto com placa primeiro.");
  var nomeBase = ($("q-nome").value.trim() || "Qualificacao").replace(/[^a-zA-Z0-9_-]/g, "_");
  var dt = ($("q-data").value.trim() || getToday()).split("/").join("-");
  var nomeArq = nomeBase + "_" + dt + ".jpg";
  var base64Puro = fotoQualFinalBase64.split(",").pop();

  var caminhoSalvo = await salvarNaPastaAndroid(nomeArq, base64Puro, true);
  if (caminhoSalvo) {
    alert("Foto salva com sucesso em:\n" + caminhoSalvo);
  } else {
    alert("Não foi possível gravar diretamente na pasta do Android. Use o botão WhatsApp / Compartilhar para salvar na Galeria.");
  }
}

async function compartilharQualificacao() {
  if (!fotoQualFinalBase64) return alert("Gere a foto com placa primeiro.");
  var nomeBase = ($("q-nome").value.trim() || "Qualificacao").replace(/[^a-zA-Z0-9_-]/g, "_");
  var nomeArq = nomeBase + ".jpg";
  var base64Puro = fotoQualFinalBase64.split(",").pop();

  var Fs = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem;
  var Share = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Share;

  if (Fs && Share) {
    try {
      var resFile = await Fs.writeFile({
        path: nomeArq,
        data: base64Puro,
        directory: "CACHE"
      });
      await Share.share({
        title: "Qualificação - " + ($("q-nome").value.trim() || ""),
        url: resFile.uri,
        dialogTitle: "Enviar Foto de Qualificação"
      });
      return;
    } catch (e) {
      alert("Aviso ao compartilhar: " + (e.message || e));
    }
  }

  try {
    var res = await fetch(fotoQualFinalBase64);
    var blob = await res.blob();
    var file = new File(new Array(blob), nomeArq, { type: "image/jpeg" });
    if (navigator.canShare && navigator.canShare({ files: new Array(file) })) {
      await navigator.share({
        title: "Qualificação - " + ($("q-nome").value.trim() || ""),
        files: new Array(file)
      });
      return;
    }
  } catch (e) {}

  salvarFotoQualificacao();
}

function adicionarEnvolvido(tipo) {
  resenhaEnvolvidos.push({ tipo: tipo, nome: "", rg: "" });
  renderizarEnvolvidosResenha();
  atualizarResenha();
}

function removerEnvolvido(idx) {
  resenhaEnvolvidos.splice(idx, 1);
  renderizarEnvolvidosResenha();
  atualizarResenha();
}

function onEnvolvidoInput(idx, campo, valor) {
  if (resenhaEnvolvidos[idx]) {
    resenhaEnvolvidos[idx][campo] = valor;
    atualizarResenha();
  }
}

function onEnvolvidoRgBlur(idx, inputEl) {
  if (resenhaEnvolvidos[idx]) {
    var fmt = formatarRgTexto(inputEl.value);
    inputEl.value = fmt;
    resenhaEnvolvidos[idx].rg = fmt;
    atualizarResenha();
  }
}

function renderizarEnvolvidosResenha() {
  var box = $("r-envolvidos-box");
  if (!box) return;
  var html = "";
  for (var i = 0; i < resenhaEnvolvidos.length; i++) {
    var env = resenhaEnvolvidos[i];
    var nomeEsc = env.nome.replace(/"/g, "&quot;");
    var rgEsc = env.rg.replace(/"/g, "&quot;");
    html += '<div class="env-box">' +
      '<div class="row" style="margin-bottom:6px;">' +
        '<span class="dot"></span><span class="lbl">' + env.tipo + ':</span>' +
        '<input type="text" value="' + nomeEsc + '" oninput="onEnvolvidoInput(' + i + ', \'nome\', this.value)">' +
        '<button type="button" class="btn-small" style="background:#dc2626;border:none;padding:6px 10px;" onclick="removerEnvolvido(' + i + ')">X</button>' +
      '</div>' +
      '<div class="row" style="margin-bottom:0;">' +
        '<span class="dot"></span><span class="lbl">RG:</span>' +
        '<input type="text" value="' + rgEsc + '" placeholder="xx.xxx.xxx-x" oninput="onEnvolvidoInput(' + i + ', \'rg\', this.value)" onblur="onEnvolvidoRgBlur(' + i + ', this)">' +
      '</div>' +
    '</div>';
  }
  box.innerHTML = html;
}

function formatarDataHoraMilitar(dtRaw, hrRaw) {
  var dt = (dtRaw || "").trim().toUpperCase();
  var hr = (hrRaw || "").trim().toUpperCase();
  if (!dt && !hr) return "";

  var meses = new Array("JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ");
  var dia = "", mesSigla = "", ano2 = "";

  if (dt) {
    var dtLimpo = dt.replace(/[^0-9A-Z]/g, "");
    var matchMes = dtLimpo.match(/^([0-9]{1,2})([A-Z]{3})([0-9]{2,4})$/);
    if (matchMes) {
      dia = two(matchMes[1]);
      mesSigla = matchMes[2];
      ano2 = matchMes[3].slice(-2);
    } else {
      var numsDt = dt.replace(/[^0-9]/g, "");
      if (numsDt.length === 8) {
        dia = numsDt.slice(0, 2);
        var mIdx = parseInt(numsDt.slice(2, 4), 10) - 1;
        mesSigla = (mIdx >= 0 && mIdx < 12) ? meses[mIdx] : numsDt.slice(2, 4);
        ano2 = numsDt.slice(6, 8);
      } else if (numsDt.length === 6) {
        dia = numsDt.slice(0, 2);
        var mIdx2 = parseInt(numsDt.slice(2, 4), 10) - 1;
        mesSigla = (mIdx2 >= 0 && mIdx2 < 12) ? meses[mIdx2] : numsDt.slice(2, 4);
        ano2 = numsDt.slice(4, 6);
      } else {
        return (dt + " " + hr).trim();
      }
    }
  }

  var hhmm = "";
  if (hr) {
    var numsHr = hr.replace(/[^0-9]/g, "");
    if (numsHr.length >= 4) {
      hhmm = numsHr.slice(0, 4);
    } else if (numsHr.length === 3) {
      hhmm = "0" + numsHr;
    } else if (numsHr.length === 2 || numsHr.length === 1) {
      hhmm = two(numsHr) + "00";
    } else {
      hhmm = hr;
    }
  }

  if (dia && mesSigla && ano2) {
    return dia + hhmm + mesSigla + ano2;
  }
  return (dt + " " + hr).trim();
}
function gerarDadosResenha() {
  var sec = $("r-sec").value.trim();
  var inst = $("r-inst").value.trim();
  var bat = $("r-bat").value.trim();
  var cia = $("r-cia").value.trim();
  var vtr = $("r-vtr").value.trim();

  var cmte = $("r-cmte").value.trim();
  var mot = $("r-mot").value.trim();
  var seg1 = $("r-seg1").value.trim();
  var seg2 = $("r-seg2").value.trim();
  var seg3 = $("r-seg3").value.trim();

  var nat = $("r-nat").value.trim();
  var dthr = formatarDataHoraMilitar($("r-dt").value, $("r-hr").value);
  var local = $("r-local").value.trim();
  var area = $("r-area").value.trim();
  var bopm = $("r-bopm").value.trim();
  var bopc = $("r-bopc").value.trim();
  var dp = $("r-dp").value.trim();
  var del = $("r-del").value.trim();
  var art = $("r-art").value.trim();
  var aprRaw = $("r-apr").value.trim();
  var hist = $("r-hist").value.trim();

  var html = "";
  var txtWpp = "";
  var txtPuro = "";

  function addTopo(val) {
    if (!val) return;
    html += '<div class="res-center">' + val + '</div>';
    txtWpp += "*" + val + "*" + NL;
    txtPuro += val + NL;
  }

  function addCampo(rotulo, val) {
    if (!val) return;
    html += '<div class="res-line"><b>' + rotulo + ':</b> ' + val + '</div>';
    txtWpp += "*" + rotulo + ":* " + val + NL;
    txtPuro += rotulo + ": " + val + NL;
  }

  function addEspaco() {
    html += '<div class="res-gap"></div>';
    txtWpp += NL;
    txtPuro += NL;
  }

  addTopo(sec);
  addTopo(inst);
  addTopo(bat);

  html += '<div class="res-title">RESENHA DE OCORRÊNCIA</div>';
  txtWpp += NL + "*RESENHA DE OCORRÊNCIA*" + NL + NL;
  txtPuro += NL + "RESENHA DE OCORRÊNCIA" + NL + NL;

  if (cia) {
    addTopo(cia);
    if (vtr) addEspaco();
  }
  if (vtr) {
    addTopo(vtr);
  }

  var temEquipe = (cmte || mot || seg1 || seg2 || seg3);
  if (temEquipe) {
    if (cia || vtr) addEspaco();
    addCampo("Cmt", cmte);
    addCampo("Mot", mot);
    addCampo("Seg", seg1);
    addCampo("Seg", seg2);
    addCampo("Seg", seg3);
  }

  var temDadosOcor = (nat || dthr || local || area || bopm || bopc || dp || del);
  if (temDadosOcor) {
    if (cia || vtr || temEquipe) addEspaco();
    addCampo("Natureza", nat);
    addCampo("Data/Hora", dthr);
    addCampo("Local", local);
    addCampo("Área", area);
    addCampo("BOPM", bopm);
    addCampo("BOPC", bopc);
    addCampo("DP", dp);
    addCampo("Delegado", del);
  }

  var totInd = 0, totSind = 0;
  for (var i = 0; i < resenhaEnvolvidos.length; i++) {
    var e = resenhaEnvolvidos[i];
    if (e.nome.trim() !== "" || e.rg.trim() !== "") {
      if (e.tipo === "Indiciado") totInd++;
      else totSind++;
    }
  }

  var temEnvolvidos = (totInd > 0 || totSind > 0);
  if (temEnvolvidos) {
    if (del || temDadosOcor) addEspaco();
    var cInd = 0, cSind = 0;
    for (var j = 0; j < resenhaEnvolvidos.length; j++) {
      var env = resenhaEnvolvidos[j];
      var nm = env.nome.trim();
      var rgVal = formatarRgTexto(env.rg);
      if (nm !== "" || rgVal !== "") {
        var lblEnv = env.tipo;
        if (env.tipo === "Indiciado") {
          cInd++;
          if (totInd > 1) lblEnv = "Indiciado " + cInd;
        } else {
          cSind++;
          if (totSind > 1) lblEnv = "Sindicado " + cSind;
        }
        if (nm) addCampo(lblEnv, nm);
        if (rgVal) addCampo("RG", rgVal);
      }
    }
  }

  if (art) {
    addCampo("Artigo", art);
  }

  if (aprRaw) {
    var itensApr = aprRaw.split(",").map(function(x) { return x.trim(); }).filter(function(x) { return x !== ""; });
    if (itensApr.length > 0) {
      if (art || temEnvolvidos || temDadosOcor) addEspaco();
      html += '<div class="res-line"><b>Apreensões:</b></div>';
      txtWpp += "*Apreensões:*" + NL;
      txtPuro += "Apreensões:" + NL;
      for (var k = 0; k < itensApr.length; k++) {
        html += '<div class="res-line">• ' + itensApr[k] + '</div>';
        txtWpp += "• " + itensApr[k] + NL;
        txtPuro += "• " + itensApr[k] + NL;
      }
    }
  }

  if (hist) {
    addEspaco();
    html += '<div class="res-line"><b>Histórico:</b></div>';
    txtWpp += "*Histórico:*" + NL;
    txtPuro += "Histórico:" + NL;
    addEspaco();
    var histHtml = hist.replace(/\n/g, "<br>");
    html += '<div class="res-line">' + histHtml + '</div>';
    txtWpp += hist + NL;
    txtPuro += hist + NL;
  }

  return { html: html, wpp: txtWpp.trim(), puro: txtPuro.trim() };
}

function atualizarResenha() {
  var box = $("res-preview-box");
  if (!box) return;
  var res = gerarDadosResenha();
  box.innerHTML = res.html;
}
function limparResenha() {
  var ids = new Array("r-sec", "r-inst", "r-bat", "r-cia", "r-vtr", "r-cmte", "r-mot", "r-seg1", "r-seg2", "r-seg3", "r-nat", "r-dt", "r-hr", "r-local", "r-area", "r-bopm", "r-bopc", "r-dp", "r-del", "r-art", "r-apr", "r-hist");
  for (var i = 0; i < ids.length; i++) {
    var el = $(ids[i]);
    if (el) el.value = "";
  }
  resenhaEnvolvidos = new Array({ tipo: "Indiciado", nome: "", rg: "" });
  renderizarEnvolvidosResenha();
  atualizarResenha();
}

function enviarResenhaWpp() {
  var res = gerarDadosResenha();
  if (!res.wpp) return alert("Preencha os dados da resenha primeiro.");
  enviarWpp(res.wpp);
}

function copiarResenha() {
  var res = gerarDadosResenha();
  if (!res.puro) return alert("Preencha os dados da resenha primeiro.");
  navigator.clipboard.writeText(res.puro);
  alert("Resenha copiada!");
}

function salvarResenhaApp() {
  var res = gerarDadosResenha();
  if (!res.puro) return alert("Preencha os dados da resenha primeiro.");
  var nat = $("r-nat").value.trim() || "Ocorrência";
  var dt = getToday();
  var list = JSON.parse(sGet("qru_saved") || "[]");
  list.unshift({ data: "Resenha (" + nat + ") - " + dt, text: res.puro });
  sSet("qru_saved", JSON.stringify(list));
  updateCount();
  alert("Resenha salva nos relatórios do app!");
}

async function exportarResenhaTxt() {
  var res = gerarDadosResenha();
  if (!res.puro) return alert("Preencha os dados da resenha primeiro.");
  var bopm = ($("r-bopm").value.trim() || getToday()).replace(/[^a-zA-Z0-9_-]/g, "_");
  var nomeArq = "Resenha_" + bopm + ".txt";
  var caminho = await salvarNaPastaAndroid(nomeArq, res.puro, false);
  if (caminho) {
    alert("Resenha salva em:\n" + caminho);
  } else {
    var blob = new Blob(new Array(res.puro), { type: "text/plain;charset=utf-8" }), a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = nomeArq; a.click();
  }
}

function saveAll() {
  sSet("qru_draft", JSON.stringify({
    doc: $("f-doc").value, uni: $("f-uni").value, outUni: $("out-uni").value, data: $("f-data").value, hora: $("f-hora").value,
    cia: $("f-cia").value, pel: $("f-pel").value, vtr: $("f-vtr").value, kmi: $("f-kmi").value, kmf: $("f-kmf").value,
    kmp: $("f-kmp").value, cmt: $("f-cmt").value, mot: $("f-mot").value, h3: $("f-h3").value, h4: $("f-h4").value, h5: $("f-h5").value, body: $("txt-body").value
  }));
}

function loadDraft() {
  var raw = sGet("qru_draft");
  if (!raw) { $("f-data").value = getToday(); $("txt-body").value = ITEM1; return; }
  var d = JSON.parse(raw);
  $("f-doc").value = d.doc || "FOLHA DE QRU"; $("f-uni").value = d.uni || ""; $("out-uni").value = d.outUni || "Batalhão de Ações Especiais de Polícia";
  $("f-data").value = (d.data && d.data.trim()) ? d.data : getToday(); $("f-hora").value = d.hora || ""; $("f-cia").value = d.cia || "";
  $("f-pel").value = d.pel || ""; $("f-vtr").value = d.vtr || ""; $("f-kmi").value = d.kmi || ""; $("f-kmf").value = d.kmf || "";
  $("f-kmp").value = d.kmp || ""; $("f-cmt").value = d.cmt || ""; $("f-mot").value = d.mot || ""; $("f-h3").value = d.h3 || "";
  $("f-h4").value = d.h4 || ""; $("f-h5").value = d.h5 || ""; $("txt-body").value = d.body || ITEM1;
}

function updateCount() { $("cnt-saved").textContent = JSON.parse(sGet("qru_saved") || "[]").length; }

function renderSaved() {
  var list = JSON.parse(sGet("qru_saved") || "[]"), box = $("saved-box");
  if (!list.length) { box.innerHTML = "<div class='card'>Nenhum relatório salvo.</div>"; return; }
  box.innerHTML = list.map(function(it, idx) {
    return '<div class="sv-item"><span class="sv-dt" onclick="openSaved(' + idx + ')">' + it.data + '</span><button type="button" class="btn-small" onclick="delSaved(' + idx + ')">Excluir</button></div>';
  }).join("");
}

function openSaved(i) {
  var list = JSON.parse(sGet("qru_saved") || "[]"), item = list.slice(i, i + 1).pop();
  if (!item) return;
  $("saved-full-txt").textContent = item.text; $("saved-detail").style.display = "block";
  $("btn-sv-wpp").onclick = function() { enviarWpp($("saved-full-txt").textContent); };
  $("btn-sv-cpy").onclick = function() { navigator.clipboard.writeText(item.text); alert("Copiado!"); };
}

function delSaved(i) { var list = JSON.parse(sGet("qru_saved") || "[]"); list.splice(i, 1); sSet("qru_saved", JSON.stringify(list)); renderSaved(); updateCount(); }

(function init() {
  var ft = document.querySelector(".footer-text");
  if (ft) {
    var box = document.createElement("div");
    box.className = "contact-box";
    var tel = "5513974031785";
    box.innerHTML = '<div class="contact-label">Dúvidas / Críticas / Sugestões</div>' +
      '<a href="https://wa.me' + tel + '" target="_blank" class="whatsapp-link">' +
      '<svg viewBox="0 0 32 32"><path d="M16.004 3.2c-7.06 0-12.8 5.74-12.8 12.8 0 2.256.59 4.458 1.71 6.398L3.1 29.01l6.784-1.78a12.74 12.74 0 0 0 6.12 1.56h.006c7.058 0 12.798-5.74 12.798-12.8 0-3.42-1.332-6.634-3.75-9.052A12.714 12.714 0 0 0 16.004 3.2zm0 23.43h-.004a10.61 10.61 0 0 1-5.41-1.482l-.388-.23-4.026 1.056 1.074-3.924-.252-.402a10.588 10.588 0 0 1-1.624-5.648c0-5.864 4.77-10.634 10.636-10.634 2.84 0 5.51 1.108 7.518 3.116a10.566 10.566 0 0 1 3.114 7.522c0 5.864-4.772 10.626-10.638 10.626zm5.834-7.964c-.32-.16-1.892-.934-2.186-1.04-.292-.106-.506-.16-.72.16-.212.32-.824 1.04-1.01 1.254-.186.212-.372.24-.692.08-.32-.16-1.35-.498-2.572-1.588-.95-.848-1.592-1.896-1.778-2.216-.186-.32-.02-.492.14-.652.144-.144.32-.374.48-.56.16-.186.212-.32.32-.534.106-.212.054-.4-.026-.56-.08-.16-.72-1.734-.986-2.374-.26-.624-.524-.54-.72-.55l-.614-.01c-.212 0-.56.08-.852.4-.292.32-1.118 1.094-1.118 2.666 0 1.574 1.146 3.094 1.306 3.308.16.212 2.254 3.442 5.462 4.826.762.33 1.358.526 1.822.674.766.244 1.462.21 2.014.128.614-.092 1.892-.774 2.158-1.52.266-.746.266-1.386.186-1.52-.08-.134-.292-.214-.612-.374z"/></svg></a>';
    ft.parentNode.insertBefore(box, ft);
  }

  atualizarFundo();
  loadEquipe();
  loadDraft();
  atualizarTelaCabecalho();
  if (!$("f-data").value.trim()) $("f-data").value = getToday();
  updateCount();

  document.addEventListener("visibilitychange", function() { if (document.hidden) saveAll(); });
  window.addEventListener("pagehide", saveAll);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function(regs) {
      for (var i = 0; i < regs.length; i++) {
        regs[i].unregister();
      }
    });
  }
  if (window.caches) {
    caches.keys().then(function(keys) {
      for (var i = 0; i < keys.length; i++) {
        caches.delete(keys[i]);
      }
    });
  }
})();
