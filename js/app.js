(function () {
  "use strict";
  var L = window.Lince;
  var sourceFilter = "";
  var charts = {};

  function $(sel) { return document.querySelector(sel); }
  function $all(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }
  function toast(msg) {
    var el = $("#toast");
    el.textContent = msg;
    el.classList.add("on");
    setTimeout(function () { el.classList.remove("on"); }, 2200);
  }

  if (!L.session()) {
    location.href = "entrar.html";
    return;
  }

  $("#who").textContent = L.session().name;

  function show(id) {
    $all("[data-view]").forEach(function (v) { v.classList.toggle("hidden", v.getAttribute("data-view") !== id); });
    $all("[data-go]").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-go") === id); });
    if (id === "dash") renderDash();
    if (id === "fontes") renderSources();
    if (id === "jobs") renderJobs();
    if (id === "dados") renderData();
    if (id === "logs") renderLogs();
  }

  function destroy(key) {
    if (charts[key]) { charts[key].destroy(); charts[key] = null; }
  }

  function renderDash() {
    var s = L.stats();
    $("#k-rec").textContent = s.records;
    $("#k-src").textContent = s.active + "/" + s.sources;
    $("#k-ok").textContent = s.success + "%";
    $("#k-run").textContent = s.run;
    var bySource = {};
    L.db().records.forEach(function (r) {
      var name = (L.sourceById(r.sourceId) || {}).name || r.sourceId;
      bySource[name] = (bySource[name] || 0) + 1;
    });
    destroy("vol");
    charts.vol = new Chart($("#chart-vol"), {
      type: "bar",
      data: {
        labels: Object.keys(bySource),
        datasets: [{ label: "Registros", data: Object.values(bySource), backgroundColor: "#3f6d12" }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: "#5f6858" }, grid: { color: "#e4e7df" } }, y: { ticks: { color: "#5f6858" }, grid: { color: "#e4e7df" } } } } }
    });
    destroy("st");
    charts.st = new Chart($("#chart-st"), {
      type: "doughnut",
      data: {
        labels: ["ok", "running", "error"],
        datasets: [{ data: [s.ok, s.run, s.err], backgroundColor: ["#2d7a38", "#1f6ea3", "#b63d28"] }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
    renderJobs("#job-mini", 5);
    renderLogs("#log-mini", 5);
  }

  function renderSources() {
    $("#src-table").innerHTML = L.db().sources.map(function (s) {
      return (
        "<tr>" +
          "<td><strong>" + L.escapeHtml(s.name) + "</strong><div class='muted mono'>" + L.escapeHtml(s.url) + "</div></td>" +
          "<td>" + L.escapeHtml(s.type) + "</td>" +
          "<td class='mono'>" + L.escapeHtml(s.schema.join(", ")) + "</td>" +
          "<td>" + L.escapeHtml(s.interval) + "</td>" +
          "<td>" + (s.active ? "<span class='badge ok'>ativa</span>" : "<span class='badge queued'>pausada</span>") + "</td>" +
          "<td>" +
            "<button class='btn btn-acid btn-sm' data-run='" + s.id + "' type='button'>Rodar</button> " +
            "<button class='btn btn-line btn-sm' data-toggle='" + s.id + "' type='button'>On/Off</button> " +
            "<button class='btn btn-line btn-sm' data-del='" + s.id + "' type='button'>Excluir</button>" +
          "</td>" +
        "</tr>"
      );
    }).join("");
  }

  function renderJobs(target, limit) {
    var el = $(target || "#job-table");
    var list = L.db().jobs.slice(0, limit || 50);
    el.innerHTML = list.map(function (j) {
      var src = L.sourceById(j.sourceId);
      return (
        "<tr>" +
          "<td class='mono'>" + L.escapeHtml(j.id) + "</td>" +
          "<td>" + L.escapeHtml(src ? src.name : j.sourceId) + "</td>" +
          "<td><span class='badge " + j.status + "'>" + j.status + "</span></td>" +
          "<td>" + j.records + "</td>" +
          "<td class='muted'>" + j.startedAt.replace("T", " ").slice(0, 16) + "</td>" +
          "<td>" + L.escapeHtml(j.message) + "</td>" +
        "</tr>"
      );
    }).join("") || "<tr><td colspan='6'>Sem jobs.</td></tr>";
  }

  function renderData() {
    var sel = $("#data-src");
    sel.innerHTML = "<option value=''>Todas as fontes</option>" + L.db().sources.map(function (s) {
      return "<option value='" + s.id + "'" + (sourceFilter === s.id ? " selected" : "") + ">" + L.escapeHtml(s.name) + "</option>";
    }).join("");
    var source = sourceFilter ? L.sourceById(sourceFilter) : L.db().sources[0];
    var cols = source ? source.schema : [];
    var rows = L.recordsBySource(sourceFilter);
    $("#data-head").innerHTML = "<tr>" + cols.map(function (c) { return "<th>" + L.escapeHtml(c) + "</th>"; }).join("") + "<th>coletado</th></tr>";
    $("#data-body").innerHTML = rows.slice(0, 80).map(function (r) {
      return "<tr>" + cols.map(function (c) { return "<td>" + L.escapeHtml(r.data[c]) + "</td>"; }).join("") +
        "<td class='muted mono'>" + r.collectedAt.replace("T", " ").slice(0, 16) + "</td></tr>";
    }).join("") || "<tr><td colspan='8'>Nenhum registro.</td></tr>";
    $("#data-count").textContent = rows.length + " linhas estruturadas";
  }

  function renderLogs(target, limit) {
    var el = $(target || "#logs");
    el.innerHTML = L.db().logs.slice(0, limit || 40).map(function (l) {
      return "<div class='log " + l.level + "'>" + l.at.replace("T", " ").slice(0, 19) + " · " + L.escapeHtml(l.text) + "</div>";
    }).join("");
  }

  document.addEventListener("click", function (e) {
    var go = e.target.closest("[data-go]");
    var run = e.target.closest("[data-run]");
    var tog = e.target.closest("[data-toggle]");
    var del = e.target.closest("[data-del]");
    if (go) show(go.getAttribute("data-go"));
    if (run) {
      var r = L.runJob(run.getAttribute("data-run"));
      toast(r.ok ? "Job na fila." : r.error);
      renderSources();
      renderJobs();
    }
    if (tog) {
      L.toggleSource(tog.getAttribute("data-toggle"));
      renderSources();
    }
    if (del && confirm("Excluir fonte?")) {
      L.deleteSource(del.getAttribute("data-del"));
      renderSources();
    }
    if (e.target.id === "logout") {
      L.logout();
      location.href = "index.html";
    }
    if (e.target.id === "export") {
      var id = sourceFilter || (L.db().sources[0] && L.db().sources[0].id);
      if (!id) return;
      var blob = new Blob([L.toCsv(id)], { type: "text/csv" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = id + ".csv";
      a.click();
    }
    if (e.target.id === "reset") {
      L.reset();
      location.reload();
    }
  });

  $("#src-form").addEventListener("submit", function (e) {
    e.preventDefault();
    L.addSource({
      name: $("#f-name").value,
      url: $("#f-url").value,
      type: $("#f-type").value,
      schema: $("#f-schema").value,
      interval: $("#f-int").value
    });
    e.target.reset();
    renderSources();
    toast("Fonte cadastrada.");
  });

  $("#data-src").addEventListener("change", function () {
    sourceFilter = this.value;
    renderData();
  });

  document.addEventListener("lince:updated", function () {
    renderDash();
    renderJobs();
    renderData();
    renderLogs();
    toast("Coleta concluída.");
  });

  show("dash");
})();
