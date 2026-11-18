/* =====================================================================
   EL LIBRO
   Arma las páginas, las agrupa en hojas que se dan vuelta en 3D,
   y maneja la escena: escritorio  ->  diario de cerca  ->  escritorio.
   Hay dos libros que comparten este mismo libro de páginas: el diario de Rhazustión
   y el Registro del DM (azul). Cada uno se arma una vez y se "monta" al abrirlo.
   Uso: Libro.construir(diario)  ·  Libro.construir(registro, "registro")
        Libro.abrir("diario" | "registro")  ·  Libro.habilitar(true/false)  ·  Libro.irAEntrada(i)
   ===================================================================== */

const Libro = (() => {
  const P = Paginador;

  // Tamaño "de diseño" de una página. Después se escala para entrar en la pantalla.
  const W = 440, H = 620;

  const escena    = document.getElementById("escena");
  const libro     = document.getElementById("libro");
  const medidor   = document.querySelector("#medidor .contenido");
  const indicador = document.getElementById("indicador");

  let hojas = [], L = 0, inicioDe = [];
  const libros = {};           // clave ("diario" | "registro") -> { hojas, extras, inicioDe }
  let activo = "diario";       // el libro que está montado en #libro
  let volteadas = 0;           // cuántas hojas ya se dieron vuelta (0 = cerrado)
  let estado = "escritorio";   // escritorio | abriendo | leyendo | cerrando
  let habilitado = false;      // false mientras se muestra el login o el editor
  // dónde está el libro 3D en pantalla (lo informa la mesa 3D); el de páginas sale y vuelve ahí
  let destinoMesa = null;
  let temporizadorOcultar = null;

  async function esperarFuentes() {
    if (!document.fonts) return;
    await Promise.race([
      Promise.all([
        document.fonts.load('17px "IM Fell English"'),
        document.fonts.load('italic 17px "IM Fell English"'),
        document.fonts.load('700 22px "Cinzel"'),
        document.fonts.load('20px "Caveat"'),
      ]),
      new Promise((r) => setTimeout(r, 3000)),
    ]).catch(() => {});
  }

  const el = (tag, clase, html) => () => {
    const n = document.createElement(tag);
    if (clase) n.className = clase;
    if (html != null) n.innerHTML = html;
    return n;
  };

  /* ---------------- 1. Páginas ---------------- */

  function armarPaginas(D, clave) {
    const esRegistro = clave === "registro";
    const entradas = D.entradas.map((e) => P.paginar([
      { crear: el("div", "encabezado",
          `<h2>${P.escapar(e.titulo || "Sin título")}</h2>` +
          (e.fecha ? `<div class="fecha">${P.escapar(e.fecha)}</div>` : "") +
          `<div class="ornamento">❦</div>`), pegado: true },
      ...P.parrafos(e.texto || "").map((t, i) => ({
        palabras: t.split(/\s+/),
        clases: i === 0 ? "inicial" : "",
      })),
    ], medidor));

    const armarIndice = (numeros) => P.paginar([
      { crear: el("h2", "titulo-indice", "Índice"), pegado: true },
      ...D.entradas.map((e, i) => ({
        crear: el("a", "item-indice",
          `<span class="t">${P.escapar(e.titulo || "Sin título")}</span><span class="puntos"></span><span class="n">${numeros[i]}</span>`),
      })),
    ], medidor);

    let indice = armarIndice(D.entradas.map(() => "000"));
    inicioDe = [];
    // diario: 1 tapa · 2 guarda · 3 ficha · índice · entradas   |   registro: 1 tapa · 2 guarda · índice · entradas
    let cursor = (esRegistro ? 3 : 4) + indice.length;
    entradas.forEach((pags) => { inicioDe.push(cursor); cursor += pags.length; });
    indice = armarIndice(inicioDe);

    if (esRegistro) {
      const paginas = [
        { tipo: "tapa", html: `
            <div class="marco">
              <div class="esquina e1"></div><div class="esquina e2"></div><div class="esquina e3"></div><div class="esquina e4"></div>
              <div class="emblema">❦</div>
              <h1>${P.escapar(D.titulo || "Registro del DM")}</h1>
              <div class="linea"></div>
              <div class="sub">${P.escapar(D.subtitulo || "Crónica de La Torre")}</div>
            </div>` },
        { tipo: "guarda", html: `
            <div class="dedicatoria">
              <p>Registro de campaña llevado por</p>
              <p class="firma">el Director de Juego</p>
              <p>Lo que pasó, tal como pasó.</p>
            </div>` },
        ...indice.map((h) => ({ tipo: "papel", html: h, numero: true })),
        ...entradas.flat().map((h) => ({ tipo: "papel", html: h, numero: true })),
      ];
      if (paginas.length % 2 === 0) paginas.push({ tipo: "papel", html: "", numero: false });
      paginas.push({ tipo: "contratapa", html: `<div class="emblema">❦</div>` });
      return paginas;
    }

    const mod = (v) => { const m = Math.floor((v - 10) / 2); return (m >= 0 ? "+" : "−") + Math.abs(m); };
    const pj = D.personaje;

    const ficha = `
      <div class="ficha">
        <div class="ficha-sup">Registro del portador</div>
        <h1>${P.escapar(pj.nombre)}</h1>
        <div class="ornamento">❦</div>
        <dl>
          <dt>Raza</dt><dd>${P.escapar(pj.raza)}</dd>
          <dt>Clase</dt><dd>${P.escapar(pj.clase)}</dd>
          <dt>Nivel</dt><dd>${P.escapar(String(pj.nivel))}</dd>
          <dt>Edad</dt><dd>${P.escapar(pj.edad)}</dd>
          <dt>Altura</dt><dd>${P.escapar(pj.altura)}</dd>
        </dl>
        <div class="atributos">
          ${Object.entries(pj.atributos).map(([k, v]) => `
            <div class="atributo"><span class="k">${k}</span><span class="v">${v}</span><span class="m">${mod(v)}</span></div>`).join("")}
        </div>
        ${pj.nota ? `<p class="nota">${P.formato(pj.nota)}</p>` : ""}
      </div>`;

    const paginas = [
      { tipo: "tapa", html: `
          <div class="marco">
            <div class="esquina e1"></div><div class="esquina e2"></div><div class="esquina e3"></div><div class="esquina e4"></div>
            <div class="emblema">❦</div>
            <h1>${P.escapar(D.titulo)}</h1>
            <div class="linea"></div>
            <div class="sub">Memorias de un caballero arcano</div>
          </div>` },
      { tipo: "guarda", html: `
          <div class="dedicatoria">
            <p>Este diario pertenece a</p>
            <p class="firma">${P.escapar(pj.nombre)}</p>
            <p>Si lo encontrás, devolvelo a su dueño.</p>
          </div>` },
      { tipo: "papel", html: ficha, numero: true },
      ...indice.map((h) => ({ tipo: "papel", html: h, numero: true })),
      ...entradas.flat().map((h) => ({ tipo: "papel", html: h, numero: true })),
    ];
    if (paginas.length % 2 === 0) paginas.push({ tipo: "papel", html: "", numero: false });
    paginas.push({ tipo: "contratapa", html: `<div class="emblema">❦</div>` });
    return paginas;
  }

  /* ---------------- 2. Hojas 3D ---------------- */

  async function construir(D, clave = "diario") {
    await esperarFuentes();
    const paginas = armarPaginas(D, clave);
    // el título también va en la tapa del libro 3D de la mesa
    if (clave === "diario" && typeof Dados !== "undefined" && Dados.ponerTitulo) Dados.ponerTitulo(D.titulo);

    const nuevas = [];
    for (let i = 0; i < paginas.length; i += 2) {
      const hoja = document.createElement("div");
      hoja.className = "hoja";
      [paginas[i], paginas[i + 1]].forEach((pag, lado) => {
        const cara = document.createElement("div");
        cara.className = `cara ${lado === 0 ? "frente" : "dorso"} ${pag.tipo}`;
        const n = i + lado + 1;
        cara.innerHTML = pag.tipo === "papel"
          ? `<div class="contenido">${pag.html}</div>${pag.numero ? `<div class="num">${n}</div>` : ""}`
          : pag.html;
        hoja.appendChild(cara);
      });
      nuevas.push(hoja);
    }
    const extras = ["sombra", "canto canto-inf", "canto canto-der", "huella"].map((c) => {
      const d = document.createElement("div"); d.className = c; return d;
    });
    const inicios = inicioDe;
    nuevas.flatMap((h) => [...h.querySelectorAll(".item-indice")]).forEach((a, i) => {
      a.addEventListener("click", (ev) => { ev.stopPropagation(); irAPagina(inicios[i]); });
    });

    libros[clave] = { hojas: nuevas, extras, inicioDe: inicios };
    if (clave === activo) montar(clave);
  }

  // Pone un libro (ya armado) dentro de #libro
  function montar(clave) {
    const b = libros[clave];
    if (!b) return false;
    const cambia = clave !== activo || hojas !== b.hojas;
    activo = clave;
    if (cambia) {
      libro.innerHTML = "";
      b.hojas.forEach((h) => libro.appendChild(h));
      b.extras.forEach((d) => libro.appendChild(d));
    }
    hojas = b.hojas; L = hojas.length; inicioDe = b.inicioDe;
    libro.classList.toggle("azul", clave === "registro");
    libro.setAttribute("aria-label", clave === "registro" ? "Registro del DM" : "Diario de Rhazustión");
    volteadas = Math.min(volteadas, L);
    actualizarHojas(true);
    return true;
  }

  /* ---------------- 3. Estado y movimiento ---------------- */

  function actualizarHojas(sinAnimar) {
    hojas.forEach((h, i) => {
      const v = i < volteadas;
      if (!sinAnimar && v !== h.classList.contains("volteada")) {
        h.classList.add("animando");
        clearTimeout(h._t);
        h._t = setTimeout(() => h.classList.remove("animando"), 900);
      }
      h.classList.toggle("volteada", v);
      h.style.zIndex = v ? i + 1 : 2 * L - i;
    });
    libro.classList.toggle("abierto", volteadas > 0 && volteadas < L);
    libro.classList.toggle("al-final", volteadas === L);
    actualizarIndicador();
    aplicarTransform();
  }

  function actualizarIndicador() {
    if (volteadas === 0) indicador.textContent = "Tapa";
    else if (volteadas === L) indicador.textContent = "Contratapa";
    else indicador.textContent = `Páginas ${volteadas * 2} – ${volteadas * 2 + 1}`;
  }

  const escala = () => Math.min((innerWidth * 0.96) / (2 * W), (innerHeight * 0.84) / H);

  function aplicarTransform() {
    const s = escala();
    const x = volteadas === 0 ? -W / 2 : volteadas === L ? W / 2 : 0;
    if (estado === "escritorio") {
      // sobre la mesa: justo encima del libro 3D (así al abrirlo parece que se levanta ese mismo libro)
      const d = destinoMesa && destinoMesa(activo);
      if (d) {
        libro.style.transform =
          `translate(${d.x - innerWidth / 2}px, ${d.y - innerHeight / 2}px) scale(${d.ancho / W}) rotateX(${d.inclinacion}deg) rotateZ(${d.angulo}deg) translateX(${-W / 2}px)`;
      } else {
        libro.style.transform =
          `translate(0px, ${innerHeight * 0.05}px) scale(${s * 0.5}) rotateX(42deg) rotateZ(-14deg) translateX(${-W / 2}px)`;
      }
    } else {
      libro.style.transform =
        `translate(0px, ${-innerHeight * 0.02}px) scale(${s}) rotateX(0deg) rotateZ(0deg) translateX(${x}px)`;
    }
  }

  function siguiente() { if (estado === "leyendo" && volteadas < L) { volteadas++; actualizarHojas(); } }
  function anterior()  { if (estado === "leyendo" && volteadas > 0) { volteadas--; actualizarHojas(); } }

  function irAPagina(n) {
    const hoja = Math.floor((n - 1) / 2);
    volteadas = n % 2 === 1 ? hoja : hoja + 1;
    actualizarHojas();
  }

  function abrir(clave, despues) {
    if (estado !== "escritorio") return;
    if (clave && clave !== activo) { volteadas = 0; if (!montar(clave)) return; }
    if (!libros[activo]) return;
    // primero, sin animación, el libro de páginas se pone exactamente donde está el 3D…
    clearTimeout(temporizadorOcultar);
    libro.style.transition = "none";
    aplicarTransform();
    void libro.offsetWidth;
    libro.style.transition = "";
    escena.classList.add("libro-visible");
    // …y desde ahí se acerca y se abre
    estado = "abriendo";
    escena.classList.add("leyendo");
    aplicarTransform();
    setTimeout(() => {
      estado = "leyendo";
      volteadas = 1;
      actualizarHojas();
      if (despues) setTimeout(despues, 300);
    }, 1100);
  }

  function cerrar() {
    if (estado !== "leyendo") return;
    estado = "cerrando";
    volteadas = 0;
    actualizarHojas();
    setTimeout(() => {
      estado = "escritorio";
      escena.classList.remove("leyendo");
      aplicarTransform();
      // cuando termina de volver a la mesa, se ve de nuevo el libro 3D
      temporizadorOcultar = setTimeout(() => escena.classList.remove("libro-visible"), 1250);
    }, 900);
  }

  // Abre el diario (si hace falta) y va a la primera página de una entrada
  function irAEntrada(i) {
    const d = libros.diario;
    if (!d || d.inicioDe[i] == null) return;
    if (activo !== "diario" && estado !== "escritorio") return;
    if (activo !== "diario") { volteadas = 0; montar("diario"); }
    if (estado === "leyendo" && activo === "diario") irAPagina(inicioDe[i]);
    else if (estado === "escritorio") abrir("diario", () => irAPagina(inicioDe[i]));
  }

  // Vuelve al escritorio de inmediato (al salir de la cuenta)
  function reiniciar() {
    estado = "escritorio";
    volteadas = 0;
    clearTimeout(temporizadorOcultar);
    escena.classList.remove("leyendo", "libro-visible");
    actualizarHojas(true);
    // al salir de la cuenta se olvidan los dos libros (se vuelven a armar al entrar)
    Object.keys(libros).forEach((k) => delete libros[k]);
    activo = "diario";
    libro.classList.remove("azul");
  }

  /* ---------------- 4. Controles ---------------- */

  document.addEventListener("keydown", (e) => {
    if (!habilitado) return;
    if (e.ctrlKey || e.metaKey || e.altKey || ["Shift", "Control", "Alt", "Meta", "Tab"].includes(e.key)) return;
    if (estado === "escritorio") return;   // el diario se abre con un clic sobre él
    switch (e.key) {
      case "ArrowRight": case "PageDown": case " ": siguiente(); e.preventDefault(); break;
      case "ArrowLeft":  case "PageUp":             anterior();  e.preventDefault(); break;
      case "Home": if (estado === "leyendo") { volteadas = 1; actualizarHojas(); } break;
      case "End":  if (estado === "leyendo") { volteadas = L - 1; actualizarHojas(); } break;
      case "Escape": cerrar(); break;
    }
  });

  document.getElementById("libro-escenario").addEventListener("click", (e) => {
    if (!habilitado) return;
    if (estado === "escritorio") return;   // sobre la mesa se abre con doble clic (ver abajo)
    if (estado !== "leyendo") return;
    e.clientX < innerWidth / 2 ? anterior() : siguiente();
  });

  document.getElementById("btn-sig").addEventListener("click", siguiente);
  document.getElementById("btn-ant").addEventListener("click", anterior);
  document.getElementById("btn-cerrar").addEventListener("click", cerrar);

  let toqueX = null;
  addEventListener("touchstart", (e) => { toqueX = e.touches[0].clientX; }, { passive: true });
  addEventListener("touchend", (e) => {
    if (toqueX == null) return;
    const dx = e.changedTouches[0].clientX - toqueX;
    toqueX = null;
    if (habilitado && estado === "leyendo" && Math.abs(dx) > 50) dx < 0 ? siguiente() : anterior();
  });



  addEventListener("resize", aplicarTransform);

  // Aun sin sesión, el lugar del diario en la mesa ya existe (los dados lo esquivan)
  { const h = document.createElement("div"); h.className = "huella"; libro.appendChild(h); }
  aplicarTransform();

  return {
    construir,
    irAEntrada,
    abrir: (clave) => abrir(clave),
    get activo() { return activo; },
    tiene: (clave) => !!libros[clave],
    fijarDestinoMesa(f) { destinoMesa = f; if (estado === "escritorio") aplicarTransform(); },
    reiniciar,
    habilitar(v) { habilitado = v; },
  };
})();
