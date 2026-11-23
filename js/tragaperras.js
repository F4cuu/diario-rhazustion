/* =====================================================================
   TRAGAPERRAS DEL FUERTE + LIBRETA DE RECOMPENSAS
   Se abre desde la máquina (o la libreta) que hay sobre el escritorio.
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

  /* ---------------- Interfaz ---------------- */

  // Cada rodillo es un cilindro 3D de CARAS fichas
  const CARAS = 10, PASO = 360 / CARAS;
  const RODILLO = (i) => `
    <div class="tp-rodillo" data-i="${i}">
      <div class="tp-ventana"><div class="tp-cilindro">${'<div class="tp-cara"><img alt=""></div>'.repeat(CARAS)}</div></div>
      <span class="tp-nombre"></span>
    </div>`;

  const raiz = crear("div"); raiz.id = "tp"; raiz.setAttribute("aria-hidden", "true");
  raiz.innerHTML = `
    <div class="tp-marco" role="dialog" aria-label="Tragaperras del Fuerte">
      <button class="tp-cerrar" type="button" title="Volver al escritorio (Esc)">Cerrar ✕</button>

      <div class="tp-escena3d">
      <div class="tp-gabinete">
      <div class="tp-lado tp-lado-izq" aria-hidden="true"></div>
      <div class="tp-lado tp-lado-der" aria-hidden="true"></div>
      <div class="tp-lado tp-techo" aria-hidden="true"></div>
      <div class="tp-lado tp-fondo" aria-hidden="true"></div>
      <button class="tp-palanca3d" type="button" title="Tirar de la palanca" aria-label="Tirar de la palanca">
        <span class="tp-pal-base"></span><span class="tp-pal-vara"><span class="tp-pal-bola"></span></span>
      </button>
      <section class="tp-maquina">
        <div class="tp-cartel">
          <h2>Tragaperras del Fuerte</h2>
          <p>2 filas · tres iguales en una fila = premio</p>
        </div>
        <div class="tp-rodillos">
          <div class="tp-fila-et">— Fila 1 —</div>
          ${[0, 1, 2].map((i) => RODILLO(i)).join("")}
          <div class="tp-fila-et">— Fila 2 —</div>
          ${[3, 4, 5].map((i) => RODILLO(i)).join("")}
        </div>
        <button class="tp-girar" type="button">🎰 Girar</button>
        <div class="tp-contador"></div>
        <div class="tp-resultado" role="status">Tirá de la palanca y probá suerte.</div>
        <div class="tp-buffs"></div>
        <details class="tp-premios">
          <summary>📖 Tabla de premios</summary>
          <div class="tp-premios-lista"></div>
        </details>
        <button class="tp-reiniciar" type="button" title="Pone en cero tiradas y buffs. La libreta no se toca.">↺ Reiniciar máquina</button>
      </section>
      </div>
      </div>

      <section class="tp-libreta">
        <div class="lb-hoja">
          <div class="lb-espiral" aria-hidden="true"></div>
          <h3>Libreta del Fuerte</h3>
          <div class="lb-cuenta"></div>
          <div class="lb-pestanas" role="tablist">
            <button type="button" data-tab="inventario" class="activa">Inventario</button>
            <button type="button" data-tab="registro">Recompensas <b class="lb-nuevas" hidden></b></button>
            <button type="button" data-tab="notas">Notas</button>
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

          <div class="lb-pie">
            <button type="button" class="lb-exportar" title="Descargar la libreta como archivo">⤓ Exportar</button>
            <label class="lb-importar" title="Cargar una libreta exportada (reemplaza la actual)">⤒ Importar<input type="file" accept=".json,application/json" hidden></label>
            <button type="button" class="lb-borrar peligro">Borrar libreta</button>
          </div>
          <div class="lb-aviso" role="status"></div>
        </div>
      </section>
    </div>`;
  document.body.appendChild(raiz);

  const rodillos = [...raiz.querySelectorAll(".tp-rodillo")];
  const btnGirar = $(".tp-girar", raiz);
  let abierta = false, girando = false, nuevas = 0, tab = "inventario";

  /* ----- Rodillos 3D ----- */

  const mod = (a, n) => ((a % n) + n) % n;
  const R3 = rodillos.map((r) => ({
    cil: r.querySelector(".tp-cilindro"),
    caras: [...r.querySelectorAll(".tp-cara")],
    nombre: r.querySelector(".tp-nombre"),
    ang: 0, radio: 0, listo: false,
  }));
  const pocoMovimiento = matchMedia("(prefers-reduced-motion: reduce)");

  function geometria() {
    R3.forEach((R) => {
      const h = R.caras[0].offsetHeight || 120;
      R.radio = h / 2 / Math.tan(Math.PI / CARAS);
      R.caras.forEach((c, k) => { c.style.transform = `rotateX(${k * PASO}deg) translateZ(${R.radio}px)`; });
      rotar(R, R.ang);
    });
  }

  function rotar(R, ang) {
    R.ang = ang;
    R.cil.style.transform = `translateZ(${-R.radio}px) rotateX(${ang}deg)`;
  }

  const frenteDe = (R) => mod(Math.round(-R.ang / PASO), CARAS);

  function cara(R, k, t) {
    const c = R.caras[k], img = c.firstElementChild;
    img.src = ruta(t.archivo); img.alt = t.nombre;
    c.className = "tp-cara " + t.tipo;
  }

  function mostrarNombre(i, t) {
    R3[i].nombre.textContent = t ? t.nombre : "";
    rodillos[i].classList.toggle("dorada", t?.tipo === "dorado");
    rodillos[i].classList.toggle("especial", t?.tipo === "especial");
  }

  // Llena los rodillos al azar la primera vez
  function prepararRodillos() {
    geometria();
    R3.forEach((R, i) => {
      if (R.listo) return;
      R.caras.forEach((_, k) => cara(R, k, azar(COMUNES)));
      const t = azar(COMUNES); cara(R, frenteDe(R), t); mostrarNombre(i, t);
      R.listo = true;
    });
  }

  // Sale del punto final, lo pasa un poquito y vuelve (rebote del rodillo al frenar)
  const frenado = (t) => { const s = 0.9; t -= 1; return 1 + (s + 1) * t * t * t + s * t * t; };

  function girarRodillos(resultado, alTerminar) {
    const inicio = performance.now();
    const planes = R3.map((R, i) => {
      const c = frenteDe(R), k = (c + CARAS / 2) % CARAS;   // la cara de atrás trae el resultado
      R.caras.forEach((_, j) => {
        if (j !== k && mod(j - c + 1, CARAS) > 2) cara(R, j, azar(TODAS));
      });
      cara(R, k, resultado[i]);
      const meta = R.ang - 360 * (2 + i * 0.75);
      const hasta = meta - mod(meta + k * PASO, 360);
      const dur = pocoMovimiento.matches ? 200 : 1150 + i * 320;
      mostrarNombre(i, null); R.nombre.textContent = "…";
      rodillos[i].classList.add("girando");
      return { R, i, desde: R.ang, hasta, dur, fin: false };
    });
    const paso = (ahora) => {
      let quedan = 0;
      planes.forEach((p) => {
        if (p.fin) return;
        const t = Math.min(1, (ahora - inicio) / p.dur);
        rotar(p.R, p.desde + (p.hasta - p.desde) * frenado(t));
        if (t > 0.72) rodillos[p.i].classList.remove("girando");
        if (t >= 1) { p.fin = true; rotar(p.R, p.hasta); mostrarNombre(p.i, resultado[p.i]); }
        else quedan++;
      });
      if (quedan) requestAnimationFrame(paso); else alTerminar();
    };
    requestAnimationFrame(paso);
  }

  function pintarMaquina() {
    const M = E.maquina;
    $(".tp-contador", raiz).innerHTML = `Tiradas: <b>${M.tiradas}</b> · Triples: <b>${M.triples}</b>`;
    const p = probabilidades(M.gSeba, M.seba, M.lukas);
    const buffs = [];
    if (M.lukas) buffs.push("🐴 Lukas: +10% de triple en la próxima tirada");
    if (M.seba) buffs.push("🎩 Sebastián: +50% de triple en la próxima tirada");
    if (M.gSeba) buffs.push("🌟 GOLDEN Sebastián: +50% de triple GOLDEN en la próxima");
    if (M.bonoDorado > 0) buffs.push(`⭐ Bono DORADO permanente: +${Math.round(M.bonoDorado * 100)}%`);
    if (M.pareja) buffs.push("💕 Caballos emparejados: el próximo GOLDEN Lukas da un potro");
    const box = $(".tp-buffs", raiz);
    box.innerHTML = "";
    buffs.forEach((b) => box.append(crear("div", "tp-buff", b)));
    box.append(crear("div", "tp-probs",
      `Próxima fila: nada ${pct(p.nada)}% · normal ${pct(p.normal)}% · dorado ${pct(p.dorado)}% · especial ${pct(p.especial)}%`));
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
    if (t === "registro") { nuevas = 0; pintarNuevas(); }
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

  /* ----- Girar ----- */

  function girar() {
    if (girando) return;
    girando = true; btnGirar.disabled = true;
    rodillos.forEach((r) => r.classList.remove("gana"));
    $(".tp-resultado", raiz).textContent = "Girando… 🎲";

    const M = E.maquina;
    const ctx = { gSeba: M.gSeba, seba: M.seba, lukas: M.lukas };
    M.gSeba = M.seba = M.lukas = false;
    const p = probabilidades(ctx.gSeba, ctx.seba, ctx.lukas);
    const filas = [tirarFila(p), tirarFila(p)];
    const grilla = [...filas[0].celdas, ...filas[1].celdas];

    const palanca = $(".tp-palanca3d", raiz);
    palanca.classList.remove("tirando"); void palanca.offsetWidth; palanca.classList.add("tirando");
    girarRodillos(grilla, () => {
      M.tiradas++;

      const res = $(".tp-resultado", raiz);
      res.innerHTML = "";
      let hubo = false;
      filas.forEach((f, n) => {
        const [a, b, c] = f.celdas;
        const linea = crear("p");
        if (a === b && b === c) {
          hubo = true;
          [0, 1, 2].forEach((k) => rodillos[n * 3 + k].classList.add("gana"));
          const { texto } = premiar(a, ctx);
          E.registro.push({ fecha: new Date().toISOString(), tirada: M.tiradas, nombre: a.nombre, tipo: a.tipo, texto });
          linea.className = "premio " + a.tipo;
          linea.append(crear("b", null, `Fila ${n + 1}: ¡TRIPLE ${a.nombre}! `), document.createTextNode(texto));
          if (abierta && tab !== "registro") nuevas++;
        } else {
          linea.textContent = `Fila ${n + 1}: ${a.nombre} · ${b.nombre} · ${c.nombre}`;
        }
        res.append(linea);
      });
      if (!hubo && (ctx.gSeba || ctx.seba || ctx.lukas)) res.append(crear("p", "nota", "Se consumieron los buffs de la tirada anterior."));
      if (hubo) { raiz.querySelector(".lb-hoja").classList.remove("anota"); void raiz.offsetWidth; raiz.querySelector(".lb-hoja").classList.add("anota"); }

      guardar();
      pintarMaquina();
      pintarLibreta();
      girando = false; btnGirar.disabled = false;
      btnGirar.focus();
    });
  }

  /* ----- Abrir / cerrar ----- */

  let precargadas = false;
  function abrir(enTab) {
    if (!App.sesion || abierta) return;
    cargar();
    if (!precargadas) { TODAS.forEach((t) => { new Image().src = ruta(t.archivo); }); precargadas = true; }
    abierta = true;
    Libro.habilitar(false);
    raiz.classList.add("visible");
    raiz.setAttribute("aria-hidden", "false");
    prepararRodillos();
    pintarMaquina();
    pintarLibreta();
    cambiarTab(enTab || tab);
    setTimeout(() => (enTab ? raiz.querySelector(`[data-tab="${enTab}"]`) : btnGirar).focus(), 60);
  }

  function cerrar() {
    if (!abierta || girando) return;
    abierta = false;
    raiz.classList.remove("visible");
    raiz.setAttribute("aria-hidden", "true");
    if (App.sesion) Libro.habilitar(true);
  }

  /* ----- Eventos ----- */

  btnGirar.addEventListener("click", girar);
  $(".tp-palanca3d", raiz).addEventListener("click", girar);
  addEventListener("resize", () => { if (abierta) geometria(); });

  // El gabinete se inclina un poco siguiendo el mouse
  const gabinete = $(".tp-gabinete", raiz);
  raiz.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse" || pocoMovimiento.matches) return;
    const x = e.clientX / innerWidth - 0.5, y = e.clientY / innerHeight - 0.5;
    gabinete.style.setProperty("--ry", (-24 + x * 16).toFixed(2) + "deg");
    gabinete.style.setProperty("--rx", (4 - y * 8).toFixed(2) + "deg");
  });
  raiz.addEventListener("pointerleave", () => { gabinete.style.removeProperty("--ry"); gabinete.style.removeProperty("--rx"); });
  $(".tp-cerrar", raiz).addEventListener("click", cerrar);
  raiz.addEventListener("click", (e) => { if (e.target === raiz) cerrar(); });
  $(".tp-reiniciar", raiz).addEventListener("click", () => {
    if (girando) return;
    E.maquina = nuevaMaquina(); guardar(); pintarMaquina();
    $(".tp-resultado", raiz).textContent = "Máquina reiniciada. La libreta quedó como estaba.";
  });

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
    if (!abierta) return;
    if (e.key === "Escape") { e.preventDefault(); cerrar(); }
  });

  // Objetos del escritorio
  $("#mesa-tragaperras")?.addEventListener("click", () => abrir());
  $("#mesa-libreta")?.addEventListener("click", () => abrir("registro"));
  $("#btn-salir")?.addEventListener("click", () => { girando = false; cerrar(); }, true);

  pintarPremios();

  return { abrir, cerrar };
})();
