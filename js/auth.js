(function () {
  "use strict";
  var L = window.Lince;
  if (L.session()) {
    location.href = "console.html";
    return;
  }
  document.getElementById("login-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var ok = L.login(document.getElementById("email").value, document.getElementById("pass").value);
    if (!ok) {
      document.getElementById("err").textContent = "Credenciais inválidas.";
      return;
    }
    location.href = "console.html";
  });
})();
