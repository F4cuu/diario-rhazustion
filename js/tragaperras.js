/* =====================================================================
   TRAGAPERRAS DEL FUERTE + LIBRETA DE RECOMPENSAS
   La máquina es un mueble 3D de la mesa (js/dados.js). Un clic la enfoca y
   aparecen estos controles: volver, resultado y la libreta.
   Cada cuenta tiene su propia libreta, guardada en este navegador.
   Los datos (personajes, premios, probabilidades) están en tragaperras-datos.js
   ===================================================================== */

const Tragaperras = (() => {
  const C = window.TRAGAPERRAS;
  const $ = (s, r = document) => r.querySelector(s);
  const ruta = (f) => C.carpeta + encodeURIComponent(f);
  const num = (n) => Number(n || 0).toLocaleString("es-AR", { maximumFractionDigits: 2 });
  const pct = (n) => (Math.round(n * 100) / 100).toLocaleString("es-AR");
  const azar = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const crear = (tag, clase, texto) => {
    const n = document.createElement(tag);
    if (clase) n.className = clase;
    if (texto != null) n.textContent = texto;
    return n;
  };

  /* ---------------- Fichas ---------------- */

  const NORMALES = C.personajes.map((p) => ({ nombre: p.nombre, archivo: p.archivo, tipo: "normal", p }));
  const DORADOS = C.personajes.filter((p) => p.dorado)
    .map((p) => ({ nombre: "GOLDEN " + p.nombre, archivo: p.dorado, tipo: "dorado", p }));
  const ESPECIALES = C.especiales.map((e) => ({ nombre: e.nombre, archivo: e.archivo, tipo: "especial", e }));
  const COMUNES = [...NORMALES, ...DORADOS];
  const TODAS = [...COMUNES, ...ESPECIALES];

  /* ---------------- Estado (por cuenta, en localStorage) ---------------- */

  const nuevaMaquina = () => ({ tiradas: 0, triples: 0, lukas: false, seba: false, gSeba: false, bonoDorado: 0, pareja: false });
  const nuevoEstado = () => ({ version: 1, maquina: nuevaMaquina(), inventario: [], registro: [], notas: "" });

  let E = nuevoEstado(), clave = null, nombreCuenta = "";

  function cargar() {
    nombreCuenta = App.sesion?.usuario?.nombre || "invitado";
    clave = "diario-rhazustion-tragaperras:" + Cripto.normalizar(nombreCuenta);
    let leido = null;
    try { leido = JSON.parse(localStorage.getItem(clave)); } catch {}
    E = validar(leido) || nuevoEstado();
  }

  function validar(x) {
    if (!x || typeof x !== "object" || x.version !== 1) return null;
    return {
      version: 1,
      maquina: { ...nuevaMaquina(), ...(x.maquina || {}) },
      inventario: Array.isArray(x.inventario) ? x.inventario.filter((i) => i && typeof i === "object")
        .map((i) => ({ id: String(i.id || "obj-" + Math.random().toString(36).slice(2)), nombre: String(i.nombre ?? ""), cantidad: Number(i.cantidad) || 0 })) : [],
      registro: Array.isArray(x.registro) ? x.registro.filter((r) => r && r.fecha) : [],
      notas: typeof x.notas === "string" ? x.notas : "",
    };
  }

  function guardar() {
    try { localStorage.setItem(clave, JSON.stringify(E)); }
    catch { avisar("No se pudo guardar en este navegador.", true); }
  }

  /* ---------------- Motor ---------------- */

  // Probabilidades por fila de la próxima tirada, con buffs (igual que la máquina del fuerte)
  function probabilidades(uGSeba, uSeba, uLukas) {
    const B = C.probabilidades;
    let { nada, normal, dorado, especial } = B;
    const dorAj = Math.min(B.dorado * (1 + E.maquina.bonoDorado), 30);
    nada -= dorAj - dorado; dorado = dorAj;
    if (uGSeba) { dorado += 50; nada -= 50; }
    else if (uSeba) {
      const base = B.normal + B.dorado + B.especial;
      normal += 50 * B.normal / base; dorado += 50 * B.dorado / base; especial += 50 * B.especial / base; nada -= 50;
    } else if (uLukas) {
      const base = B.normal + B.dorado;
      normal += 10 * B.normal / base; dorado += 10 * B.dorado / base; nada -= 10;
    }
    return { nada: Math.max(0, nada), normal, dorado, especial };
  }

  function tirarFila(p) {
    let r = Math.random() * 100;
    for (const t of ESPECIALES) {
      const q = p.especial * t.e.parte;
      if (r < q) return { celdas: [t, t, t] };
      r -= q;
    }
    if (r < p.dorado) { const t = azar(DORADOS); return { celdas: [t, t, t] }; }
    r -= p.dorado;
    if (r < p.normal) { const t = azar(NORMALES); return { celdas: [t, t, t] }; }
    const a = azar(COMUNES), b = azar(COMUNES);
    let c = azar(COMUNES);
    while (a === b && b === c) c = azar(COMUNES);
    return { celdas: [a, b, c] };
  }

  function sumar(id, v) {
    let it = E.inventario.find((x) => x.id === id);
    if (!it) { it = { id, nombre: C.inventario[id] || id, cantidad: 0 }; E.inventario.push(it); }
    it.cantidad = Math.round(((Number(it.cantidad) || 0) + v) * 100) / 100;
  }

  // Aplica el premio de un triple y devuelve el texto para la libreta
  function premiar(t, ctx) {
    const M = E.maquina;
    M.triples++;
    let texto, efectos;
    if (t.tipo === "especial") {
      texto = t.e.texto; efectos = { ...t.e.efectos };
    } else {
      const dor = t.tipo === "dorado", def = dor ? t.p.golden : t.p.normal;
      texto = def?.texto || "Recompensa a definir por el DM.";
      efectos = { ...(def?.efectos || {}) };
      if (t.p.mecanica === "lukas") {
        if (!dor) M.lukas = true;
        else if (M.pareja) { efectos.potros = (efectos.potros || 0) + 1; texto = "+1 CABALLOS y ¡nació un potro! (la pareja sigue)."; }
        else { M.pareja = true; texto = "+1 CABALLOS y Lukas emparejó 2 caballos. El próximo GOLDEN Lukas dará un potro."; }
      } else if (t.p.mecanica === "seba") {
        if (!dor) {
          if (ctx.seba) {
            M.bonoDorado += 0.25;
            texto = `¡DOBLE Sebastián! +25% de chance DORADO permanente (ahora ${pct(Math.min(C.probabilidades.dorado * (1 + M.bonoDorado), 30))}% por fila) y se renueva el +50% de triple.`;
          }
          M.seba = true;
        } else if (ctx.gSeba) { efectos.oro = (efectos.oro || 0) + 100; texto = "¡DOBLE GOLDEN Sebastián! +100 oro."; }
        else M.gSeba = true;
      }
    }
    Object.entries(efectos).forEach(([k, v]) => sumar(k, v));
    return { texto, efectos };
  }


  /* ---------------- Controles de la vista de frente ---------------- */

  const maq = () => (typeof Dados !== "undefined" && Dados.maquina) || null;

  const raiz = crear("div"); raiz.id = "tp-hud"; raiz.setAttribute("aria-hidden", "true");
  raiz.innerHTML = `
    <button class="tp-volver" type="button" title="Volver al escritorio (Esc)">← Volver al escritorio</button>

    <div class="tp-panel" role="region" aria-label="Tragaperras del Fuerte">
      <div class="tp-resultado" role="status">Tirá de la palanca para probar suerte.</div>
      <div class="tp-fila-inf">
        <span class="tp-contador"></span>
        <button class="tp-girar" type="button" title="Girar (Espacio)">🎰 Girar</button>
      </div>
      <div class="tp-buffs"></div>
    </div>

    <button class="tp-abrir-libreta" type="button" aria-expanded="false">📒 Libreta <b class="lb-nuevas" hidden></b></button>

    <aside class="tp-libreta" aria-label="Libreta del Fuerte">
      <div class="lb-hoja">
        <div class="lb-espiral" aria-hidden="true"></div>
        <button class="lb-cerrar" type="button" title="Cerrar la libreta">✕</button>
        <h3>Libreta del Fuerte</h3>
        <div class="lb-cuenta"></div>
        <div class="lb-pestanas" role="tablist">
          <button type="button" data-tab="inventario" class="activa">Inventario</button>
          <button type="button" data-tab="registro">Recompensas</button>
          <button type="button" data-tab="notas">Notas</button>
          <button type="button" data-tab="premios">Premios</button>
        </div>

        <div class="lb-panel" data-panel="inventario">
          <ul class="lb-inv"></ul>
          <p class="lb-vacio lb-inv-vacio">Todavía no hay nada guardado. Los premios se anotan solos.</p>
          <button type="button" class="lb-agregar">+ Agregar objeto</button>
        </div>
        <div class="lb-panel" data-panel="registro" hidden>
          <div class="lb-reg"></div>
          <p class="lb-vacio lb-reg-vacio">Ninguna recompensa todavía.</p>
        </div>
        <div class="lb-panel" data-panel="notas" hidden>
          <textarea class="lb-notas" placeholder="Anotaciones sueltas…" spellcheck="true"></textarea>
        </div>
        <div class="lb-panel" data-panel="premios" hidden>
          <div class="tp-premios-lista"></div>
          <button class="tp-reiniciar" type="button" title="Pone en cero tiradas y buffs. La libreta no se toca.">↺ Reiniciar máquina</button>
        </div>

        <div class="lb-pie">
          <button type="button" class="lb-exportar" title="Descargar la libreta como archivo">⤓ Exportar</button>
          <label class="lb-importar" title="Cargar una libreta exportada (reemplaza la actual)">⤒ Importar<input type="file" accept=".json,application/json" hidden></label>
          <button type="button" class="lb-borrar peligro">Borrar libreta</button>
        </div>
        <div class="lb-aviso" role="status"></div>
      </div>
    </aside>`;
  document.body.appendChild(raiz);

  const btnGirar = $(".tp-girar", raiz);
  let visible = false, girando = false, nuevas = 0, tab = "inventario";
  let libretaAbierta = innerWidth >= 1100;

  function pintarMaquina() {
    const M = E.maquina;
    $(".tp-contador", raiz).innerHTML = `Tiradas: <b>${M.tiradas}</b> · Triples: <b>${M.triples}</b>`;
    const p = probabilidades(M.gSeba, M.seba, M.lukas);
    const buffs = [];
    if (M.lukas) buffs.push("🐴 Lukas: +10% de triple en la próxima");
    if (M.seba) buffs.push("🎩 Sebastián: +50% de triple en la próxima");
    if (M.gSeba) buffs.push("🌟 GOLDEN Sebastián: +50% de triple GOLDEN en la próxima");
    if (M.bonoDorado > 0) buffs.push(`⭐ Bono DORADO: +${Math.round(M.bonoDorado * 100)}%`);
    if (M.pareja) buffs.push("💕 Caballos emparejados");
    const box = $(".tp-buffs", raiz);
    box.innerHTML = "";
    buffs.forEach((b) => box.append(crear("span", "tp-buff", b)));
    box.append(crear("span", "tp-probs",
      `Por fila: nada ${pct(p.nada)}% · normal ${pct(p.normal)}% · dorado ${pct(p.dorado)}% · especial ${pct(p.especial)}%`));
  }

  function pintarPremios() {
    const lista = $(".tp-premios-lista", raiz);
    lista.innerHTML = "";
    const fila = (nombre, texto, clase) => {
      const d = crear("div", "tp-premio " + (clase || ""));
      d.append(crear("b", null, nombre + ": "), document.createTextNode(texto || "a definir por el DM"));
      lista.append(d);
    };
    lista.append(crear("h4", null, "Tres iguales"));
    C.personajes.forEach((p) => fila(p.nombre, p.normal?.texto, p.normal ? "" : "sin-definir"));
    lista.append(crear("h4", null, "Tres GOLDEN"));
    C.personajes.forEach((p) => fila("GOLDEN " + p.nombre, p.golden?.texto, p.golden ? "" : "sin-definir"));
    lista.append(crear("h4", null, "Especiales"));
    C.especiales.forEach((e) => fila(`${e.nombre} (${pct(C.probabilidades.especial * e.parte)}%)`, e.texto));
  }

  /* ----- Libreta ----- */

  function pintarInventario() {
    const ul = $(".lb-inv", raiz);
    ul.innerHTML = "";
    E.inventario.forEach((it, i) => {
      const li = crear("li");
      const nombre = crear("textarea", "lb-nombre"); nombre.rows = 1; nombre.value = it.nombre; nombre.placeholder = "objeto"; nombre.setAttribute("aria-label", "Nombre");
      const cant = crear("input", "lb-cant"); cant.type = "number"; cant.step = "0.5"; cant.value = it.cantidad; cant.setAttribute("aria-label", "Cantidad");
      const menos = crear("button", "lb-mas", "−"); menos.type = "button"; menos.title = "Restar 1";
      const mas = crear("button", "lb-mas", "+"); mas.type = "button"; mas.title = "Sumar 1";
      const quitar = botonConfirmar("×", "¿Quitar?", () => { E.inventario.splice(i, 1); guardar(); pintarInventario(); });
      quitar.classList.add("lb-quitar"); quitar.title = "Quitar del inventario";
      const ajustar = () => { nombre.style.height = "auto"; nombre.style.height = nombre.scrollHeight + "px"; };
      nombre.addEventListener("input", () => { it.nombre = nombre.value.replace(/\n/g, " "); ajustar(); guardar(); });
      nombre.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); nombre.blur(); } });
      requestAnimationFrame(ajustar);
      cant.addEventListener("input", () => { it.cantidad = Number(cant.value.replace(",", ".")) || 0; guardar(); });
      const paso = (d) => { it.cantidad = Math.round(((Number(it.cantidad) || 0) + d) * 100) / 100; cant.value = it.cantidad; guardar(); };
      menos.addEventListener("click", () => paso(-1));
      mas.addEventListener("click", () => paso(1));
      li.append(nombre, menos, cant, mas, quitar);
      ul.append(li);
    });
    $(".lb-inv-vacio", raiz).hidden = E.inventario.length > 0;
  }

  function pintarRegistro() {
    const caja = $(".lb-reg", raiz);
    caja.innerHTML = "";
    let diaActual = null, grupo = null;
    const orden = E.registro.map((r, i) => ({ r, i })).sort((a, b) => b.r.fecha.localeCompare(a.r.fecha));
    orden.forEach(({ r, i }) => {
      const f = new Date(r.fecha);
      const dia = f.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
      if (dia !== diaActual) {
        diaActual = dia;
        caja.append(crear("div", "lb-dia", dia.charAt(0).toUpperCase() + dia.slice(1)));
        grupo = crear("ul", "lb-dia-lista");
        caja.append(grupo);
      }
      const li = crear("li", "lb-entrada " + (r.tipo || ""));
      const hora = crear("span", "lb-hora", f.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }) + (r.tirada ? ` · #${r.tirada}` : ""));
      const cuerpo = crear("div", "lb-texto");
      cuerpo.append(crear("b", null, (r.tipo === "dorado" ? "🌟 " : r.tipo === "especial" ? "⚡ " : "🎉 ") + r.nombre), document.createTextNode(" — " + r.texto));
      const quitar = botonConfirmar("×", "¿Borrar?", () => { E.registro.splice(i, 1); guardar(); pintarRegistro(); });
      quitar.classList.add("lb-quitar"); quitar.title = "Borrar del registro (no cambia el inventario)";
      li.append(hora, cuerpo, quitar);
      grupo.append(li);
    });
    $(".lb-reg-vacio", raiz).hidden = E.registro.length > 0;
  }

  function pintarLibreta() {
    $(".lb-cuenta", raiz).textContent = "de " + nombreCuenta;
    $(".lb-notas", raiz).value = E.notas;
    pintarInventario();
    pintarRegistro();
    pintarNuevas();
  }

  function pintarNuevas() {
    const b = $(".lb-nuevas", raiz);
    b.hidden = !nuevas; b.textContent = nuevas;
  }

  function cambiarTab(t) {
    tab = t;
    raiz.querySelectorAll(".lb-pestanas button").forEach((b) => b.classList.toggle("activa", b.dataset.tab === t));
    raiz.querySelectorAll(".lb-panel").forEach((p) => { p.hidden = p.dataset.panel !== t; });
    if (t === "registro" && libretaAbierta) { nuevas = 0; pintarNuevas(); }
    if (t === "inventario") raiz.querySelectorAll(".lb-nombre").forEach((n) => { n.style.height = "auto"; n.style.height = n.scrollHeight + "px"; });
  }

  // Botón que pide un segundo toque para confirmar (como en el editor)
  function botonConfirmar(texto, textoArmado, accion) {
    const x = crear("button", null, texto); x.type = "button";
    x.addEventListener("click", () => {
      if (x.dataset.armado) { accion(); return; }
      x.dataset.armado = "1"; x.textContent = textoArmado; x.classList.add("armado");
      setTimeout(() => { delete x.dataset.armado; x.textContent = texto; x.classList.remove("armado"); }, 3000);
    });
    return x;
  }

  let tAviso;
  function avisar(t, error) {
    const a = $(".lb-aviso", raiz);
    a.textContent = t; a.classList.toggle("error", !!error);
    clearTimeout(tAviso); tAviso = setTimeout(() => { a.textContent = ""; }, 4000);
  }


  /* ----- Libreta: abrir/cerrar el panel ----- */

  function ponerLibreta(abierta) {
    libretaAbierta = abierta;
    raiz.classList.toggle("con-libreta", abierta);
    $(".tp-abrir-libreta", raiz).setAttribute("aria-expanded", String(abierta));
    if (abierta && tab === "registro") { nuevas = 0; pintarNuevas(); }
    ajustarMargenes();
  }

  function ajustarMargenes() {
    if (!maq()) return;
    const panel = $(".tp-panel", raiz).getBoundingClientRect();
    const ancho = innerWidth >= 900 && libretaAbierta ? $(".tp-libreta", raiz).offsetWidth + 24 : 0;
    maq().margenes({ der: ancho, inf: visible ? innerHeight - panel.top + 10 : 0 });
  }

  /* ----- Girar ----- */

  function tirar() {
    if (girando || !visible || !maq()) return;
    girando = true; btnGirar.disabled = true;
    $(".tp-resultado", raiz).textContent = "Girando… 🎲";

    const M = E.maquina;
    const ctx = { gSeba: M.gSeba, seba: M.seba, lukas: M.lukas };
    M.gSeba = M.seba = M.lukas = false;
    const p = probabilidades(ctx.gSeba, ctx.seba, ctx.lukas);
    const filas = [tirarFila(p), tirarFila(p)];
    const grilla = [...filas[0].celdas, ...filas[1].celdas];

    maq().girar(grilla, () => {
      M.tiradas++;
      const res = $(".tp-resultado", raiz);
      res.innerHTML = "";
      const ganadoras = [];
      filas.forEach((f, n) => {
        const [a, b, c] = f.celdas;
        const linea = crear("p");
        if (a === b && b === c) {
          ganadoras.push(n);
          const { texto } = premiar(a, ctx);
          E.registro.push({ fecha: new Date().toISOString(), tirada: M.tiradas, nombre: a.nombre, tipo: a.tipo, texto });
          linea.className = "premio " + a.tipo;
          linea.append(crear("b", null, `Fila ${n + 1}: ¡TRIPLE ${a.nombre}! `), document.createTextNode(texto));
          if (!(libretaAbierta && tab === "registro")) nuevas++;
        } else {
          linea.textContent = `Fila ${n + 1}: ${a.nombre} · ${b.nombre} · ${c.nombre}`;
        }
        res.append(linea);
      });
      if (!ganadoras.length && (ctx.gSeba || ctx.seba || ctx.lukas)) res.append(crear("p", "nota", "Se consumieron los buffs de la tirada anterior."));
      maq().celebrar(ganadoras);
      if (ganadoras.length) { const h = $(".lb-hoja", raiz); h.classList.remove("anota"); void h.offsetWidth; h.classList.add("anota"); }
      guardar();
      pintarMaquina();
      pintarLibreta();
      girando = false; btnGirar.disabled = false;
      requestAnimationFrame(ajustarMargenes);
    });
  }

  /* ----- Al enfocar / salir (lo llama la mesa 3D) ----- */

  function alEnfocar() {
    if (!App.sesion) return;
    cargar();
    visible = true;
    Libro.habilitar(false);
    raiz.classList.add("visible");
    raiz.setAttribute("aria-hidden", "false");
    pintarMaquina();
    pintarLibreta();
    cambiarTab(tab);
    ponerLibreta(innerWidth >= 1100 ? libretaAbierta : false);
    setTimeout(() => btnGirar.focus({ preventScroll: true }), 50);
  }

  function alSalir() {
    if (!visible) return;
    visible = false;
    raiz.classList.remove("visible");
    raiz.setAttribute("aria-hidden", "true");
    if (App.sesion) Libro.habilitar(true);
    if (document.activeElement && raiz.contains(document.activeElement)) document.activeElement.blur();
  }

  const volver = () => { if (!girando) maq()?.salir(); };

  /* ----- Eventos ----- */

  btnGirar.addEventListener("click", tirar);
  $(".tp-volver", raiz).addEventListener("click", volver);
  $(".tp-abrir-libreta", raiz).addEventListener("click", () => ponerLibreta(!libretaAbierta));
  $(".lb-cerrar", raiz).addEventListener("click", () => ponerLibreta(false));
  $(".tp-reiniciar", raiz).addEventListener("click", () => {
    if (girando) return;
    E.maquina = nuevaMaquina(); guardar(); pintarMaquina();
    $(".tp-resultado", raiz).textContent = "Máquina reiniciada. La libreta quedó como estaba.";
  });
  addEventListener("resize", () => { if (visible) ajustarMargenes(); });

  raiz.querySelectorAll(".lb-pestanas button").forEach((b) => b.addEventListener("click", () => cambiarTab(b.dataset.tab)));
  $(".lb-notas", raiz).addEventListener("input", (e) => { E.notas = e.target.value; guardar(); });
  $(".lb-agregar", raiz).addEventListener("click", () => {
    E.inventario.push({ id: "obj-" + Date.now().toString(36), nombre: "", cantidad: 1 });
    guardar(); pintarInventario();
    const ins = raiz.querySelectorAll(".lb-inv .lb-nombre");
    ins[ins.length - 1]?.focus();
  });

  $(".lb-exportar", raiz).addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(E, null, 2)], { type: "application/json" });
    const a = crear("a");
    a.href = URL.createObjectURL(blob);
    a.download = `libreta-fuerte-${Cripto.normalizar(nombreCuenta)}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    avisar("Libreta exportada.");
  });

  $(".lb-importar input", raiz).addEventListener("change", async (e) => {
    const f = e.target.files[0]; e.target.value = "";
    if (!f) return;
    try {
      const nuevo = validar(JSON.parse(await f.text()));
      if (!nuevo) throw new Error();
      E = nuevo; guardar(); pintarMaquina(); pintarLibreta();
      avisar("Libreta importada.");
    } catch { avisar("Ese archivo no es una libreta válida.", true); }
  });

  const btnBorrar = $(".lb-borrar", raiz);
  btnBorrar.addEventListener("click", () => {
    if (!btnBorrar.dataset.armado) {
      btnBorrar.dataset.armado = "1"; btnBorrar.textContent = "¿Seguro? Tocá de nuevo";
      setTimeout(() => { delete btnBorrar.dataset.armado; btnBorrar.textContent = "Borrar libreta"; }, 3500);
      return;
    }
    delete btnBorrar.dataset.armado; btnBorrar.textContent = "Borrar libreta";
    E.inventario = []; E.registro = []; E.notas = "";
    guardar(); pintarLibreta();
    avisar("Libreta en blanco.");
  });

  document.addEventListener("keydown", (e) => {
    if (!visible) return;
    const escribiendo = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
    if (e.key === "Escape") { e.preventDefault(); if (escribiendo) e.target.blur(); else volver(); return; }
    if ((e.key === " " || e.key === "Enter") && !escribiendo && e.target.tagName !== "BUTTON" && e.target.tagName !== "LABEL") {
      e.preventDefault(); tirar();
    }
  });

  // Al salir de la cuenta, la cámara vuelve al escritorio
  $("#btn-salir")?.addEventListener("click", () => { girando = false; maq()?.salir(true); }, true);

  pintarPremios();

  return { tirar, alEnfocar, alSalir };
})();
