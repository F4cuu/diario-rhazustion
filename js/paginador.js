/* =====================================================================
   PAGINADOR
   Reparte bloques de contenido (títulos, párrafos) en páginas,
   midiendo de verdad cuánto entra en una página invisible (#medidor).
   ===================================================================== */

const Paginador = (() => {

  function escapar(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // Formato mínimo: **negrita** y *cursiva*
  function formato(s) {
    return escapar(s)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>");
  }

  // Separa el texto en párrafos (línea en blanco = párrafo nuevo)
  function parrafos(texto) {
    return texto.trim()
      .split(/\n\s*\n/)
      .map(p => p.replace(/\s*\n\s*/g, " ").trim())
      .filter(Boolean);
  }

  function crearParrafo(palabras, clases) {
    const p = document.createElement("p");
    if (clases) p.className = clases;
    p.innerHTML = formato(palabras.join(" "));
    return p;
  }

  /* Bloque partible:   { palabras: [...], clases: "..." }
     Bloque fijo:       { crear: () => Element, pegado: true/false }
     "pegado" = no puede quedar solo al final de una página (ej. un título). */
  function paginar(bloques, contenedor) {
    const paginas = [];
    const desborda = () => contenedor.scrollHeight > contenedor.clientHeight + 1;
    const cerrarPagina = () => {
      if (contenedor.childNodes.length) paginas.push(contenedor.innerHTML);
      contenedor.innerHTML = "";
    };

    contenedor.innerHTML = "";
    const cola = [...bloques];
    let seguro = 0;

    while (cola.length && seguro++ < 10000) {
      const b = cola.shift();
      const nodo = b.palabras ? crearParrafo(b.palabras, b.clases) : b.crear();
      if (b.pegado) nodo.dataset.pegado = "1";

      contenedor.appendChild(nodo);
      if (!desborda()) continue;
      contenedor.removeChild(nodo);

      const paginaVacia = contenedor.childNodes.length === 0;

      if (b.palabras && b.palabras.length > 1) {
        // Búsqueda binaria: cuántas palabras entran en lo que queda de página
        let lo = 1, hi = b.palabras.length - 1, k = 0;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          const prueba = crearParrafo(b.palabras.slice(0, mid), b.clases);
          contenedor.appendChild(prueba);
          const entra = !desborda();
          contenedor.removeChild(prueba);
          if (entra) { k = mid; lo = mid + 1; } else { hi = mid - 1; }
        }

        if (k > 0) {
          contenedor.appendChild(crearParrafo(b.palabras.slice(0, k), (b.clases || "") + " cortado"));
          cerrarPagina();
          // El resto sigue en la página siguiente, sin sangría ni letra capital
          cola.unshift({ palabras: b.palabras.slice(k), clases: "cont" });
          continue;
        }
      }

      if (paginaVacia) {
        // No entra ni en una página vacía: lo ponemos igual para no trabarnos
        contenedor.appendChild(nodo);
        cerrarPagina();
        continue;
      }

      // Si lo último de la página es un título, se va con el párrafo a la siguiente
      const movidos = [];
      while (contenedor.lastElementChild && contenedor.lastElementChild.dataset.pegado
             && contenedor.childNodes.length > 1) {
        movidos.unshift(contenedor.lastElementChild);
        contenedor.removeChild(contenedor.lastElementChild);
      }
      cerrarPagina();
      movidos.forEach(m => contenedor.appendChild(m));
      cola.unshift(b);
    }

    cerrarPagina();
    return paginas;
  }

  return { paginar, parrafos, formato, escapar };
})();
