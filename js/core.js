/**
 * LINCE — motor da console de coleta.
 * Este protótipo simula jobs e armazena dados estruturados no navegador.
 * Em produção: workers Python/Node, fila Redis, Postgres e respeito a
 * robots.txt, rate-limit e fontes autorizadas.
 */
(function (global) {
  "use strict";

  var KEY = "lince.v1";
  var AUTH = "lince.auth";

  function uid(prefix) {
    return (prefix || "ID") + "-" + Math.random().toString(16).slice(2, 8).toUpperCase();
  }

  function now() {
    return new Date().toISOString();
  }

  function hoursAgo(h) {
    return new Date(Date.now() - h * 3600 * 1000).toISOString();
  }

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function seed() {
    return {
      sources: [
        {
          id: "src-cafe",
          name: "Mercado Café",
          url: "https://demo.lince.dev/cafe",
          type: "e-commerce",
          schema: ["sku", "produto", "origem", "preco", "estoque"],
          interval: "6h",
          active: true,
          respectRobots: true
        },
        {
          id: "src-vagas",
          name: "Quadro de Vagas",
          url: "https://demo.lince.dev/vagas",
          type: "listagem",
          schema: ["titulo", "empresa", "cidade", "senioridade", "publicado"],
          interval: "3h",
          active: true,
          respectRobots: true
        },
        {
          id: "src-graos",
          name: "Cotações Grãos",
          url: "https://demo.lince.dev/graos",
          type: "série temporal",
          schema: ["commodity", "bolsa", "preco", "variacao", "data"],
          interval: "1h",
          active: true,
          respectRobots: true
        },
        {
          id: "src-agenda",
          name: "Agenda Cultural",
          url: "https://demo.lince.dev/agenda",
          type: "eventos",
          schema: ["evento", "local", "bairro", "data", "preco"],
          interval: "12h",
          active: false,
          respectRobots: true
        }
      ],
      jobs: [
        { id: "job-1", sourceId: "src-cafe", status: "ok", startedAt: hoursAgo(2), finishedAt: hoursAgo(1.9), records: 24, message: "24 itens novos/atualizados" },
        { id: "job-2", sourceId: "src-vagas", status: "ok", startedAt: hoursAgo(3), finishedAt: hoursAgo(2.8), records: 18, message: "18 vagas parseadas" },
        { id: "job-3", sourceId: "src-graos", status: "running", startedAt: hoursAgo(0.1), finishedAt: null, records: 0, message: "Coletando página 2/4" },
        { id: "job-4", sourceId: "src-agenda", status: "error", startedAt: hoursAgo(8), finishedAt: hoursAgo(8), records: 0, message: "HTTP 429 — aguardar janela de rate-limit" }
      ],
      records: demoRecords(),
      logs: [
        { at: hoursAgo(0.1), level: "info", text: "Worker graos iniciado (1 req / 4s)." },
        { at: hoursAgo(1.9), level: "ok", text: "Job Mercado Café concluído. 24 linhas no dataset cafe." },
        { at: hoursAgo(2.8), level: "ok", text: "Job Vagas concluído. Schema validado." },
        { at: hoursAgo(8), level: "warn", text: "Agenda Cultural bloqueada por rate-limit. Próxima tentativa em 2h." }
      ]
    };
  }

  function demoRecords() {
    var rows = [];
    var cafes = [
      ["CF-01", "Bourbon Amarelo", "Sul de Minas", 64.9, 120],
      ["CF-02", "Catuaí Vermelho", "Cerrado", 58.2, 80],
      ["CF-03", "Geisha Lavado", "Chapada", 142.0, 12],
      ["CF-04", "Arábica Natural", "Mogiana", 51.5, 200],
      ["CF-05", "Blend Casa", "Espírito Santo", 39.9, 340]
    ];
    cafes.forEach(function (c, i) {
      rows.push({
        id: "r-c" + i,
        sourceId: "src-cafe",
        collectedAt: hoursAgo(2 - i * 0.1),
        data: { sku: c[0], produto: c[1], origem: c[2], preco: c[3], estoque: c[4] }
      });
    });
    var vagas = [
      ["Eng. de dados", "Norte Lab", "SP", "Pleno", "2026-09-05"],
      ["Fullstack Python", "Safra Digital", "Remoto", "Sênior", "2026-09-06"],
      ["Scraping engineer", "Lince", "BH", "Pleno", "2026-09-07"],
      ["Analista de dados", "Orla", "RJ", "Júnior", "2026-09-04"]
    ];
    vagas.forEach(function (v, i) {
      rows.push({
        id: "r-v" + i,
        sourceId: "src-vagas",
        collectedAt: hoursAgo(3),
        data: { titulo: v[0], empresa: v[1], cidade: v[2], senioridade: v[3], publicado: v[4] }
      });
    });
    var graos = [
      ["Soja", "B3", 128.4, 0.8, "2026-09-07"],
      ["Milho", "B3", 67.1, -0.4, "2026-09-07"],
      ["Café arábica", "ICE", 248.2, 1.2, "2026-09-07"],
      ["Açúcar", "ICE", 19.6, 0.1, "2026-09-07"]
    ];
    graos.forEach(function (g, i) {
      rows.push({
        id: "r-g" + i,
        sourceId: "src-graos",
        collectedAt: hoursAgo(1),
        data: { commodity: g[0], bolsa: g[1], preco: g[2], variacao: g[3], data: g[4] }
      });
    });
    return rows;
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function save(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  function db() {
    var data = load();
    if (!data) {
      data = seed();
      save(data);
    }
    return data;
  }

  function persist(fn) {
    var data = db();
    fn(data);
    save(data);
    return data;
  }

  function sourceById(id) {
    return db().sources.find(function (s) { return s.id === id; }) || null;
  }

  function recordsBySource(sourceId) {
    return db().records.filter(function (r) { return !sourceId || r.sourceId === sourceId; });
  }

  function stats() {
    var d = db();
    var ok = d.jobs.filter(function (j) { return j.status === "ok"; }).length;
    var err = d.jobs.filter(function (j) { return j.status === "error"; }).length;
    var run = d.jobs.filter(function (j) { return j.status === "running"; }).length;
    return {
      sources: d.sources.length,
      active: d.sources.filter(function (s) { return s.active; }).length,
      records: d.records.length,
      jobs: d.jobs.length,
      ok: ok,
      err: err,
      run: run,
      success: d.jobs.length ? Math.round((ok / d.jobs.length) * 100) : 0
    };
  }

  function addSource(payload) {
    var src = {
      id: uid("SRC"),
      name: payload.name,
      url: payload.url,
      type: payload.type || "listagem",
      schema: String(payload.schema || "").split(",").map(function (x) { return x.trim(); }).filter(Boolean),
      interval: payload.interval || "6h",
      active: true,
      respectRobots: true
    };
    persist(function (d) { d.sources.unshift(src); });
    return src;
  }

  function toggleSource(id) {
    persist(function (d) {
      var s = d.sources.find(function (x) { return x.id === id; });
      if (s) s.active = !s.active;
    });
  }

  function deleteSource(id) {
    persist(function (d) {
      d.sources = d.sources.filter(function (s) { return s.id !== id; });
    });
  }

  function sampleFor(source) {
    var type = source.type;
    if (type === "e-commerce") {
      return { sku: "CF-" + Math.floor(Math.random() * 90 + 10), produto: "Lote " + uid("L"), origem: "Cerrado", preco: +(40 + Math.random() * 90).toFixed(1), estoque: Math.floor(Math.random() * 200) };
    }
    if (type === "série temporal") {
      return { commodity: "Soja", bolsa: "B3", preco: +(120 + Math.random() * 10).toFixed(1), variacao: +(Math.random() * 2 - 1).toFixed(2), data: now().slice(0, 10) };
    }
    if (type === "eventos") {
      return { evento: "Mostra " + uid("E"), local: "Centro", bairro: "Savassi", data: "2026-09-20", preco: 40 };
    }
    return { titulo: "Vaga " + uid("V"), empresa: "Studio Norte", cidade: "SP", senioridade: "Pleno", publicado: now().slice(0, 10) };
  }

  function runJob(sourceId) {
    var source = sourceById(sourceId);
    if (!source) return { ok: false, error: "Fonte inexistente." };
    if (!source.active) return { ok: false, error: "Fonte pausada." };
    var job = {
      id: uid("JOB"),
      sourceId: source.id,
      status: "running",
      startedAt: now(),
      finishedAt: null,
      records: 0,
      message: "Fila aceita. Worker alocado."
    };
    persist(function (d) {
      d.jobs.unshift(job);
      d.logs.unshift({ at: now(), level: "info", text: "Job " + job.id + " · " + source.name + " na fila." });
    });
    setTimeout(function () {
      var n = 3 + Math.floor(Math.random() * 4);
      persist(function (d) {
        var j = d.jobs.find(function (x) { return x.id === job.id; });
        if (!j) return;
        for (var i = 0; i < n; i++) {
          d.records.unshift({
            id: uid("R"),
            sourceId: source.id,
            collectedAt: now(),
            data: sampleFor(source)
          });
        }
        j.status = "ok";
        j.finishedAt = now();
        j.records = n;
        j.message = n + " registros estruturados.";
        d.logs.unshift({ at: now(), level: "ok", text: source.name + ": " + n + " linhas gravadas." });
      });
      if (typeof document !== "undefined") {
        document.dispatchEvent(new CustomEvent("lince:updated"));
      }
    }, 1400);
    return { ok: true, job: job };
  }

  function toCsv(sourceId) {
    var source = sourceById(sourceId);
    var rows = recordsBySource(sourceId);
    if (!source) return "";
    var cols = source.schema.concat(["collectedAt"]);
    var lines = [cols.join(",")];
    rows.forEach(function (r) {
      lines.push(cols.map(function (c) {
        var v = c === "collectedAt" ? r.collectedAt : r.data[c];
        return JSON.stringify(v == null ? "" : v);
      }).join(","));
    });
    return lines.join("\n");
  }

  function login(user, pass) {
    if (user === "ana@lince.dev" && pass === "Lince#2026") {
      sessionStorage.setItem(AUTH, JSON.stringify({ name: "Ana Costa", email: user, role: "ops" }));
      return true;
    }
    return false;
  }

  function session() {
    try {
      return JSON.parse(sessionStorage.getItem(AUTH) || "null");
    } catch (e) {
      return null;
    }
  }

  function logout() {
    sessionStorage.removeItem(AUTH);
  }

  function reset() {
    localStorage.removeItem(KEY);
  }

  global.Lince = {
    db: db,
    escapeHtml: escapeHtml,
    sourceById: sourceById,
    recordsBySource: recordsBySource,
    stats: stats,
    addSource: addSource,
    toggleSource: toggleSource,
    deleteSource: deleteSource,
    runJob: runJob,
    toCsv: toCsv,
    login: login,
    session: session,
    logout: logout,
    reset: reset
  };
})(window);
