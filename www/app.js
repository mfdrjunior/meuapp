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
var resenhaIndiciados = new Array({ nome: "", rg: "", artigo: "" });
var resenhaSindicados = new Array({ nome: "", rg: "", artigo: "" });
var mdipFeridos = new Array({ naoIdentificado: false, nome: "", rg: "", mae: "", criminal: "", obs: "" });

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
  $("mdip-screen").style.display = "none";
  $(telaId).style.display = "block";
  window.scrollTo(0, 0);
}

function voltarInicio() { saveAll(); updateCount(); mostrarTela("home-screen"); }
function abrirCabecalho() { if (!$("f-data").value.trim()) $("f-data").value = getToday(); atualizarTelaCabecalho(); mostrarTela("header-screen"); }
function editarCabecalho() { saveAll(); atualizarTelaCabecalho(); mostrarTela("header-screen"); }
function abrirSalvos() { $("saved-detail").style.display = "none"; renderSaved(); mostrarTela("saved-screen"); }
function abrirResenha() { renderizarIndiciadosResenha(); renderizarSindicadosResenha(); atualizarResenha(); mostrarTela("resenha-screen"); }
function abrirMdip() { renderizarFeridosMdip(); atualizarMdip(); mostrarTela("mdip-screen"); }

function registrarTrabalhoSalvo(titulo, texto, imagemBase64) {
  if (!texto && !imagemBase64) return;
  var list = JSON.parse(sGet("qru_saved") || "[]");
  if (list.length > 0 && list.data === titulo && list.text === texto && (list.img || "") === (imagemBase64 || "")) {
    return;
  }
  var item = { data: titulo, text: texto || "" };
  if (imagemBase64) item.img = imagemBase64;
  list.unshift(item);
  sSet("qru_saved", JSON.stringify(list));
  updateCount();
}

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

function normalizarCidadesEAcentos(txt) {
  if (!txt) return "";
  var mapa = new Array(
    { re: /\bsao vicente\b/gi, rep: "São Vicente" },
    { re: /\bsantos\b/gi, rep: "Santos" },
    { re: /\bpedro de toledo\b/gi, rep: "Pedro de Toledo" },
    { re: /\bguaruja\b/gi, rep: "Guarujá" },
    { re: /\bcubatao\b/gi, rep: "Cubatão" },
    { re: /\bpraia grande\b/gi, rep: "Praia Grande" },
    { re: /\bmongagua\b/gi, rep: "Mongaguá" },
    { re: /\bitanhaem\b/gi, rep: "Itanhaém" },
    { re: /\bperuibe\b/gi, rep: "Peruíbe" },
    { re: /\bbertioga\b/gi, rep: "Bertioga" },
    { re: /\bsao paulo\b/gi, rep: "São Paulo" },
    { re: /\bsao sebastiao\b/gi, rep: "São Sebastião" },
    { re: /\bilhabela\b/gi, rep: "Ilhabela" },
    { re: /\bcaraguatatuba\b/gi, rep: "Caraguatatuba" },
    { re: /\bubatuba\b/gi, rep: "Ubatuba" },
    { re: /\bregistro\b/gi, rep: "Registro" },
    { re: /\bjacupiranga\b/gi, rep: "Jacupiranga" },
    { re: /\bcajati\b/gi, rep: "Cajati" },
    { re: /\bjuquia\b/gi, rep: "Juquiá" },
    { re: /\bmiracatu\b/gi, rep: "Miracatu" },
    { re: /\bitariri\b/gi, rep: "Itariri" },
    { re: /\biguape\b/gi, rep: "Iguape" },
    { re: /\bilha comprida\b/gi, rep: "Ilha Comprida" },
    { re: /\bcananeia\b/gi, rep: "Cananéia" },
    { re: /\bcatalao\b/gi, rep: "Catalão" },
    { re: /\bsao\b/gi, rep: "São" },
    { re: /\bjoao\b/gi, rep: "João" },
    { re: /\bjose\b/gi, rep: "José" },
    { re: /\bantonio\b/gi, rep: "Antônio" }
  );
  var res = txt;
  for (var i = 0; i < mapa.length; i++) {
    res = res.replace(mapa[i].re, mapa[i].rep);
  }
  return res;
}

function titleCase(s) {
  if (!s) return "";
  var str = String(s);
  var minusculas = new Array("de", "da", "do", "das", "dos", "e", "em", "na", "no", "nas", "nos");
  var base = str.trim().toLowerCase().split(" ").filter(function(x) { return x !== ""; }).map(function(w, idx) {
    if (w.indexOf("/") > -1) {
      var p = w.split("/");
      var p0 = p.slice(0, 1).join("");
      var p1 = p.slice(1, 2).join("");
      var left = p0.charAt(0).toUpperCase() + p0.slice(1);
      var right = p1.length <= 2 ? p1.toUpperCase() : (p1.charAt(0).toUpperCase() + p1.slice(1));
      return left + "/" + right;
    }
    if (idx > 0 && minusculas.indexOf(w) > -1) return w;
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join(" ");
  return normalizarCidadesEAcentos(base);
}

function formatarEnderecoCompleto(raw) {
  var v = (raw || "").trim();
  if (!v) return "";
  var limpo = v.replace(/,/g, " ").replace(/\s+-\s+/g, " ").replace(/\s+/g, " ").trim();
  var mApenasNum = limpo.match(/^(.+?)\s+([0-9]+[a-zA-Z0-9\-\/]*|s\/n)$/i);
  if (mApenasNum) {
    var logrSimples = titleCase(mApenasNum.slice(1, 2).join(""));
    var numSimples = mApenasNum.slice(2, 3).join("").toUpperCase();
    return logrSimples + ", " + (numSimples === "S/N" ? "s/n" : numSimples);
  }
  var m = limpo.match(/^(.+?)\s+([0-9]+[a-zA-Z0-9\-\/]*|s\/n)\s+(.+)$/i);
  if (m) {
    var m1 = m.slice(1, 2).join("");
    var m2 = m.slice(2, 3).join("");
    var m3 = m.slice(3, 4).join("");
    var logr = titleCase(m1);
    var num = m2.toUpperCase() === "S/N" ? "s/n" : m2.toUpperCase();
    var resto = m3.trim();
    var ufMatch = resto.match(/^(.*?)[\s\/\-]+(sp|rj|mg|pr|sc|rs|es|ba|go|df|ms|mt)$/i);
    var uf = "";
    if (ufMatch) {
      resto = ufMatch.slice(1, 2).join("").trim();
      uf = "/" + ufMatch.slice(2, 3).join("").toUpperCase();
    }
    var palavrasResto = resto.split(" ").filter(function(x) { return x !== ""; });
    if (palavrasResto.length >= 2) {
      var cidConhecidas2 = new Array("sao vicente", "são vicente", "praia grande", "ilha comprida", "sao paulo", "são paulo", "sao sebastiao", "são sebastião");
      var cidConhecidas3 = new Array("pedro de toledo");
      var lowerResto = resto.toLowerCase();
      var cidade = "", bairro = "";
      for (var c3 = 0; c3 < cidConhecidas3.length; c3++) {
        if (lowerResto.endsWith(cidConhecidas3[c3])) {
          cidade = titleCase(cidConhecidas3[c3]);
          bairro = titleCase(resto.slice(0, resto.length - cidConhecidas3[c3].length).trim());
          break;
        }
      }
      if (!cidade) {
        for (var c2 = 0; c2 < cidConhecidas2.length; c2++) {
          if (lowerResto.endsWith(cidConhecidas2[c2])) {
            cidade = titleCase(cidConhecidas2[c2]);
            bairro = titleCase(resto.slice(0, resto.length - cidConhecidas2[c2].length).trim());
            break;
          }
        }
      }
      if (!cidade) {
        cidade = titleCase(palavrasResto.pop());
        bairro = titleCase(palavrasResto.join(" "));
      }
      if (bairro && cidade) {
        return logr + ", " + num + " - " + bairro + " - " + cidade + uf;
      }
      return logr + ", " + num + " - " + (bairro || cidade) + uf;
    }
    return logr + ", " + num + " - " + titleCase(resto) + uf;
  }
  return normalizarCidadesEAcentos(titleCase(v));
}

}
}
function formatarTextoMilitar(raw) {
  var txt = (raw || "").trim();
  if (!txt) return "";
  txt = txt.replace(/\b([0-9]+)\s*[ªa]?\s*cia\s+(?:baep|aep)\b/gi, "$1ª Cia AEP");
  txt = txt.replace(/\b([0-9]+)\s*[ªa]?\s*cia\s+([0-9]+)\s*[°º]?\s*(?:bpm\/?i|i)\b/gi, "$1ª Cia - $2º BPM/I");
  txt = txt.replace(/\b([0-9]+)\s*[ªa]?\s*cia\s+([0-9]+)\s*[°º]?\s*(?:bpm\/?m|m)\b/gi, "$1ª Cia - $2º BPM/M");
  txt = txt.replace(/\b([0-9]+)\s*[ªa]?\s*cia\b/gi, "$1ª Cia");
  txt = txt.replace(/\b([0-9]+)\s*[°º]?\s*(?:bpm\/?i|i)\b/gi, "$1º BPM/I");
  txt = txt.replace(/\b([0-9]+)\s*[°º]?\s*(?:bpm\/?m|m)\b/gi, "$1º BPM/M");
  txt = txt.replace(/\b([0-9]+)\s*[°º]?\s*baep\b/gi, "$1º BAEP");
  txt = txt.replace(/\b([0-9]+)\s*[°º]?\s*bpchq\b/gi, "$1º BPChq");
  txt = txt.replace(/\b([0-9]+)\s*[°º]?\s*dp\b/gi, "$1º DP");
  txt = txt.replace(/\bdp\b/gi, "DP");
  txt = txt.replace(/\bcpj\b/gi, "CPJ");
  txt = txt.replace(/\b([a-zA-Z])-?([0-9]{4,5})\b/g, function(all, l, n) {
    return l.toUpperCase() + "-" + n;
  });
  txt = txt.replace(/\b()\s*[°º]?\s*(sgt|ten|sargento|tenente)\s*(?:pm\s+)?([a-zA-ZÀ-ÿ]+)/gi, function(all, n, g, nome) {
    return n + "° " + (g.toLowerCase().indexOf("ten") === 0 ? "Ten" : "Sgt") + " PM " + titleCase(nome);
  });
  txt = txt.replace(/\b(sd|soldado|cb|cabo|sgt|sargento|ten|tenente|cap|capit[aã]o|maj|major|cel|coronel|subten|asp)\s*(?:pm\s+)?([a-zA-ZÀ-ÿ]+)/gi, function(all, g, nome) {
    var gl = g.toLowerCase().replace(".", "");
    var gr = "Sd";
    if (gl.indexOf("cb") === 0 || gl.indexOf("cab") === 0) gr = "Cb";
    else if (gl.indexOf("sgt") === 0 || gl.indexOf("sar") === 0) gr = "Sgt";
    else if (gl.indexOf("ten") === 0) gr = "Ten";
    else if (gl.indexOf("cap") === 0) gr = "Cap";
    else if (gl.indexOf("maj") === 0) gr = "Maj";
    else if (gl.indexOf("cel") === 0 || gl.indexOf("cor") === 0) gr = "Cel";
    else if (gl.indexOf("sub") === 0) gr = "Subten";
    else if (gl.indexOf("asp") === 0) gr = "Asp";
    return gr + " PM " + titleCase(nome);
  });
  return normalizarCidadesEAcentos(txt);
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
  } else if (up.indexOf("BPMI") > -1 || up.indexOf("BPM/I") > -1 || (num !== "" && semNum === "I")) {
    res = (num ? num + "º " : "") + "Batalhão de Polícia Militar do Interior";
  } else if (up.indexOf("BPMM") > -1 || up.indexOf("BPM/M") > -1 || (num !== "" && semNum === "M")) {
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

function formatarSiglaBatalhaoCurta(raw) {
  var v = (raw || "").trim();
  if (!v) return "";
  var up = v.toUpperCase();
  var m = up.match(/^([0-9]+)\s*[°º]?\s*(BAEP|BPMI|BPM\/I|I|BPMM|BPM\/M|M|BPCHQ|CAEP|PAEP)(.*)$/);
  if (m) {
    var num = m.slice(1, 2).join("");
    var tipo = m.slice(2, 3).join("");
    var restoRaw = m.slice(3, 4).join("").trim();
    var resto = restoRaw ? titleCase(restoRaw) : "";
    if (tipo === "BPMI" || tipo === "I") tipo = "BPM/I";
    if (tipo === "BPMM" || tipo === "M") tipo = "BPM/M";
    if (tipo === "BPCHQ") tipo = "BPChq";
    return num + "º " + tipo + (resto ? " " + resto : "");
  }
  return formatarTextoMilitar(v);
}

}

function formatarDpTexto(raw) {
  var v = (raw || "").trim();
  if (!v) return "";
  if (isNum(v)) return v + "º DP";
  var txt = formatarTextoMilitar(v);
  var partes = txt.split(" ");
  for (var i = 0; i < partes.length; i++) {
    var p = partes[i];
    if (p !== "DP" && p !== "CPJ" && p.indexOf("º") === -1 && p.indexOf("ª") === -1 && p.indexOf("/") === -1 && p !== "BPM/I" && p !== "BPM/M" && p !== "BAEP") {
      partes[i] = titleCase(p);
    }
  }
  return normalizarCidadesEAcentos(partes.join(" "));
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

function formatarHoraUnica(raw) {
  var v = (raw || "").trim();
  if (!v) return "";
  if (/^[0-9]{4}$/.test(v)) return v.slice(0, 2) + ":" + v.slice(2, 4);
  if (/^[0-9]{3}$/.test(v)) return "0" + v.slice(0, 1) + ":" + v.slice(1, 3);
  if (/^[0-9]{1,2}$/.test(v)) return two(v) + ":00";
  if (/^[0-9]{1,2}:[0-9]{2}$/.test(v)) {
    var p = v.split(":");
    return two(p) + ":" + p;
  }
  return v;
}

function extractTimes(str) {
  var parts = str.split(" "), found = new Array();
  for (var i = 0; i < parts.length; i++) {
    var p = parts.slice(i, i + 1).join("").trim();
    if (isNum(p) && p.length <= 2) found.push(two(p) + ":00");
    else if (isNum(p) && p.length === 3) found.push("0" + p.slice(0, 1) + ":" + p.slice(1, 3));
    else if (isNum(p) && p.length === 4) found.push(p.slice(0, 2) + ":" + p.slice(2, 4));
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
  else if (v) { $("f-cia").value = formatarTextoMilitar(v); saveAll(); }
}

function formatPelInput() {
  var v = $("f-pel").value.trim();
  if (isNum(v)) { $("f-pel").value = v + "°"; saveAll(); }
}

function formatVtrTexto(raw) {
  var v = (raw || "").trim();
  if (!v) return "";
  var primeira = v.charAt(0).toUpperCase();
  if (primeira >= "A" && primeira <= "Z") {
    var resto = v.slice(1).trim();
    if (resto.charAt(0) === "-") resto = resto.slice(1).trim();
    return resto ? primeira + "-" + resto : primeira;
  }
  return v;
}

function formatVtrInput() {
  var el = $("f-vtr");
  if (!el || !el.value.trim()) return;
  el.value = formatVtrTexto(el.value);
  saveAll();
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
function httpGetJson(url, paramsObj) {
  var CapHttp = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorHttp;
  if (CapHttp && CapHttp.get) {
    var req = {
      url: url,
      headers: {
        "Accept": "application/json",
        "User-Agent": "FolhaDeQRU-Android/1.0"
      }
    };
    if (paramsObj) req.params = paramsObj;
    return CapHttp.get(req).then(function(res) {
      if (res.status >= 200 && res.status < 300) {
        return typeof res.data === "string" ? JSON.parse(res.data) : res.data;
      }
      throw new Error("Status " + res.status);
    });
  }
  var fullUrl = url;
  if (paramsObj) {
    var qs = Object.keys(paramsObj).map(function(k) {
      return encodeURIComponent(k) + "=" + encodeURIComponent(paramsObj[k]);
    }).join("&");
    fullUrl = url + "?" + qs;
  }
  return fetch(fullUrl).then(function(r) {
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  });
}

function consultarBairroApi(lat, lon) {
  var latStr = String(lat);
  var lonStr = String(lon);
  return httpGetJson("https://bigdatacloud.net", {
    latitude: latStr,
    longitude: lonStr,
    localityLanguage: "pt"
  })
    .then(function(j) {
      var bairro = j.locality || "";
      var cidade = j.city || "";
      if (!bairro && j.localityInfo && j.localityInfo.administrative) {
        var adm = j.localityInfo.administrative;
        if (adm.length > 0) bairro = adm[adm.length - 1].name || "";
      }
      if (bairro) return { bairro: bairro, cidade: cidade };
      throw new Error("Sem bairro");
    })
    .catch(function() {
      return httpGetJson("https://komoot.io", {
        lon: lonStr,
        lat: latStr
      }).then(function(j2) {
        var feat = j2 && j2.features && j2.features.length > 0 ? j2.features : null;
        var props = feat ? feat.properties : {};
        var b2 = props.district || props.suburb || props.neighbourhood || props.locality || props.name || "";
        var c2 = props.city || props.town || props.county || "";
        if (b2) return { bairro: b2, cidade: c2 };
        throw new Error("Sem bairro Photon");
      });
    })
    .catch(function() {
      return httpGetJson("https://openstreetmap.org", {
        format: "json",
        lat: latStr,
        lon: lonStr,
        "accept-language": "pt-BR"
      }).then(function(j3) {
        var b3 = (j3.address && (j3.address.suburb || j3.address.neighbourhood || j3.address.quarter || j3.address.city_district)) || "";
        var c3 = (j3.address && (j3.address.city || j3.address.town || j3.address.village)) || "";
        return { bairro: b3, cidade: c3 };
      });
    });
}

function processarPosicaoGps(lat, lon) {
  var radioH = document.querySelector('input[name="gps-h"]:checked');
  var h = radioH ? parseInt(radioH.value, 10) : 1;
  if (blkStart && (new Date() - blkStart >= h * 3600000)) {
    fecharBlocoGps();
  }

  if (!lastPos || Math.abs(lat - lastPos.lat) + Math.abs(lon - lastPos.lon) > 0.0015) {
    lastPos = { lat: lat, lon: lon };
    consultarBairroApi(lat, lon)
      .then(function(res) {
        var b = res.bairro || "";
        if (b && bairros.indexOf(b) === -1) {
          bairros.push(b);
          saveAll();
        }
        $("gps-info").textContent = "Bairros: " + (bairros.join(", ") || "buscando...");
      })
      .catch(function(err) {
        $("gps-info").textContent = "GPS ativo (aguardando rede: " + (err.message || "sem conexão") + ")...";
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
    consultarBairroApi(p.coords.latitude, p.coords.longitude)
      .then(function(res) {
        var b = res.bairro || "Bairro não identificado";
        var c = res.cidade || "";
        $("gps-info").textContent = "Teste OK: " + b + (c ? " (" + c + ")" : "") + (bairros.length ? " | Acumulados: " + bairros.join(", ") : "");
      })
      .catch(function(err) {
        $("gps-info").textContent = "GPS OK (" + p.coords.latitude.toFixed(4) + ", " + p.coords.longitude.toFixed(4) + "), falha na rede: " + (err.message || "verifique dados móveis");
      });
  }, function(err) {
    $("gps-info").textContent = "Erro no satélite GPS: " + err.message;
  }, { enableHighAccuracy: true, timeout: 10000 });
}
function fmtHora(d) { return two(d.getHours()) + ":" + two(d.getMinutes()); }

function fecharBlocoGps() {
  var now = new Date(), ini = fmtHora(blkStart || now), fim = fmtHora(now);
  var txtB = bairros.length ? bairros.join(", ") : "             ";
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
    registrarTrabalhoSalvo("Relatório - " + hoje, textoFinal, "");
    sDel("qru_draft");
    var caminhoSalvo = await salvarNaPastaAndroid("Relatorio_" + hoje.split("/").join("-") + ".txt", textoFinal, false);
    limparCampos();
    alert(caminhoSalvo ? "Relatório encerrado e salvo em:\n" + caminhoSalvo : "Relatório encerrado e salvo em Trabalhos Salvos!");
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
  registrarTrabalhoSalvo("Folha de QRU - " + dtCab, textoFinal, "");
  sDel("qru_draft");
  var caminhoSalvo = await salvarNaPastaAndroid("Folha_de_QRU_" + dtCab.split("/").join("-") + ".txt", textoFinal, false);
  limparCampos();
  alert(caminhoSalvo ? "Relatório encerrado e salvo em:\n" + caminhoSalvo : "Relatório encerrado e salvo em Trabalhos Salvos!");
  voltarInicio();
}
function getFullText() {
  if (isModoRelatorio()) return $("txt-body").value;
  var doc = $("f-doc").value.trim().toUpperCase();
  var esp = Math.max(0, Math.floor((42 - doc.length) / 2));
  var docCent = " ".repeat(esp) + doc;
  return "Polícia Militar do Estado de São Paulo" + NL + $("out-uni").value + NL + NL + docCent + NL + $("out-hdr").innerText + NL + NL + NL + $("txt-body").value;
}

async function enviarWpp(texto) {
  var Share = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Share;
  if (Share) {
    try {
      await Share.share({
        text: texto,
        dialogTitle: "Enviar via WhatsApp"
      });
      return;
    } catch (e) {
      if (e && e.message && e.message.toLowerCase().indexOf("cancel") > -1) return;
    }
  }
  window.location.href = "https://whatsapp.com" + encodeURIComponent(texto);
}

function sendWhats() {
  var txt = getFullText();
  var dt = $("f-data").value.trim() || getToday();
  var origem = isModoRelatorio() ? "Relatório" : "Folha de QRU";
  registrarTrabalhoSalvo(origem + " - " + dt, txt, "");
  enviarWpp(txt);
}

async function exportTxt() {
  var txt = getFullText();
  var dtCab = $("f-data").value.trim() || getToday();
  var dt = dtCab.split("/").join("-");
  var origem = isModoRelatorio() ? "Relatório" : "Folha de QRU";
  registrarTrabalhoSalvo(origem + " - " + dtCab, txt, "");
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
  if (/^[0-9]{2}\.[0-9]{3}\.[0-9]{3}-[0-9X]$/i.test(v) || /^[0-9]{2}\.[0-9]{3}\.[0-9]{3}$/.test(v) || /^[0-9]{2}\.[0-9]{3}\.[0-9]{2}-[0-9]$/.test(v)) {
    return v.toUpperCase();
  }
  if (/^[0-9]{8}[0-9X]$/i.test(v)) {
    var up = v.toUpperCase();
    return up.slice(0, 2) + "." + up.slice(2, 5) + "." + up.slice(5, 8) + "-" + up.slice(8, 9);
  }
  if (/^[0-9]{8}$/.test(v)) {
    return v.slice(0, 2) + "." + v.slice(2, 5) + "." + v.slice(5, 8);
  }
  return v;
}

function formatarRgQual() {
  var el = $("q-rg");
  el.value = formatarRgTexto(el.value);
}

function formatarDataQual(idCampo) {
  var el = $(idCampo);
  if (!el) return;
  var v = el.value.trim();
  if (!v) return;
  if (/^[0-9]{8}$/.test(v)) {
    el.value = v.slice(0, 2) + "/" + v.slice(2, 4) + "/" + v.slice(4, 8);
  } else if (/^[0-9]{6}$/.test(v)) {
    el.value = v.slice(0, 2) + "/" + v.slice(2, 4) + "/" + v.slice(4, 6);
  }
}

function formatarBatalhaoQual() {
  var el = $("q-uni");
  if (el && el.value.trim()) {
    el.value = formatarSiglaBatalhaoCurta(el.value);
  }
}

function formatarDpQual() {
  var el = $("q-dp");
  if (el && el.value.trim()) {
    el.value = formatarDpTexto(el.value);
  }
}

function formatarCidadeQual() {
  var el = $("q-cidade");
  if (el && el.value.trim()) {
    el.value = titleCase(el.value);
  }
}

function formatarLocalCampo(idCampo) {
  var el = $(idCampo);
  if (el && el.value.trim()) {
    el.value = formatarEnderecoCompleto(el.value);
  }
}

function formatarGeralCampo(idCampo) {
  var el = $(idCampo);
  if (el && el.value.trim()) {
    el.value = formatarTextoMilitar(el.value);
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
  formatarBatalhaoQual();
  formatarRgQual();
  formatarDataQual("q-data");
  formatarDataQual("q-dtn");
  formatarDpQual();
  formatarCidadeQual();
  formatarLocalCampo("q-local");
  formatarGeralCampo("q-obs");

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

    var placaX = 0;
    var placaW = largura;
    var padX = Math.round(placaW * 0.032);
    var innerW = placaW - (padX * 2);

    var fontTitulo = Math.max(24, Math.round(largura * 0.044));
    var fontLbl = Math.max(11, Math.round(largura * 0.0165));
    var fontVal = Math.max(15, Math.round(largura * 0.0235));

    var alturaMinimaPlaca = Math.round(altura * 0.40);
    var topoEspaco = Math.round(fontTitulo * 2.4);
    var rodapeEspaco = Math.round(padX * 1.1);
    var areaLinhas = alturaMinimaPlaca - topoEspaco - rodapeEspaco;
    var rowGap = Math.max(Math.round(fontVal * 1.85), Math.floor(areaLinhas / 7));

    var placaH = topoEspaco + (7 * rowGap) + rodapeEspaco;
    var placaY = altura - placaH;
    if (placaY < 0) placaY = 0;

    ctx.save();
    retanguloArredondado(ctx, placaX, placaY, placaW, placaH, Math.round(largura * 0.032));
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#94a3b8";
    ctx.stroke();
    ctx.restore();

    var y = placaY + Math.round(fontTitulo * 1.2);
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
    y += Math.round(fontTitulo * 1.45);

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

    var dtQual = $("q-data").value.trim() || getToday();
    var nomeQual = $("q-nome").value.trim();
    var resumoQual = (nomeQual ? "Nome: " + nomeQual + NL : "") +
      ($("q-rg").value.trim() ? "RG: " + $("q-rg").value.trim() + NL : "") +
      ($("q-artigo").value.trim() ? "Artigo: " + $("q-artigo").value.trim() + NL : "") +
      ($("q-dp").value.trim() ? "DP: " + $("q-dp").value.trim() : "");
    registrarTrabalhoSalvo("Foto e Qualificação - " + dtQual, resumoQual.trim(), fotoQualFinalBase64);
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

function formatarSecResenha() {
  var el = $("r-sec");
  if (!el) return;
  if (el.value.trim().toUpperCase() === "SSP") {
    el.value = "Secretaria da Segurança Pública";
    atualizarResenha();
  }
}

function formatarInstResenha() {
  var el = $("r-inst");
  if (!el) return;
  if (el.value.trim().toUpperCase() === "PMESP") {
    el.value = "Polícia Militar do Estado de São Paulo";
    atualizarResenha();
  }
}

function formatarBatResenha() {
  var el = $("r-bat");
  if (!el) return;
  var v = el.value.trim();
  if (!v) return;
  if (v.toUpperCase() === "ROTA") {
    el.value = "ROTA";
  } else {
    el.value = formatarSiglaBatalhaoCurta(v);
  }
  atualizarResenha();
}

function formatarCiaResenha() {
  var el = $("r-cia");
  if (!el) return;
  var v = el.value.trim();
  if (!v) return;
  var up = v.toUpperCase();
  if (up === "FT") el.value = "Força Tática";
  else if (up === "CANIL") el.value = "Canil";
  else if (up === "CAVALARIA") el.value = "Cavalaria";
  else if (up === "ROCAM") el.value = "ROCAM";
  else if (isNum(v)) el.value = v + "ª Cia";
  else el.value = formatarTextoMilitar(v);
  atualizarResenha();
}

function formatarVtrResenha() {
  var el = $("r-vtr");
  if (!el || !el.value.trim()) return;
  el.value = formatVtrTexto(el.value);
  atualizarResenha();
}

function formatarPolicialResenha(idCampo) {
  var el = $(idCampo);
  if (!el || !el.value.trim()) return;
  el.value = formatRankAndName(el.value);
  addEquipe(el.value);
  atualizarResenha();
}

function formatarAreaResenha() {
  var el = $("r-area");
  if (!el || !el.value.trim()) return;
  el.value = formatarTextoMilitar(el.value);
  atualizarResenha();
}

function formatarDpResenha() {
  var el = $("r-dp");
  if (!el || !el.value.trim()) return;
  el.value = formatarDpTexto(el.value);
  atualizarResenha();
}

function formatarHoraResenha() {
  var el = $("r-hr");
  if (!el || !el.value.trim()) return;
  el.value = formatarHoraUnica(el.value);
  atualizarResenha();
}

function formatarLocalResenha() {
  var el = $("r-local");
  if (!el || !el.value.trim()) return;
  el.value = formatarEnderecoCompleto(el.value);
  atualizarResenha();
}

function formatarGeralResenha(idCampo) {
  var el = $(idCampo);
  if (!el || !el.value.trim()) return;
  el.value = formatarTextoMilitar(el.value);
  atualizarResenha();
}

function adicionarIndiciado() {
  resenhaIndiciados.push({ nome: "", rg: "", artigo: "" });
  renderizarIndiciadosResenha();
  atualizarResenha();
}

function removerIndiciado(idx) {
  resenhaIndiciados.splice(idx, 1);
  renderizarIndiciadosResenha();
  atualizarResenha();
}

function onIndiciadoInput(idx, campo, valor) {
  if (resenhaIndiciados[idx]) {
    resenhaIndiciados[idx][campo] = valor;
    atualizarResenha();
  }
}

function onIndiciadoRgBlur(idx, inputEl) {
  if (resenhaIndiciados[idx]) {
    var fmt = formatarRgTexto(inputEl.value);
    inputEl.value = fmt;
    resenhaIndiciados[idx].rg = fmt;
    atualizarResenha();
  }
}

function renderizarIndiciadosResenha() {
  var box = $("r-indiciados-box");
  if (!box) return;
  var html = "";
  for (var i = 0; i < resenhaIndiciados.length; i++) {
    var env = resenhaIndiciados[i];
    var nomeEsc = (env.nome || "").replace(/"/g, "&quot;");
    var rgEsc = (env.rg || "").replace(/"/g, "&quot;");
    var artEsc = (env.artigo || "").replace(/"/g, "&quot;");
    html += '<div class="env-box">' +
      '<div class="row" style="margin-bottom:6px;">' +
        '<span class="dot"></span><span class="lbl">Indiciado:</span>' +
        '<input type="text" value="' + nomeEsc + '" oninput="onIndiciadoInput(' + i + ', \'nome\', this.value)">' +
        '<button type="button" class="btn-small" style="background:#dc2626;border:none;padding:6px 10px;" onclick="removerIndiciado(' + i + ')">X</button>' +
      '</div>' +
      '<div class="row" style="margin-bottom:6px;">' +
        '<span class="dot"></span><span class="lbl">RG:</span>' +
        '<input type="text" value="' + rgEsc + '" placeholder="xx.xxx.xxx-x ou xx.xxx.xxx" oninput="onIndiciadoInput(' + i + ', \'rg\', this.value)" onblur="onIndiciadoRgBlur(' + i + ', this)">' +
      '</div>' +
      '<div class="row" style="margin-bottom:0;">' +
        '<span class="dot"></span><span class="lbl">Artigo:</span>' +
        '<input type="text" value="' + artEsc + '" oninput="onIndiciadoInput(' + i + ', \'artigo\', this.value)">' +
      '</div>' +
    '</div>';
  }
  box.innerHTML = html;
}
function adicionarSindicado() {
  resenhaSindicados.push({ nome: "", rg: "", artigo: "" });
  renderizarSindicadosResenha();
  atualizarResenha();
}

function removerSindicado(idx) {
  resenhaSindicados.splice(idx, 1);
  renderizarSindicadosResenha();
  atualizarResenha();
}

function onSindicadoInput(idx, campo, valor) {
  if (resenhaSindicados[idx]) {
    resenhaSindicados[idx][campo] = valor;
    atualizarResenha();
  }
}

function onSindicadoRgBlur(idx, inputEl) {
  if (resenhaSindicados[idx]) {
    var fmt = formatarRgTexto(inputEl.value);
    inputEl.value = fmt;
    resenhaSindicados[idx].rg = fmt;
    atualizarResenha();
  }
}

function renderizarSindicadosResenha() {
  var box = $("r-sindicados-box");
  if (!box) return;
  var html = "";
  for (var i = 0; i < resenhaSindicados.length; i++) {
    var env = resenhaSindicados[i];
    var nomeEsc = (env.nome || "").replace(/"/g, "&quot;");
    var rgEsc = (env.rg || "").replace(/"/g, "&quot;");
    var artEsc = (env.artigo || "").replace(/"/g, "&quot;");
    html += '<div class="env-box">' +
      '<div class="row" style="margin-bottom:6px;">' +
        '<span class="dot"></span><span class="lbl">Sindicado:</span>' +
        '<input type="text" value="' + nomeEsc + '" oninput="onSindicadoInput(' + i + ', \'nome\', this.value)">' +
        '<button type="button" class="btn-small" style="background:#dc2626;border:none;padding:6px 10px;" onclick="removerSindicado(' + i + ')">X</button>' +
      '</div>' +
      '<div class="row" style="margin-bottom:6px;">' +
        '<span class="dot"></span><span class="lbl">RG:</span>' +
        '<input type="text" value="' + rgEsc + '" placeholder="xx.xxx.xxx-x ou xx.xxx.xxx" oninput="onSindicadoInput(' + i + ', \'rg\', this.value)" onblur="onSindicadoRgBlur(' + i + ', this)">' +
      '</div>' +
      '<div class="row" style="margin-bottom:0;">' +
        '<span class="dot"></span><span class="lbl">Artigo:</span>' +
        '<input type="text" value="' + artEsc + '" oninput="onSindicadoInput(' + i + ', \'artigo\', this.value)">' +
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
function separarItensApreensoes(raw) {
  if (!raw) return new Array();
  var marcado = raw.replace(/([0-9]),([0-9]+\s*(?:g|gr|grs|grama|gramas|kg|kgs|kilo|kilos|quilo|quilos|mg|ml|l|un|und|cx|pct)?\b)/gi, "$1###VIRGULA###$2");
  marcado = marcado.replace(/(R\$\s*[0-9.]+),([0-9]{2})/gi, "$1###VIRGULA###$2");
  var partes = marcado.split(",");
  var res = new Array();
  for (var i = 0; i < partes.length; i++) {
    var item = partes[i].split("###VIRGULA###").join(",").trim();
    if (item !== "") res.push(item);
  }
  return res;
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
  var aprRaw = $("r-apr").value.trim();
  var hist = $("r-hist").value.trim();

  var html = "";
  var txtWpp = "";
  var txtPuro = "";

  function addTopoIgual(val) {
    if (!val) return;
    html += '<div class="res-topo-igual">' + val + '</div>';
    txtWpp += "*" + val + "*" + NL;
    txtPuro += val + NL;
  }

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

  addTopoIgual(sec);
  addTopoIgual(inst);
  if (bat) {
    if (sec || inst) addEspaco();
    addTopo(bat);
  }

  html += '<div class="res-title">RESENHA DE OCORRÊNCIA</div><div class="res-gap"></div>';
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

  var indValidos = new Array();
  for (var i = 0; i < resenhaIndiciados.length; i++) {
    var ind = resenhaIndiciados[i];
    if ((ind.nome || "").trim() !== "" || (ind.rg || "").trim() !== "" || (ind.artigo || "").trim() !== "") {
      indValidos.push(ind);
    }
  }

  var sindValidos = new Array();
  for (var s = 0; s < resenhaSindicados.length; s++) {
    var sind = resenhaSindicados[s];
    if ((sind.nome || "").trim() !== "" || (sind.rg || "").trim() !== "" || (sind.artigo || "").trim() !== "") {
      sindValidos.push(sind);
    }
  }

  var temEnvolvidos = (indValidos.length > 0 || sindValidos.length > 0);
  if (temEnvolvidos) {
    if (del || temDadosOcor) addEspaco();
    var primeiroEnv = true;

    for (var j = 0; j < indValidos.length; j++) {
      if (!primeiroEnv) addEspaco();
      primeiroEnv = false;
      var curInd = indValidos[j];
      var lblInd = indValidos.length > 1 ? ("Indiciado " + (j + 1)) : "Indiciado";
      if ((curInd.nome || "").trim()) addCampo(lblInd, curInd.nome.trim());
      if ((curInd.rg || "").trim()) addCampo("RG", formatarRgTexto(curInd.rg));
      if ((curInd.artigo || "").trim()) addCampo("Artigo", curInd.artigo.trim());
    }

    for (var m = 0; m < sindValidos.length; m++) {
      if (!primeiroEnv) addEspaco();
      primeiroEnv = false;
      var curSind = sindValidos[m];
      var lblSind = sindValidos.length > 1 ? ("Sindicado " + (m + 1)) : "Sindicado";
      if ((curSind.nome || "").trim()) addCampo(lblSind, curSind.nome.trim());
      if ((curSind.rg || "").trim()) addCampo("RG", formatarRgTexto(curSind.rg));
      if ((curSind.artigo || "").trim()) addCampo("Artigo", curSind.artigo.trim());
    }
  }

  if (aprRaw) {
    var itensApr = separarItensApreensoes(aprRaw);
    if (itensApr.length > 0) {
      if (temEnvolvidos || temDadosOcor) addEspaco();
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

function obterTextoEditadoResenha(modoWpp) {
  var box = $("res-preview-box");
  if (!box) return "";
  var linhas = new Array();
  var filhos = box.childNodes;
  for (var i = 0; i < filhos.length; i++) {
    var el = filhos[i];
    if (el.nodeType === 1) {
      if (el.className === "res-gap") {
        linhas.push("");
      } else {
        var txt = (el.innerText || el.textContent || "").trim();
        if (modoWpp && (el.className === "res-center" || el.className === "res-topo-igual" || el.className === "res-title")) {
          linhas.push("*" + txt + "*");
        } else if (modoWpp && txt.indexOf(":") > -1 && el.querySelector("b")) {
          var idxDoisPontos = txt.indexOf(":");
          var rot = txt.slice(0, idxDoisPontos + 1);
          var val = txt.slice(idxDoisPontos + 1);
          linhas.push("*" + rot + "*" + val);
        } else {
          linhas.push(txt);
        }
      }
    } else if (el.nodeType === 3) {
      var t = el.nodeValue.trim();
      if (t) linhas.push(t);
    }
  }
  return linhas.join(NL).trim();
}

function limparResenha() {
  var ids = new Array("r-sec", "r-inst", "r-bat", "r-cia", "r-vtr", "r-cmte", "r-mot", "r-seg1", "r-seg2", "r-seg3", "r-nat", "r-dt", "r-hr", "r-local", "r-area", "r-bopm", "r-bopc", "r-dp", "r-del", "r-apr", "r-hist");
  for (var i = 0; i < ids.length; i++) {
    var el = $(ids[i]);
    if (el) el.value = "";
  }
  resenhaIndiciados = new Array({ nome: "", rg: "", artigo: "" });
  resenhaSindicados = new Array({ nome: "", rg: "", artigo: "" });
  renderizarIndiciadosResenha();
  renderizarSindicadosResenha();
  atualizarResenha();
}

function enviarResenhaWpp() {
  var txtWpp = obterTextoEditadoResenha(true);
  var txtPuro = obterTextoEditadoResenha(false);
  if (!txtWpp) return alert("Preencha os dados da resenha primeiro.");
  var dt = getToday();
  registrarTrabalhoSalvo("Resenha de Ocorrência - " + dt, txtPuro, "");
  enviarWpp(txtWpp);
}

function copiarResenha() {
  var txt = obterTextoEditadoResenha(false);
  if (!txt) return alert("Preencha os dados da resenha primeiro.");
  navigator.clipboard.writeText(txt);
  alert("Resenha copiada!");
}

function salvarResenhaApp() {
  var txt = obterTextoEditadoResenha(false);
  if (!txt) return alert("Preencha os dados da resenha primeiro.");
  var dt = getToday();
  registrarTrabalhoSalvo("Resenha de Ocorrência - " + dt, txt, "");
  alert("Resenha salva em Trabalhos Salvos!");
}

async function exportarResenhaTxt() {
  var txt = obterTextoEditadoResenha(false);
  if (!txt) return alert("Preencha os dados da resenha primeiro.");
  var dt = getToday();
  registrarTrabalhoSalvo("Resenha de Ocorrência - " + dt, txt, "");
  var bopm = ($("r-bopm").value.trim() || dt).replace(/[^a-zA-Z0-9_-]/g, "_");
  var nomeArq = "Resenha_" + bopm + ".txt";
  var caminho = await salvarNaPastaAndroid(nomeArq, txt, false);
  if (caminho) {
    alert("Resenha salva em:\n" + caminho);
  } else {
    var blob = new Blob(new Array(txt), { type: "text/plain;charset=utf-8" }), a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = nomeArq; a.click();
  }
}
function formatarCampoMilitarMdip(idCampo) {
  var el = $(idCampo);
  if (!el || !el.value.trim()) return;
  el.value = formatarTextoMilitar(el.value);
  atualizarMdip();
}

function formatarLocalMdip() {
  var el = $("m-qth");
  if (!el || !el.value.trim()) return;
  el.value = formatarEnderecoCompleto(el.value);
  atualizarMdip();
}

function formatarHoraMdip(idCampo) {
  var el = $(idCampo);
  if (!el || !el.value.trim()) return;
  el.value = formatarHoraUnica(el.value);
  atualizarMdip();
}

function formatarHoraTextoMdip(idCampo) {
  var el = $(idCampo);
  if (!el || !el.value.trim()) return;
  var txt = el.value.trim();
  txt = txt.replace(/\b([0-9]{2})([0-9]{2})\b/g, "$1:$2");
  el.value = formatarTextoMilitar(txt);
  atualizarMdip();
}

function formatarGeralMdip(idCampo) {
  var el = $(idCampo);
  if (!el || !el.value.trim()) return;
  el.value = formatarTextoMilitar(el.value);
  atualizarMdip();
}

function formatarListaVtrsMdip(idCampo) {
  var el = $(idCampo);
  if (!el || !el.value.trim()) return;
  var partes = el.value.split(",");
  for (var i = 0; i < partes.length; i++) {
    partes[i] = formatarTextoMilitar(partes[i].trim());
  }
  el.value = partes.join(", ");
  atualizarMdip();
}

function formatarCiaMdip() {
  var el = $("m-cia");
  if (!el || !el.value.trim()) return;
  var v = el.value.trim();
  var up = v.toUpperCase();
  if (up === "FT") el.value = "Força Tática";
  else if (up === "CANIL") el.value = "Canil";
  else if (up === "CAVALARIA") el.value = "Cavalaria";
  else if (up === "ROCAM") el.value = "ROCAM";
  else if (isNum(v)) el.value = v + "ª Cia";
  else el.value = formatarTextoMilitar(v);
  atualizarMdip();
}

function formatarVtrCampo(idCampo) {
  var el = $(idCampo);
  if (!el || !el.value.trim()) return;
  el.value = formatVtrTexto(el.value);
}

function formatarVtrMdip() {
  formatarVtrCampo("m-vtr");
  atualizarMdip();
}

function formatarPolicialMdip(idCampo) {
  var el = $(idCampo);
  if (!el || !el.value.trim()) return;
  el.value = formatRankAndName(el.value);
  addEquipe(el.value);
  atualizarMdip();
}

function formatarDpMdip() {
  var el = $("m-dp");
  if (!el || !el.value.trim()) return;
  el.value = formatarDpTexto(el.value);
  atualizarMdip();
}

function adicionarFeridoMdip() {
  mdipFeridos.push({ naoIdentificado: false, nome: "", rg: "", mae: "", criminal: "", obs: "" });
  renderizarFeridosMdip();
  atualizarMdip();
}

function removerFeridoMdip(idx) {
  mdipFeridos.splice(idx, 1);
  renderizarFeridosMdip();
  atualizarMdip();
}

function alternarNaoIdentificadoMdip(idx) {
  if (mdipFeridos[idx]) {
    mdipFeridos[idx].naoIdentificado = !mdipFeridos[idx].naoIdentificado;
    renderizarFeridosMdip();
    atualizarMdip();
  }
}

function onFeridoMdipInput(idx, campo, valor) {
  if (mdipFeridos[idx]) {
    mdipFeridos[idx][campo] = valor;
    atualizarMdip();
  }
}

function onFeridoMdipRgBlur(idx, inputEl) {
  if (mdipFeridos[idx]) {
    var fmt = formatarRgTexto(inputEl.value);
    inputEl.value = fmt;
    mdipFeridos[idx].rg = fmt;
    atualizarMdip();
  }
}

function renderizarFeridosMdip() {
  var box = $("m-feridos-box");
  if (!box) return;
  var html = "";
  for (var i = 0; i < mdipFeridos.length; i++) {
    var f = mdipFeridos[i];
    var nomeEsc = (f.nome || "").replace(/"/g, "&quot;");
    var rgEsc = (f.rg || "").replace(/"/g, "&quot;");
    var maeEsc = (f.mae || "").replace(/"/g, "&quot;");
    var crimEsc = (f.criminal || "").replace(/"/g, "&quot;");
    var obsEsc = (f.obs || "").replace(/"/g, "&quot;");
    var btnCor = f.naoIdentificado ? "#eab308" : "#475569";
    var btnTxtCor = f.naoIdentificado ? "#0f172a" : "#ffffff";

    html += '<div class="env-box">' +
      '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">' +
        '<strong style="font-size:13px; color:#eab308;">Identificação do Ferido ' + (mdipFeridos.length > 1 ? (i + 1) : "") + '</strong>' +
        '<div style="display:flex; gap:6px;">' +
          '<button type="button" class="btn-small" style="background:' + btnCor + ';color:' + btnTxtCor + ';border:none;padding:5px 9px;font-weight:bold;" onclick="alternarNaoIdentificadoMdip(' + i + ')">' + (f.naoIdentificado ? "Não Identificado (Ativo)" : "Não Identificado") + '</button>' +
          '<button type="button" class="btn-small" style="background:#dc2626;border:none;padding:5px 9px;" onclick="removerFeridoMdip(' + i + ')">X</button>' +
        '</div>' +
      '</div>' +
      '<div class="row" style="margin-bottom:6px;">' +
        '<span class="dot"></span><span class="lbl">Nome:</span>' +
        '<input type="text" value="' + nomeEsc + '" oninput="onFeridoMdipInput(' + i + ', \'nome\', this.value)">' +
      '</div>' +
      '<div class="row" style="margin-bottom:6px;">' +
        '<span class="dot"></span><span class="lbl">RG:</span>' +
        '<input type="text" value="' + rgEsc + '" placeholder="xx.xxx.xxx-x ou xx.xxx.xxx" oninput="onFeridoMdipInput(' + i + ', \'rg\', this.value)" onblur="onFeridoMdipRgBlur(' + i + ', this)">' +
      '</div>' +
      '<div class="row" style="margin-bottom:6px;">' +
        '<span class="dot"></span><span class="lbl">Mãe:</span>' +
        '<input type="text" value="' + maeEsc + '" oninput="onFeridoMdipInput(' + i + ', \'mae\', this.value)">' +
      '</div>' +
      '<div class="row" style="margin-bottom:6px;">' +
        '<span class="dot"></span><span class="lbl">Criminal:</span>' +
        '<input type="text" value="' + crimEsc + '" oninput="onFeridoMdipInput(' + i + ', \'criminal\', this.value)">' +
      '</div>' +
      '<div class="row" style="margin-bottom:0;">' +
        '<span class="dot"></span><span class="lbl">Obs. (Caract./Vest.):</span>' +
        '<input type="text" value="' + obsEsc + '" placeholder="Características físicas e vestimentas..." oninput="onFeridoMdipInput(' + i + ', \'obs\', this.value)">' +
      '</div>' +
    '</div>';
  }
  box.innerHTML = html;
}
function gerarDadosMdip() {
  var html = '<div class="mdip-title">MORTE DECORRENTE DE INTERVENÇÃO POLICIAL</div>';
  var txtWpp = "*MORTE DECORRENTE DE INTERVENÇÃO POLICIAL*" + NL + NL;
  var txtPuro = "MORTE DECORRENTE DE INTERVENÇÃO POLICIAL" + NL + NL;

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

  var dt = $("m-data").value.trim();
  var qtr = $("m-qtr").value.trim();
  var area = $("m-area").value.trim();
  var cia = $("m-cia").value.trim();
  var qth = $("m-qth").value.trim();
  var correg = $("m-correg").value.trim();

  var temBloco1 = (dt || qtr || area || cia || qth || correg);
  if (temBloco1) {
    addCampo("Data", dt);
    addCampo("QTR", qtr);
    addCampo("Área", area);
    addCampo("Cia", cia);
    addCampo("QTH dos fatos", qth);
    addCampo("QTR acionamento Correg/Atendente", correg);
  }

  var vtr = $("m-vtr").value.trim();
  if (vtr) {
    if (temBloco1) addEspaco();
    addCampo("Viatura", vtr);
  }

  var equipeSlots = new Array(
    { lbl: "Cmte Equipe", p: "m-cmt", a: "m-cmt-arma", d: "m-cmt-disp", o: "m-cmt-ocor" },
    { lbl: "Motorista", p: "m-mot", a: "m-mot-arma", d: "m-mot-disp", o: "m-mot-ocor" },
    { lbl: "3º Homem", p: "m-h3", a: "m-h3-arma", d: "m-h3-disp", o: "m-h3-ocor" },
    { lbl: "4º Homem", p: "m-h4", a: "m-h4-arma", d: "m-h4-disp", o: "m-h4-ocor" },
    { lbl: "5º Homem", p: "m-h5", a: "m-h5-arma", d: "m-h5-disp", o: "m-h5-ocor" }
  );

  var temAlgumPolicial = false;
  for (var i = 0; i < equipeSlots.length; i++) {
    var sl = equipeSlots[i];
    var vp = $(sl.p).value.trim();
    var va = $(sl.a).value.trim();
    var vd = $(sl.d).value.trim();
    var vo = $(sl.o).value.trim();
    if (vp || va || vd || vo) {
      if (temBloco1 || vtr || temAlgumPolicial) addEspaco();
      temAlgumPolicial = true;
      addCampo(sl.lbl, vp);
      addCampo("Arma", va);
      addCampo("Qtde Disparos", vd);
      addCampo("Qtde Ocorrências", vo);
    }
  }

  var feridosValidos = new Array();
  for (var fIdx = 0; fIdx < mdipFeridos.length; fIdx++) {
    var fer = mdipFeridos[fIdx];
    if (fer.naoIdentificado || (fer.nome || "").trim() || (fer.rg || "").trim() || (fer.mae || "").trim() || (fer.criminal || "").trim() || (fer.obs || "").trim()) {
      feridosValidos.push(fer);
    }
  }

  if (feridosValidos.length > 0) {
    for (var k = 0; k < feridosValidos.length; k++) {
      if (temBloco1 || vtr || temAlgumPolicial || k > 0) addEspaco();
      var curF = feridosValidos[k];
      var rotFerido = feridosValidos.length > 1 ? ("Identificação do ferido " + (k + 1)) : "Identificação do ferido";
      if (curF.naoIdentificado) {
        addCampo(rotFerido, "Não identificado");
      } else {
        addCampo(rotFerido, "Identificado");
      }
      var temDadosPessoa = ((curF.nome || "").trim() || (curF.rg || "").trim() || (curF.mae || "").trim() || (curF.criminal || "").trim() || (curF.obs || "").trim());
      if (temDadosPessoa) addEspaco();
      if ((curF.nome || "").trim()) addCampo("Nome", curF.nome.trim());
      if ((curF.rg || "").trim()) addCampo("RG", formatarRgTexto(curF.rg));
      if ((curF.mae || "").trim()) addCampo("Mãe", curF.mae.trim());
      if ((curF.criminal || "").trim()) addCampo("Criminal", curF.criminal.trim());
      if ((curF.obs || "").trim()) addCampo("Observação (Características/Vestimenta)", curF.obs.trim());
    }
  }

  var dp = $("m-dp").value.trim();
  var del = $("m-del").value.trim();
  var qtrCiencia = $("m-qtr-ciencia").value.trim();
  var bopm = $("m-bopm").value.trim();
  var bopc = $("m-bopc").value.trim();
  var temBlocoPolJud = (dp || del || qtrCiencia || bopm || bopc);
  if (temBlocoPolJud) {
    if (temBloco1 || vtr || temAlgumPolicial || feridosValidos.length > 0) addEspaco();
    addCampo("DP", dp);
    addCampo("Delegado", del);
    addCampo("QTR Ciência", qtrCiencia);
    addCampo("BOPM", bopm);
    addCampo("BOPC", bopc);
  }

  var qtrRede = $("m-qtr-rede").value.trim();
  var vtrsLocal = $("m-vtrs-local").value.trim();
  var vtrIc = $("m-vtr-ic").value.trim();
  var perito = $("m-perito").value.trim();
  var qtrChegada = $("m-qtr-chegada").value.trim();
  var aprRaw = $("m-apr").value.trim();
  var itensApr = aprRaw ? separarItensApreensoes(aprRaw) : new Array();
  var temBlocoApoio = (qtrRede || vtrsLocal || vtrIc || perito || qtrChegada || itensApr.length > 0);
  if (temBlocoApoio) {
    if (temBloco1 || vtr || temAlgumPolicial || feridosValidos.length > 0 || temBlocoPolJud) addEspaco();
    addCampo("QTR solicitação de resgate na rede", qtrRede);
    addCampo("Viaturas que compareceram pelo local", vtrsLocal);
    addCampo("Viatura IC", vtrIc);
    addCampo("Perito", perito);
    addCampo("QTR chegada", qtrChegada);
    if (itensApr.length > 0) {
      if (qtrRede || vtrsLocal || vtrIc || perito || qtrChegada) addEspaco();
      html += '<div class="res-line"><b>Objetos apreendidos:</b></div>';
      txtWpp += "*Objetos apreendidos:*" + NL;
      txtPuro += "Objetos apreendidos:" + NL;
      for (var aIdx = 0; aIdx < itensApr.length; aIdx++) {
        html += '<div class="res-line">• ' + itensApr[aIdx] + '</div>';
        txtWpp += "• " + itensApr[aIdx] + NL;
        txtPuro += "• " + itensApr[aIdx] + NL;
      }
    }
  }

  var resgate = $("m-resgate").value.trim();
  var qtrLocal = $("m-qtr-local").value.trim();
  var qtrSaida = $("m-qtr-saida").value.trim();
  var qtrPs = $("m-qtr-ps").value.trim();
  var ps = $("m-ps").value.trim();
  var medico = $("m-medico").value.trim();
  var vtrEscolta = $("m-vtr-escolta").value.trim();
  var temBlocoResgate = (resgate || qtrLocal || qtrSaida || qtrPs || ps || medico || vtrEscolta);
  if (temBlocoResgate) {
    if (temBloco1 || vtr || temAlgumPolicial || feridosValidos.length > 0 || temBlocoPolJud || temBlocoApoio) addEspaco();
    addCampo("Resgate", resgate);
    addCampo("QTR no local", qtrLocal);
    addCampo("QTR de saída", qtrSaida);
    addCampo("QTR no PS", qtrPs);
    addCampo("PS", ps);
    addCampo("Médico + CRM", medico);
    addCampo("VTR Escolta", vtrEscolta);
  }

  return { html: html, wpp: txtWpp.trim(), puro: txtPuro.trim() };
}

function atualizarMdip() {
  var box = $("mdip-preview-box");
  if (!box) return;
  var res = gerarDadosMdip();
  box.innerHTML = res.html;
}

function obterTextoEditadoMdip(modoWpp) {
  var box = $("mdip-preview-box");
  if (!box) return "";
  var linhas = new Array();
  var filhos = box.childNodes;
  for (var i = 0; i < filhos.length; i++) {
    var el = filhos[i];
    if (el.nodeType === 1) {
      if (el.className === "res-gap") {
        linhas.push("");
      } else {
        var txt = (el.innerText || el.textContent || "").trim();
        if (modoWpp && (el.className === "res-center" || el.className === "res-title" || el.className === "mdip-title")) {
          linhas.push("*" + txt + "*");
        } else if (modoWpp && txt.indexOf(":") > -1 && el.querySelector("b")) {
          var idxDoisPontos = txt.indexOf(":");
          var rot = txt.slice(0, idxDoisPontos + 1);
          var val = txt.slice(idxDoisPontos + 1);
          linhas.push("*" + rot + "*" + val);
        } else {
          linhas.push(txt);
        }
      }
    } else if (el.nodeType === 3) {
      var t = el.nodeValue.trim();
      if (t) linhas.push(t);
    }
  }
  return linhas.join(NL).trim();
}

function limparMdip() {
  var ids = new Array("m-data", "m-qtr", "m-area", "m-cia", "m-qth", "m-correg", "m-vtr", "m-cmt", "m-cmt-arma", "m-cmt-disp", "m-cmt-ocor", "m-mot", "m-mot-arma", "m-mot-disp", "m-mot-ocor", "m-h3", "m-h3-arma", "m-h3-disp", "m-h3-ocor", "m-h4", "m-h4-arma", "m-h4-disp", "m-h4-ocor", "m-h5", "m-h5-arma", "m-h5-disp", "m-h5-ocor", "m-dp", "m-del", "m-qtr-ciencia", "m-bopm", "m-bopc", "m-qtr-rede", "m-vtrs-local", "m-vtr-ic", "m-perito", "m-qtr-chegada", "m-apr", "m-resgate", "m-qtr-local", "m-qtr-saida", "m-qtr-ps", "m-ps", "m-medico", "m-vtr-escolta");
  for (var i = 0; i < ids.length; i++) {
    var el = $(ids[i]);
    if (el) el.value = "";
  }
  mdipFeridos = new Array({ naoIdentificado: false, nome: "", rg: "", mae: "", criminal: "", obs: "" });
  renderizarFeridosMdip();
  atualizarMdip();
}

function enviarMdipWpp() {
  var txtWpp = obterTextoEditadoMdip(true);
  var txtPuro = obterTextoEditadoMdip(false);
  if (!txtWpp) return alert("Preencha os dados do MDIP primeiro.");
  var dt = $("m-data").value.trim() || getToday();
  registrarTrabalhoSalvo("MDIP - " + dt, txtPuro, "");
  enviarWpp(txtWpp);
}

function copiarMdip() {
  var txt = obterTextoEditadoMdip(false);
  if (!txt) return alert("Preencha os dados do MDIP primeiro.");
  navigator.clipboard.writeText(txt);
  alert("MDIP copiado!");
}

function salvarMdipApp() {
  var txt = obterTextoEditadoMdip(false);
  if (!txt) return alert("Preencha os dados do MDIP primeiro.");
  var dt = $("m-data").value.trim() || getToday();
  registrarTrabalhoSalvo("MDIP - " + dt, txt, "");
  alert("MDIP salvo em Trabalhos Salvos!");
}

async function exportarMdipTxt() {
  var txt = obterTextoEditadoMdip(false);
  if (!txt) return alert("Preencha os dados do MDIP primeiro.");
  var dt = $("m-data").value.trim() || getToday();
  registrarTrabalhoSalvo("MDIP - " + dt, txt, "");
  var bopm = ($("m-bopm").value.trim() || dt).replace(/[^a-zA-Z0-9_-]/g, "_");
  var nomeArq = "MDIP_" + bopm + ".txt";
  var caminho = await salvarNaPastaAndroid(nomeArq, txt, false);
  if (caminho) {
    alert("MDIP salvo em:\n" + caminho);
  } else {
    var blob = new Blob(new Array(txt), { type: "text/plain;charset=utf-8" }), a = document.createElement("a");
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
  if (!list.length) { box.innerHTML = "<div class='card'>Nenhum trabalho salvo.</div>"; return; }
  box.innerHTML = list.map(function(it, idx) {
    return '<div class="sv-item">' +
      '<span class="sv-dt" onclick="openSaved(' + idx + ')">' + it.data + '</span>' +
      '<button type="button" class="btn-small" onclick="renameSaved(' + idx + ')">Renomear</button>' +
      '<button type="button" class="btn-small" style="background:#dc2626;border:none;" onclick="delSaved(' + idx + ')">Excluir</button>' +
    '</div>';
  }).join("");
}

function renameSaved(i) {
  var list = JSON.parse(sGet("qru_saved") || "[]");
  if (!list[i]) return;
  var novo = prompt("Digite o novo título:", list[i].data);
  if (novo !== null && novo.trim() !== "") {
    list[i].data = novo.trim();
    sSet("qru_saved", JSON.stringify(list));
    renderSaved();
  }
}

function openSaved(i) {
  var list = JSON.parse(sGet("qru_saved") || "[]"), item = list.slice(i, i + 1).pop();
  if (!item) return;
  var imgEl = $("saved-full-img");
  if (item.img) {
    imgEl.src = item.img;
    imgEl.style.display = "block";
  } else {
    imgEl.src = "";
    imgEl.style.display = "none";
  }
  $("saved-full-txt").textContent = item.text || "";
  $("saved-detail").style.display = "block";
  $("btn-sv-wpp").onclick = async function() {
    if (item.img) {
      var Fs = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem;
      var Share = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Share;
      if (Fs && Share) {
        try {
          var base64Puro = item.img.split(",").pop();
          var resFile = await Fs.writeFile({ path: "trabalho_salvo.jpg", data: base64Puro, directory: "CACHE" });
          await Share.share({ title: item.data, text: item.text || "", url: resFile.uri, dialogTitle: "Enviar Trabalho Salvo" });
          return;
        } catch (e) {}
      }
    }
    enviarWpp($("saved-full-txt").textContent);
  };
  $("btn-sv-cpy").onclick = function() {
    navigator.clipboard.writeText(item.text || item.data);
    alert("Copiado!");
  };
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
