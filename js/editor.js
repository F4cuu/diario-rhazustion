/* =====================================================================
   EDITOR (solo cuentas con rol "editor")
   Edita entradas, ficha del personaje y cuentas. Al guardar, vuelve a
   cifrar todo y lo sube a GitHub, que republica la página sola.
   ===================================================================== */

const Editor = (() => {
  const $ = (s) => document.querySelector(s);
  const panel = $("#editor"), lista = $("#ed-entradas"), form = $("#ed-form"), estadoEl = $("#ed-estado");
  const CLAVE_TOKEN = "diario-rhazustion-token";
  const GH = window.CONFIG.github;
  const URL_ARCHIVO = `https://api.github.com/repos/${GH.usuario}/${GH.repo}/contents/${GH.archivo}`;

  let b = null;          // borrador: { diario, usuarios }
  let sel = { tipo: "personaje" };
  let sucio = false;
  let guardando = false;

  const token = {
    leer() { try { return localStorage.getItem(CLAVE_TOKEN); } catch { return null; } },
    guardar(t) { try { t ? localStorage.setItem(CLAVE_TOKEN, t) : localStorage.removeItem(CLAVE_TOKEN); } catch {} },
  };

  /* ---------------- Abrir / cerrar ---------------- */

  function nuevoBorrador() {
    const s = App.sesion;
    b = {
      diario: structuredClone(s.diario),
      usuarios: s.archivo.usuarios.map((u) => ({
        ...u, contrasena: "", _yo: u === s.usuario,
      })),
    };
    sucio = false;
    const n = b.diario.entradas.length;
    sel = n ? { tipo: "entrada", i: n - 1 } : { tipo: "personaje" };
  }

  function abrir() {
    if (!App.sesion || App.sesion.usuario.rol !== "editor") return;
    if (!b) nuevoBorrador();
    Libro.habilitar(false);
    panel.classList.add("visible");
    pintarLista();
    pintarForm();
  }

  function cerrar() {
    panel.classList.remove("visible");
    Libro.habilitar(true);
  }

  function marcarSucio() {
    sucio = true;
    $("#sesion-pendiente").hidden = false;
    estado("Cambios sin guardar", "aviso");
  }

  function descartar() {
    const habia = sucio;
    b = null; sucio = false;
    $("#sesion-pendiente").hidden = true;
    return habia;
  }

  function estado(texto, tipo) {
    estadoEl.textContent = texto || "";
    estadoEl.className = tipo || "";
  }

  /* ---------------- Lista de la izquierda ---------------- */

  function pintarLista() {
    document.querySelectorAll(".ed-item").forEach((x) =>
      x.classList.toggle("activo", sel.tipo === x.dataset.sec));
    lista.innerHTML = "";
    b.diario.entradas.forEach((e, i) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.className = "ed-item" + (sel.tipo === "entrada" && sel.i === i ? " activo" : "");
      btn.innerHTML = `<span class="t"></span><span class="f"></span>`;
      btn.querySelector(".t").textContent = e.titulo || "Sin título";
      btn.querySelector(".f").textContent = e.fecha || "";
      btn.addEventListener("click", () => { sel = { tipo: "entrada", i }; pintarLista(); pintarForm(); });
      li.appendChild(btn);
      lista.appendChild(li);
    });
  }

  document.querySelectorAll(".ed-item[data-sec]").forEach((x) =>
    x.addEventListener("click", () => { sel = { tipo: x.dataset.sec }; pintarLista(); pintarForm(); }));

  $("#ed-nueva").addEventListener("click", () => {
    // Si la última se llama "Sesión N", proponemos "Sesión N+1"
    let n = 0;
    b.diario.entradas.forEach((e) => { const m = /^Sesi[oó]n\s+(\d+)/i.exec(e.titulo || ""); if (m) n = Math.max(n, +m[1]); });
    b.diario.entradas.push({ titulo: n ? `Sesión ${n + 1}` : "Nueva entrada", fecha: "", texto: "" });
    sel = { tipo: "entrada", i: b.diario.entradas.length - 1 };
    marcarSucio();
    pintarLista();
    pintarForm();
    form.querySelector("textarea")?.focus();
  });

  /* ---------------- Formularios ---------------- */

  const campo = (etiqueta, valor, alCambiar, opciones = {}) => {
    const label = document.createElement("label");
    label.className = "ed-campo" + (opciones.clase ? " " + opciones.clase : "");
    label.innerHTML = `<span class="et"></span>`;
    label.querySelector(".et").textContent = etiqueta;
    if (opciones.ayuda) {
      const a = document.createElement("span"); a.className = "ayuda"; a.textContent = opciones.ayuda; label.appendChild(a);
    }
    const input = document.createElement(opciones.area ? "textarea" : opciones.opciones ? "select" : "input");
    if (opciones.tipo) input.type = opciones.tipo;
    if (opciones.placeholder) input.placeholder = opciones.placeholder;
    if (opciones.opciones) opciones.opciones.forEach(([v, t]) => input.add(new Option(t, v)));
    input.value = valor ?? "";
    input.spellcheck = !!opciones.area;
    input.addEventListener("input", () => { alCambiar(input.value); marcarSucio(); });
    label.appendChild(input);
    return label;
  };

  const boton = (texto, accion, clase) => {
    const x = document.createElement("button");
    x.type = "button"; x.textContent = texto; if (clase) x.className = clase;
    x.addEventListener("click", accion);
    return x;
  };

  // Botón que pide un segundo clic para confirmar (sin ventanas emergentes)
  const botonPeligroso = (texto, accion) => {
    const x = boton(texto, () => {
      if (x.dataset.armado) { accion(); return; }
      x.dataset.armado = "1"; x.textContent = "¿Seguro? Tocá de nuevo";
      setTimeout(() => { delete x.dataset.armado; x.textContent = texto; }, 3500);
    }, "peligro");
    return x;
  };

  function pintarForm() {
    form.innerHTML = "";
    if (sel.tipo === "entrada") formEntrada();
    else if (sel.tipo === "personaje") formPersonaje();
    else formCuentas();
  }

  function formEntrada() {
    const e = b.diario.entradas[sel.i];
    if (!e) { sel = { tipo: "personaje" }; return pintarForm(); }
    const i = sel.i;

    const fila = document.createElement("div"); fila.className = "ed-fila";
    fila.append(
      campo("Título", e.titulo, (v) => { e.titulo = v; pintarLista(); }),
      campo("Fecha", e.fecha, (v) => { e.fecha = v; pintarLista(); }, { placeholder: "ej. 14 de marzo" }),
    );
    form.append(fila,
      campo("Texto", e.texto, (v) => { e.texto = v; },
        { area: true, clase: "grande", ayuda: "Línea en blanco = párrafo nuevo · *cursiva* · **negrita**" }));

    const acc = document.createElement("div"); acc.className = "ed-acciones";
    const mover = (d) => {
      const j = i + d, arr = b.diario.entradas;
      if (j < 0 || j >= arr.length) return;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      sel = { tipo: "entrada", i: j };
      marcarSucio(); pintarLista(); pintarForm();
    };
    acc.append(
      boton("↑ Subir", () => mover(-1)),
      boton("↓ Bajar", () => mover(1)),
      boton("Ver en el diario", () => verEnDiario(i)),
      botonPeligroso("Eliminar entrada", () => {
        b.diario.entradas.splice(i, 1);
        sel = b.diario.entradas.length ? { tipo: "entrada", i: Math.max(0, i - 1) } : { tipo: "personaje" };
        marcarSucio(); pintarLista(); pintarForm();
      }),
    );
    form.append(acc);
  }

  function formPersonaje() {
    const D = b.diario, pj = D.personaje;
    const h = document.createElement("h3"); h.textContent = "Ficha del personaje"; form.append(h);

    form.append(campo("Título del diario (tapa)", D.titulo, (v) => { D.titulo = v; }));
    form.append(campo("Nombre completo", pj.nombre, (v) => { pj.nombre = v; }));
    const f1 = document.createElement("div"); f1.className = "ed-fila";
    f1.append(campo("Raza", pj.raza, (v) => { pj.raza = v; }), campo("Clase", pj.clase, (v) => { pj.clase = v; }));
    const f2 = document.createElement("div"); f2.className = "ed-fila tres";
    f2.append(
      campo("Nivel", pj.nivel, (v) => { pj.nivel = v === "" ? "" : Number(v); }, { tipo: "number" }),
      campo("Edad", pj.edad, (v) => { pj.edad = v; }),
      campo("Altura", pj.altura, (v) => { pj.altura = v; }),
    );
    const f3 = document.createElement("div"); f3.className = "ed-fila seis";
    Object.keys(pj.atributos).forEach((k) =>
      f3.append(campo(k, pj.atributos[k], (v) => { pj.atributos[k] = Number(v) || 0; }, { tipo: "number" })));
    form.append(f1, f2, f3,
      campo("Nota al pie de la ficha", pj.nota, (v) => { pj.nota = v; }, { area: true, clase: "chica" }));

    const acc = document.createElement("div"); acc.className = "ed-acciones";
    acc.append(boton("Ver en el diario", () => verEnDiario(null)));
    form.append(acc);
  }

  function formCuentas() {
    const h = document.createElement("h3"); h.textContent = "Cuentas";
    const p = document.createElement("p"); p.className = "ed-nota";
    p.textContent = "Las claves no se pueden ver, solo reemplazar. Dejá «Nueva clave» vacío para no cambiarla. " +
                    "Los cambios se aplican al guardar. Mayúsculas y tildes no importan al entrar.";
    form.append(h, p);

    const tabla = document.createElement("div"); tabla.className = "ed-cuentas";
    b.usuarios.forEach((u, i) => {
      const fila = document.createElement("div"); fila.className = "ed-fila cuenta";
      fila.append(
        campo("Nombre", u.nombre, (v) => { u.nombre = v; }),
        campo("Permiso", u.rol, (v) => { u.rol = v; }, { opciones: [["lector", "Solo lectura"], ["editor", "Puede editar"]] }),
        campo(u.llave ? "Nueva clave" : "Clave (obligatoria)", u.contrasena, (v) => { u.contrasena = v; },
          { placeholder: u.llave ? "sin cambios" : "elegí una clave" }),
      );
      if (u._yo) {
        const yo = document.createElement("span"); yo.className = "ed-yo"; yo.textContent = "(vos)"; fila.append(yo);
      } else {
        fila.append(botonPeligroso("Quitar", () => { b.usuarios.splice(i, 1); marcarSucio(); pintarForm(); }));
      }
      tabla.append(fila);
    });
    form.append(tabla);

    const acc = document.createElement("div"); acc.className = "ed-acciones";
    acc.append(boton("+ Agregar cuenta", () => {
      b.usuarios.push({ nombre: "", rol: "lector", contrasena: "" });
      marcarSucio(); pintarForm();
      form.querySelectorAll(".cuenta input")[form.querySelectorAll(".cuenta").length * 2 - 2]?.focus();
    }));
    form.append(acc);
  }

  /* ---------------- Vista previa ---------------- */

  async function verEnDiario(i) {
    await Libro.construir(structuredClone(b.diario));
    cerrar();
    if (i != null) Libro.irAEntrada(i);
  }

  /* ---------------- Guardar ---------------- */

  function validar() {
    const nombres = new Set();
    for (const u of b.usuarios) {
      const n = Cripto.normalizar(u.nombre || "");
      if (!n) return "Hay una cuenta sin nombre.";
      if (nombres.has(n)) return `Hay dos cuentas llamadas «${u.nombre}».`;
      nombres.add(n);
      if (!u.llave && !u.contrasena) return `La cuenta «${u.nombre}» necesita una clave.`;
    }
    const yo = b.usuarios.find((u) => u._yo);
    if (!yo || yo.rol !== "editor") return "No podés quitarte a vos mismo el permiso de editar.";
    return null;
  }

  function pedirToken() {
    return new Promise((resolver) => {
      const modal = $("#token"), f = $("#token-form"), input = $("#token-valor"), err = $("#token-error");
      $("#token-repo").textContent = `${GH.usuario}/${GH.repo}`;
      input.value = ""; err.textContent = "";
      modal.classList.add("visible");
      setTimeout(() => input.focus(), 50);
      const fin = (v) => {
        modal.classList.remove("visible");
        f.removeEventListener("submit", alEnviar);
        $("#token-cancelar").removeEventListener("click", alCancelar);
        resolver(v);
      };
      const alEnviar = (e) => {
        e.preventDefault();
        const t = input.value.trim();
        if (!/^(github_pat_|ghp_)[A-Za-z0-9_]{20,}$/.test(t)) { err.textContent = "Eso no parece un token de GitHub."; return; }
        token.guardar(t);
        fin(t);
      };
      const alCancelar = () => fin(null);
      f.addEventListener("submit", alEnviar);
      $("#token-cancelar").addEventListener("click", alCancelar);
    });
  }

  async function pedirGitHub(url, opciones, t) {
    const r = await fetch(url, {
      ...opciones,
      cache: "no-store",
      headers: { Authorization: `Bearer ${t}`, Accept: "application/vnd.github+json", ...(opciones.headers || {}) },
    });
    return r;
  }

  async function subir(texto, t, mensaje) {
    for (let intento = 0; intento < 2; intento++) {
      let sha;
      const actual = await pedirGitHub(`${URL_ARCHIVO}?ref=${GH.rama}`, {}, t);
      if (actual.ok) sha = (await actual.json()).sha;
      else if (actual.status !== 404) throw Object.assign(new Error("lectura"), { status: actual.status });

      const r = await pedirGitHub(URL_ARCHIVO, {
        method: "PUT",
        body: JSON.stringify({
          message: mensaje,
          content: Cripto.b64(new TextEncoder().encode(texto)),
          branch: GH.rama,
          ...(sha ? { sha } : {}),
        }),
      }, t);
      if (r.ok) return;
      if (r.status === 409 && intento === 0) continue;   // cambió mientras tanto: reintenta
      throw Object.assign(new Error("escritura"), { status: r.status });
    }
  }

  async function guardar() {
    if (guardando || !b) return;
    const error = validar();
    if (error) { estado(error, "error"); return; }

    let t = token.leer() || await pedirToken();
    if (!t) { estado("Sin conexión con GitHub no se puede guardar.", "error"); return; }

    guardando = true;
    const btn = $("#ed-guardar"); btn.disabled = true;
    try {
      estado("Cifrando…");
      const archivo = await Cripto.armarArchivo(App.sesion.raw, b.diario, b.usuarios);
      estado("Subiendo a GitHub…");
      await subir(Cripto.serializar(archivo), t, `Diario actualizado desde la web (${App.sesion.usuario.nombre})`);

      const yo = b.usuarios.findIndex((u) => u._yo);
      if (yo >= 0) archivo.usuarios[yo]._yo = true;
      await App.actualizar(structuredClone(b.diario), archivo);
      nuevoBorrador();
      $("#sesion-pendiente").hidden = true;
      pintarLista(); pintarForm();
      estado("✓ Guardado. La página pública se actualiza en 1–2 minutos.", "ok");
    } catch (e) {
      console.error(e);
      if (e.status === 401) {
        token.guardar(null);
        estado("GitHub rechazó el token (vencido o mal copiado). Volvé a tocar «Guardar» para cargar uno nuevo.", "error");
      } else if (e.status === 403 || e.status === 404) {
        token.guardar(null);
        estado("El token no tiene permiso de escritura en el repositorio. Creá uno nuevo con «Contents: Read and write».", "error");
      } else {
        estado("No se pudo guardar" + (e.status ? ` (error ${e.status})` : " (¿sin internet?)") + ". Tus cambios siguen acá: probá de nuevo.", "error");
      }
    } finally {
      guardando = false; btn.disabled = false;
    }
  }

  // Al entrar como editor: si GitHub tiene una versión más nueva que la publicada, usarla
  async function traerUltima() {
    const t = token.leer();
    if (!t) return;
    try {
      const r = await pedirGitHub(`${URL_ARCHIVO}?ref=${GH.rama}`, { headers: { Accept: "application/vnd.github.raw+json" } }, t);
      if (!r.ok) return;
      const archivo = Cripto.leerTexto(await r.text());
      const s = App.sesion;
      if (!s || archivo.contenido.datos === s.archivo.contenido.datos) return;
      const diario = await Cripto.abrirConMaestra(archivo, s.raw);
      const i = archivo.usuarios.findIndex((u) => Cripto.normalizar(u.nombre) === Cripto.normalizar(s.usuario.nombre));
      if (i >= 0) archivo.usuarios[i]._yo = true;
      if (!sucio) { await App.actualizar(diario, archivo); b = null; }
    } catch (e) { console.warn("No se pudo traer la última versión:", e); }
  }

  /* ---------------- Botones ---------------- */

  $("#btn-editar").addEventListener("click", abrir);
  $("#ed-cerrar").addEventListener("click", cerrar);
  $("#ed-guardar").addEventListener("click", guardar);
  $("#ed-descartar").addEventListener("click", async () => {
    if (!sucio) { cerrar(); return; }
    const x = $("#ed-descartar");
    if (!x.dataset.armado) {
      x.dataset.armado = "1"; x.textContent = "¿Seguro? Tocá de nuevo";
      setTimeout(() => { delete x.dataset.armado; x.textContent = "Descartar cambios"; }, 3500);
      return;
    }
    delete x.dataset.armado; x.textContent = "Descartar cambios";
    descartar();
    estado("");
    await Libro.construir(App.sesion.diario);
    cerrar();
  });

  document.addEventListener("keydown", (e) => {
    if (panel.classList.contains("visible") && e.key === "Escape" && !$("#token").classList.contains("visible")) cerrar();
    if (panel.classList.contains("visible") && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); guardar(); }
  });

  addEventListener("beforeunload", (e) => { if (sucio) { e.preventDefault(); e.returnValue = ""; } });

  return { abrir, traerUltima, descartar, tieneCambios: () => sucio };
})();
