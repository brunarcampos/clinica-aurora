(function () {
  "use strict";
  var CONFIG = { webhookUrl: "", whatsapp: "5541999999999" };

  var S = [
    { n: "Limpeza de pele profunda", min: 75, p: "R$ 150", t: { pele: 3 }, d: "Remove impurezas e renova a textura da pele." },
    { n: "Massagem relaxante", min: 60, p: "R$ 140", t: { relax: 3 }, d: "Alivia a tensão muscular e o estresse do dia a dia." },
    { n: "Drenagem linfática", min: 60, p: "R$ 160", t: { inchaco: 3, relax: 1 }, d: "Reduz a retenção de líquidos e a sensação de peso." },
    { n: "Peeling químico", min: 45, p: "R$ 220", t: { pele: 3 }, d: "Uniformiza o tom e suaviza manchas." },
    { n: "Design de sobrancelhas", min: 30, p: "R$ 60", t: { rapido: 3 }, d: "Realça o olhar de forma rápida e natural." },
    { n: "Day Spa completo", min: 150, p: "R$ 390", t: { relax: 3, pele: 2, inchaco: 1 }, d: "Esfoliação, massagem e limpeza facial em uma tarde." }];
  var GOALS = { relax: "relaxar", pele: "cuidar da pele", inchaco: "reduzir o inchaço", rapido: "algo rápido" };

  function recommend(goal, max) {
    return S.filter(function (s) { return s.min <= max && (s.t[goal] || 0) > 0 })
      .sort(function (a, b) { return b.t[goal] - a.t[goal] || a.min - b.min }).slice(0, 2);
  }
  function wa(text) { return "https://wa.me/" + CONFIG.whatsapp + "?text=" + encodeURIComponent(text) }
  function h(s) { return s.replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] }) }
  function recHTML(list) {
    return list.map(function (s) {
      return '<div class="rec"><h3>' + h(s.n) + '</h3><p>' + h(s.d) + ' (' + s.min + ' min · ' + h(s.p) + ')</p>' +
        '<a class="btn" href="' + wa("Olá! Quero agendar: " + s.n) + '" target="_blank" rel="noopener">Agendar no WhatsApp</a></div>';
    }).join("");
  }

  document.getElementById("servicos-lista").innerHTML = S.map(function (s) {
    return '<div class="row"><h3>' + h(s.n) + '</h3><div class="meta">' + h(s.p) + '<small>' + s.min + ' min</small></div><p>' + h(s.d) + '</p></div>';
  }).join("");

  document.getElementById("recomendador").addEventListener("submit", function (e) {
    e.preventDefault();
    var f = new FormData(e.target), goal = f.get("goal"), max = +f.get("time");
    var r = recommend(goal, max);
    document.getElementById("result").innerHTML = r.length
      ? '<p class="note">Para ' + GOALS[goal] + ' no seu tempo, a gente indica com carinho:</p>' + recHTML(r)
      : '<p>Nenhum tratamento cabe nesse tempo. Tente aumentar o tempo disponível.</p>';
  });

  // Assistente
  var chat = document.getElementById("chat"), fab = document.getElementById("fab"), log = document.getElementById("log"),
    input = document.getElementById("msg"), history = [];
  function add(role, text, html) {
    var m = document.createElement("div"); m.className = "msg " + role;
    if (html) m.innerHTML = html; else m.textContent = text;
    log.appendChild(m); log.scrollTop = log.scrollHeight;
  }
  function norm(s) { return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") }
  function local(raw) {
    var t = norm(raw);
    if (/preco|valor|quanto|custa/.test(t)) return { html: "Nossos valores de exemplo:<br>" + S.map(function (s) { return h(s.n) + ": " + h(s.p) }).join("<br>") };
    if (/horario|abre|fecha|funciona/.test(t)) return { text: "Atendemos de segunda a sexta, das 9h às 19h, e aos sábados, das 9h às 14h." };
    if (/endereco|onde|local|chegar/.test(t)) return { text: "Estamos na Rua das Flores, 123, Centro." };
    if (/agend|marcar|reserv/.test(t)) return { html: 'Para agendar, <a href="' + wa("Olá! Quero agendar um horário.") + '" target="_blank" rel="noopener">fale com a equipe no WhatsApp</a>.' };
    var goal = /relax|estress|tens|dor|ansied|cansad|massag/.test(t) ? "relax" : /pele|acne|mancha|cravo|rosto|facial|peeling/.test(t) ? "pele" : /incha|reten|dren|perna|liquid/.test(t) ? "inchaco" : /sobrancelha|rapid/.test(t) ? "rapido" : null;
    if (goal) {
      var r = recommend(goal, 999);
      return { html: "Para " + GOALS[goal] + ", eu indico:" + recHTML(r) };
    }
    if (/^(oi|ola|bom dia|boa tarde|boa noite)/.test(t)) return { text: "Oi! 🌸 Eu sou a Aurora. Me conta o que você procura, tipo relaxar ou cuidar da pele, que eu indico um tratamento com muito carinho." };
    return { text: "Hmm, não entendi direitinho. Pode me perguntar sobre serviços, preços e horários, ou me contar como quer se sentir, tipo relaxar ou desinchar 💗" };
  }
  async function reply(raw) {
    if (CONFIG.webhookUrl) {
      try {
        var c = new AbortController(), to = setTimeout(function () { c.abort() }, 6000);
        var res = await fetch(CONFIG.webhookUrl, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: raw, history: history.slice(-6) }), signal: c.signal
        });
        clearTimeout(to);
        var j = await res.json();
        if (j && j.reply) return { text: j.reply };
      } catch (err) { }
    }
    return local(raw);
  }
  async function send(raw) {
    raw = raw.trim(); if (!raw) return;
    add("user", raw); history.push({ role: "user", content: raw });
    var r = await reply(raw);
    add("bot", r.text, r.html); history.push({ role: "assistant", content: r.text || "" });
  }
  function open(v) {
    chat.classList.toggle("open", v); fab.setAttribute("aria-expanded", v);
    if (v) { input.focus(); if (!log.children.length) add("bot", "Oi, que bom te ver por aqui! 🌸 Eu sou a Aurora. Como posso te ajudar hoje?") }
    else fab.focus();
  }
  fab.addEventListener("click", function () { open(!chat.classList.contains("open")) });
  document.getElementById("close").addEventListener("click", function () { open(false) });
  chat.addEventListener("keydown", function (e) { if (e.key === "Escape") open(false) });
  document.getElementById("chatform").addEventListener("submit", function (e) { e.preventDefault(); var v = input.value; input.value = ""; send(v) });
  document.getElementById("quick").innerHTML = ["Quero relaxar", "Pele com manchas", "Quanto custa?", "Horários"].map(function (q) { return '<button type="button">' + q + '</button>' }).join("");
  document.getElementById("quick").addEventListener("click", function (e) { if (e.target.tagName === "BUTTON") send(e.target.textContent) });
})();