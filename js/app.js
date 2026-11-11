/* =====================================================================
   APP: login, sesión y conexión entre el libro y el editor.
   ===================================================================== */

const App = (() => {
  const $ = (s) => document.querySelector(s);
  const CLAVE_SESION = "diario-rhazustion-sesion";

  const ss = {
    leer() { try { return JSON.parse(sessionStorage.getItem(CLAVE_SESION)); } catch { return null; } },
    guardar(v) { try { sessionStorage.setItem(CLAVE_SESION, JSON.stringify(v)); } catch {} },
    borrar() { try { sessionStorage.removeItem(CLAVE_SESION); } catch {} },
  };

  const api = { sesion: null };

  async function iniciar(raw, usuario, diario, archivo) {
    api.sesion = { raw, usuario, diario, archivo };
    ss.guardar({ nombre: usuario.nombre, raw: Cripto.b64(raw) });

    $("#sesion-nombre").textContent = usuario.nombre;
    $("#btn-editar").hidden = usuario.rol !== "editor";
    document.body.classList.add("con-sesion");

    await Libro.construir(diario);
    document.body.classList.add("listo");
    $("#login").classList.add("oculto");
    Libro.habilitar(true);

    if (usuario.rol === "editor") Editor.traerUltima();
  }

  function salir() {
    if (Editor.tieneCambios() && !confirmarSalida()) return;
    Editor.descartar();
    ss.borrar();
    api.sesion = null;
    Libro.habilitar(false);
    Libro.reiniciar();
    document.getElementById("libro").innerHTML = "";
    document.body.classList.remove("listo", "con-sesion");
    $("#login-form").reset();
    $("#login-error").textContent = "";
    $("#login").classList.remove("oculto");
    setTimeout(() => $("#login-usuario").focus(), 50);
  }

  let avisoSalida = 0;
  function confirmarSalida() {
    // Doble clic para confirmar, sin ventanas emergentes
    if (Date.now() - avisoSalida < 4000) return true;
    avisoSalida = Date.now();
    $("#btn-salir").textContent = "¿Salir sin guardar?";
    setTimeout(() => { $("#btn-salir").textContent = "Salir"; }, 4000);
    return false;
  }

  // Después de guardar (o de traer una versión nueva de GitHub)
  async function actualizar(diario, archivo) {
    const s = api.sesion;
    s.diario = diario;
    s.archivo = archivo;
    s.usuario = archivo.usuarios.find((u) => u._yo) ||
                archivo.usuarios.find((u) => Cripto.normalizar(u.nombre) === Cripto.normalizar(s.usuario.nombre)) ||
                s.usuario;
    archivo.usuarios.forEach((u) => delete u._yo);
    ss.guardar({ nombre: s.usuario.nombre, raw: Cripto.b64(s.raw) });
    $("#sesion-nombre").textContent = s.usuario.nombre;
    await Libro.construir(diario);
  }

  /* ---------- Login ---------- */

  $("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const boton = $("#login-boton"), error = $("#login-error");
    const archivo = window.DIARIO_CIFRADO;
    if (!archivo) { error.textContent = "No se encontró el diario (falta data/diario.enc.js)."; return; }
    if (!window.crypto || !crypto.subtle) { error.textContent = "Este navegador no permite descifrar el diario. Abrí la página desde su link (https)."; return; }

    boton.disabled = true;
    boton.textContent = "Rompiendo el sello…";
    error.textContent = "";
    try {
      const r = await Cripto.entrar(archivo, $("#login-usuario").value, $("#login-clave").value);
      await iniciar(r.raw, r.usuario, r.diario, archivo);
    } catch (err) {
      error.textContent =
        err.message === "usuario" ? "Ese nombre no figura entre los portadores del diario." :
        err.message === "clave"   ? "La clave no es correcta." :
                                    "No se pudo abrir el diario.";
      $("#login-form").classList.remove("sacudir");
      void $("#login-form").offsetWidth;
      $("#login-form").classList.add("sacudir");
      if (err.message !== "usuario" && err.message !== "clave") console.error(err);
    } finally {
      boton.disabled = false;
      boton.textContent = "Romper el sello";
    }
  });

  $("#btn-salir").addEventListener("click", salir);

  // Si ya entró en esta pestaña, no le pedimos la clave de nuevo al recargar
  (async () => {
    const guardada = ss.leer();
    const archivo = window.DIARIO_CIFRADO;
    if (!guardada || !archivo || !window.crypto?.subtle) return;
    const u = archivo.usuarios.find((x) => Cripto.normalizar(x.nombre) === Cripto.normalizar(guardada.nombre));
    if (!u) { ss.borrar(); return; }
    try {
      const raw = Cripto.desdeB64(guardada.raw);
      const diario = await Cripto.abrirConMaestra(archivo, raw);
      await iniciar(raw, u, diario, archivo);
    } catch { ss.borrar(); }
  })();

  api.actualizar = actualizar;
  return api;
})();
