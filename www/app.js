window.onerror = function(msg, url, line) {
  alert("Aviso de erro (linha " + line + "): " + msg);
};

var memStore = {};
var ITEM1 = "1. Das    às    - Assunção do serviço, limpeza, manutenção e equipagem da viatura, conferência do efetivo e preleção com BAEP Comando.";
var watchId = null, timerId = null, blkStart = null, bairros = new Array(), lastPos = null;
var gpsParadoManualmente = false;
var modoDocumentoAtual = "QRU";
var blkEndTarget = null;
var NL = String.fromCharCode(10);
var IMAGEM_PADRAO = "./fundo.png";
var fotoQualBase64 = "";
var fotoQualFinalBase64 = "";
var resenhaIndiciados = new Array({ nome: "", rg: "", artigo: "" });
var resenhaSindicados = new Array({ nome: "", rg: "", artigo: "" });
var mdipFeridos = new Array({ naoIdentificado: false, nome: "", rg: "", mae: "", criminal: "", obs: "" });
var novAbordados = { abo: new Array(), cmp: new Array() };

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
  try {
    localStorage.setItem(k, v);
  } catch (e) {
    if (k === "qru_saved") {
      try {
        var list = JSON.parse(v);
        for (var i = list.length - 1; i >= 0; i--) {
          if (list[i].img) {
            delete list[i].img;
            localStorage.setItem(k, JSON.stringify(list));
            return;
          }
        }
      } catch (e2) {}
    }
  }
}

function sDel(k) {
  delete memStore[k];
  try { localStorage.removeItem(k); } catch (e) {}
}

function two(n) { var s = String(n); return s.length < 2 ? "0" + s : s; }
function isNum(s) { return s !== "" && !isNaN(Number(s)); }
function getToday() { var d = new Date(); return two(d.getDate()) + "/" + two(d.getMonth() + 1) + "/" + d.getFullYear(); }
function enviarWpp(txt) {
  if (!txt) return alert("Nada para enviar.");
  var url = "https:/" + "/api.whatsapp.com/send?text=" + encodeURIComponent(txt);
  window.open(url, "_blank");
}

function sincronizarHorarioItem1() {
  var ta = $("txt-body");
  if (!ta) return;
  var times = extractTimes($("f-hora").value);
  var hIni = times.length > 0 ? times[0] : "   ";
  var lines = ta.value.split(NL);
  for (var i = 0; i < lines.length; i++) {
    if (lines[i].indexOf("Assunção do serviço") > -1) {
      lines[i] = lines[i].replace(/^([0-9]+\.\s*Das\s+)(?:[0-9]{2}:[0-9]{2}|\s{2,4})(\s+às)/i, "$1" + hIni + "$2");
      break;
    }
  }
  ta.value = lines.join(NL);
}

function formatarCabecalhoQruTexto(modoWpp) {
  var eq = [];
  if ($("f-cmt").value.trim()) eq.push("Cmt: " + $("f-cmt").value.trim());
  if ($("f-mot").value.trim()) eq.push("Mot: " + $("f-mot").value.trim());
  if ($("f-h3").value.trim()) eq.push("3° Homem: " + $("f-h3").value.trim());
  if ($("f-h4").value.trim()) eq.push("4° Homem: " + $("f-h4").value.trim());
  if ($("f-h5").value.trim()) eq.push("5° Homem: " + $("f-h5").value.trim());

  var b = modoWpp ? "*" : "";
  var l1 = b + "Data:" + b + " " + $("f-data").value.trim() + " | " + b + "Horário:" + b + " " + $("f-hora").value.trim();
  var l2 = b + "Cia:" + b + " " + $("f-cia").value.trim() + " | " + b + "Pel:" + b + " " + $("f-pel").value.trim() + " | " + b + "Viatura:" + b + " " + $("f-vtr").value.trim();
  var l3 = b + "KM Ini:" + b + " " + $("f-kmi").value.trim() + " | " + b + "KM Fin:" + b + " " + $("f-kmf").value.trim() + " | " + b + "KM Perc:" + b + " " + $("f-kmp").value.trim();
  var l4 = b + "Equipe:" + b + " " + eq.join(" | ");
  return l1 + NL + l2 + NL + l3 + NL + l4;
}

function formatarCorpoQruWpp(txt) {
  if (!txt) return "";
  return txt.split(NL).map(function(linha) {
    return linha.replace(/^([0-9]+\.\s*(?:Das\s+[0-9: ]+\s+às\s+[0-9: ]+|Às\s+[0-9: ]+)\s*-)/i, "*$1*");
  }).join(NL);
}

function copiarFallback(txt, msgOk) {
  var ta = document.createElement("textarea");
  ta.value = txt;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try {
    document.execCommand("copy");
    if (msgOk) alert(msgOk);
  } catch (e) {
    alert("Não foi possível copiar automaticamente.");
  }
  document.body.removeChild(ta);
}
function copiarTextoSeguro(txt, msgOk) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).then(function() {
      if (msgOk) alert(msgOk);
    }).catch(function() {
      copiarFallback(txt, msgOk);
    });
  } else {
    copiarFallback(txt, msgOk);
  }
}

function redimensionarImagemBase64(dataUrl, maxLargura, qualidade, callback) {
  var img = new Image();
  img.onload = function() {
    var w = img.width;
    var h = img.height;
    if (w > maxLargura) {
      h = Math.round(h * (maxLargura / w));
      w = maxLargura;
    }
    var canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);
    var res = canvas.toDataURL("image/jpeg", qualidade);
    canvas.width = 0;
    canvas.height = 0;
    callback(res);
  };
  img.onerror = function() { callback(dataUrl); };
  img.src = dataUrl;
}

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
function abrirCabecalho() {
  modoDocumentoAtual = "QRU";
  $("f-doc").value = "FOLHA DE QRU";
  if (!$("f-data").value.trim()) $("f-data").value = getToday();
  atualizarTelaCabecalho();
  mostrarTela("header-screen");
}

function abrirModoDiretoSemCabecalho(tipoModo, tituloTopo, textoBotaoEncerrar) {
  modoDocumentoAtual = tipoModo;
  if ($("out-inst")) $("out-inst").style.display = "none";
  $("out-uni").style.display = "none";
  $("out-doc").style.display = "block";
  $("out-doc").textContent = tituloTopo;
  $("out-hdr").style.display = "none";
  document.querySelector("#print-box .space-2").style.display = "none";

  var btnEditarCab = document.querySelector("#report-screen .card:first-child button:nth-child(2)");
  if (btnEditarCab) btnEditarCab.style.display = "none";

  var btnEnc = $("btn-encerrar-qru");
  if (btnEnc) btnEnc.textContent = textoBotaoEncerrar;

  if (!$("txt-body").value.trim()) $("txt-body").value = ITEM1;
  saveAll();
  mostrarTela("report-screen");
}
function abrirRelatorioSimples() {
  abrirModoDiretoSemCabecalho("RELATORIO", "RELATÓRIO", "Encerrar Relatório");
}

function abrirRelatorioBo() {
  abrirModoDiretoSemCabecalho("RELATORIO_BO", "RELATÓRIO BO", "Encerrar Relatório BO");
}

function editarCabecalho() { saveAll(); atualizarTelaCabecalho(); mostrarTela("header-screen"); }
function abrirSalvos() { $("saved-detail").style.display = "none"; renderSaved(); mostrarTela("saved-screen"); }
function abrirResenha() { renderizarIndiciadosResenha(); renderizarSindicadosResenha(); atualizarResenha(); mostrarTela("resenha-screen"); }
function abrirMdip() { renderizarFeridosMdip(); atualizarMdip(); mostrarTela("mdip-screen"); }

function registrarTrabalhoSalvo(titulo, texto, imagemBase64) {
  if (!texto && !imagemBase64) return;
  var list = JSON.parse(sGet("qru_saved") || "[]");
  if (list.length > 0 && list[0].data === titulo && list[0].text === texto && (list[0].img || "") === (imagemBase64 || "")) {
    return;
  }
  var salvarItem = function(imgOtimizada) {
    var item = { data: titulo, text: texto || "" };
    if (imgOtimizada) item.img = imgOtimizada;
    list.unshift(item);
    sSet("qru_saved", JSON.stringify(list));
    updateCount();
  };
  if (imagemBase64) {
    redimensionarImagemBase64(imagemBase64, 960, 0.75, salvarItem);
  } else {
    salvarItem("");
  }
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
  var f = (e.target.files && e.target.files.length > 0) ? e.target.files[0] : null;
  if (!f) return;
  var r = new FileReader();
  r.onload = function(ev) {
    redimensionarImagemBase64(ev.target.result, 800, 0.65, function(imgComprimida) {
      sSet("qru_bg", imgComprimida);
      atualizarFundo();
    });
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
    { re: /\bantonio\b/gi, rep: "Antônio" },
    { re: /\bjunior\b/gi, rep: "Júnior" }
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

function formatarNomePessoa(raw) {
  var v = (raw || "").trim();
  if (!v) return "";
  return normalizarCidadesEAcentos(titleCase(v));
}
function formatarEnderecoCompleto(raw) {
  var v = (raw || "").trim();
  if (!v) return "";
  var limpo = v.replace(/,/g, " ").replace(/\s+-\s+/g, " ").replace(/\s+/g, " ").trim();
  limpo = limpo.replace(/\bdoutro\b/gi, "doutor");

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
    var compPartes = new Array();

    resto = resto.replace(/\b(?:bloco|bl)\.?\s*([0-9]+[a-zA-Z]?|[a-zA-Z])\b/gi, function(all, nBl) {
      var valBl = isNum(nBl) ? two(nBl) : nBl.toUpperCase();
      compPartes.push("bloco " + valBl);
      return " ";
    });
    resto = resto.replace(/\b(?:apartamento|apto|apt|ap)\.?\s*([0-9]+[a-zA-Z]?)\b/gi, function(all, nAp) {
      var valAp = isNum(nAp) ? two(nAp) : nAp.toUpperCase();
      compPartes.push("apto " + valAp);
      return " ";
    });
    resto = resto.replace(/\b(?:casa|cs)\.?\s*([0-9]+[a-zA-Z]?)\b/gi, function(all, nCs) {
      var valCs = isNum(nCs) ? two(nCs) : nCs.toUpperCase();
      compPartes.push("casa " + valCs);
      return " ";
    });

    resto = resto.replace(/\s+/g, " ").trim();
    var compStr = compPartes.length > 0 ? (" - " + compPartes.join(" - ")) : "";
    var uf = "";
    var ufExtenso = resto.match(/^(.*?)[\s\/\-]+(sao paulo|são paulo|rio de janeiro|minas gerais|parana|paraná|santa catarina|rio grande do sul|espirito santo|espírito santo|bahia|goias|goiás|distrito federal|mato grosso do sul|mato grosso)$/i);
    if (ufExtenso) {
      var prevResto = ufExtenso.slice(1, 2).join("").trim();
      var estNome = ufExtenso.slice(2, 3).join("").toLowerCase();
      if (prevResto !== "") {
        resto = prevResto;
        if (estNome.indexOf("paulo") > -1) uf = "/SP";
        else if (estNome.indexOf("janeiro") > -1) uf = "/RJ";
        else if (estNome.indexOf("minas") > -1) uf = "/MG";
        else if (estNome.indexOf("paran") > -1) uf = "/PR";
        else if (estNome.indexOf("catarina") > -1) uf = "/SC";
        else if (estNome.indexOf("sul") > -1 && estNome.indexOf("rio") > -1) uf = "/RS";
        else if (estNome.indexOf("santo") > -1) uf = "/ES";
        else if (estNome.indexOf("bahia") > -1) uf = "/BA";
        else if (estNome.indexOf("goi") > -1) uf = "/GO";
        else if (estNome.indexOf("distrito") > -1) uf = "/DF";
        else if (estNome.indexOf("mato grosso do sul") > -1) uf = "/MS";
        else if (estNome.indexOf("mato grosso") > -1) uf = "/MT";
      }
    }
    if (!uf) {
      var ufMatch = resto.match(/^(.*?)[\s\/\-]+(sp|rj|mg|pr|sc|rs|es|ba|go|df|ms|mt)$/i);
      if (ufMatch) {
        resto = ufMatch.slice(1, 2).join("").trim();
        uf = "/" + ufMatch.slice(2, 3).join("").toUpperCase();
      }
    }
    var palavrasResto = resto.split(" ").filter(function(x) { return x !== ""; });
    if (palavrasResto.length >= 2) {
      var cidConhecidas2 = new Array("sao vicente", "são vicente", "praia grande", "ilha comprida", "sao paulo", "são paulo", "sao sebastiao", "são sebastião");
      var cidConhecidas3 = new Array("pedro de toledo");
      var lowerResto = resto.toLowerCase();
      var cidade = "", bairro = "";
      for (var c3 = 0; c3 < cidConhecidas3.length; c3++) {
        var cid3 = cidConhecidas3[c3];
        if (lowerResto.slice(-cid3.length) === cid3) {
          cidade = titleCase(cid3);
          bairro = titleCase(resto.slice(0, resto.length - cid3.length).trim());
          break;
        }
      }
      if (!cidade) {
        for (var c2 = 0; c2 < cidConhecidas2.length; c2++) {
          var cid2 = cidConhecidas2[c2];
          if (lowerResto.slice(-cid2.length) === cid2) {
            cidade = titleCase(cid2);
            bairro = titleCase(resto.slice(0, resto.length - cid2.length).trim());
            break;
          }
        }
      }
      if (!cidade) {
        cidade = titleCase(palavrasResto.pop());
        bairro = titleCase(palavrasResto.join(" "));
      }
      if (bairro && cidade) return logr + ", " + num + compStr + " - " + bairro + " - " + cidade + uf;
      return logr + ", " + num + compStr + " - " + (bairro || cidade) + uf;
    }
    return logr + ", " + num + compStr + (resto ? " - " + titleCase(resto) : "") + uf;
  }
  return normalizarCidadesEAcentos(titleCase(v));
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
  txt = txt.replace(/\b([a-zA-Z])-?([0-9]{4,5})\b/g, function(all, l, n) { return l.toUpperCase() + "-" + n; });
  txt = txt.replace(/\b([1-3])\s*[°º]?\s*(sgt|ten|sargento|tenente)\s*(?:pm\s+)?([a-zA-ZÀ-ÿ]+)/gi, function(all, n, g, nome) {
    return n + "° " + (g.toLowerCase().indexOf("ten") === 0 ? "Ten" : "Sgt") + " PM " + titleCase(nome);
  });
  txt = txt.replace(/\b(ten(?:ente)?\s*cel(?:onel)?|tencel|tc|sd|soldado|cb|cabo|sgt|sargento|ten|tenente|cap|capit[aã]o|maj|major|cel|coronel|subten|asp)\s*(?:pm\s+)?([a-zA-ZÀ-ÿ]+)/gi, function(all, g, nome) {
    var gl = g.toLowerCase().replace(/\./g, "").replace(/\s+/g, "");
    var gr = "Sd";
    if (gl === "tencel" || gl === "tenentecel" || gl === "tencelonel" || gl === "tenentecoronel" || gl === "tc") gr = "Ten Cel";
    else if (gl.indexOf("cb") === 0 || gl.indexOf("cab") === 0) gr = "Cb";
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

  if (up.indexOf("ROTA") > -1) res = "Batalhão Tobias de Aguiar";
  else if (up.indexOf("BPMI") > -1 || up.indexOf("BPM/I") > -1 || (num !== "" && semNum === "I")) res = (num ? num + "º " : "") + "Batalhão de Polícia Militar do Interior";
  else if (up.indexOf("BPMM") > -1 || up.indexOf("BPM/M") > -1 || (num !== "" && semNum === "M")) res = (num ? num + "º " : "") + "Batalhão de Polícia Militar Metropolitano";
  else if (up.indexOf("BPCHQ") > -1) res = (num ? num + "º " : "") + "Batalhão de Polícia de Choque";
  else if (up.indexOf("BAEP") > -1) {
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

function formatarDpTexto(raw) {
  var v = (raw || "").trim();
  if (!v) return "";
  var up = v.toUpperCase();
  if (up === "SEDE" || up === "DP SEDE") return "DP Sede";
  if (up === "CPJ") return "CPJ";
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
function detectarGeneroNome(primeiroNomeRaw) {
  var primeiroNome = (primeiroNomeRaw || "").toLowerCase()
    .replace(/[áàãâ]/g, "a").replace(/[éèê]/g, "e").replace(/[íìî]/g, "i").replace(/[óòõô]/g, "o").replace(/[úùû]/g, "u");
  var mascTerminaEmA = new Array("luca", "djalma", "ubirajara", "ibra", "nika", "mustafa", "josua");
  var femNaoTerminaEmA = new Array(
    "beatriz", "raquel", "alice", "simone", "denise", "aline", "caroline", "michele", "michelle", "ester", "esther",
    "ingrid", "iris", "lilian", "mirian", "miriam", "suellen", "suelen", "vivian", "viviane", "eliane", "rosane",
    "solange", "irene", "ivone", "marlene", "darlene", "carol", "ruth", "rute", "edith", "edite", "janete",
    "elisabete", "elizabeth", "izabel", "isabel", "grace", "joyce", "kelly", "karen", "ellen", "helen", "heloise",
    "louise", "denize", "clarice", "janice", "eunice", "bernice", "berenice", "cleide", "neide", "zuleide",
    "lucilene", "marilene", "rosilene", "franciele", "gabriele", "gabrielle", "daniele", "danielle", "rafaele", "rafaelle"
  );
  if (femNaoTerminaEmA.indexOf(primeiroNome) > -1) return "F";
  if (mascTerminaEmA.indexOf(primeiroNome) > -1) return "M";
  if (primeiroNome.slice(-1) === "a") return "F";
  return "M";
}

function formatarMedicoCrmCampo(idCampo) {
  var el = $(idCampo);
  if (!el) return;
  var raw = el.value.trim();
  if (!raw) return;
  var ehMulherForcado = /^(?:doutora|dra\.?)\b/i.test(raw);
  var ehHomemForcado = /^(?:doutor|dr\.?)\b/i.test(raw);
  var limpo = raw.replace(/^(?:doutora|doutor|dra\.?|dr\.?)\s+/i, "").replace(/[-–—]/g, " ").replace(/\bcrm\b[:\s]*/gi, " ").replace(/\s+/g, " ").trim();
  if (!limpo) return;
  var crmMatch = limpo.match(/\b([0-9]{3,10}(?:\/[a-zA-Z]{2})?)\b\s*$/);
  var crmNum = "", nomeParte = limpo;
  if (crmMatch) {
    crmNum = crmMatch.slice(1, 2).join("").toUpperCase();
    nomeParte = limpo.slice(0, limpo.length - crmMatch.slice(0, 1).join("").length).trim();
  }
  if (!nomeParte) return;
  var nomeFormatado = formatarNomePessoa(nomeParte);
  var primeiroNome = nomeParte.split(" ").slice(0, 1).join("");
  var ehMulher = ehMulherForcado ? true : (ehHomemForcado ? false : (detectarGeneroNome(primeiroNome) === "F"));
  el.value = (ehMulher ? "Doutora " : "Doutor ") + nomeFormatado + (crmNum ? " - CRM " + crmNum : "");
}

function formatarDelegadoCampo(idCampo) {
  var el = $(idCampo);
  if (!el) return;
  var raw = el.value.trim();
  if (!raw) return;
  var ehMulherForcado = /^(?:doutora|dra\.?)\b/i.test(raw);
  var ehHomemForcado = /^(?:doutor|dr\.?)\b/i.test(raw);
  var semPrefixo = raw.replace(/^(?:doutora|doutor|dra\.?|dr\.?)\s+/i, "").trim();
  if (!semPrefixo) return;
  var nomeFormatado = formatarNomePessoa(semPrefixo);
  var primeiroNome = semPrefixo.split(" ").slice(0, 1).join("");
  var ehMulher = ehMulherForcado ? true : (ehHomemForcado ? false : (detectarGeneroNome(primeiroNome) === "F"));
  el.value = (ehMulher ? "Doutora " : "Doutor ") + nomeFormatado;
}

function onUnitChange() {
  var res = resolverNomeBatalhao($("f-uni").value);
  $("out-uni").value = res;
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
  if ((cur === "tenente" || cur === "ten") && (next === "cel" || next === "coronel")) { rank = "Ten Cel"; idx += 2; }
  else if (cur === "tc" || cur === "tencel") { rank = "Ten Cel"; idx += 1; }
  else if (cur === "sd" || cur === "soldado") { rank = "Sd"; idx += 1; }
  else if (cur === "cb" || cur === "cabo") { rank = "Cb"; idx += 1; }
  else if (cur === "sgt" || cur === "sargento") { rank = "Sgt"; idx += 1; }
  else if (cur === "ten" || cur === "tenente") { rank = "Ten"; idx += 1; }
  else if (cur === "cap" || cur === "capitao" || cur === "capitão") { rank = "Cap"; idx += 1; }
  else if (cur === "maj" || cur === "major") { rank = "Maj"; idx += 1; }
  else if (cur === "cel" || cur === "coronel") { rank = "Cel"; idx += 1; }
  else if (cur === "subten" || cur === "st") { rank = "Subten"; idx += 1; }
  else if (cur === "asp" || cur === "aspirante") { rank = "Asp"; idx += 1; }
  else { return formatarNomePessoa(txt); }
  var afterRank = words.slice(idx);
  if (afterRank.length > 0 && afterRank.slice(0, 1).join("").toUpperCase() === "PM") afterRank = afterRank.slice(1);
  var namePart = formatarNomePessoa(afterRank.join(" "));
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
    return two(p.slice(0, 1).join("")) + ":" + p.slice(1, 2).join("");
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
  return modoDocumentoAtual === "RELATORIO" || modoDocumentoAtual === "RELATORIO_BO";
}

function atualizarTelaCabecalho() {
  var rows = document.querySelectorAll("#header-screen .row");
  for (var i = 0; i < rows.length; i++) rows.item(i).style.display = "flex";
  var btn = $("btn-hdr-ok");
  if (btn) btn.textContent = "Cabeçalho Preenchido";
}

function finishHeaderStep() {
  modoDocumentoAtual = "QRU";
  var btnEditarCab = document.querySelector("#report-screen .card:first-child button:nth-child(2)");
  if (btnEditarCab) btnEditarCab.style.display = "inline-block";
  var btnEnc = $("btn-encerrar-qru");
  if (btnEnc) btnEnc.textContent = "Encerrar Folha de QRU";

  $("out-doc").style.display = "block";
  $("out-hdr").style.display = "block";
  document.querySelector("#print-box .space-2").style.display = "block";
  if (!$("f-data").value.trim()) $("f-data").value = getToday();
  formatHourInput(); formatCiaInput(); formatPelInput(); formatVtrInput(); onUnitChange(); formatAllEquipe();
  if (!$("txt-body").value.trim()) $("txt-body").value = ITEM1;
  sincronizarHorarioItem1();
  refreshPreview();
  mostrarTela("report-screen");
}

function refreshPreview() {
  $("out-doc").textContent = $("f-doc").value;
  var temBat = $("f-uni").value.trim() !== "";
  if ($("out-inst")) $("out-inst").style.display = temBat ? "block" : "none";
  if ($("out-uni")) $("out-uni").style.display = temBat ? "block" : "none";

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

function montarUrlComParams(baseUrl, paramsObj) {
  if (!paramsObj) return baseUrl;
  var partes = new Array();
  var chaves = Object.keys(paramsObj);
  for (var i = 0; i < chaves.length; i++) {
    var k = chaves[i];
    partes.push(encodeURIComponent(k) + "=" + encodeURIComponent(paramsObj[k]));
  }
  return baseUrl + String.fromCharCode(63) + partes.join(String.fromCharCode(38));
}

function parseJsonSeguro(raw) {
  if (!raw) throw new Error("Resposta vazia");
  if (typeof raw === "object") return raw;
  var txt = String(raw).trim();
  if (txt.charAt(0) !== "{") throw new Error("Resposta não JSON");
  return JSON.parse(txt);
}

function httpGetJson(url, paramsObj) {
  var fullUrl = montarUrlComParams(url, paramsObj);
  return fetch(fullUrl)
    .then(function(r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); })
    .then(function(txt) { return parseJsonSeguro(txt); });
}

function consultarBairroApi(lat, lon) {
  var urlArcGis = "https:/" + "/geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode";
  return httpGetJson(urlArcGis, { location: String(lon) + "," + String(lat), langCode: "pt", f: "pjson" })
    .then(function(j0) {
      var addr0 = j0 && j0.address ? j0.address : {};
      var c0 = addr0.City || addr0.Subregion || "";
      var b0 = addr0.Neighborhood || "";
      if (!b0 && addr0.District && addr0.District.toLowerCase() !== c0.toLowerCase()) b0 = addr0.District;
      var rua0 = addr0.Address || addr0.ShortLabel || "";
      if (b0 || rua0) return { bairro: b0, cidade: c0, endereco: rua0 };
      throw new Error("Sem dados ArcGIS");
    }).catch(function() {
      var urlNom = "https:/" + "/nominatim.openstreetmap.org/reverse";
      return httpGetJson(urlNom, { format: "jsonv2", lat: String(lat), lon: String(lon), zoom: "18", "accept-language": "pt-BR" })
        .then(function(j3) {
          var a3 = j3 && j3.address ? j3.address : {};
          var c3 = a3.city || a3.town || a3.municipality || "";
          var b3 = a3.neighbourhood || a3.quarter || a3.suburb || a3.city_district || a3.residential || "";
          var rua3 = a3.road || "";
          var num3 = a3.house_number || "";
          var end3 = rua3 ? (rua3 + (num3 ? ", " + num3 : "")) : "";
          if (b3 || end3) return { bairro: b3, cidade: c3, endereco: end3 };
          throw new Error("Sem dados Nominatim");
        });
    }).catch(function() {
      var urlBdc = "https:/" + "/api.bigdatacloud.net/data/reverse-geocode-client";
      return httpGetJson(urlBdc, { latitude: String(lat), longitude: String(lon), localityLanguage: "pt" })
        .then(function(j) {
          var cidade = j.city || "";
          var bairro = "";
          if (j.localityInfo && j.localityInfo.administrative) {
            var adm = j.localityInfo.administrative;
            for (var i = adm.length - 1; i >= 0; i--) {
              var nomeAdm = adm[i].name || "";
              if (nomeAdm && nomeAdm.toLowerCase() !== cidade.toLowerCase() && (adm[i].adminLevel >= 9 || i === adm.length - 1)) {
                bairro = nomeAdm;
                break;
              }
            }
          }
          if (!bairro) bairro = j.locality || cidade;
          return { bairro: bairro, cidade: cidade, endereco: "" };
        });
    });
}
function preencherLocalPorGps(idCampo) {
  var el = $(idCampo);
  if (!el) return;
  if (!navigator.geolocation) return alert("Sem GPS neste aparelho.");
  var valAnterior = el.value;
  el.value = "Buscando endereço pelo GPS...";
  navigator.geolocation.getCurrentPosition(function(p) {
    consultarBairroApi(p.coords.latitude, p.coords.longitude)
      .then(function(res) {
        var partes = new Array();
        if (res.endereco) partes.push(res.endereco);
        if (res.bairro) partes.push(res.bairro);
        if (res.cidade) partes.push(res.cidade + "/SP");
        var montado = partes.join(" - ");
        el.value = montado ? formatarEnderecoCompleto(montado) : valAnterior;
      })
      .catch(function() {
        el.value = valAnterior;
        alert("Não foi possível obter o endereço pela rede. Verifique sua conexão.");
      });
  }, function(err) {
    el.value = valAnterior;
    alert("Erro ao obter posição GPS: " + err.message);
  }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
}

function obterHorasSelecionadasGps() {
  var radioH = document.querySelector('input[name="gps-h"]:checked');
  var h = radioH ? parseInt(radioH.value, 10) : 1;
  return (h === 2) ? 2 : 1;
}

function calcularProximaHoraCheiaGps(dataBase) {
  var d = new Date(dataBase.getTime());
  var h = obterHorasSelecionadasGps();
  var min = d.getMinutes();
  var horaAlvo = d.getHours();
  if (h === 1) horaAlvo += (min < 30) ? 1 : 2;
  else horaAlvo += (min < 30) ? 2 : 4;
  d.setHours(horaAlvo, 0, 0, 0);
  return d;
}

function recalcularProximoFechamentoGps() {
  if (!blkStart) return;
  blkEndTarget = calcularProximaHoraCheiaGps(blkStart);
  saveAll();
  if ($("gps-info") && !gpsParadoManualmente) {
    $("gps-info").textContent = "GPS ativo (fecha às " + fmtHora(blkEndTarget) + ") | Bairros: " + (bairros.join(", ") || "buscando...");
  }
}

function verificarBlocosVencidosGps() {
  if (!blkStart) return;
  if (!blkEndTarget) blkEndTarget = calcularProximaHoraCheiaGps(blkStart);
  var agora = new Date();
  while (agora.getTime() >= blkEndTarget.getTime()) {
    var ini = fmtHora(blkStart);
    var fim = fmtHora(blkEndTarget);
    var txtB = bairros.length ? bairros.join(", ") : "             ";
    addItem("Das " + ini + " às " + fim + " - Patrulhamento pelos bairros " + txtB + ".");
    blkStart = new Date(blkEndTarget.getTime());
    blkEndTarget = calcularProximaHoraCheiaGps(blkStart);
    bairros = new Array();
    saveAll();
  }
}

function processarPosicaoGps(lat, lon) {
  verificarBlocosVencidosGps();
  if (!lastPos || Math.abs(lat - lastPos.lat) + Math.abs(lon - lastPos.lon) > 0.0012) {
    lastPos = { lat: lat, lon: lon };
    consultarBairroApi(lat, lon)
      .then(function(res) {
        var b = res.bairro || "";
        if (b && bairros.indexOf(b) === -1) { bairros.push(b); saveAll(); }
        var prox = blkEndTarget ? " (fecha às " + fmtHora(blkEndTarget) + ")" : "";
        $("gps-info").textContent = "GPS ativo" + prox + " | Bairros: " + (bairros.join(", ") || "buscando...");
      })
      .catch(function(err) {
        saveAll();
        $("gps-info").textContent = "GPS ativo (aguardando rede: " + (err.message || "sem conexão") + ")...";
      });
  }
}

function startGps(retomando) {
  gpsParadoManualmente = false;
  sSet("qru_gps_ativo", "1");
  if (!blkStart) { blkStart = new Date(); if (!retomando) bairros = new Array(); }
  if (!blkEndTarget) blkEndTarget = calcularProximaHoraCheiaGps(blkStart);
  saveAll();
  $("b-gps-on").style.display = "none";
  $("b-gps-off").style.display = "inline-block";
  $("gps-info").textContent = "GPS ativo (fecha às " + fmtHora(blkEndTarget) + ")" + (bairros.length ? " | Bairros: " + bairros.join(", ") : "...");

  var BgGps = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.BackgroundGeolocation;
  if (BgGps) {
    if (watchId && typeof watchId === "string") BgGps.removeWatcher({ id: watchId }).catch(function() {});
    var retWatcher = BgGps.addWatcher(
      { backgroundTitle: "Patrulhamento GPS Ativo", backgroundMessage: "Próximo fechamento em hora cheia: " + fmtHora(blkEndTarget), requestPermissions: true, stale: false, distanceFilter: 15 },
      function(location, error) {
        if (error) {
          if (error.code === "NOT_AUTHORIZED" && confirm("Ative a permissão de localização 'Permitir o tempo todo' nas configurações.")) BgGps.openSettings();
          $("gps-info").textContent = "Aviso GPS: " + (error.message || error.code);
          return;
        }
        if (location) processarPosicaoGps(location.latitude, location.longitude);
      }
    );
    if (retWatcher && typeof retWatcher.then === "function") {
      retWatcher.then(function(res) {
        var id = (res && typeof res === "object") ? res.id : res;
        if (gpsParadoManualmente && id) BgGps.removeWatcher({ id: id });
        else watchId = id;
      });
    } else {
      watchId = (retWatcher && typeof retWatcher === "object") ? retWatcher.id : retWatcher;
    }
  } else {
    if (!navigator.geolocation) return alert("Sem GPS neste aparelho.");
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    watchId = navigator.geolocation.watchPosition(function(p) { processarPosicaoGps(p.coords.latitude, p.coords.longitude); }, function(err) { $("gps-info").textContent = "Aviso GPS: " + err.message; }, { enableHighAccuracy: true, maximumAge: 0 });
  }
  if (timerId) clearInterval(timerId);
  timerId = setInterval(function() { verificarBlocosVencidosGps(); }, 15000);
}
function stopGps() {
  gpsParadoManualmente = true;
  sDel("qru_gps_ativo");
  blkStart = null;
  blkEndTarget = null;
  bairros = new Array();
  lastPos = null;

  var BgGps = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.BackgroundGeolocation;
  if (watchId !== null && watchId !== undefined) {
    if (BgGps && typeof watchId === "string") BgGps.removeWatcher({ id: watchId });
    else if (navigator.geolocation) navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  if (timerId) { clearInterval(timerId); timerId = null; }
  $("b-gps-on").style.display = "inline-block";
  $("b-gps-off").style.display = "none";
  $("gps-info").textContent = "GPS encerrado.";
  saveAll();
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
  }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
}

function fmtHora(d) { return two(d.getHours()) + ":" + two(d.getMinutes()); }

function fecharBlocoGps() {
  var now = new Date();
  var ini = fmtHora(blkStart || now);
  var fim = fmtHora(now);
  var txtB = bairros.length ? bairros.join(", ") : "             ";
  addItem("Das " + ini + " às " + fim + " - Patrulhamento pelos bairros " + txtB + ".");
  blkStart = new Date(now.getTime());
  blkEndTarget = calcularProximaHoraCheiaGps(blkStart);
  bairros = new Array();
  saveAll();
  if ($("gps-info") && !gpsParadoManualmente) {
    $("gps-info").textContent = "Bloco fechado. Próximo às " + fmtHora(blkEndTarget) + ".";
  }
}

function extrairMinutosInicioLinha(linha) {
  var semNum = linha.replace(/^[0-9]+\.\s*/, "").trim();
  var m = semNum.match(/^(?:Das|Às|As)\s+([0-9]{1,2}):([0-9]{2})/i);
  if (!m) return null;
  var hh = parseInt(m.slice(1, 2).join(""), 10);
  var mm = parseInt(m.slice(2, 3).join(""), 10);
  return (hh * 60) + mm;
}

function addItem(txt, forcarFinal) {
  var ta = $("txt-body");
  var lines = ta.value.trim().split(NL).filter(function(x) { return x.trim() !== ""; });
  var novoMin = forcarFinal ? null : extrairMinutosInicioLinha(txt);

  if (novoMin !== null && lines.length > 0) {
    var baseMin = null;
    for (var b = 0; b < lines.length; b++) {
      var m0 = extrairMinutosInicioLinha(lines[b]);
      if (m0 !== null) { baseMin = m0; break; }
    }
    if (baseMin === null && $("f-hora") && $("f-hora").value) {
      var tCab = extractTimes($("f-hora").value);
      if (tCab.length > 0) {
        var pCab = tCab[0].split(":");
        baseMin = (parseInt(pCab[0], 10) * 60) + parseInt(pCab[1], 10);
      }
    }
    var ajustarTurno = function(minVal) {
      if (baseMin !== null && baseMin >= 720 && minVal < 360) return minVal + 1440;
      return minVal;
    };
    var novoAjustado = ajustarTurno(novoMin);
    var inserido = false;
    for (var i = 0; i < lines.length; i++) {
      var lCur = lines[i];
      if (lCur.indexOf("Assunção do serviço") > -1) continue;
      if (lCur.indexOf("encerramento do serviço") > -1) {
        lines.splice(i, 0, "0. " + txt);
        inserido = true;
        break;
      }
      var curMin = extrairMinutosInicioLinha(lCur);
      if (curMin !== null && novoAjustado < ajustarTurno(curMin)) {
        lines.splice(i, 0, "0. " + txt);
        inserido = true;
        break;
      }
    }
    if (!inserido) lines.push("0. " + txt);
  } else {
    lines.push("0. " + txt);
  }

  var c = 1;
  var renumeradas = lines.map(function(l) {
    var dot = l.indexOf(".");
    if (dot > 0 && isNum(l.slice(0, dot).trim())) return (c++) + l.slice(dot);
    return (c++) + ". " + l;
  });
  ta.value = renumeradas.join(NL);
}
function limparCampos() {
  $("f-doc").value = "FOLHA DE QRU";
  $("f-uni").value = "";
  $("out-uni").value = "";
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
    if (Fs.requestPermissions) await Fs.requestPermissions().catch(function() {});
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

async function exportarArquivoNativo(nomeArquivo, conteudo, isBase64, titulo) {
  var Fs = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem;
  var Share = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Share;
  if (Fs && Share) {
    try {
      var writeOpts = { path: nomeArquivo, data: conteudo, directory: "CACHE" };
      if (!isBase64) writeOpts.encoding = "utf8";
      var resFile = await Fs.writeFile(writeOpts);
      await Share.share({ title: titulo || nomeArquivo, url: resFile.uri, dialogTitle: "Exportar " + (titulo || nomeArquivo) });
      return true;
    } catch (e) {
      if (e && e.message && e.message.toLowerCase().indexOf("cancel") > -1) return true;
    }
  }
  try {
    var blob;
    var mimeType = isBase64 ? "image/jpeg" : "text/plain;charset=utf-8";
    if (isBase64) {
      var dataUrl = conteudo.indexOf("data:") === 0 ? conteudo : ("data:image/jpeg;base64," + conteudo);
      var res = await fetch(dataUrl);
      blob = await res.blob();
    } else {
      blob = new Blob(new Array(conteudo), { type: mimeType });
    }
    var file = new File(new Array(blob), nomeArquivo, { type: mimeType });
    if (navigator.canShare && navigator.canShare({ files: new Array(file) })) {
      await navigator.share({ title: titulo || nomeArquivo, files: new Array(file) });
      return true;
    }
  } catch (e2) {
    if (e2 && e2.name === "AbortError") return true;
  }
  var caminhoSalvo = await salvarNaPastaAndroid(nomeArquivo, conteudo, isBase64);
  if (caminhoSalvo) { alert("Arquivo salvo em:\n" + caminhoSalvo); return true; }
  var a = document.createElement("a");
  if (isBase64) a.href = conteudo.indexOf("data:") === 0 ? conteudo : ("data:image/jpeg;base64," + conteudo);
  else a.href = URL.createObjectURL(new Blob(new Array(conteudo), { type: "text/plain;charset=utf-8" }));
  a.download = nomeArquivo;
  a.click();
  return true;
}

function obterNomeDocumentoAtual() {
  if (modoDocumentoAtual === "RELATORIO_BO") return "Relatório BO";
  if (modoDocumentoAtual === "RELATORIO") return "Relatório";
  return "Folha de QRU";
}

function obterPrefixoArquivoAtual() {
  if (modoDocumentoAtual === "RELATORIO_BO") return "Relatorio_BO_";
  if (modoDocumentoAtual === "RELATORIO") return "Relatorio_";
  return "Folha_de_QRU_";
}

async function abrirModalKmFin() {
  if (isModoRelatorio()) {
    stopGps();
    var lines = $("txt-body").value.trim().split(NL), prevEnd = "   ";
    for (var i = lines.length - 1; i >= 0; i--) {
      var times = extractTimes(lines.slice(i, i + 1).join("").replace("-", " ").replace(",", " "));
      if (times.length > 0) { prevEnd = times.slice(-1).join(""); break; }
    }
    addItem("Das " + prevEnd + " às    - Pela base, preenchimento de RSO, desequipagem da viatura e encerramento do serviço.", true);
    var hoje = getToday();
    var nomeDoc = obterNomeDocumentoAtual();
    var prefixo = obterPrefixoArquivoAtual();
    var textoFinal = getFullText(false);
    registrarTrabalhoSalvo(nomeDoc + " - " + hoje, textoFinal, "");
    sDel("qru_draft");
    var caminhoSalvo = await salvarNaPastaAndroid(prefixo + hoje.split("/").join("-") + ".txt", textoFinal, false);
    limparCampos();
    alert(caminhoSalvo ? nomeDoc + " encerrado e salvo em:\n" + caminhoSalvo : nomeDoc + " encerrado e salvo em Trabalhos Salvos!");
    voltarInicio();
  } else {
    $("modal-kmi-info").textContent = "KM Inicial informado: " + ($("f-kmi").value.trim() || "não preenchido");
    $("modal-kmf-input").value = $("f-kmf").value.trim();
    $("modal-km").style.display = "flex";
  }
}

function fecharModalKm() {
  $("modal-km").style.display = "none";
}

async function confirmarKmFin() {
  var kmfVal = $("modal-kmf-input").value.trim();
  if (!kmfVal) return alert("Informe o KM Final.");
  $("f-kmf").value = kmfVal;
  calcKm();
  $("modal-km").style.display = "none";
  stopGps();
  var timesCab = extractTimes($("f-hora").value);
  var horaFimCab = timesCab.length >= 2 ? timesCab[1] : "   ";
  var lines = $("txt-body").value.trim().split(NL), prevEnd = "   ";
  for (var i = lines.length - 1; i >= 0; i--) {
    var times = extractTimes(lines[i].replace("-", " ").replace(",", " "));
    if (times.length > 0) { prevEnd = times[times.length - 1]; break; }
  }
  addItem("Das " + prevEnd + " às " + horaFimCab + " - Pela base, preenchimento de RSO, desequipagem da viatura e encerramento do serviço.", true);
  refreshPreview();
  var dt = $("f-data").value.trim() || getToday();
  var textoFinal = getFullText(false);
  registrarTrabalhoSalvo("Folha de QRU - " + dt, textoFinal, "");
  sDel("qru_draft");
  var caminhoSalvo = await salvarNaPastaAndroid("Folha_de_QRU_" + dt.split("/").join("-") + ".txt", textoFinal, false);
  limparCampos();
  alert(caminhoSalvo ? "Folha de QRU encerrada e salva em:\n" + caminhoSalvo : "Folha de QRU encerrada e salva em Trabalhos Salvos!");
  voltarInicio();
}

function getFullText(modoWpp) {
  if (isModoRelatorio()) {
    var titulo = obterNomeDocumentoAtual().toUpperCase();
    if (modoWpp) return centralizarLinhaWpp(titulo) + NL + "\u200B" + NL + formatarCorpoQruWpp($("txt-body").value);
    return titulo + NL + NL + $("txt-body").value;
  }
  var inst = "Polícia Militar do Estado de São Paulo";
  var uni = $("out-uni").value.trim();
  var temBat = $("f-uni").value.trim() !== "" && uni !== "";
  var doc = "FOLHA DE QRU";

  if (modoWpp) {
    var topoWpp = temBat ? (centralizarLinhaWpp(inst) + NL + centralizarLinhaWpp(uni) + NL + "\u200B" + NL) : "";
    return topoWpp + centralizarLinhaWpp(doc) + NL + "\u200B" + NL + formatarCabecalhoQruTexto(true) + NL + "\u200B" + NL + formatarCorpoQruWpp($("txt-body").value);
  }
  var esp = Math.max(0, Math.floor((42 - doc.length) / 2));
  var docCent = new Array(esp + 1).join(" ") + doc;
  var topoTxt = temBat ? (inst + NL + uni + NL + NL) : "";
  return topoTxt + docCent + NL + NL + formatarCabecalhoQruTexto(false) + NL + NL + $("txt-body").value;
}

function sendWhats() {
  var txtWpp = getFullText(true);
  var txtPuro = getFullText(false);
  var dt = isModoRelatorio() ? getToday() : ($("f-data").value.trim() || getToday());
  var origem = obterNomeDocumentoAtual();
  registrarTrabalhoSalvo(origem + " - " + dt, txtPuro, "");
  enviarWpp(txtWpp);
}

async function exportTxt() {
  var txt = getFullText(false);
  var dtCab = isModoRelatorio() ? getToday() : ($("f-data").value.trim() || getToday());
  var dt = dtCab.split("/").join("-");
  var origem = obterNomeDocumentoAtual();
  registrarTrabalhoSalvo(origem + " - " + dtCab, txt, "");
  await exportarArquivoNativo(obterPrefixoArquivoAtual() + dt + ".txt", txt, false, origem);
}

function copiarQru() {
  copiarTextoSeguro(getFullText(false), obterNomeDocumentoAtual() + " copiado!");
}

async function salvarQruCelular() {
  var txt = getFullText(false);
  var dtCab = isModoRelatorio() ? getToday() : ($("f-data").value.trim() || getToday());
  var dt = dtCab.split("/").join("-");
  var origem = obterNomeDocumentoAtual();
  registrarTrabalhoSalvo(origem + " - " + dtCab, txt, "");
  await baixarOuSalvarDireto(obterPrefixoArquivoAtual() + dt + ".txt", txt, false);
}
function alternarNovidadesBox() {
  var box = $("novidades-box");
  if (!box) return;
  box.style.display = (box.style.display === "none" || box.style.display === "") ? "block" : "none";
}

function selecionarNovidade(tipo) {
  var atual = $("nov-tipo").value;
  $("nov-tipo").value = (atual === tipo) ? "" : tipo;
  mudarTipoNovidade();
}

function mudarTipoNovidade() {
  var tipo = $("nov-tipo").value;
  var tipos = ["OCORRENCIAS", "REFEICAO", "REABASTECIMENTO", "ABORDAGEM", "BUSCA_DOMICILIAR", "APOIO", "ESTACIONAMENTO", "COMPLETO"];
  for (var i = 0; i < tipos.length; i++) {
    var btn = $("btn-nov-" + tipos[i]);
    if (btn) {
      if (tipos[i] === tipo) btn.classList.add("ativo");
      else btn.classList.remove("ativo");
    }
  }
  $("nov-form-ocorrencias").style.display = (tipo === "OCORRENCIAS") ? "block" : "none";
  $("nov-form-refeicao").style.display = (tipo === "REFEICAO") ? "block" : "none";
  $("nov-form-reabastecimento").style.display = (tipo === "REABASTECIMENTO") ? "block" : "none";
  $("nov-form-abordagem").style.display = (tipo === "ABORDAGEM") ? "block" : "none";
  $("nov-form-busca").style.display = (tipo === "BUSCA_DOMICILIAR") ? "block" : "none";
  $("nov-form-apoio").style.display = (tipo === "APOIO") ? "block" : "none";
  if ($("nov-form-estacionamento")) $("nov-form-estacionamento").style.display = (tipo === "ESTACIONAMENTO") ? "block" : "none";
  $("nov-form-completo").style.display = (tipo === "COMPLETO") ? "block" : "none";
  if (tipo === "ABORDAGEM" && novAbordados.abo.length === 0) adicionarAbordadoNovidade("abo");
  if (tipo === "COMPLETO" && novAbordados.cmp.length === 0) adicionarAbordadoNovidade("cmp");
}

function formatarHoraNovidade(idCampo) {
  var el = $(idCampo);
  if (!el || !el.value.trim()) return;
  el.value = formatarHoraUnica(el.value);
}

function formatarDpNovidade(idCampo) {
  var el = $(idCampo);
  if (!el || !el.value.trim()) return;
  el.value = formatarDpTexto(el.value);
}

function formatarTextoMilitarCampo(idCampo) {
  var el = $(idCampo);
  if (!el || !el.value.trim()) return;
  el.value = formatarTextoMilitar(el.value);
}

function formatarGeralNovidade(idCampo) {
  var el = $(idCampo);
  if (!el || !el.value.trim()) return;
  var txt = formatarTextoMilitar(el.value);
  el.value = normalizarCidadesEAcentos(titleCase(txt))
    .replace(/\bDp\b/g, "DP").replace(/\bCpj\b/g, "CPJ").replace(/\bPs\b/g, "PS").replace(/\bUpa\b/g, "UPA")
    .replace(/\bPm\b/g, "PM").replace(/\bBaep\b/g, "BAEP").replace(/\bBpm\/i\b/gi, "BPM/I").replace(/\bBpm\/m\b/gi, "BPM/M")
    .replace(/\bBpchq\b/gi, "BPChq").replace(/\bAep\b/g, "AEP").replace(/\bCia\b/g, "Cia").replace(/\bGcm\b/g, "GCM")
    .replace(/\bPmesp\b/g, "PMESP").replace(/\bSamu\b/g, "SAMU").replace(/\bBopm\b/g, "BOPM").replace(/\bBopc\b/g, "BOPC").replace(/\bRso\b/g, "RSO");
}

function formatarMoedaNovidade(idCampo) {
  var el = $(idCampo);
  if (!el) return;
  var v = el.value.replace(/R\$/gi, "").trim();
  if (!v) return;
  v = v.replace(/\./g, "").replace(",", ".");
  var num = parseFloat(v);
  if (!isNaN(num)) el.value = "R$ " + num.toFixed(2).replace(".", ",");
}

function formatarPlacaVeiculoCampo(idCampo) {
  var el = $(idCampo);
  if (!el) return;
  var v = el.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (/^[A-Z]{3}[0-9]{4}$/.test(v)) el.value = v.slice(0, 3) + "-" + v.slice(3, 7);
  else el.value = v;
}

function formatarCpfTexto(raw) {
  var d = (raw || "").replace(/[^0-9]/g, "");
  if (d.length === 11) return d.slice(0, 3) + "." + d.slice(3, 6) + "." + d.slice(6, 9) + "-" + d.slice(9, 11);
  return (raw || "").trim();
}

function obterPreposicaoLocal(localTxt, tipoPrep) {
  var w0 = (localTxt || "").trim().split(" ").slice(0, 1).join("").toLowerCase().replace(/[^a-zà-ÿ]/g, "");
  var femPalavras = new Array("base", "cia", "companhia", "sede", "unidade", "viatura", "vtr", "av", "avenida", "rua", "praca", "praça", "rodovia", "estrada", "alameda", "travessa", "lanchonete", "padaria", "churrascaria", "pizzaria", "cantina", "copa", "delegacia");
  var ehFem = (femPalavras.indexOf(w0) > -1) || (w0.length > 2 && w0.slice(-1) === "a" && w0 !== "restaurante");
  if (tipoPrep === "a") return ehFem ? "à" : "ao";
  return ehFem ? "pela" : "pelo";
}

function limparFormNovidade(prefixo) {
  var inputs = document.querySelectorAll('[id^="' + prefixo + '-"]');
  for (var i = 0; i < inputs.length; i++) {
    if (inputs[i].type === "checkbox") inputs[i].checked = false;
    else inputs[i].value = "";
  }
}
async function concluirAcaoNovidade(acao, texto, tituloArq, fnLimpar) {
  if (acao === "inserir") {
    addItem(texto);
    if (!gpsParadoManualmente && (watchId !== null || sGet("qru_gps_ativo") === "1")) {
      var timesNov = extractTimes(texto);
      var horaRefStr = timesNov.length > 0 ? timesNov[timesNov.length - 1] : fmtHora(new Date());
      var pNov = horaRefStr.split(":");
      var novaBase = new Date();
      novaBase.setHours(parseInt(pNov[0], 10), parseInt(pNov[1], 10), 0, 0);
      blkStart = novaBase;
      blkEndTarget = calcularProximaHoraCheiaGps(blkStart);
      bairros = new Array();
      if ($("gps-info")) $("gps-info").textContent = "GPS ativo (fecha às " + fmtHora(blkEndTarget) + ") | Bairros: buscando...";
    }
    saveAll();
    if (fnLimpar) fnLimpar();
    $("nov-tipo").value = "";
    mudarTipoNovidade();
  } else if (acao === "wpp") {
    registrarTrabalhoSalvo(tituloArq + " - " + getToday(), texto, "");
    enviarWpp(texto);
  } else if (acao === "exp") {
    registrarTrabalhoSalvo(tituloArq + " - " + getToday(), texto, "");
    var nomeArq = tituloArq.replace(/[^a-zA-Z0-9_-]/g, "_") + "_" + getToday().split("/").join("-") + ".txt";
    await exportarArquivoNativo(nomeArq, texto, false, tituloArq);
  }
}

function montarTextoPartes(prefixo) {
  var pMasc = parseInt($(prefixo + "-pmasc").value, 10) || 0;
  var mMasc = parseInt($(prefixo + "-mmasc").value, 10) || 0;
  var pFem = parseInt($(prefixo + "-pfem").value, 10) || 0;
  var mFem = parseInt($(prefixo + "-mfem").value, 10) || 0;
  var total = pMasc + mMasc + pFem + mFem;
  if (total === 0) return { total: 0, texto: "" };
  var lista = new Array();
  if (pMasc > 0) lista.push(two(pMasc) + (pMasc === 1 ? " parte maior masculina" : " partes maiores masculinas"));
  if (mMasc > 0) lista.push(two(mMasc) + (mMasc === 1 ? " parte menor masculina" : " partes menores masculinas"));
  if (pFem > 0) lista.push(two(pFem) + (pFem === 1 ? " parte maior feminina" : " partes maiores femininas"));
  if (mFem > 0) lista.push(two(mFem) + (mFem === 1 ? " parte menor feminina" : " partes menores femininas"));
  var desc = lista.length === 1 ? lista[0] : (lista.slice(0, -1).join(", ") + " e " + lista.slice(-1).join(""));
  return { total: total, texto: desc };
}

function montarListaApreensoesArtigos(prefixo) {
  var itens = new Array();
  if ($(prefixo + "-ap-arma").checked) itens.push("a arma");
  if ($(prefixo + "-ap-armas").checked) itens.push("as armas");
  if ($(prefixo + "-ap-droga").checked) itens.push("a droga");
  if ($(prefixo + "-ap-drogas").checked) itens.push("as drogas");
  if ($(prefixo + "-ap-din").checked) itens.push("o dinheiro");
  var outros = $(prefixo + "-ap-outros").value.trim();
  if (outros) {
    var outrosFmt = normalizarCidadesEAcentos(outros);
    if (/^(?:o|a|os|as)\s+/i.test(outrosFmt)) itens.push(outrosFmt);
    else itens.push("os demais objetos (" + outrosFmt + ")");
  }
  if (itens.length === 0) return "";
  if (itens.length === 1) return itens[0];
  return itens.slice(0, -1).join(", ") + " e " + itens.slice(-1).join("");
}

function processarNovidadeOcorrencias(acao) {
  formatarHoraNovidade("nov-oc-hora");
  formatarGeralNovidade("nov-oc-nat");
  formatarGeralNovidade("nov-oc-ps");
  formatarMedicoCrmCampo("nov-oc-med");
  formatarDpNovidade("nov-oc-dp");

  var hrIni = $("nov-oc-hora").value.trim() || fmtHora(new Date());
  var hrFim = fmtHora(new Date());
  var nat = $("nov-oc-nat").value.trim();
  var partesInfo = montarTextoPartes("nov-oc");
  var ps = $("nov-oc-ps").value.trim();
  var med = $("nov-oc-med").value.trim();
  var aprStr = montarListaApreensoesArtigos("nov-oc");
  var dp = $("nov-oc-dp").value.trim();
  var bopm = $("nov-oc-bopm").value.trim().toUpperCase();
  var bopc = $("nov-oc-bopc").value.trim().toUpperCase();

  var pl = partesInfo.total > 1;
  var cond = pl ? "conduzidas" : "conduzida";
  var aten = pl ? "atendidas e liberadas" : "atendida e liberada";

  var texto = "Das " + hrIni + " às " + hrFim + " - ";
  if (partesInfo.total > 0) {
    texto += "Flagrante" + (nat ? " de " + nat : "") + ", " + partesInfo.texto;
    if (ps) {
      texto += " " + cond + " ao " + ps;
      if (med) texto += ", " + aten + " pelo " + med;
      if (dp) texto += ", e após isso, " + cond + (aprStr ? " juntamente com " + aprStr : "") + " ao " + dp;
    } else if (dp) {
      texto += " " + cond + (aprStr ? " juntamente com " + aprStr : "") + " ao " + dp;
    }
  } else {
    texto += (nat ? nat : "Ocorrência");
    if (aprStr && dp) texto += ", apresentadas " + aprStr + " no " + dp;
    else if (dp) texto += ", apresentada no " + dp;
    else if (aprStr) texto += ", apreendidas " + aprStr;
  }

  var docs = new Array();
  if (bopm) docs.push("BOPM " + bopm);
  if (bopc) docs.push("BOPC " + bopc);
  if (docs.length > 0) texto += ", " + docs.join(" e ") + " a respeito.";
  else texto += ".";

  concluirAcaoNovidade(acao, texto, "Ocorrencia", function() { limparFormNovidade("nov-oc"); });
}
function processarNovidadeRefeicao(acao) {
  formatarHoraNovidade("nov-ref-hpeg");
  formatarLocalCampo("nov-ref-lpeg");
  formatarHoraNovidade("nov-ref-hcheg");
  formatarLocalCampo("nov-ref-lefet");
  formatarHoraNovidade("nov-ref-henc");

  var hPeg = $("nov-ref-hpeg").value.trim();
  var lPeg = $("nov-ref-lpeg").value.trim();
  var hCheg = $("nov-ref-hcheg").value.trim();
  var lEfet = $("nov-ref-lefet").value.trim();
  var hEnc = $("nov-ref-henc").value.trim() || fmtHora(new Date());

  var prepPeg = obterPreposicaoLocal(lPeg, "pelo");
  var prepEfetPelo = obterPreposicaoLocal(lEfet, "pelo");
  var prepEfetA = obterPreposicaoLocal(lEfet, "a");

  if (lPeg && lEfet) {
    var hMeio = hCheg || hPeg || fmtHora(new Date());
    var hIni1 = hPeg || hMeio;
    var txt1 = "Das " + hIni1 + " às " + hMeio + " - Colhida refeição " + prepPeg + " " + lPeg + " e deslocamento " + prepEfetA + " " + lEfet + ".";
    var txt2 = "Das " + hMeio + " às " + hEnc + " - Refeição " + prepEfetPelo + " " + lEfet + ".";
    if (acao === "inserir") {
      addItem(txt1); addItem(txt2); saveAll(); limparFormNovidade("nov-ref");
      $("nov-tipo").value = ""; mudarTipoNovidade();
    } else {
      concluirAcaoNovidade(acao, txt1 + NL + txt2, "Refeicao", null);
    }
    return;
  }

  var hIniUnico = hCheg || hPeg || fmtHora(new Date());
  var txtUnico = "";
  if (lEfet) txtUnico = "Das " + hIniUnico + " às " + hEnc + " - Refeição " + prepEfetPelo + " " + lEfet + ".";
  else if (lPeg) txtUnico = "Das " + hIniUnico + " às " + hEnc + " - Colhida refeição " + prepPeg + " " + lPeg + ".";
  else txtUnico = "Das " + hIniUnico + " às " + hEnc + " - Refeição.";
  concluirAcaoNovidade(acao, txtUnico, "Refeicao", function() { limparFormNovidade("nov-ref"); });
}

function processarNovidadeReabastecimento(acao) {
  formatarHoraNovidade("nov-rea-hora");
  formatarLocalCampo("nov-rea-local");
  formatarGeralNovidade("nov-rea-comb");
  formatarMoedaNovidade("nov-rea-valor");

  var hora = $("nov-rea-hora").value.trim();
  var local = $("nov-rea-local").value.trim();
  var litros = $("nov-rea-litros").value.trim();
  var comb = $("nov-rea-comb").value.trim();
  var valor = $("nov-rea-valor").value.trim();
  var km = $("nov-rea-km").value.trim();

  if (!hora || !local || !litros || !comb || !valor || !km) {
    return alert("Preencha todos os campos do Reabastecimento (Hora, Local, Litros, Combustível, R$ e KM).");
  }

  var prepLocal = obterPreposicaoLocal(local, "pelo");
  var litrosTxt = /litro/i.test(litros) ? litros : (litros + " litros");
  var kmTxt = /^km/i.test(km) ? km : ("KM " + km);
  var texto = "Às " + hora + " - Reabastecimento da viatura " + prepLocal + " " + local + ", reabastecidos " + litrosTxt + " de " + comb + ", " + valor + ", " + kmTxt + ".";
  concluirAcaoNovidade(acao, texto, "Reabastecimento", function() { limparFormNovidade("nov-rea"); });
}

function adicionarAbordadoNovidade(prefixo) {
  novAbordados[prefixo].push({ nome: "", rg: "", cpf: "", cnh: "", situacao: "liberado" });
  renderizarAbordadosNovidade(prefixo);
}

function removerAbordadoNovidade(prefixo, idx) {
  novAbordados[prefixo].splice(idx, 1);
  renderizarAbordadosNovidade(prefixo);
}

function onAbordadoNovidadeInput(prefixo, idx, campo, valor) {
  if (novAbordados[prefixo][idx]) novAbordados[prefixo][idx][campo] = valor;
}

function onAbordadoNovidadeBlur(prefixo, idx, campo, inputEl) {
  if (!novAbordados[prefixo][idx]) return;
  var val = inputEl.value;
  if (campo === "nome") val = formatarNomePessoa(val);
  else if (campo === "rg") val = formatarRgTexto(val);
  else if (campo === "cpf") val = formatarCpfTexto(val);
  inputEl.value = val;
  novAbordados[prefixo][idx][campo] = val;
}

function renderizarAbordadosNovidade(prefixo) {
  var box = $("nov-" + prefixo + "-pessoas-box");
  if (!box) return;
  var lista = novAbordados[prefixo];
  var html = "";
  for (var i = 0; i < lista.length; i++) {
    var p = lista[i];
    var nomeEsc = (p.nome || "").replace(/"/g, "&quot;");
    var rgEsc = (p.rg || "").replace(/"/g, "&quot;");
    var cpfEsc = (p.cpf || "").replace(/"/g, "&quot;");
    var cnhEsc = (p.cnh || "").replace(/"/g, "&quot;");
    html += '<div class="env-box">' +
      '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">' +
        '<strong style="font-size:12px; color:#eab308;">Abordado ' + (lista.length > 1 ? (i + 1) : "") + '</strong>' +
        '<button type="button" class="btn-small" style="background:#dc2626;border:none;padding:4px 8px;" onclick="removerAbordadoNovidade(\'' + prefixo + '\', ' + i + ')">X</button>' +
      '</div>' +
      '<div class="row" style="margin-bottom:6px;"><span class="dot"></span><span class="lbl">Nome:</span><input type="text" value="' + nomeEsc + '" oninput="onAbordadoNovidadeInput(\'' + prefixo + '\', ' + i + ', \'nome\', this.value)" onblur="onAbordadoNovidadeBlur(\'' + prefixo + '\', ' + i + ', \'nome\', this)"></div>' +
      '<div class="row" style="margin-bottom:6px;"><span class="dot"></span><span class="lbl">RG:</span><input type="text" value="' + rgEsc + '" oninput="onAbordadoNovidadeInput(\'' + prefixo + '\', ' + i + ', \'rg\', this.value)" onblur="onAbordadoNovidadeBlur(\'' + prefixo + '\', ' + i + ', \'rg\', this)"></div>' +
      '<div class="row" style="margin-bottom:6px;"><span class="dot"></span><span class="lbl">CPF:</span><input type="text" value="' + cpfEsc + '" oninput="onAbordadoNovidadeInput(\'' + prefixo + '\', ' + i + ', \'cpf\', this.value)" onblur="onAbordadoNovidadeBlur(\'' + prefixo + '\', ' + i + ', \'cpf\', this)"></div>' +
      '<div class="row" style="margin-bottom:6px;"><span class="dot"></span><span class="lbl">CNH:</span><input type="text" value="' + cnhEsc + '" oninput="onAbordadoNovidadeInput(\'' + prefixo + '\', ' + i + ', \'cnh\', this.value)"></div>' +
      '<div class="row" style="margin-bottom:0;"><span class="dot"></span><span class="lbl">Situação:</span>' +
        '<select onchange="onAbordadoNovidadeInput(\'' + prefixo + '\', ' + i + ', \'situacao\', this.value)">' +
          '<option value="liberado"' + (p.situacao === "liberado" ? " selected" : "") + '>Liberado</option>' +
          '<option value="conduzido"' + (p.situacao === "conduzido" ? " selected" : "") + '>Conduzido</option>' +
          '<option value="preso"' + (p.situacao === "preso" ? " selected" : "") + '>Preso</option>' +
        '</select>' +
      '</div>' +
    '</div>';
  }
  box.innerHTML = html;
}
function alternarTerceiroVeiculo(prefixo) {
  var sit = $("nov-" + prefixo + "-sitvei").value;
  $("nov-" + prefixo + "-terceiro-box").style.display = (sit === "terceiro") ? "block" : "none";
}

function alternarCamposBusca(prefixo) {
  if (prefixo === "cmp") $("nov-cmp-busca-detalhes").style.display = ($("nov-cmp-busca").value === "SIM") ? "block" : "none";
  $("nov-" + prefixo + "-nummand-row").style.display = ($("nov-" + prefixo + "-mand").value === "SIM") ? "flex" : "none";
  $("nov-" + prefixo + "-quem-row").style.display = ($("nov-" + prefixo + "-cons").value === "SIM") ? "flex" : "none";
}

function montarDescricaoAbordados(prefixo) {
  var lista = novAbordados[prefixo] || new Array();
  var descricoes = new Array();
  for (var i = 0; i < lista.length; i++) {
    var p = lista[i];
    if (!p.nome && !p.rg && !p.cpf && !p.cnh) continue;
    var sub = new Array();
    if (p.nome) sub.push(formatarNomePessoa(p.nome));
    if (p.rg) sub.push("RG " + formatarRgTexto(p.rg));
    if (p.cpf) sub.push("CPF " + formatarCpfTexto(p.cpf));
    if (p.cnh) sub.push("CNH " + p.cnh.trim());
    var strP = sub.join(", ");
    if (p.situacao) strP += " (" + p.situacao + ")";
    descricoes.push(strP);
  }
  if (descricoes.length === 0) return "";
  if (descricoes.length === 1) return descricoes.slice(0, 1).join("");
  return descricoes.slice(0, -1).join(", ") + " e " + descricoes.slice(-1).join("");
}

function montarDescricaoVeiculoNovidade(prefixo) {
  var vei = $("nov-" + prefixo + "-vei").value.trim();
  var cor = $("nov-" + prefixo + "-cor").value.trim();
  var placa = $("nov-" + prefixo + "-placa").value.trim();
  var sitVei = $("nov-" + prefixo + "-sitvei").value;
  if (!vei && !cor && !placa && !sitVei) return "";
  var partesV = new Array();
  if (vei) partesV.push("veículo " + vei);
  if (cor) partesV.push("cor " + cor);
  if (placa) partesV.push("placa " + placa);
  if (sitVei === "liberado") partesV.push("veículo liberado");
  else if (sitVei === "apreendido") partesV.push("veículo apreendido");
  else if (sitVei === "terceiro") {
    var tNome = $("nov-" + prefixo + "-t-nome").value.trim();
    var tRg = $("nov-" + prefixo + "-t-rg").value.trim();
    var tCnh = $("nov-" + prefixo + "-t-cnh").value.trim();
    var tPartes = new Array();
    if (tNome) tPartes.push(formatarNomePessoa(tNome));
    if (tRg) tPartes.push("RG " + formatarRgTexto(tRg));
    if (tCnh) tPartes.push("CNH " + tCnh);
    partesV.push("veículo liberado a terceiro" + (tPartes.length ? " " + tPartes.join(", ") : ""));
  }
  return partesV.join(", ");
}

function limparFormAbordagem() {
  limparFormNovidade("nov-abo");
  novAbordados.abo = new Array();
  renderizarAbordadosNovidade("abo");
  alternarTerceiroVeiculo("abo");
}

function processarNovidadeAbordagem(acao) {
  formatarHoraNovidade("nov-abo-hora");
  formatarLocalCampo("nov-abo-local");
  formatarGeralNovidade("nov-abo-vei");
  formatarGeralNovidade("nov-abo-cor");
  formatarPlacaVeiculoCampo("nov-abo-placa");
  $("nov-abo-t-nome").value = formatarNomePessoa($("nov-abo-t-nome").value);
  formatarTextoMilitarCampo("nov-abo-obs");

  var hora = $("nov-abo-hora").value.trim() || fmtHora(new Date());
  var local = $("nov-abo-local").value.trim();
  var pessoasTxt = montarDescricaoAbordados("abo");
  var veiTxt = montarDescricaoVeiculoNovidade("abo");
  var obs = $("nov-abo-obs").value.trim();

  var texto = "Às " + hora + " - Abordagem";
  if (local) texto += " " + obterPreposicaoLocal(local, "pelo") + " " + local;
  if (pessoasTxt) { texto += " a " + pessoasTxt; if (veiTxt) texto += ", " + veiTxt; }
  else if (veiTxt) texto += " ao " + veiTxt;
  texto += ".";
  if (obs) texto += " Obs.: " + obs + (obs.slice(-1) === "." ? "" : ".");
  concluirAcaoNovidade(acao, texto, "Abordagem", limparFormAbordagem);
}

function limparFormBusca() {
  limparFormNovidade("nov-bus");
  $("nov-bus-mand").value = "NAO"; $("nov-bus-cons").value = "NAO"; $("nov-bus-evid").value = "NAO";
  alternarCamposBusca("bus");
}

function processarNovidadeBusca(acao) {
  formatarHoraNovidade("nov-bus-hora");
  formatarLocalCampo("nov-bus-local");
  $("nov-bus-quem").value = formatarNomePessoa($("nov-bus-quem").value);
  formatarTextoMilitarCampo("nov-bus-obs");

  var hrIni = $("nov-bus-hora").value.trim() || fmtHora(new Date());
  var hrFim = fmtHora(new Date());
  var local = $("nov-bus-local").value.trim();
  var mand = $("nov-bus-mand").value === "SIM";
  var numMand = $("nov-bus-nummand").value.trim();
  var cons = $("nov-bus-cons").value === "SIM";
  var quem = $("nov-bus-quem").value.trim();
  var evid = $("nov-bus-evid").value === "SIM";
  var bopm = $("nov-bus-bopm").value.trim().toUpperCase();
  var bopc = $("nov-bus-bopc").value.trim().toUpperCase();
  var obs = $("nov-bus-obs").value.trim();

  var texto = "Das " + hrIni + " às " + hrFim + " - Busca domiciliar";
  if (local) texto += " " + obterPreposicaoLocal(local, "pelo") + " " + local;
  if (mand) texto += numMand ? (", em cumprimento ao mandado judicial nº " + numMand) : ", em cumprimento a mandado judicial";
  else if (cons) texto += ", sem mandado judicial, mediante consentimento" + (quem ? " de " + quem : "");
  else texto += ", sem mandado judicial e sem consentimento";
  if (evid) texto += ", com registro de evidências digitais";

  var docs = new Array();
  if (bopm) docs.push("BOPM " + bopm);
  if (bopc) docs.push("BOPC " + bopc);
  texto += (docs.length > 0) ? (", " + docs.join(" e ") + " a respeito.") : ".";
  if (obs) texto += " Obs.: " + obs + (obs.slice(-1) === "." ? "" : ".");
  concluirAcaoNovidade(acao, texto, "Busca_Domiciliar", limparFormBusca);
}
function processarNovidadeApoio(acao) {
  formatarHoraNovidade("nov-apo-hora"); formatarGeralNovidade("nov-apo-inst"); formatarVtrCampo("nov-apo-vtr");
  formatarLocalCampo("nov-apo-local"); formatarGeralNovidade("nov-apo-mot"); formatarTextoMilitarCampo("nov-apo-obs");

  var hrIni = $("nov-apo-hora").value.trim() || fmtHora(new Date());
  var hrFim = fmtHora(new Date());
  var inst = $("nov-apo-inst").value.trim(), vtr = $("nov-apo-vtr").value.trim(), local = $("nov-apo-local").value.trim(), mot = $("nov-apo-mot").value.trim();
  var bopm = $("nov-apo-bopm").value.trim().toUpperCase(), bopc = $("nov-apo-bopc").value.trim().toUpperCase(), obs = $("nov-apo-obs").value.trim();

  var texto = "Das " + hrIni + " às " + hrFim + " - Apoio";
  if (vtr && inst) texto += " à viatura " + vtr + " da " + inst;
  else if (vtr) texto += " à viatura " + vtr;
  else if (inst) texto += " à " + inst;
  if (local) texto += " " + obterPreposicaoLocal(local, "pelo") + " " + local;
  if (mot) texto += " em " + mot;

  var docs = new Array();
  if (bopm) docs.push("BOPM " + bopm);
  if (bopc) docs.push("BOPC " + bopc);
  texto += (docs.length > 0) ? (", " + docs.join(" e ") + " a respeito.") : ".";
  if (obs) texto += " Obs.: " + obs + (obs.slice(-1) === "." ? "" : ".");
  concluirAcaoNovidade(acao, texto, "Apoio", function() { limparFormNovidade("nov-apo"); });
}

function processarNovidadeEstacionamento(acao) {
  formatarHoraNovidade("nov-est-hcheg"); formatarLocalCampo("nov-est-local");
  var hrChegada = $("nov-est-hcheg").value.trim() || fmtHora(new Date());
  var hrEncerramento = fmtHora(new Date());
  var local = $("nov-est-local").value.trim();
  var texto = "Das " + hrChegada + " às " + hrEncerramento + " - Ponto de Estacionamento" + (local ? " " + obterPreposicaoLocal(local, "pelo") + " " + local : "") + ".";
  concluirAcaoNovidade(acao, texto, "Ponto_de_Estacionamento", function() { limparFormNovidade("nov-est"); });
}

function limparFormCompleto() {
  limparFormNovidade("nov-cmp"); novAbordados.cmp = new Array(); renderizarAbordadosNovidade("cmp"); alternarTerceiroVeiculo("cmp");
  $("nov-cmp-busca").value = ""; $("nov-cmp-mand").value = "NAO"; $("nov-cmp-cons").value = "NAO"; $("nov-cmp-evid").value = "NAO";
  alternarCamposBusca("cmp");
}

function processarNovidadeCompleto(acao) {
  formatarHoraNovidade("nov-cmp-hora"); formatarLocalCampo("nov-cmp-local"); formatarGeralNovidade("nov-cmp-inst"); formatarVtrCampo("nov-cmp-vtr");
  formatarGeralNovidade("nov-cmp-nat"); formatarGeralNovidade("nov-cmp-vei"); formatarGeralNovidade("nov-cmp-cor"); formatarPlacaVeiculoCampo("nov-cmp-placa");
  $("nov-cmp-t-nome").value = formatarNomePessoa($("nov-cmp-t-nome").value);
  $("nov-cmp-quem").value = formatarNomePessoa($("nov-cmp-quem").value);
  formatarGeralNovidade("nov-cmp-ps"); formatarMedicoCrmCampo("nov-cmp-med"); formatarDpNovidade("nov-cmp-dp");
  formatarDelegadoCampo("nov-cmp-del"); formatarTextoMilitarCampo("nov-cmp-obs");

  var hrIni = $("nov-cmp-hora").value.trim() || fmtHora(new Date()), hrFim = fmtHora(new Date());
  var local = $("nov-cmp-local").value.trim(), inst = $("nov-cmp-inst").value.trim(), vtr = $("nov-cmp-vtr").value.trim(), nat = $("nov-cmp-nat").value.trim();
  var partesInfo = montarTextoPartes("nov-cmp"), pessoasTxt = montarDescricaoAbordados("cmp"), veiTxt = montarDescricaoVeiculoNovidade("cmp");
  var houveBusca = $("nov-cmp-busca").value === "SIM", ps = $("nov-cmp-ps").value.trim(), med = $("nov-cmp-med").value.trim();
  var aprStr = montarListaApreensoesArtigos("nov-cmp"), dp = $("nov-cmp-dp").value.trim(), del = $("nov-cmp-del").value.trim();
  var bopm = $("nov-cmp-bopm").value.trim().toUpperCase(), bopc = $("nov-cmp-bopc").value.trim().toUpperCase(), obs = $("nov-cmp-obs").value.trim();

  var segs = new Array();
  if (vtr || inst) {
    var apStr = "Apoio";
    if (vtr && inst) apStr += " à viatura " + vtr + " da " + inst;
    else if (vtr) apStr += " à viatura " + vtr;
    else if (inst) apStr += " à " + inst;
    if (local) apStr += " " + obterPreposicaoLocal(local, "pelo") + " " + local;
    segs.push(apStr);
  } else if (local) {
    var prepCap = obterPreposicaoLocal(local, "pelo");
    segs.push(prepCap.charAt(0).toUpperCase() + prepCap.slice(1) + " " + local);
  }
  if (houveBusca) {
    var bStr = "busca domiciliar";
    var mand = $("nov-cmp-mand").value === "SIM", numMand = $("nov-cmp-nummand").value.trim();
    var cons = $("nov-cmp-cons").value === "SIM", quem = $("nov-cmp-quem").value.trim(), evid = $("nov-cmp-evid").value === "SIM";
    if (mand) bStr += numMand ? (" em cumprimento ao mandado judicial nº " + numMand) : " em cumprimento a mandado judicial";
    else if (cons) bStr += " sem mandado judicial, mediante consentimento" + (quem ? " de " + quem : "");
    else bStr += " sem mandado judicial e sem consentimento";
    if (evid) bStr += ", com registro de evidências digitais";
    segs.push(bStr);
  }
  if (pessoasTxt) segs.push("abordagem a " + pessoasTxt);
  if (veiTxt) segs.push(veiTxt);

  var pl = partesInfo.total > 1, cond = pl ? "conduzidas" : "conduzida", aten = pl ? "atendidas e liberadas" : "atendida e liberada";
  if (partesInfo.total > 0) {
    var flStr = "Flagrante" + (nat ? " de " + nat : "") + ", " + partesInfo.texto;
    if (ps) {
      flStr += " " + cond + " ao " + ps;
      if (med) flStr += ", " + aten + " pelo " + med;
      if (dp) flStr += ", e após isso, " + cond + (aprStr ? " juntamente com " + aprStr : "") + " ao " + dp;
    } else if (dp) flStr += " " + cond + (aprStr ? " juntamente com " + aprStr : "") + " ao " + dp;
    segs.push(flStr);
  } else if (nat || ps || dp || aprStr) {
    var ocStr = nat || "ocorrência";
    if (ps) { ocStr += ", condução ao " + ps; if (med) ocStr += ", atendimento pelo " + med; }
    if (aprStr && dp) ocStr += ", apresentadas " + aprStr + " no " + dp;
    else if (dp) ocStr += ", apresentada no " + dp;
    else if (aprStr) ocStr += ", apreendidas " + aprStr;
    segs.push(ocStr);
  }
  if (del) segs.push("ciente " + del);

  var corpo = segs.join(", ");
  if (corpo.length > 0) corpo = corpo.charAt(0).toUpperCase() + corpo.slice(1);
  var texto = "Das " + hrIni + " às " + hrFim + " - " + corpo;
  var docs = new Array();
  if (bopm) docs.push("BOPM " + bopm);
  if (bopc) docs.push("BOPC " + bopc);
  texto += (docs.length > 0) ? (", " + docs.join(" e ") + " a respeito.") : ".";
  if (obs) texto += " Obs.: " + obs + (obs.slice(-1) === "." ? "" : ".");
  concluirAcaoNovidade(acao, texto, "Ocorrencia_Completa", limparFormCompleto);
}
function processarNovidadeApoio(acao) {
  formatarHoraNovidade("nov-apo-hora"); formatarGeralNovidade("nov-apo-inst"); formatarVtrCampo("nov-apo-vtr");
  formatarLocalCampo("nov-apo-local"); formatarGeralNovidade("nov-apo-mot"); formatarTextoMilitarCampo("nov-apo-obs");

  var hrIni = $("nov-apo-hora").value.trim() || fmtHora(new Date());
  var hrFim = fmtHora(new Date());
  var inst = $("nov-apo-inst").value.trim(), vtr = $("nov-apo-vtr").value.trim(), local = $("nov-apo-local").value.trim(), mot = $("nov-apo-mot").value.trim();
  var bopm = $("nov-apo-bopm").value.trim().toUpperCase(), bopc = $("nov-apo-bopc").value.trim().toUpperCase(), obs = $("nov-apo-obs").value.trim();

  var texto = "Das " + hrIni + " às " + hrFim + " - Apoio";
  if (vtr && inst) texto += " à viatura " + vtr + " da " + inst;
  else if (vtr) texto += " à viatura " + vtr;
  else if (inst) texto += " à " + inst;
  if (local) texto += " " + obterPreposicaoLocal(local, "pelo") + " " + local;
  if (mot) texto += " em " + mot;

  var docs = new Array();
  if (bopm) docs.push("BOPM " + bopm);
  if (bopc) docs.push("BOPC " + bopc);
  texto += (docs.length > 0) ? (", " + docs.join(" e ") + " a respeito.") : ".";
  if (obs) texto += " Obs.: " + obs + (obs.slice(-1) === "." ? "" : ".");
  concluirAcaoNovidade(acao, texto, "Apoio", function() { limparFormNovidade("nov-apo"); });
}

function processarNovidadeEstacionamento(acao) {
  formatarHoraNovidade("nov-est-hcheg"); formatarLocalCampo("nov-est-local");
  var hrChegada = $("nov-est-hcheg").value.trim() || fmtHora(new Date());
  var hrEncerramento = fmtHora(new Date());
  var local = $("nov-est-local").value.trim();
  var texto = "Das " + hrChegada + " às " + hrEncerramento + " - Ponto de Estacionamento" + (local ? " " + obterPreposicaoLocal(local, "pelo") + " " + local : "") + ".";
  concluirAcaoNovidade(acao, texto, "Ponto_de_Estacionamento", function() { limparFormNovidade("nov-est"); });
}

function limparFormCompleto() {
  limparFormNovidade("nov-cmp"); novAbordados.cmp = new Array(); renderizarAbordadosNovidade("cmp"); alternarTerceiroVeiculo("cmp");
  $("nov-cmp-busca").value = ""; $("nov-cmp-mand").value = "NAO"; $("nov-cmp-cons").value = "NAO"; $("nov-cmp-evid").value = "NAO";
  alternarCamposBusca("cmp");
}

function processarNovidadeCompleto(acao) {
  formatarHoraNovidade("nov-cmp-hora"); formatarLocalCampo("nov-cmp-local"); formatarGeralNovidade("nov-cmp-inst"); formatarVtrCampo("nov-cmp-vtr");
  formatarGeralNovidade("nov-cmp-nat"); formatarGeralNovidade("nov-cmp-vei"); formatarGeralNovidade("nov-cmp-cor"); formatarPlacaVeiculoCampo("nov-cmp-placa");
  $("nov-cmp-t-nome").value = formatarNomePessoa($("nov-cmp-t-nome").value);
  $("nov-cmp-quem").value = formatarNomePessoa($("nov-cmp-quem").value);
  formatarGeralNovidade("nov-cmp-ps"); formatarMedicoCrmCampo("nov-cmp-med"); formatarDpNovidade("nov-cmp-dp");
  formatarDelegadoCampo("nov-cmp-del"); formatarTextoMilitarCampo("nov-cmp-obs");

  var hrIni = $("nov-cmp-hora").value.trim() || fmtHora(new Date()), hrFim = fmtHora(new Date());
  var local = $("nov-cmp-local").value.trim(), inst = $("nov-cmp-inst").value.trim(), vtr = $("nov-cmp-vtr").value.trim(), nat = $("nov-cmp-nat").value.trim();
  var partesInfo = montarTextoPartes("nov-cmp"), pessoasTxt = montarDescricaoAbordados("cmp"), veiTxt = montarDescricaoVeiculoNovidade("cmp");
  var houveBusca = $("nov-cmp-busca").value === "SIM", ps = $("nov-cmp-ps").value.trim(), med = $("nov-cmp-med").value.trim();
  var aprStr = montarListaApreensoesArtigos("nov-cmp"), dp = $("nov-cmp-dp").value.trim(), del = $("nov-cmp-del").value.trim();
  var bopm = $("nov-cmp-bopm").value.trim().toUpperCase(), bopc = $("nov-cmp-bopc").value.trim().toUpperCase(), obs = $("nov-cmp-obs").value.trim();

  var segs = new Array();
  if (vtr || inst) {
    var apStr = "Apoio";
    if (vtr && inst) apStr += " à viatura " + vtr + " da " + inst;
    else if (vtr) apStr += " à viatura " + vtr;
    else if (inst) apStr += " à " + inst;
    if (local) apStr += " " + obterPreposicaoLocal(local, "pelo") + " " + local;
    segs.push(apStr);
  } else if (local) {
    var prepCap = obterPreposicaoLocal(local, "pelo");
    segs.push(prepCap.charAt(0).toUpperCase() + prepCap.slice(1) + " " + local);
  }
  if (houveBusca) {
    var bStr = "busca domiciliar";
    var mand = $("nov-cmp-mand").value === "SIM", numMand = $("nov-cmp-nummand").value.trim();
    var cons = $("nov-cmp-cons").value === "SIM", quem = $("nov-cmp-quem").value.trim(), evid = $("nov-cmp-evid").value === "SIM";
    if (mand) bStr += numMand ? (" em cumprimento ao mandado judicial nº " + numMand) : " em cumprimento a mandado judicial";
    else if (cons) bStr += " sem mandado judicial, mediante consentimento" + (quem ? " de " + quem : "");
    else bStr += " sem mandado judicial e sem consentimento";
    if (evid) bStr += ", com registro de evidências digitais";
    segs.push(bStr);
  }
  if (pessoasTxt) segs.push("abordagem a " + pessoasTxt);
  if (veiTxt) segs.push(veiTxt);

  var pl = partesInfo.total > 1, cond = pl ? "conduzidas" : "conduzida", aten = pl ? "atendidas e liberadas" : "atendida e liberada";
  if (partesInfo.total > 0) {
    var flStr = "Flagrante" + (nat ? " de " + nat : "") + ", " + partesInfo.texto;
    if (ps) {
      flStr += " " + cond + " ao " + ps;
      if (med) flStr += ", " + aten + " pelo " + med;
      if (dp) flStr += ", e após isso, " + cond + (aprStr ? " juntamente com " + aprStr : "") + " ao " + dp;
    } else if (dp) flStr += " " + cond + (aprStr ? " juntamente com " + aprStr : "") + " ao " + dp;
    segs.push(flStr);
  } else if (nat || ps || dp || aprStr) {
    var ocStr = nat || "ocorrência";
    if (ps) { ocStr += ", condução ao " + ps; if (med) ocStr += ", atendimento pelo " + med; }
    if (aprStr && dp) ocStr += ", apresentadas " + aprStr + " no " + dp;
    else if (dp) ocStr += ", apresentada no " + dp;
    else if (aprStr) ocStr += ", apreendidas " + aprStr;
    segs.push(ocStr);
  }
  if (del) segs.push("ciente " + del);

  var corpo = segs.join(", ");
  if (corpo.length > 0) corpo = corpo.charAt(0).toUpperCase() + corpo.slice(1);
  var texto = "Das " + hrIni + " às " + hrFim + " - " + corpo;
  var docs = new Array();
  if (bopm) docs.push("BOPM " + bopm);
  if (bopc) docs.push("BOPC " + bopc);
  texto += (docs.length > 0) ? (", " + docs.join(" e ") + " a respeito.") : ".";
  if (obs) texto += " Obs.: " + obs + (obs.slice(-1) === "." ? "" : ".");
  concluirAcaoNovidade(acao, texto, "Ocorrencia_Completa", limparFormCompleto);
}
function abrirCameraQualificacao() { var inp = $("cam-input"); inp.value = ""; inp.click(); }

function formatarRgTexto(raw) {
  var v = (raw || "").trim();
  if (!v) return "";
  if (/^[0-9]{2}\.[0-9]{3}\.[0-9]{3}-[0-9X]$/i.test(v) || /^[0-9]{2}\.[0-9]{3}\.[0-9]{3}$/.test(v) || /^[0-9]{2}\.[0-9]{3}\.[0-9]{2}-[0-9]$/.test(v)) return v.toUpperCase();
  if (/^[0-9]{8}[0-9X]$/i.test(v)) { var up = v.toUpperCase(); return up.slice(0, 2) + "." + up.slice(2, 5) + "." + up.slice(5, 8) + "-" + up.slice(8, 9); }
  if (/^[0-9]{8}$/.test(v)) return v.slice(0, 2) + "." + v.slice(2, 5) + "." + v.slice(5, 8);
  return v;
}

function formatarRgQual() { $("q-rg").value = formatarRgTexto($("q-rg").value); }
function formatarDataQual(idCampo) { var el = $(idCampo); if (!el) return; var v = el.value.trim(); if (/^[0-9]{8}$/.test(v)) el.value = v.slice(0, 2) + "/" + v.slice(2, 4) + "/" + v.slice(4, 8); else if (/^[0-9]{6}$/.test(v)) el.value = v.slice(0, 2) + "/" + v.slice(2, 4) + "/" + v.slice(4, 6); }
function formatarBatalhaoQual() { var el = $("q-uni"); if (el && el.value.trim()) el.value = formatarSiglaBatalhaoCurta(el.value); }
function formatarDpQual() { var el = $("q-dp"); if (el && el.value.trim()) el.value = formatarDpTexto(el.value); }
function formatarCidadeQual() { var el = $("q-cidade"); if (el && el.value.trim()) el.value = titleCase(el.value); }
function formatarLocalCampo(idCampo) { var el = $(idCampo); if (el && el.value.trim()) el.value = formatarEnderecoCompleto(el.value); }
function formatarGeralCampo(idCampo) { var el = $(idCampo); if (el && el.value.trim()) el.value = formatarTextoMilitar(el.value); }

function onFotoCapturada(e) {
  var f = (e.target.files && e.target.files.length > 0) ? e.target.files : null;
  if (!f) return;
  var r = new FileReader();
  r.onload = function(ev) {
    fotoQualBase64 = ev.target.result; fotoQualFinalBase64 = "";
    $("qual-thumb").src = fotoQualBase64; $("qual-thumb").style.display = "block"; $("qual-result-box").style.display = "none";
    if (!$("q-data").value.trim()) $("q-data").value = getToday();
    mostrarTela("qual-screen");
  };
  r.readAsDataURL(f);
}

function retanguloArredondado(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

var placaState = { imgObj: null, largura: 0, altura: 0, x: 0, y: null, wRatio: 1.0, hRatio: 0.33, drag: false, startX: 0, startY: 0, origX: 0, origY: 0, eventosLigados: false };

function desenharCampoPlaca(ctx, lbl, val, x, y, wColuna, fontLbl, fontVal) {
  ctx.fillStyle = "#000000"; ctx.font = "bold " + fontLbl + "px Arial"; ctx.fillText(lbl, x, y);
  var wLbl = ctx.measureText(lbl + " ").width;
  ctx.beginPath(); ctx.moveTo(x + wLbl, y + 3); ctx.lineTo(x + wColuna, y + 3); ctx.strokeStyle = "#cbd5e1"; ctx.lineWidth = 1.5; ctx.stroke();
  if (val) { ctx.font = "normal " + fontVal + "px Arial"; ctx.fillText(val, x + wLbl + 4, y, wColuna - wLbl - 6); }
}
function renderizarCanvasQualificacao(salvarHistorico) {
  var img = placaState.imgObj, canvas = $("qual-canvas");
  if (!img || !canvas) return;
  var largura = placaState.largura, altura = placaState.altura;
  canvas.width = largura; canvas.height = altura;
  var ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, largura, altura);

  var placaW = Math.round(largura * placaState.wRatio), padX = Math.round(placaW * 0.032), innerW = placaW - (padX * 2);
  var escalaFonte = placaState.wRatio, placaH = Math.round(altura * placaState.hRatio);
  if (placaH > altura) placaH = altura;

  var fontTitulo = Math.max(28, Math.round(largura * 0.052 * escalaFonte)), topoEspaco = Math.round(fontTitulo * 1.85), rodapeEspaco = Math.round(placaH * 0.04);
  var rowGap = Math.max(22, Math.floor((placaH - topoEspaco - rodapeEspaco) / 7));
  var fontLbl = Math.max(16, Math.min(Math.round(rowGap * 0.56), Math.round(largura * 0.028 * escalaFonte)));
  var fontVal = Math.max(17, Math.min(Math.round(rowGap * 0.62), Math.round(largura * 0.031 * escalaFonte)));

  if (placaState.y === null) { placaState.x = Math.round((largura - placaW) / 2); placaState.y = altura - placaH; }
  if (placaState.x < 0) placaState.x = 0; if (placaState.x + placaW > largura) placaState.x = largura - placaW;
  if (placaState.y < 0) placaState.y = 0; if (placaState.y + placaH > altura) placaState.y = altura - placaH;

  var placaX = placaState.x, placaY = placaState.y;
  ctx.save(); retanguloArredondado(ctx, placaX, placaY, placaW, placaH, Math.round(placaW * 0.032));
  ctx.fillStyle = "#ffffff"; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = "#94a3b8"; ctx.stroke(); ctx.restore();

  var y = placaY + Math.round(fontTitulo * 1.2), batalhao = $("q-uni").value.trim().toUpperCase();
  if (batalhao) { ctx.fillStyle = "#000000"; ctx.font = "bold " + fontTitulo + "px Arial"; ctx.textAlign = "center"; ctx.fillText(batalhao, placaX + (placaW / 2), y, innerW); }

  ctx.textAlign = "left";
  var x0 = placaX + padX, gapCol = Math.round(innerW * 0.02);
  y += Math.round(fontTitulo * 1.4);

  desenharCampoPlaca(ctx, "NOME:", $("q-nome").value.trim().toUpperCase(), x0, y, innerW, fontLbl, fontVal); y += rowGap;
  desenharCampoPlaca(ctx, "FILIAÇÃO:", $("q-filiacao").value.trim().toUpperCase(), x0, y, innerW, fontLbl, fontVal); y += rowGap;
  var wRg = Math.round(innerW * 0.48), wVulgo = innerW - wRg - gapCol;
  desenharCampoPlaca(ctx, "RG:", $("q-rg").value.trim(), x0, y, wRg, fontLbl, fontVal);
  desenharCampoPlaca(ctx, "VULGO:", $("q-vulgo").value.trim(), x0 + wRg + gapCol, y, wVulgo, fontLbl, fontVal); y += rowGap;
  var wData = Math.round(innerW * 0.25), wArt = Math.round(innerW * 0.21), wDtn = Math.round(innerW * 0.26), wDp = innerW - wData - wArt - wDtn - (gapCol * 3), cx = x0;
  desenharCampoPlaca(ctx, "DATA:", $("q-data").value.trim(), cx, y, wData, fontLbl, fontVal); cx += wData + gapCol;
  desenharCampoPlaca(ctx, "ARTIGO:", $("q-artigo").value.trim(), cx, y, wArt, fontLbl, fontVal); cx += wArt + gapCol;
  desenharCampoPlaca(ctx, "DTN:", $("q-dtn").value.trim(), cx, y, wDtn, fontLbl, fontVal); cx += wDtn + gapCol;
  desenharCampoPlaca(ctx, "DP:", $("q-dp").value.trim().toUpperCase(), cx, y, wDp, fontLbl, fontVal); y += rowGap;
  var wCid = Math.round(innerW * 0.44), wBopm = Math.round(innerW * 0.25), wBopc = innerW - wCid - wBopm - (gapCol * 2); cx = x0;
  desenharCampoPlaca(ctx, "CIDADE:", $("q-cidade").value.trim().toUpperCase(), cx, y, wCid, fontLbl, fontVal); cx += wCid + gapCol;
  desenharCampoPlaca(ctx, "BOPM:", $("q-bopm").value.trim().toUpperCase(), cx, y, wBopm, fontLbl, fontVal); cx += wBopm + gapCol;
  desenharCampoPlaca(ctx, "BOPC:", $("q-bopc").value.trim().toUpperCase(), cx, y, wBopc, fontLbl, fontVal); y += rowGap;
  desenharCampoPlaca(ctx, "LOCALIDADE QUE ATUA:", $("q-local").value.trim().toUpperCase(), x0, y, innerW, fontLbl, fontVal); y += rowGap;
  desenharCampoPlaca(ctx, "OBS.:", $("q-obs").value.trim().toUpperCase(), x0, y, innerW, fontLbl, fontVal);

  fotoQualFinalBase64 = canvas.toDataURL("image/jpeg", 0.88);
  if (salvarHistorico) {
    var dtQual = $("q-data").value.trim() || getToday(), nomeQual = $("q-nome").value.trim();
    var resumoQual = (nomeQual ? "Nome: " + nomeQual + NL : "") + ($("q-rg").value.trim() ? "RG: " + $("q-rg").value.trim() + NL : "") + ($("q-artigo").value.trim() ? "Artigo: " + $("q-artigo").value.trim() + NL : "") + ($("q-dp").value.trim() ? "DP: " + $("q-dp").value.trim() : "");
    registrarTrabalhoSalvo("Foto e Qualificação - " + dtQual, resumoQual.trim(), fotoQualFinalBase64);
  }
}

function ajustarPlacaQual(tipo, delta) {
  if (!placaState.imgObj) return;
  if (tipo === "altura") placaState.hRatio = Math.min(0.85, Math.max(0.25, placaState.hRatio + delta));
  else if (tipo === "largura") { placaState.wRatio = Math.min(1.0, Math.max(0.55, placaState.wRatio + delta)); placaState.x = Math.round((placaState.largura - Math.round(placaState.largura * placaState.wRatio)) / 2); }
  else if (tipo === "y") placaState.y += delta;
  else if (tipo === "reset") { placaState.wRatio = 1.0; placaState.hRatio = 0.33; placaState.x = 0; placaState.y = null; }
  renderizarCanvasQualificacao(false);
}

function ligarEventosArrastoPlaca() {
  var canvas = $("qual-canvas");
  if (!canvas || placaState.eventosLigados) return;
  placaState.eventosLigados = true;
  function obterCoordCanvas(ev) { var rect = canvas.getBoundingClientRect(), pt = (ev.touches && ev.touches.length > 0) ? ev.touches.item(0) : ev; return { cx: (pt.clientX - rect.left) * (canvas.width / rect.width), cy: (pt.clientY - rect.top) * (canvas.height / rect.height) }; }
  function iniciarArrasto(ev) { if (!placaState.imgObj) return; var p = obterCoordCanvas(ev); placaState.drag = true; placaState.startX = p.cx; placaState.startY = p.cy; placaState.origX = placaState.x; placaState.origY = placaState.y; }
  function moverArrasto(ev) { if (!placaState.drag) return; ev.preventDefault(); var p = obterCoordCanvas(ev); placaState.x = Math.round(placaState.origX + (p.cx - placaState.startX)); placaState.y = Math.round(placaState.origY + (p.cy - placaState.startY)); renderizarCanvasQualificacao(false); }
  function finalizarArrasto() { placaState.drag = false; }
  canvas.addEventListener("touchstart", iniciarArrasto, { passive: false }); canvas.addEventListener("touchmove", moverArrasto, { passive: false }); canvas.addEventListener("touchend", finalizarArrasto);
  canvas.addEventListener("mousedown", iniciarArrasto); window.addEventListener("mousemove", moverArrasto); window.addEventListener("mouseup", finalizarArrasto);
}

function gerarPlacaQualificacao() {
  if (!fotoQualBase64) return alert("Tire uma foto primeiro.");
  formatarBatalhaoQual(); $("q-nome").value = formatarNomePessoa($("q-nome").value); $("q-filiacao").value = formatarNomePessoa($("q-filiacao").value);
  formatarRgQual(); formatarDataQual("q-data"); formatarDataQual("q-dtn"); formatarDpQual(); formatarCidadeQual(); formatarLocalCampo("q-local"); formatarGeralCampo("q-obs");
  var img = new Image();
  img.onload = function() {
    var largura = img.width, altura = img.height;
    if (largura > 1280) { var escala = 1280 / largura; largura = 1280; altura = Math.round(img.height * escala); }
    placaState.imgObj = img; placaState.largura = largura; placaState.altura = altura; placaState.wRatio = 1.0; placaState.hRatio = 0.33; placaState.x = 0; placaState.y = null;
    $("qual-result-box").style.display = "block"; ligarEventosArrastoPlaca(); renderizarCanvasQualificacao(true); fotoQualBase64 = ""; $("qual-result-box").scrollIntoView({ behavior: "smooth" });
  };
  img.src = fotoQualBase64;
}

async function salvarFotoQualificacao() { if (!fotoQualFinalBase64) return alert("Gere a foto com placa primeiro."); var nomeBase = ($("q-nome").value.trim() || "Qualificacao").replace(/[^a-zA-Z0-9_-]/g, "_"); var dt = ($("q-data").value.trim() || getToday()).split("/").join("-"); await exportarArquivoNativo(nomeBase + "_" + dt + ".jpg", fotoQualFinalBase64.split(",").pop(), true, "Qualificação - " + ($("q-nome").value.trim() || "")); }
async function exportarQualificacaoRapido() { if (fotoQualFinalBase64) { await salvarFotoQualificacao(); return; } if (!fotoQualBase64) return alert("Tire uma foto primeiro."); gerarPlacaQualificacao(); setTimeout(function() { if (fotoQualFinalBase64) salvarFotoQualificacao(); }, 450); }
async function compartilharQualificacao() { await salvarFotoQualificacao(); }
function formatarSecResenha() { var el = $("r-sec"); if (el && el.value.trim().toUpperCase() === "SSP") { el.value = "Secretaria da Segurança Pública"; atualizarResenha(); } }
function formatarInstResenha() { var el = $("r-inst"); if (el && el.value.trim().toUpperCase() === "PMESP") { el.value = "Polícia Militar do Estado de São Paulo"; atualizarResenha(); } }
function formatarBatResenha() { var el = $("r-bat"); if (el && el.value.trim()) { el.value = resolverNomeBatalhao(el.value); atualizarResenha(); } }
function formatarCiaResenha() {
  var el = $("r-cia"); if (!el || !el.value.trim()) return;
  var v = el.value.trim(), up = v.toUpperCase();
  if (up === "FT") el.value = "Força Tática"; else if (up === "CANIL") el.value = "Canil"; else if (up === "CAVALARIA") el.value = "Cavalaria"; else if (up === "ROCAM") el.value = "ROCAM"; else if (isNum(v)) el.value = v + "ª Cia"; else el.value = formatarTextoMilitar(v);
  atualizarResenha();
}
function formatarVtrResenha() { var el = $("r-vtr"); if (el && el.value.trim()) { el.value = formatVtrTexto(el.value); atualizarResenha(); } }
function formatarPolicialResenha(idCampo) { var el = $(idCampo); if (el && el.value.trim()) { el.value = formatRankAndName(el.value); addEquipe(el.value); atualizarResenha(); } }
function formatarAreaResenha() { var el = $("r-area"); if (el && el.value.trim()) { el.value = formatarTextoMilitar(el.value); atualizarResenha(); } }
function formatarDpResenha() { var el = $("r-dp"); if (el && el.value.trim()) { el.value = formatarDpTexto(el.value); atualizarResenha(); } }
function formatarHoraResenha() { var el = $("r-hr"); if (el && el.value.trim()) { el.value = formatarHoraUnica(el.value); atualizarResenha(); } }
function formatarLocalResenha() { var el = $("r-local"); if (el && el.value.trim()) { el.value = formatarEnderecoCompleto(el.value); atualizarResenha(); } }
function formatarGeralResenha(idCampo) { var el = $(idCampo); if (el && el.value.trim()) { el.value = formatarTextoMilitar(el.value); atualizarResenha(); } }

function adicionarIndiciado() { resenhaIndiciados.push({ nome: "", rg: "", artigo: "" }); renderizarIndiciadosResenha(); atualizarResenha(); }
function removerIndiciado(idx) { resenhaIndiciados.splice(idx, 1); renderizarIndiciadosResenha(); atualizarResenha(); }
function onIndiciadoInput(idx, campo, valor) { if (resenhaIndiciados[idx]) { resenhaIndiciados[idx][campo] = valor; atualizarResenha(); } }
function onIndiciadoNomeBlur(idx, inputEl) { if (resenhaIndiciados[idx]) { var fmt = formatarNomePessoa(inputEl.value); inputEl.value = fmt; resenhaIndiciados[idx].nome = fmt; atualizarResenha(); } }
function onIndiciadoRgBlur(idx, inputEl) { if (resenhaIndiciados[idx]) { var fmt = formatarRgTexto(inputEl.value); inputEl.value = fmt; resenhaIndiciados[idx].rg = fmt; atualizarResenha(); } }

function renderizarIndiciadosResenha() {
  var box = $("r-indiciados-box"); if (!box) return;
  var html = "";
  for (var i = 0; i < resenhaIndiciados.length; i++) {
    var env = resenhaIndiciados[i], nomeEsc = (env.nome || "").replace(/"/g, "&quot;"), rgEsc = (env.rg || "").replace(/"/g, "&quot;"), artEsc = (env.artigo || "").replace(/"/g, "&quot;");
    html += '<div class="env-box">' +
      '<div class="row" style="margin-bottom:6px;"><span class="dot"></span><span class="lbl">Indiciado:</span><input type="text" value="' + nomeEsc + '" oninput="onIndiciadoInput(' + i + ', \'nome\', this.value)" onblur="onIndiciadoNomeBlur(' + i + ', this)"><button type="button" class="btn-small" style="background:#dc2626;border:none;padding:6px 10px;" onclick="removerIndiciado(' + i + ')">X</button></div>' +
      '<div class="row" style="margin-bottom:6px;"><span class="dot"></span><span class="lbl">RG:</span><input type="text" value="' + rgEsc + '" placeholder="xx.xxx.xxx-x ou xx.xxx.xxx" oninput="onIndiciadoInput(' + i + ', \'rg\', this.value)" onblur="onIndiciadoRgBlur(' + i + ', this)"></div>' +
      '<div class="row" style="margin-bottom:0;"><span class="dot"></span><span class="lbl">Artigo:</span><input type="text" value="' + artEsc + '" oninput="onIndiciadoInput(' + i + ', \'artigo\', this.value)"></div>' +
    '</div>';
  }
  box.innerHTML = html;
}

function adicionarSindicado() { resenhaSindicados.push({ nome: "", rg: "", artigo: "" }); renderizarSindicadosResenha(); atualizarResenha(); }
function removerSindicado(idx) { resenhaSindicados.splice(idx, 1); renderizarSindicadosResenha(); atualizarResenha(); }
function onSindicadoInput(idx, campo, valor) { if (resenhaSindicados[idx]) { resenhaSindicados[idx][campo] = valor; atualizarResenha(); } }
function onSindicadoNomeBlur(idx, inputEl) { if (resenhaSindicados[idx]) { var fmt = formatarNomePessoa(inputEl.value); inputEl.value = fmt; resenhaSindicados[idx].nome = fmt; atualizarResenha(); } }
function onSindicadoRgBlur(idx, inputEl) { if (resenhaSindicados[idx]) { var fmt = formatarRgTexto(inputEl.value); inputEl.value = fmt; resenhaSindicados[idx].rg = fmt; atualizarResenha(); } }

function renderizarSindicadosResenha() {
  var box = $("r-sindicados-box"); if (!box) return;
  var html = "";
  for (var i = 0; i < resenhaSindicados.length; i++) {
    var env = resenhaSindicados[i], nomeEsc = (env.nome || "").replace(/"/g, "&quot;"), rgEsc = (env.rg || "").replace(/"/g, "&quot;"), artEsc = (env.artigo || "").replace(/"/g, "&quot;");
    html += '<div class="env-box">' +
      '<div class="row" style="margin-bottom:6px;"><span class="dot"></span><span class="lbl">Sindicado:</span><input type="text" value="' + nomeEsc + '" oninput="onSindicadoInput(' + i + ', \'nome\', this.value)" onblur="onSindicadoNomeBlur(' + i + ', this)"><button type="button" class="btn-small" style="background:#dc2626;border:none;padding:6px 10px;" onclick="removerSindicado(' + i + ')">X</button></div>' +
      '<div class="row" style="margin-bottom:6px;"><span class="dot"></span><span class="lbl">RG:</span><input type="text" value="' + rgEsc + '" placeholder="xx.xxx.xxx-x ou xx.xxx.xxx" oninput="onSindicadoInput(' + i + ', \'rg\', this.value)" onblur="onSindicadoRgBlur(' + i + ', this)"></div>' +
      '<div class="row" style="margin-bottom:0;"><span class="dot"></span><span class="lbl">Artigo:</span><input type="text" value="' + artEsc + '" oninput="onSindicadoInput(' + i + ', \'artigo\', this.value)"></div>' +
    '</div>';
  }
  box.innerHTML = html;
}
function formatarDataHoraMilitar(dtRaw, hrRaw) {
  var dt = (dtRaw || "").trim().toUpperCase(), hr = (hrRaw || "").trim().toUpperCase();
  if (!dt && !hr) return "";
  var meses = new Array("JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ");
  var dia = "", mesSigla = "", ano2 = "";
  if (dt) {
    var dtLimpo = dt.replace(/[^0-9A-Z]/g, ""), matchMes = dtLimpo.match(/^([0-9]{1,2})([A-Z]{3})([0-9]{2,4})$/);
    if (matchMes) { dia = two(matchMes.slice(1, 2).join("")); mesSigla = matchMes.slice(2, 3).join(""); ano2 = matchMes.slice(3, 4).join("").slice(-2); }
    else {
      var numsDt = dt.replace(/[^0-9]/g, "");
      if (numsDt.length === 8) { dia = numsDt.slice(0, 2); var mIdx = parseInt(numsDt.slice(2, 4), 10) - 1; mesSigla = (mIdx >= 0 && mIdx < 12) ? meses[mIdx] : numsDt.slice(2, 4); ano2 = numsDt.slice(6, 8); }
      else if (numsDt.length === 6) { dia = numsDt.slice(0, 2); var mIdx2 = parseInt(numsDt.slice(2, 4), 10) - 1; mesSigla = (mIdx2 >= 0 && mIdx2 < 12) ? meses[mIdx2] : numsDt.slice(2, 4); ano2 = numsDt.slice(4, 6); }
      else return (dt + " " + hr).trim();
    }
  }
  var hhmm = "";
  if (hr) { var numsHr = hr.replace(/[^0-9]/g, ""); if (numsHr.length >= 4) hhmm = numsHr.slice(0, 4); else if (numsHr.length === 3) hhmm = "0" + numsHr; else if (numsHr.length === 2 || numsHr.length === 1) hhmm = two(numsHr) + "00"; else hhmm = hr; }
  return (dia && mesSigla && ano2) ? (dia + hhmm + mesSigla + ano2) : (dt + " " + hr).trim();
}

function separarItensApreensoes(raw) {
  if (!raw) return new Array();
  var marcado = raw.replace(/([0-9]),([0-9]+\s*(?:g|gr|grs|grama|gramas|kg|kgs|kilo|kilos|quilo|quilos|mg|ml|l|un|und|cx|pct)?\b)/gi, "$1###VIRGULA###$2").replace(/(R\$\s*[0-9.]+),([0-9]{2})/gi, "$1###VIRGULA###$2");
  var partes = marcado.split(","), res = new Array();
  for (var i = 0; i < partes.length; i++) { var item = partes[i].split("###VIRGULA###").join(",").trim(); if (item !== "") res.push(item); }
  return res;
}

function gerarDadosResenha() {
  var sec = $("r-sec").value.trim(), inst = $("r-inst").value.trim(), bat = $("r-bat").value.trim(), cia = $("r-cia").value.trim(), vtr = $("r-vtr").value.trim();
  var cmte = $("r-cmte").value.trim(), mot = $("r-mot").value.trim(), seg1 = $("r-seg1").value.trim(), seg2 = $("r-seg2").value.trim(), seg3 = $("r-seg3").value.trim();
  var nat = $("r-nat").value.trim(), dthr = formatarDataHoraMilitar($("r-dt").value, $("r-hr").value), local = $("r-local").value.trim(), area = $("r-area").value.trim();
  var bopm = $("r-bopm").value.trim(), bopc = $("r-bopc").value.trim(), dp = $("r-dp").value.trim(), del = $("r-del").value.trim(), aprRaw = $("r-apr").value.trim(), hist = $("r-hist").value.trim();

  var html = "", txtWpp = "", txtPuro = "";
  function addTopoIgual(val) { if (!val) return; html += '<div class="res-topo-igual">' + val + '</div>'; txtWpp += "*" + val + "*" + NL; txtPuro += val + NL; }
  function addTopo(val) { if (!val) return; html += '<div class="res-center">' + val + '</div>'; txtWpp += "*" + val + "*" + NL; txtPuro += val + NL; }
  function addCampo(rotulo, val) { if (!val) return; html += '<div class="res-line"><b>' + rotulo + ':</b> ' + val + '</div>'; txtWpp += "*" + rotulo + ":* " + val + NL; txtPuro += rotulo + ": " + val + NL; }
  function addEspaco() { html += '<div class="res-gap"></div>'; txtWpp += NL; txtPuro += NL; }

  addTopoIgual(sec); addTopoIgual(inst);
  if (bat) { if (sec || inst) addEspaco(); addTopo(bat); }
  if (sec || inst || bat) addEspaco();
  html += '<div class="res-title">RESENHA DE OCORRÊNCIA</div><div class="res-gap"></div>'; txtWpp += NL + "*RESENHA DE OCORRÊNCIA*" + NL + NL; txtPuro += NL + "RESENHA DE OCORRÊNCIA" + NL + NL;

  if (cia) { addTopo(cia); if (vtr) addEspaco(); }
  if (vtr) { html += '<div class="res-line"><b>' + vtr + '</b></div>'; txtWpp += "*" + vtr + "*" + NL; txtPuro += vtr + NL; }
  var temEquipe = (cmte || mot || seg1 || seg2 || seg3);
  if (temEquipe) { if (cia || vtr) addEspaco(); addCampo("Cmt", cmte); addCampo("Mot", mot); addCampo("Seg", seg1); addCampo("Seg", seg2); addCampo("Seg", seg3); }
  var temDadosOcor = (nat || dthr || local || area || bopm || bopc || dp || del);
  if (temDadosOcor) { if (cia || vtr || temEquipe) addEspaco(); addCampo("Natureza", nat); addCampo("Data/Hora", dthr); addCampo("Local", local); addCampo("Área", area); addCampo("BOPM", bopm); addCampo("BOPC", bopc); addCampo("DP", dp); addCampo("Delegado(a)", del); }

  var indValidos = resenhaIndiciados.filter(function(ind) { return (ind.nome || "").trim() !== "" || (ind.rg || "").trim() !== "" || (ind.artigo || "").trim() !== ""; });
  var sindValidos = resenhaSindicados.filter(function(sind) { return (sind.nome || "").trim() !== "" || (sind.rg || "").trim() !== "" || (sind.artigo || "").trim() !== ""; });
  var temEnvolvidos = (indValidos.length > 0 || sindValidos.length > 0);
  if (temEnvolvidos) {
    if (del || temDadosOcor) addEspaco();
    var primeiroEnv = true;
    for (var j = 0; j < indValidos.length; j++) {
      if (!primeiroEnv) addEspaco(); primeiroEnv = false;
      var curInd = indValidos[j], lblInd = indValidos.length > 1 ? ("Indiciado " + (j + 1)) : "Indiciado";
      if ((curInd.nome || "").trim()) addCampo(lblInd, formatarNomePessoa(curInd.nome));
      if ((curInd.rg || "").trim()) addCampo("RG", formatarRgTexto(curInd.rg));
      if ((curInd.artigo || "").trim()) addCampo("Artigo", curInd.artigo.trim());
    }
    for (var m = 0; m < sindValidos.length; m++) {
      if (!primeiroEnv) addEspaco(); primeiroEnv = false;
      var curSind = sindValidos[m], lblSind = sindValidos.length > 1 ? ("Sindicado " + (m + 1)) : "Sindicado";
      if ((curSind.nome || "").trim()) addCampo(lblSind, formatarNomePessoa(curSind.nome));
      if ((curSind.rg || "").trim()) addCampo("RG", formatarRgTexto(curSind.rg));
      if ((curSind.artigo || "").trim()) addCampo("Artigo", curSind.artigo.trim());
    }
  }
  if (aprRaw) {
    var itensApr = separarItensApreensoes(aprRaw);
    if (itensApr.length > 0) {
      if (temEnvolvidos || temDadosOcor) addEspaco();
      html += '<div class="res-line"><b>Apreensões:</b></div>'; txtWpp += "*Apreensões:*" + NL; txtPuro += "Apreensões:" + NL;
      for (var k = 0; k < itensApr.length; k++) { html += '<div class="res-line">• ' + itensApr[k] + '</div>'; txtWpp += "• " + itensApr[k] + NL; txtPuro += "• " + itensApr[k] + NL; }
    }
  }
  if (hist) {
    addEspaco(); html += '<div class="res-line"><b>Histórico:</b></div>'; txtWpp += "*Histórico:*" + NL; txtPuro += "Histórico:" + NL; addEspaco();
    html += '<div class="res-line">' + hist.replace(/\n/g, "<br>") + '</div>'; txtWpp += hist + NL; txtPuro += hist + NL;
  }
  return { html: html, wpp: txtWpp.trim(), puro: txtPuro.trim() };
}

function atualizarResenha() { var box = $("res-preview-box"); if (box) box.innerHTML = gerarDadosResenha().html; }
function centralizarLinhaWpp(txt) { var larguraRef = 44, pad = Math.max(0, Math.round(((larguraRef - txt.length) / 2) * 1.4)); return "\u200B" + new Array(pad + 1).join(" ") + "*" + txt + "*"; }

function obterTextoEditadoResenha(modoWpp) {
  var box = $("res-preview-box"); if (!box) return "";
  var linhas = new Array(), filhos = box.childNodes;
  for (var i = 0; i < filhos.length; i++) {
    var el = filhos[i];
    if (el.nodeType === 1) {
      if (el.className === "res-gap") linhas.push(modoWpp ? "\u200B" : "");
      else {
        var txt = (el.innerText || el.textContent || "").trim();
        if (modoWpp && (el.className === "res-center" || el.className === "res-topo-igual" || el.className === "res-title")) linhas.push(centralizarLinhaWpp(txt));
        else if (modoWpp && txt.indexOf(":") > -1 && el.querySelector("b")) { var idx = txt.indexOf(":"); linhas.push("*" + txt.slice(0, idx + 1) + "*" + txt.slice(idx + 1)); }
        else if (modoWpp && el.querySelector("b")) linhas.push("*" + txt + "*");
        else linhas.push(txt);
      }
    } else if (el.nodeType === 3) { var t = el.nodeValue.trim(); if (t) linhas.push(t); }
  }
  return linhas.join(NL).trim();
}

function limparResenha() {
  var ids = new Array("r-sec", "r-inst", "r-bat", "r-cia", "r-vtr", "r-cmte", "r-mot", "r-seg1", "r-seg2", "r-seg3", "r-nat", "r-dt", "r-hr", "r-local", "r-area", "r-bopm", "r-bopc", "r-dp", "r-del", "r-apr", "r-hist");
  for (var i = 0; i < ids.length; i++) { var el = $(ids[i]); if (el) el.value = ""; }
  resenhaIndiciados = new Array({ nome: "", rg: "", artigo: "" }); resenhaSindicados = new Array({ nome: "", rg: "", artigo: "" });
  renderizarIndiciadosResenha(); renderizarSindicadosResenha(); atualizarResenha();
}

function enviarResenhaWpp() { var txtWpp = obterTextoEditadoResenha(true), txtPuro = obterTextoEditadoResenha(false); if (!txtWpp) return alert("Preencha os dados da resenha primeiro."); registrarTrabalhoSalvo("Resenha de Ocorrência - " + getToday(), txtPuro, ""); enviarWpp(txtWpp); }
function copiarResenha() { var txt = obterTextoEditadoResenha(false); if (!txt) return alert("Preencha os dados da resenha primeiro."); copiarTextoSeguro(txt, "Resenha copiada!"); }
async function exportarResenhaTxt() { var txt = obterTextoEditadoResenha(false); if (!txt) return alert("Preencha os dados da resenha primeiro."); var dt = getToday(); registrarTrabalhoSalvo("Resenha de Ocorrência - " + dt, txt, ""); var bopm = ($("r-bopm").value.trim() || dt).replace(/[^a-zA-Z0-9_-]/g, "_"); await exportarArquivoNativo("Resenha_" + bopm + ".txt", txt, false, "Resenha de Ocorrência"); }
function formatarCampoMilitarMdip(idCampo) { var el = $(idCampo); if (el && el.value.trim()) { el.value = formatarTextoMilitar(el.value); atualizarMdip(); } }
function formatarLocalMdip() { var el = $("m-qth"); if (el && el.value.trim()) { el.value = formatarEnderecoCompleto(el.value); atualizarMdip(); } }
function formatarHoraMdip(idCampo) { var el = $(idCampo); if (el && el.value.trim()) { el.value = formatarHoraUnica(el.value); atualizarMdip(); } }
function formatarHoraTextoMdip(idCampo) { var el = $(idCampo); if (el && el.value.trim()) { el.value = formatarTextoMilitar(el.value.trim().replace(/\b([0-9]{2})([0-9]{2})\b/g, "$1:$2")); atualizarMdip(); } }
function formatarGeralMdip(idCampo) { var el = $(idCampo); if (el && el.value.trim()) { el.value = formatarTextoMilitar(el.value); atualizarMdip(); } }
function formatarListaVtrsMdip(idCampo) {
  var el = $(idCampo); if (!el || !el.value.trim()) return;
  var partes = el.value.trim().replace(/\s+([a-zA-Z]-?[0-9]{4,5})\b/g, ", $1").split(","), limpos = new Array();
  for (var i = 0; i < partes.length; i++) { var item = partes[i].trim(); if (item !== "") limpos.push(formatarTextoMilitar(item)); }
  el.value = limpos.join(", "); atualizarMdip();
}
function formatarCiaMdip() {
  var el = $("m-cia"); if (!el || !el.value.trim()) return;
  var v = el.value.trim(), up = v.toUpperCase();
  if (up === "FT") el.value = "Força Tática"; else if (up === "CANIL") el.value = "Canil"; else if (up === "CAVALARIA") el.value = "Cavalaria"; else if (up === "ROCAM") el.value = "ROCAM"; else if (isNum(v)) el.value = v + "ª Cia"; else el.value = formatarTextoMilitar(v);
  atualizarMdip();
}
function formatarVtrCampo(idCampo) { var el = $(idCampo); if (el && el.value.trim()) el.value = formatVtrTexto(el.value); }
function formatarVtrMdip() { formatarVtrCampo("m-vtr"); atualizarMdip(); }
function formatarPolicialMdip(idCampo) { var el = $(idCampo); if (el && el.value.trim()) { el.value = formatRankAndName(el.value); addEquipe(el.value); atualizarMdip(); } }
function formatarDpMdip() { var el = $("m-dp"); if (el && el.value.trim()) { el.value = formatarDpTexto(el.value); atualizarMdip(); } }

function adicionarFeridoMdip() { mdipFeridos.push({ naoIdentificado: false, nome: "", rg: "", mae: "", criminal: "", obs: "" }); renderizarFeridosMdip(); atualizarMdip(); }
function removerFeridoMdip(idx) { mdipFeridos.splice(idx, 1); renderizarFeridosMdip(); atualizarMdip(); }
function alternarNaoIdentificadoMdip(idx) { if (mdipFeridos[idx]) { mdipFeridos[idx].naoIdentificado = !mdipFeridos[idx].naoIdentificado; renderizarFeridosMdip(); atualizarMdip(); } }
function onFeridoMdipInput(idx, campo, valor) { if (mdipFeridos[idx]) { mdipFeridos[idx][campo] = valor; atualizarMdip(); } }
function onFeridoMdipNomeBlur(idx, campo, inputEl) { if (mdipFeridos[idx]) { var fmt = formatarNomePessoa(inputEl.value); inputEl.value = fmt; mdipFeridos[idx][campo] = fmt; atualizarMdip(); } }
function onFeridoMdipRgBlur(idx, inputEl) { if (mdipFeridos[idx]) { var fmt = formatarRgTexto(inputEl.value); inputEl.value = fmt; mdipFeridos[idx].rg = fmt; atualizarMdip(); } }

function renderizarFeridosMdip() {
  var box = $("m-feridos-box"); if (!box) return;
  var html = "";
  for (var i = 0; i < mdipFeridos.length; i++) {
    var f = mdipFeridos[i], nomeEsc = (f.nome || "").replace(/"/g, "&quot;"), rgEsc = (f.rg || "").replace(/"/g, "&quot;"), maeEsc = (f.mae || "").replace(/"/g, "&quot;"), crimEsc = (f.criminal || "").replace(/"/g, "&quot;"), obsEsc = (f.obs || "").replace(/"/g, "&quot;");
    var btnCor = f.naoIdentificado ? "#eab308" : "#475569", btnTxtCor = f.naoIdentificado ? "#0f172a" : "#ffffff";
    html += '<div class="env-box">' +
      '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">' +
        '<strong style="font-size:13px; color:#eab308;">Identificação do Ferido ' + (mdipFeridos.length > 1 ? (i + 1) : "") + '</strong>' +
        '<div style="display:flex; gap:6px;">' +
          '<button type="button" class="btn-small" style="background:' + btnCor + ';color:' + btnTxtCor + ';border:none;padding:5px 9px;font-weight:bold;" onclick="alternarNaoIdentificadoMdip(' + i + ')">' + (f.naoIdentificado ? "Não Identificado (Ativo)" : "Não Identificado") + '</button>' +
          '<button type="button" class="btn-small" style="background:#dc2626;border:none;padding:5px 9px;" onclick="removerFeridoMdip(' + i + ')">X</button>' +
        '</div>' +
      '</div>' +
      '<div class="row" style="margin-bottom:6px;"><span class="dot"></span><span class="lbl">Nome:</span><input type="text" value="' + nomeEsc + '" oninput="onFeridoMdipInput(' + i + ', \'nome\', this.value)" onblur="onFeridoMdipNomeBlur(' + i + ', \'nome\', this)"></div>' +
      '<div class="row" style="margin-bottom:6px;"><span class="dot"></span><span class="lbl">RG:</span><input type="text" value="' + rgEsc + '" placeholder="xx.xxx.xxx-x ou xx.xxx.xxx" oninput="onFeridoMdipInput(' + i + ', \'rg\', this.value)" onblur="onFeridoMdipRgBlur(' + i + ', this)"></div>' +
      '<div class="row" style="margin-bottom:6px;"><span class="dot"></span><span class="lbl">Mãe:</span><input type="text" value="' + maeEsc + '" oninput="onFeridoMdipInput(' + i + ', \'mae\', this.value)" onblur="onFeridoMdipNomeBlur(' + i + ', \'mae\', this)"></div>' +
      '<div class="row" style="margin-bottom:6px;"><span class="dot"></span><span class="lbl">Criminal:</span><input type="text" value="' + crimEsc + '" oninput="onFeridoMdipInput(' + i + ', \'criminal\', this.value)"></div>' +
      '<div class="row" style="margin-bottom:0;"><span class="dot"></span><span class="lbl">Obs. (Caract./Vest.):</span><input type="text" value="' + obsEsc + '" placeholder="Características físicas e vestimentas..." oninput="onFeridoMdipInput(' + i + ', \'obs\', this.value)"></div>' +
    '</div>';
  }
  box.innerHTML = html;
}
function gerarDadosMdip() {
  var html = '<div class="mdip-title">MORTE DECORRENTE DE INTERVENÇÃO POLICIAL</div>', txtWpp = "*MORTE DECORRENTE DE INTERVENÇÃO POLICIAL*" + NL + NL, txtPuro = "MORTE DECORRENTE DE INTERVENÇÃO POLICIAL" + NL + NL;
  function addCampo(rotulo, val) { if (!val) return; html += '<div class="res-line"><b>' + rotulo + ':</b> ' + val + '</div>'; txtWpp += "*" + rotulo + ":* " + val + NL; txtPuro += rotulo + ": " + val + NL; }
  function addEspaco() { html += '<div class="res-gap"></div>'; txtWpp += NL; txtPuro += NL; }

  var dt = $("m-data").value.trim(), qtr = $("m-qtr").value.trim(), area = $("m-area").value.trim(), cia = $("m-cia").value.trim(), qth = $("m-qth").value.trim(), correg = $("m-correg").value.trim();
  var temBloco1 = (dt || qtr || area || cia || qth || correg);
  if (temBloco1) { addCampo("Data", dt); addCampo("QTR", qtr); addCampo("Área", area); addCampo("Cia", cia); addCampo("QTH dos fatos", qth); addCampo("QTR acionamento Correg/Atendente", correg); }
  var vtr = $("m-vtr").value.trim();
  if (vtr) { if (temBloco1) addEspaco(); addCampo("Viatura", vtr); }

  var equipeSlots = new Array({ lbl: "Cmte Equipe", p: "m-cmt", a: "m-cmt-arma", d: "m-cmt-disp", o: "m-cmt-ocor" }, { lbl: "Motorista", p: "m-mot", a: "m-mot-arma", d: "m-mot-disp", o: "m-mot-ocor" }, { lbl: "3º Homem", p: "m-h3", a: "m-h3-arma", d: "m-h3-disp", o: "m-h3-ocor" }, { lbl: "4º Homem", p: "m-h4", a: "m-h4-arma", d: "m-h4-disp", o: "m-h4-ocor" }, { lbl: "5º Homem", p: "m-h5", a: "m-h5-arma", d: "m-h5-disp", o: "m-h5-ocor" });
  var temAlgumPolicial = false;
  for (var i = 0; i < equipeSlots.length; i++) {
    var sl = equipeSlots[i], vp = $(sl.p).value.trim(), va = $(sl.a).value.trim(), vd = $(sl.d).value.trim(), vo = $(sl.o).value.trim();
    if (vp || va || vd || vo) { if (temBloco1 || vtr || temAlgumPolicial) addEspaco(); temAlgumPolicial = true; addCampo(sl.lbl, vp); addCampo("Arma", va); addCampo("Qtde Disparos", vd); addCampo("Qtde Ocorrências", vo); }
  }

  var feridosValidos = mdipFeridos.filter(function(fer) { return fer.naoIdentificado || (fer.nome || "").trim() || (fer.rg || "").trim() || (fer.mae || "").trim() || (fer.criminal || "").trim() || (fer.obs || "").trim(); });
  if (feridosValidos.length > 0) {
    for (var k = 0; k < feridosValidos.length; k++) {
      if (temBloco1 || vtr || temAlgumPolicial || k > 0) addEspaco();
      var curF = feridosValidos[k], rotFerido = feridosValidos.length > 1 ? ("Identificação do ferido " + (k + 1)) : "Identificação do ferido";
      addCampo(rotFerido, curF.naoIdentificado ? "Não identificado" : "Identificado");
      var temDadosPessoa = ((curF.nome || "").trim() || (curF.rg || "").trim() || (curF.mae || "").trim() || (curF.criminal || "").trim() || (curF.obs || "").trim());
      if (temDadosPessoa) addEspaco();
      if ((curF.nome || "").trim()) addCampo("Nome", formatarNomePessoa(curF.nome));
      if ((curF.rg || "").trim()) addCampo("RG", formatarRgTexto(curF.rg));
      if ((curF.mae || "").trim()) addCampo("Mãe", formatarNomePessoa(curF.mae));
      if ((curF.criminal || "").trim()) addCampo("Criminal", curF.criminal.trim());
      if ((curF.obs || "").trim()) addCampo("Observação (Características/Vestimentas)", curF.obs.trim());
    }
  }

  var dp = $("m-dp").value.trim(), del = $("m-del").value.trim(), qtrCiencia = $("m-qtr-ciencia").value.trim(), bopm = $("m-bopm").value.trim(), bopc = $("m-bopc").value.trim();
  var temBlocoPolJud = (dp || del || qtrCiencia || bopm || bopc);
  if (temBlocoPolJud) { if (temBloco1 || vtr || temAlgumPolicial || feridosValidos.length > 0) addEspaco(); addCampo("DP", dp); addCampo("Delegado(a)", del); addCampo("QTR Ciência", qtrCiencia); addCampo("BOPM", bopm); addCampo("BOPC", bopc); }

  var qtrRede = $("m-qtr-rede").value.trim(), vtrsLocal = $("m-vtrs-local").value.trim(), vtrIc = $("m-vtr-ic").value.trim(), perito = $("m-perito").value.trim(), qtrChegada = $("m-qtr-chegada").value.trim();
  var itensApr = $("m-apr").value.trim() ? separarItensApreensoes($("m-apr").value.trim()) : new Array();
  var temBlocoApoio = (qtrRede || vtrsLocal || vtrIc || perito || qtrChegada || itensApr.length > 0);
  if (temBlocoApoio) {
    if (temBloco1 || vtr || temAlgumPolicial || feridosValidos.length > 0 || temBlocoPolJud) addEspaco();
    if (qtrRede) addCampo("QTR solicitação de resgate na rede", qtrRede);
    if (vtrsLocal) { if (qtrRede) addEspaco(); addCampo("Viaturas que compareceram pelo local", vtrsLocal); }
    if (vtrIc) { if (qtrRede || vtrsLocal) addEspaco(); addCampo("Viatura IC", vtrIc); }
    addCampo("Perito", perito); addCampo("QTR chegada", qtrChegada);
    if (itensApr.length > 0) {
      if (qtrRede || vtrsLocal || vtrIc || perito || qtrChegada) addEspaco();
      html += '<div class="res-line"><b>Objetos apreendidos:</b></div>'; txtWpp += "*Objetos apreendidos:*" + NL; txtPuro += "Objetos apreendidos:" + NL;
      for (var aIdx = 0; aIdx < itensApr.length; aIdx++) { html += '<div class="res-line">• ' + itensApr[aIdx] + '</div>'; txtWpp += "• " + itensApr[aIdx] + NL; txtPuro += "• " + itensApr[aIdx] + NL; }
    }
  }

  var resgate = $("m-resgate").value.trim(), qtrLocal = $("m-qtr-local").value.trim(), qtrSaida = $("m-qtr-saida").value.trim(), qtrPs = $("m-qtr-ps").value.trim(), ps = $("m-ps").value.trim(), medico = $("m-medico").value.trim(), vtrEscolta = $("m-vtr-escolta").value.trim();
  var temBlocoResgate = (resgate || qtrLocal || qtrSaida || qtrPs || ps || medico || vtrEscolta);
  if (temBlocoResgate) {
    if (temBloco1 || vtr || temAlgumPolicial || feridosValidos.length > 0 || temBlocoPolJud || temBlocoApoio) addEspaco();
    addCampo("Resgate", resgate); addCampo("QTR no local", qtrLocal); addCampo("QTR de saída", qtrSaida); addCampo("QTR no PS", qtrPs); addCampo("PS", ps); addCampo("Médico + CRM", medico); addCampo("VTR Escolta", vtrEscolta);
  }
  return { html: html, wpp: txtWpp.trim(), puro: txtPuro.trim() };
}

function atualizarMdip() { var box = $("mdip-preview-box"); if (box) box.innerHTML = gerarDadosMdip().html; }

function obterTextoEditadoMdip(modoWpp) {
  var box = $("mdip-preview-box"); if (!box) return "";
  var linhas = new Array(), filhos = box.childNodes;
  for (var i = 0; i < filhos.length; i++) {
    var el = filhos[i];
    if (el.nodeType === 1) {
      if (el.className === "res-gap") linhas.push("");
      else {
        var txt = (el.innerText || el.textContent || "").trim();
        if (modoWpp && el.className === "mdip-title") linhas.push("*" + txt.toUpperCase() + "*");
        else if (modoWpp && (el.className === "res-center" || el.className === "res-title")) linhas.push("*" + txt + "*");
        else if (modoWpp && txt.indexOf(":") > -1 && el.querySelector("b")) { var idx = txt.indexOf(":"); linhas.push("*" + txt.slice(0, idx + 1) + "*" + txt.slice(idx + 1)); }
        else linhas.push(txt);
      }
    } else if (el.nodeType === 3) { var t = el.nodeValue.trim(); if (t) linhas.push(t); }
  }
  return linhas.join(NL).trim();
}

function limparMdip() {
  var ids = new Array("m-data", "m-qtr", "m-area", "m-cia", "m-qth", "m-correg", "m-vtr", "m-cmt", "m-cmt-arma", "m-cmt-disp", "m-cmt-ocor", "m-mot", "m-mot-arma", "m-mot-disp", "m-mot-ocor", "m-h3", "m-h3-arma", "m-h3-disp", "m-h3-ocor", "m-h4", "m-h4-arma", "m-h4-disp", "m-h4-ocor", "m-h5", "m-h5-arma", "m-h5-disp", "m-h5-ocor", "m-dp", "m-del", "m-qtr-ciencia", "m-bopm", "m-bopc", "m-qtr-rede", "m-vtrs-local", "m-vtr-ic", "m-perito", "m-qtr-chegada", "m-apr", "m-resgate", "m-qtr-local", "m-qtr-saida", "m-qtr-ps", "m-ps", "m-medico", "m-vtr-escolta");
  for (var i = 0; i < ids.length; i++) { var el = $(ids[i]); if (el) el.value = ""; }
  mdipFeridos = new Array({ naoIdentificado: false, nome: "", rg: "", mae: "", criminal: "", obs: "" });
  renderizarFeridosMdip(); atualizarMdip();
}

function enviarMdipWpp() { var txtWpp = obterTextoEditadoMdip(true), txtPuro = obterTextoEditadoMdip(false); if (!txtWpp) return alert("Preencha os dados do MDIP primeiro."); registrarTrabalhoSalvo("MDIP - " + ($("m-data").value.trim() || getToday()), txtPuro, ""); enviarWpp(txtWpp); }
function copiarMdip() { var txt = obterTextoEditadoMdip(false); if (!txt) return alert("Preencha os dados do MDIP primeiro."); copiarTextoSeguro(txt, "MDIP copiado!"); }
async function exportarMdipTxt() { var txt = obterTextoEditadoMdip(false); if (!txt) return alert("Preencha os dados do MDIP primeiro."); var dt = $("m-data").value.trim() || getToday(); registrarTrabalhoSalvo("MDIP - " + dt, txt, ""); var bopm = ($("m-bopm").value.trim() || dt).replace(/[^a-zA-Z0-9_-]/g, "_"); await exportarArquivoNativo("MDIP_" + bopm + ".txt", txt, false, "MDIP"); }
function saveAll() {
  sSet("qru_draft", JSON.stringify({
    doc: $("f-doc").value, uni: $("f-uni").value, outUni: $("out-uni").value, data: $("f-data").value, hora: $("f-hora").value,
    cia: $("f-cia").value, pel: $("f-pel").value, vtr: $("f-vtr").value, kmi: $("f-kmi").value, kmf: $("f-kmf").value,
    kmp: $("f-kmp").value, cmt: $("f-cmt").value, mot: $("f-mot").value, h3: $("f-h3").value, h4: $("f-h4").value, h5: $("f-h5").value, body: $("txt-body").value,
    modo: modoDocumentoAtual, gpsAtivo: !gpsParadoManualmente && (watchId !== null || sGet("qru_gps_ativo") === "1"),
    blkStart: blkStart ? blkStart.getTime() : null, blkEndTarget: blkEndTarget ? blkEndTarget.getTime() : null, bairros: bairros
  }));
}

function loadDraft() {
  var raw = sGet("qru_draft");
  if (!raw) { $("f-data").value = getToday(); $("txt-body").value = ITEM1; return; }
  var d = JSON.parse(raw);
  $("f-doc").value = d.doc || "FOLHA DE QRU"; $("f-uni").value = d.uni || ""; $("out-uni").value = d.outUni || "";
  $("f-data").value = (d.data && d.data.trim()) ? d.data : getToday(); $("f-hora").value = d.hora || ""; $("f-cia").value = d.cia || "";
  $("f-pel").value = d.pel || ""; $("f-vtr").value = d.vtr || ""; $("f-kmi").value = d.kmi || ""; $("f-kmf").value = d.kmf || "";
  $("f-kmp").value = d.kmp || ""; $("f-cmt").value = d.cmt || ""; $("f-mot").value = d.mot || ""; $("f-h3").value = d.h3 || "";
  $("f-h4").value = d.h4 || ""; $("f-h5").value = d.h5 || ""; $("txt-body").value = d.body || ITEM1;
  if (d.modo) modoDocumentoAtual = d.modo;
  if (Array.isArray(d.bairros)) bairros = d.bairros;
  if (d.blkStart) blkStart = new Date(d.blkStart);
  if (d.blkEndTarget) blkEndTarget = new Date(d.blkEndTarget);
  else if (blkStart) blkEndTarget = calcularProximaHoraCheiaGps(blkStart);
  if (d.gpsAtivo || sGet("qru_gps_ativo") === "1") { verificarBlocosVencidosGps(); startGps(true); }
}

function updateCount() { $("cnt-saved").textContent = JSON.parse(sGet("qru_saved") || "[]").length; }

function renderSaved() {
  var list = JSON.parse(sGet("qru_saved") || "[]"), box = $("saved-box");
  if (!list.length) { box.innerHTML = "<div class='card'>Nenhum trabalho salvo.</div>"; return; }
  box.innerHTML = list.map(function(it, idx) {
    return '<div class="sv-item"><span class="sv-dt" onclick="openSaved(' + idx + ')">' + it.data + '</span><button type="button" class="btn-small" style="background:#2563eb;border:none;padding:6px 9px;" onclick="exportarSavedDireto(' + idx + ')">Exportar</button><button type="button" class="btn-small" style="padding:6px 9px;" onclick="renameSaved(' + idx + ')">Renomear</button><button type="button" class="btn-small" style="background:#dc2626;border:none;padding:6px 9px;" onclick="delSaved(' + idx + ')">X</button></div>';
  }).join("");
}

async function exportarSavedDireto(i) {
  var list = JSON.parse(sGet("qru_saved") || "[]"), item = list[i]; if (!item) return;
  var nomeLimpo = (item.data || "Arquivo_Salvo").replace(/[^a-zA-Z0-9_-]/g, "_");
  if (item.img) await exportarArquivoNativo(nomeLimpo + ".jpg", item.img.split(",").pop(), true, item.data);
  else await exportarArquivoNativo(nomeLimpo + ".txt", item.text || "", false, item.data);
}

function renameSaved(i) {
  var list = JSON.parse(sGet("qru_saved") || "[]"); if (!list[i]) return;
  var novo = prompt("Digite o novo título:", list[i].data);
  if (novo !== null && novo.trim() !== "") { list[i].data = novo.trim(); sSet("qru_saved", JSON.stringify(list)); renderSaved(); }
}

function openSaved(i) {
  var list = JSON.parse(sGet("qru_saved") || "[]"), item = list.slice(i, i + 1).pop(); if (!item) return;
  var imgEl = $("saved-full-img");
  if (item.img) { imgEl.src = item.img; imgEl.style.display = "block"; } else { imgEl.src = ""; imgEl.style.display = "none"; }
  $("saved-full-txt").textContent = item.text || ""; $("saved-detail").style.display = "block";
  $("btn-sv-wpp").onclick = async function() { if (item.img) { await exportarArquivoNativo("trabalho_salvo.jpg", item.img.split(",").pop(), true, item.data); return; } enviarWpp($("saved-full-txt").textContent); };
  $("btn-sv-cpy").onclick = function() { copiarTextoSeguro(item.text || item.data, "Copiado!"); };
  $("btn-sv-exp").onclick = async function() { var nomeLimpo = (item.data || "Arquivo_Salvo").replace(/[^a-zA-Z0-9_-]/g, "_"); if (item.img) await exportarArquivoNativo(nomeLimpo + ".jpg", item.img.split(",").pop(), true, item.data); else await exportarArquivoNativo(nomeLimpo + ".txt", item.text || "", false, item.data); };
}

function delSaved(i) { var list = JSON.parse(sGet("qru_saved") || "[]"); list.splice(i, 1); sSet("qru_saved", JSON.stringify(list)); renderSaved(); updateCount(); }
async function baixarOuSalvarDireto(nomeArquivo, conteudo, isBase64) {
  var caminho = await salvarNaPastaAndroid(nomeArquivo, conteudo, isBase64);
  if (caminho) { alert("Salvo no celular em:\n" + caminho); return; }
  var a = document.createElement("a");
  if (isBase64) a.href = conteudo.indexOf("data:") === 0 ? conteudo : ("data:image/jpeg;base64," + conteudo);
  else a.href = URL.createObjectURL(new Blob([conteudo], { type: "text/plain;charset=utf-8" }));
  a.download = nomeArquivo; document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

function imprimirSecao(idElemento) {
  var el = $(idElemento); if (!el) return window.print();
  var conteudo = (idElemento === "qual-result-box" && fotoQualFinalBase64) ? '<img src="' + fotoQualFinalBase64 + '" style="max-width:100%;height:auto;">' : el.innerHTML;
  var win = window.open("", "_blank"); if (!win) return window.print();
  win.document.write('<html><head><title>Impressão</title><style>body{font-family:Arial,sans-serif;padding:20px;color:#000;}textarea{width:100%;border:none;font-family:Arial,sans-serif;font-size:14px;}</style></head><body>' + conteudo + '</body></html>');
  win.document.close(); win.focus(); setTimeout(function() { win.print(); win.close(); }, 300);
}

async function salvarResenhaCelular() { var txt = obterTextoEditadoResenha(false); if (!txt) return alert("Preencha os dados da resenha primeiro."); var dt = getToday(); registrarTrabalhoSalvo("Resenha de Ocorrência - " + dt, txt, ""); var bopm = ($("r-bopm").value.trim() || dt).replace(/[^a-zA-Z0-9_-]/g, "_"); await baixarOuSalvarDireto("Resenha_" + bopm + ".txt", txt, false); }
async function encerrarResenha() { var txt = obterTextoEditadoResenha(false); if (!txt) return alert("Preencha os dados da resenha primeiro."); var dt = getToday(); registrarTrabalhoSalvo("Resenha de Ocorrência - " + dt, txt, ""); var bopm = ($("r-bopm").value.trim() || dt).replace(/[^a-zA-Z0-9_-]/g, "_"); await salvarNaPastaAndroid("Resenha_" + bopm + ".txt", txt, false); limparResenha(); alert("Resenha encerrada e salva!"); voltarInicio(); }
async function salvarMdipCelular() { var txt = obterTextoEditadoMdip(false); if (!txt) return alert("Preencha os dados do MDIP primeiro."); var dt = $("m-data").value.trim() || getToday(); registrarTrabalhoSalvo("MDIP - " + dt, txt, ""); var bopm = ($("m-bopm").value.trim() || dt).replace(/[^a-zA-Z0-9_-]/g, "_"); await baixarOuSalvarDireto("MDIP_" + bopm + ".txt", txt, false); }
async function encerrarMdip() { var txt = obterTextoEditadoMdip(false); if (!txt) return alert("Preencha os dados do MDIP primeiro."); var dt = $("m-data").value.trim() || getToday(); registrarTrabalhoSalvo("MDIP - " + dt, txt, ""); var bopm = ($("m-bopm").value.trim() || dt).replace(/[^a-zA-Z0-9_-]/g, "_"); await salvarNaPastaAndroid("MDIP_" + bopm + ".txt", txt, false); limparMdip(); alert("MDIP encerrado e salvo!"); voltarInicio(); }

function copiarQualificacao() { var resumo = "Nome: " + $("q-nome").value.trim() + NL + "RG: " + $("q-rg").value.trim() + NL + "Vulgo: " + $("q-vulgo").value.trim() + NL + "Artigo: " + $("q-artigo").value.trim() + NL + "DP: " + $("q-dp").value.trim() + NL + "BOPM: " + $("q-bopm").value.trim() + " | BOPC: " + $("q-bopc").value.trim(); copiarTextoSeguro(resumo, "Dados da qualificação copiados!"); }
async function salvarQualificacaoCelular() { if (!fotoQualFinalBase64) return alert("Gere a foto com placa primeiro."); var nomeBase = ($("q-nome").value.trim() || "Qualificacao").replace(/[^a-zA-Z0-9_-]/g, "_"); var dt = ($("q-data").value.trim() || getToday()).split("/").join("-"); await baixarOuSalvarDireto(nomeBase + "_" + dt + ".jpg", fotoQualFinalBase64.split(",").pop(), true); }
async function encerrarQualificacao() {
  if (!fotoQualFinalBase64 && !fotoQualBase64) return alert("Tire uma foto primeiro.");
  if (!fotoQualFinalBase64 && fotoQualBase64) { gerarPlacaQualificacao(); await new Promise(function(r) { setTimeout(r, 400); }); }
  var nomeBase = ($("q-nome").value.trim() || "Qualificacao").replace(/[^a-zA-Z0-9_-]/g, "_");
  var dt = ($("q-data").value.trim() || getToday()).split("/").join("-");
  await salvarNaPastaAndroid(nomeBase + "_" + dt + ".jpg", fotoQualFinalBase64.split(",").pop(), true);
  var inputs = document.querySelectorAll('#qual-screen input[type="text"]');
  for (var i = 0; i < inputs.length; i++) inputs[i].value = "";
  fotoQualBase64 = ""; fotoQualFinalBase64 = ""; $("qual-thumb").style.display = "none"; $("qual-result-box").style.display = "none";
  alert("Qualificação encerrada e salva!"); voltarInicio();
}

(function init() {
  var ft = document.querySelector(".footer-text");
  if (ft) {
    var box = document.createElement("div");
    box.className = "contact-box";
    var tel = "5513974031785";
    var urlWa = "https:/" + "/wa.me/" + tel;
    box.innerHTML = '<div class="contact-label">Dúvidas / Críticas / Sugestões</div>' +
      '<a href="' + urlWa + '" target="_blank" class="whatsapp-link">' +
      '<svg viewBox="0 0 32 32"><path d="M16.004 3.2c-7.06 0-12.8 5.74-12.8 12.8 0 2.256.59 4.458 1.71 6.398L3.1 29.01l6.784-1.78a12.74 12.74 0 0 0 6.12 1.56h.006c7.058 0 12.798-5.74 12.798-12.8 0-3.42-1.332-6.634-3.75-9.052A12.714 12.714 0 0 0 16.004 3.2zm0 23.43h-.004a10.61 10.61 0 0 1-5.41-1.482l-.388-.23-4.026 1.056 1.074-3.924-.252-.402a10.588 10.588 0 0 1-1.624-5.648c0-5.864 4.77-10.634 10.636-10.634 2.84 0 5.51 1.108 7.518 3.116a10.566 10.566 0 0 1 3.114 7.522c0 5.864-4.772 10.626-10.638 10.626zm5.834-7.964c-.32-.16-1.892-.934-2.186-1.04-.292-.106-.506-.16-.72.16-.212.32-.824 1.04-1.01 1.254-.186.212-.372.24-.692.08-.32-.16-1.35-.498-2.572-1.588-.95-.848-1.592-1.896-1.778-2.216-.186-.32-.02-.492.14-.652.144-.144.32-.374.48-.56.16-.186.212-.32.32-.534.106-.212.054-.4-.026-.56-.08-.16-.72-1.734-.986-2.374-.26-.624-.524-.54-.72-.55l-.614-.01c-.212 0-.56.08-.852.4-.292.32-1.118 1.094-1.118 2.666 0 1.574 1.146 3.094 1.306 3.308.16.212 2.254 3.442 5.462 4.826.762.33 1.358.526 1.822.674.766.244 1.462.21 2.014.128.614-.092 1.892-.774 2.158-1.52.266-.746.266-1.386.186-1.52-.08-.134-.292-.214-.612-.374z"/></svg></a>';
    ft.parentNode.insertBefore(box, ft);
  }
  atualizarFundo(); loadEquipe(); loadDraft(); atualizarTelaCabecalho();
  if (!$("f-data").value.trim()) $("f-data").value = getToday();
  updateCount();
  document.addEventListener("visibilitychange", function() { if (document.hidden) saveAll(); });
  window.addEventListener("pagehide", saveAll);
})();
