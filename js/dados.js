/* =====================================================================
   DADOS
   Un dado de cada tipo sobre el escritorio (d4, d6, d8, d10, d%, d12,
   d20 y d2), dibujados con three.js y con una física propia.

   - Mantener apretado un dado: lo levantás.
   - Agitarlo: gira en la mano.
   - Soltarlo en movimiento (o después de agitarlo): lo tirás.
   El número es el que queda arriba cuando el dado se detiene.
   ===================================================================== */

const Dados = (() => {
  const T = window.THREE;
  if (!T) { console.warn("three.js no cargó: no hay dados."); return {}; }

  const PHI = (1 + Math.sqrt(5)) / 2;
  const escena = document.getElementById("escena");
  const contenedor = document.getElementById("dados");

  /* =================================================================
     1. FORMAS
     ================================================================= */

  const d10 = () => {
    const h = 1, c = Math.cos(Math.PI / 5);
    const z = h * (1 - c) / (1 + c);           // altura de los anillos para que las caras sean planas
    const v = [[0, h, 0], [0, -h, 0]];
    for (let k = 0; k < 5; k++) {
      const a = (2 * Math.PI * k) / 5, b = a + Math.PI / 5;
      v.push([Math.cos(a), z, Math.sin(a)], [Math.cos(b), -z, Math.sin(b)]);
    }
    return v;
  };

  const TIPOS = {
    d4:   { radio: 1.10, bisel: 0.12, verts: () => [[1, 1, 1], [-1, -1, 1], [-1, 1, -1], [1, -1, -1]] },
    d6:   { radio: 0.92, bisel: 0.10, verts: () => [-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z) => [x, y, z]))) },
    d8:   { radio: 0.98, bisel: 0.10, verts: () => [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]] },
    d10:  { radio: 0.98, bisel: 0.09, verts: d10, subrayar: true },
    d100: { radio: 0.98, bisel: 0.09, verts: d10 },
    d12:  { radio: 0.98, bisel: 0.08, subrayar: true, verts: () => {
      const v = [], a = 1 / PHI;
      [-1, 1].forEach((x) => [-1, 1].forEach((y) => [-1, 1].forEach((z) => v.push([x, y, z]))));
      [-1, 1].forEach((s) => [-1, 1].forEach((t) => v.push([0, s * a, t * PHI], [s * a, t * PHI, 0], [s * PHI, 0, t * a])));
      return v;
    } },
    d20:  { radio: 1.02, bisel: 0.08, subrayar: true, verts: () => {
      const v = [];
      [-1, 1].forEach((s) => [-1, 1].forEach((t) => v.push([0, s, t * PHI], [s, t * PHI, 0], [s * PHI, 0, t])));
      return v;
    } },
    d2:   { radio: 0.82, bisel: 0.10, verts: () => {
      const v = [];
      for (let k = 0; k < 24; k++) { const a = (2 * Math.PI * k) / 24; v.push([Math.cos(a), 0.17, Math.sin(a)], [Math.cos(a), -0.17, Math.sin(a)]); }
      return v;
    } },
  };
  const ORDEN = ["d20", "d12", "d10", "d100", "d8", "d6", "d4", "d2"];

  // Encuentra las caras (planos) de un poliedro convexo a partir de sus vértices
  function hallarCaras(V) {
    const planos = [], n = V.length, eps = 1e-5;
    const ab = new T.Vector3(), ac = new T.Vector3();
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) for (let k = j + 1; k < n; k++) {
      const nor = new T.Vector3().crossVectors(ab.subVectors(V[j], V[i]), ac.subVectors(V[k], V[i]));
      if (nor.lengthSq() < 1e-10) continue;
      nor.normalize();
      let d = nor.dot(V[i]), pos = 0, neg = 0;
      for (const p of V) { const s = nor.dot(p) - d; if (s > eps) pos++; else if (s < -eps) neg++; }
      if (pos && neg) continue;
      if (pos) { nor.negate(); d = -d; }
      if (planos.some((p) => p.n.dot(nor) > 1 - 1e-6)) continue;
      const idx = [];
      V.forEach((p, m) => { if (Math.abs(nor.dot(p) - d) < eps) idx.push(m); });
      const c = idx.reduce((s, m) => s.add(V[m]), new T.Vector3()).divideScalar(idx.length);
      const u = V[idx[0]].clone().sub(c).normalize(), w = new T.Vector3().crossVectors(nor, u);
      idx.sort((a, b) => {
        const pa = V[a].clone().sub(c), pb = V[b].clone().sub(c);
        return Math.atan2(pa.dot(w), pa.dot(u)) - Math.atan2(pb.dot(w), pb.dot(u));
      });
      planos.push({ n: nor, idx, c });
    }
    return planos;
  }

  // Números de cada cara: las caras opuestas suman lo mismo, como en los dados de verdad
  function asignarNumeros(tipo, planos) {
    const N = planos.length;
    if (tipo === "d2") return planos.map((p) => (p.n.y > 0.9 ? "1" : p.n.y < -0.9 ? "2" : null));
    if (tipo === "d4") return planos.map(() => null);
    const base = tipo === "d10" || tipo === "d100" ? 0 : 1;
    const total = tipo === "d10" || tipo === "d100" ? N - 1 : N + 1;
    const etiqueta = (v) => (tipo === "d100" ? (v === 0 ? "00" : v + "0") : String(v));
    const valores = new Array(N).fill(null);
    let siguiente = base;
    planos.forEach((p, f) => {
      if (valores[f] != null) return;
      const g = planos.findIndex((q, h) => h !== f && valores[h] == null && q.n.dot(p.n) < -0.999);
      valores[f] = siguiente;
      if (g >= 0) valores[g] = total - siguiente;
      siguiente++;
    });
    return valores.map(etiqueta);
  }

  /* =================================================================
     2. APARIENCIA (blanco nacarado, bordes redondeados, números grafito)
     ================================================================= */

  const COLOR_BASE = "#f3f1ec";
  const COLOR_NUMERO = "#26262a";
  const FUENTE = '"Nunito", "Arial Rounded MT Bold", "Segoe UI", Arial, sans-serif';
  const TAM = 1024;

  function crearDado(tipo) {
    const def = TIPOS[tipo];
    const V = def.verts().map((a) => new T.Vector3(...a));
    const R = Math.max(...V.map((v) => v.length()));
    V.forEach((v) => v.multiplyScalar(def.radio / R));
    const planos = hallarCaras(V);
    const etiquetas = asignarNumeros(tipo, planos);
    const etiquetasVertice = tipo === "d4" ? ["1", "2", "3", "4"] : null;

    // ---- textura con todos los números ----
    const g = Math.ceil(Math.sqrt(planos.length + 1)), cs = TAM / g;
    const lienzo = document.createElement("canvas");
    lienzo.width = lienzo.height = TAM;
    const ctx = lienzo.getContext("2d");
    ctx.fillStyle = COLOR_BASE;
    ctx.fillRect(0, 0, TAM, TAM);
    const uvLiso = [(cs / 2) / TAM, 1 - (cs / 2) / TAM];

    const ejes = planos.map((p, f) => {
      let arriba;
      if (tipo === "d6") arriba = V[p.idx[0]].clone().add(V[p.idx[1]]).multiplyScalar(0.5);
      else if (tipo === "d10" || tipo === "d100") arriba = V[p.idx.reduce((a, b) => (Math.abs(V[b].y) > Math.abs(V[a].y) ? b : a))].clone();
      else if (tipo === "d2") arriba = p.c.clone().add(Math.abs(p.n.y) > 0.9 ? new T.Vector3(0, 0, -1) : new T.Vector3(0, 1, 0));
      else arriba = V[p.idx[0]].clone();
      const y = arriba.sub(p.c); y.addScaledVector(p.n, -y.dot(p.n));
      if (y.lengthSq() < 1e-8) y.copy(V[p.idx[0]]).sub(p.c);
      y.normalize();
      const x = new T.Vector3().crossVectors(y, p.n);
      const pts = p.idx.map((i) => { const q = V[i].clone().sub(p.c); return [q.dot(x), q.dot(y)]; });
      const rmax = Math.max(...pts.map(([a, b]) => Math.hypot(a, b)));
      const s = (cs * 0.48) / rmax;
      const celda = f + 1, cx = (celda % g) * cs + cs / 2, cy = Math.floor(celda / g) * cs + cs / 2;
      // radio inscripto (para el tamaño del número)
      let rin = Infinity;
      pts.forEach(([ax, ay], k) => {
        const [bx, by] = pts[(k + 1) % pts.length];
        rin = Math.min(rin, Math.abs(ax * by - ay * bx) / Math.hypot(bx - ax, by - ay));
      });
      return { x, y, s, cx, cy, pts, rin };
    });

    const escribir = (texto, px, ang, ox, oy, subrayar) => {
      ctx.save();
      ctx.translate(ox, oy);
      ctx.rotate(ang);
      ctx.font = `800 ${px}px ${FUENTE}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      // grabado: un brillo debajo y el número oscuro encima
      ctx.fillStyle = "rgba(255,255,255,.9)";
      ctx.fillText(texto, 0, px * 0.05);
      ctx.fillStyle = COLOR_NUMERO;
      ctx.fillText(texto, 0, 0);
      if (subrayar) {
        const w = ctx.measureText(texto).width;
        ctx.fillRect(-w * 0.45, px * 0.42, w * 0.9, px * 0.08);
      }
      ctx.restore();
    };

    planos.forEach((p, f) => {
      const e = ejes[f];
      if (tipo === "d4") {
        p.idx.forEach((i, k) => {
          const [vx, vy] = e.pts[k];
          const ox = e.cx + vx * e.s * 0.55, oy = e.cy - vy * e.s * 0.55;
          escribir(etiquetasVertice[i], e.rin * e.s * 0.8, Math.atan2(vx, vy), ox, oy, false);
        });
      } else if (etiquetas[f] != null) {
        const t = etiquetas[f];
        const k = tipo === "d2" ? 0.9 : t.length > 1 ? 0.92 : 1.12;
        const sub = def.subrayar && (t === "6" || t === "9");
        // en el d10 el número va un poco más cerca de la punta
        const desplaz = tipo === "d10" || tipo === "d100" ? e.rin * e.s * 0.15 : 0;
        escribir(t, e.rin * e.s * k, 0, e.cx, e.cy - desplaz, sub);
      }
    });

    const textura = new T.CanvasTexture(lienzo);
    textura.encoding = T.sRGBEncoding;
    textura.anisotropy = 8;

    // ---- geometría con bisel (bordes y esquinas redondeados) ----
    const pos = [], nor = [], uv = [];
    const copias = planos.map((p) => {
      const m = {};
      p.idx.forEach((i) => { m[i] = V[i].clone().sub(p.c).multiplyScalar(1 - def.bisel).add(p.c); });
      return m;
    });
    const uvDe = (f, q) => {
      const e = ejes[f], d = q.clone().sub(planos[f].c);
      return [(e.cx + d.dot(e.x) * e.s) / TAM, 1 - (e.cy - d.dot(e.y) * e.s) / TAM];
    };
    const tri = (a, b, c, ref) => {
      const n = new T.Vector3().crossVectors(b.p.clone().sub(a.p), c.p.clone().sub(a.p));
      if (n.dot(ref) < 0) [b, c] = [c, b];
      for (const v of [a, b, c]) { pos.push(v.p.x, v.p.y, v.p.z); nor.push(v.n.x, v.n.y, v.n.z); uv.push(...v.uv); }
    };

    // caras
    planos.forEach((p, f) => {
      const vs = p.idx.map((i) => ({ p: copias[f][i], n: p.n, uv: uvDe(f, copias[f][i]) }));
      for (let k = 1; k < vs.length - 1; k++) tri(vs[0], vs[k], vs[k + 1], p.n);
    });
    // bordes
    const aristas = {};
    planos.forEach((p, f) => p.idx.forEach((a, k) => { aristas[a + "," + p.idx[(k + 1) % p.idx.length]] = f; }));
    planos.forEach((p, f) => p.idx.forEach((a, k) => {
      const b = p.idx[(k + 1) % p.idx.length], h = aristas[b + "," + a];
      if (h == null || h < f) return;
      const q = planos[h], ref = p.n.clone().add(q.n);
      const A1 = { p: copias[f][a], n: p.n, uv: uvLiso }, B1 = { p: copias[f][b], n: p.n, uv: uvLiso };
      const A2 = { p: copias[h][a], n: q.n, uv: uvLiso }, B2 = { p: copias[h][b], n: q.n, uv: uvLiso };
      tri(A1, A2, B2, ref); tri(A1, B2, B1, ref);
    }));
    // esquinas
    V.forEach((v, i) => {
      const caras = planos.map((p, f) => f).filter((f) => planos[f].idx.includes(i));
      if (caras.length < 3) return;
      const ref = caras.reduce((s, f) => s.add(planos[f].n), new T.Vector3()).normalize();
      const u = new T.Vector3().crossVectors(ref, Math.abs(ref.y) < 0.9 ? new T.Vector3(0, 1, 0) : new T.Vector3(1, 0, 0)).normalize();
      const w = new T.Vector3().crossVectors(ref, u);
      const vs = caras.map((f) => ({ p: copias[f][i], n: planos[f].n, uv: uvLiso }))
        .sort((a, b) => {
          const pa = a.p.clone().sub(v), pb = b.p.clone().sub(v);
          return Math.atan2(pa.dot(w), pa.dot(u)) - Math.atan2(pb.dot(w), pb.dot(u));
        });
      for (let k = 1; k < vs.length - 1; k++) tri(vs[0], vs[k], vs[k + 1], ref);
    });

    const geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
    geo.setAttribute("normal", new T.Float32BufferAttribute(nor, 3));
    geo.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
    geo.computeBoundingSphere();

    const material = new T.MeshPhysicalMaterial({
      map: textura, color: 0xffffff, roughness: 0.42, metalness: 0,
      clearcoat: 0.55, clearcoatRoughness: 0.35, sheen: 0.4, sheenColor: new T.Color(0xfff6e8),
    });
    const malla = new T.Mesh(geo, material);
    malla.castShadow = true;

    // puntos de choque: los vértices ya biselados (ruedan un poco más natural)
    const puntos = [];
    copias.forEach((m) => Object.values(m).forEach((q) => {
      if (!puntos.some((r) => r.distanceToSquared(q) < 1e-6)) puntos.push(q.clone());
    }));

    return {
      tipo, malla, puntos, mundo: puntos.map(() => new T.Vector3()),
      radio: def.radio, invI: 1 / (0.28 * def.radio * def.radio),
      planos, etiquetas, etiquetasVertice, V,
      p: new T.Vector3(), q: new T.Quaternion(), v: new T.Vector3(), w: new T.Vector3(),
      dormido: false, quieto: 0, sostenido: false,
    };
  }

  // Lo que muestra el dado arriba (no se usa en pantalla, pero queda disponible: Dados.resultados())
  function resultado(d) {
    if (d.tipo === "d4") {
      let mejor = 0, y = -Infinity;
      d.V.forEach((v, i) => { const wy = v.clone().applyQuaternion(d.q).y; if (wy > y) { y = wy; mejor = i; } });
      return d.etiquetasVertice[mejor];
    }
    let mejor = 0, y = -Infinity;
    d.planos.forEach((p, f) => { const ny = p.n.clone().applyQuaternion(d.q).y; if (ny > y && d.etiquetas[f] != null) { y = ny; mejor = f; } });
    return d.etiquetas[mejor];
  }

  /* =================================================================
     3. ESCENA 3D
     ================================================================= */

  const render = new T.WebGLRenderer({ antialias: true, alpha: true });
  render.setPixelRatio(Math.min(devicePixelRatio, 2));
  render.outputEncoding = T.sRGBEncoding;
  render.toneMapping = T.ACESFilmicToneMapping;
  render.toneMappingExposure = 1.05;
  render.shadowMap.enabled = true;
  render.shadowMap.type = T.PCFSoftShadowMap;
  contenedor.appendChild(render.domElement);

  const mundo = new T.Scene();
  const camara = new T.PerspectiveCamera(30, 1, 0.5, 300);
  camara.position.set(0, 32, 10);
  camara.lookAt(0, 0, 0);

  // Luz: ambiente cálido + la vela (arriba a la izquierda) que proyecta las sombras
  mundo.add(new T.HemisphereLight(0xfff1dc, 0x3a2414, 0.55));
  const sol = new T.DirectionalLight(0xffe2b8, 1.05);
  sol.position.set(-12, 22, -9);
  sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048);
  Object.assign(sol.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 80 });
  sol.shadow.radius = 4;
  sol.shadow.bias = -0.0008;
  mundo.add(sol);
  const relleno = new T.DirectionalLight(0xbfd0ff, 0.25);
  relleno.position.set(10, 14, 12);
  mundo.add(relleno);

  // Reflejos suaves (para el brillo nacarado)
  {
    const pm = new T.PMREMGenerator(render);
    const amb = new T.Scene();
    amb.background = new T.Color(0x24180f);
    const panel = (color, x, y, z, w, h) => {
      const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color, side: T.DoubleSide }));
      m.position.set(x, y, z); m.lookAt(0, 0, 0); amb.add(m);
    };
    panel(0xffd9a0, -6, 8, -5, 6, 6);
    panel(0x8a6a4a, 6, 4, 6, 10, 6);
    panel(0xfff4e6, 0, 10, 0, 8, 8);
    mundo.environment = pm.fromScene(amb, 0.04).texture;
  }

  const piso = new T.Mesh(new T.PlaneGeometry(200, 200), new T.ShadowMaterial({ opacity: 0.42 }));
  piso.rotation.x = -Math.PI / 2;
  piso.receiveShadow = true;
  mundo.add(piso);

  /* =================================================================
     4. FÍSICA
     ================================================================= */

  const GRAVEDAD = 75, SUBPASOS = 6, REBOTE = 0.32, ROCE = 0.45;
  const ALTURA_MANO = 3.4;
  let paredes = [];                      // planos: { n, d }  (adentro: n·x >= d)
  let limites = { x0: -10, x1: 10, z0: -6, z1: 6 };
  let obstaculo = null;                  // el diario: { x0, x1, z0, z1, alto }
  const dados = [];

  const tmp = new T.Vector3(), tmp2 = new T.Vector3(), tmp3 = new T.Vector3();

  function aplicar(d, J, r) {
    d.v.add(J);
    d.w.addScaledVector(tmp3.crossVectors(r, J), d.invI);
  }

  function velPunto(d, r, salida) {
    return salida.crossVectors(d.w, r).add(d.v);
  }

  function despertar(d) { d.dormido = false; d.quieto = 0; }

  function paso(h) {
    const contactos = [];
    for (const d of dados) {
      if (d.dormido || d.sostenido) continue;
      d.v.y -= GRAVEDAD * h;
      d.enPiso = false;
      d.correccion = {};
      for (let i = 0; i < d.puntos.length; i++) {
        const P = d.mundo[i].copy(d.puntos[i]).applyQuaternion(d.q).add(d.p);
        // piso y paredes
        for (let k = 0; k < paredes.length; k++) {
          const pl = paredes[k], pen = pl.d - pl.n.dot(P);
          if (pen > -0.004) contactos.push(nuevoContacto(d, P, pl.n, pen, k));
        }
        // el diario
        const o = obstaculo;
        if (o && P.x > o.x0 && P.x < o.x1 && P.z > o.z0 && P.z < o.z1 && P.y < o.alto) {
          const op = [[P.x - o.x0, -1, 0, 0], [o.x1 - P.x, 1, 0, 0], [P.z - o.z0, 0, 0, -1], [o.z1 - P.z, 0, 0, 1], [o.alto - P.y, 0, 1, 0]]
            .reduce((a, b) => (b[0] < a[0] ? b : a));
          contactos.push(nuevoContacto(d, P, new T.Vector3(op[1], op[2], op[3]), op[0], "o" + op.slice(1).join()));
        }
      }
    }

    // resolver impulsos (varias pasadas)
    for (let it = 0; it < 8; it++) {
      for (const c of contactos) {
        const d = c.d;
        const u = velPunto(d, c.r, tmp);
        const vn = u.dot(c.n);
        let dj = (c.sesgo - vn) / c.kn;
        const viejo = c.jn; c.jn = Math.max(0, viejo + dj); dj = c.jn - viejo;
        if (dj) aplicar(d, tmp2.copy(c.n).multiplyScalar(dj), c.r);
        for (const t of [c.t1, c.t2]) {
          const ut = velPunto(d, c.r, tmp).dot(t.v);
          let jt = -ut / t.k;
          const lim = ROCE * c.jn, va = t.j;
          t.j = Math.max(-lim, Math.min(lim, va + jt)); jt = t.j - va;
          if (jt) aplicar(d, tmp2.copy(t.v).multiplyScalar(jt), c.r);
        }
      }
    }

    // choques entre dados (aproximados como esferas)
    for (let a = 0; a < dados.length; a++) for (let b = a + 1; b < dados.length; b++) {
      const A = dados[a], B = dados[b];
      if ((A.dormido && B.dormido) || A.sostenido || B.sostenido) continue;
      const rmin = (A.radio + B.radio) * 0.78;
      tmp.subVectors(A.p, B.p);
      const dist = tmp.length();
      if (dist >= rmin || dist < 1e-6) continue;
      const n = tmp.divideScalar(dist);
      const rel = tmp2.subVectors(A.v, B.v).dot(n);
      if (rel < 0) {
        const j = (-(1 + 0.35) * rel) / 2;
        A.v.addScaledVector(n, j); B.v.addScaledVector(n, -j);
        if (Math.abs(rel) > 1.5) { A.w.add(azar(Math.abs(rel) * 0.6)); B.w.add(azar(Math.abs(rel) * 0.6)); }
      }
      // separarlos (sin levantarlos ni hundirlos); solo se "despiertan" si el choque es de verdad
      const sep = (rmin - dist) / 2;
      tmp2.copy(n).setY(0);
      if (tmp2.lengthSq() > 1e-6) {
        tmp2.normalize();
        if (!A.dormido) A.p.addScaledVector(tmp2, B.dormido ? sep * 2 : sep);
        if (!B.dormido) B.p.addScaledVector(tmp2, A.dormido ? -sep * 2 : -sep);
      }
      if (rel < -1.5) { despertar(A); despertar(B); }
    }

    // integrar
    for (const d of dados) {
      if (d.dormido || d.sostenido) continue;
      if (d.v.length() > 45) d.v.setLength(45);
      if (d.w.length() > 70) d.w.setLength(70);
      d.p.addScaledVector(d.v, h);
      integrarGiro(d, h);
      for (const k in d.correccion) {
        const c = d.correccion[k];
        if (c.pen > 0.002) d.p.addScaledVector(c.n, (c.pen - 0.002) * 0.6);
      }
      // amortiguación (aire y rozamiento al rodar)
      d.v.multiplyScalar(1 - 0.08 * h);
      d.w.multiplyScalar(1 - (d.enPiso ? 1.6 : 0.15) * h);
      // reposo
      if (d.enPiso && d.v.lengthSq() < 0.04 && d.w.lengthSq() < 0.09) {
        d.quieto += h;
        if (d.quieto > 0.35) { d.dormido = true; d.v.set(0, 0, 0); d.w.set(0, 0, 0); }
      } else d.quieto = 0;
    }
  }

  function nuevoContacto(d, P, n, pen, clave) {
    const r = P.clone().sub(d.p);
    const rn = tmp3.crossVectors(r, n);
    const kn = 1 + d.invI * rn.lengthSq();
    const vn0 = velPunto(d, r, tmp).dot(n);
    const t1v = new T.Vector3().crossVectors(n, Math.abs(n.y) < 0.9 ? new T.Vector3(0, 1, 0) : new T.Vector3(1, 0, 0)).normalize();
    const t2v = new T.Vector3().crossVectors(n, t1v);
    const k = (t) => 1 + d.invI * tmp3.crossVectors(r, t).lengthSq();
    if (n.y > 0.5) d.enPiso = true;
    const c = d.correccion[clave];
    if (!c || pen > c.pen) d.correccion[clave] = { n, pen };
    return {
      d, r, n, kn, jn: 0,
      sesgo: vn0 < -2 ? -REBOTE * vn0 : 0,
      t1: { v: t1v, k: k(t1v), j: 0 }, t2: { v: t2v, k: k(t2v), j: 0 },
    };
  }

  function integrarGiro(d, h) {
    const w = d.w, q = d.q;
    const dq = new T.Quaternion(w.x * h * 0.5, w.y * h * 0.5, w.z * h * 0.5, 0).multiply(q);
    q.set(q.x + dq.x, q.y + dq.y, q.z + dq.z, q.w + dq.w).normalize();
  }

  function azar(m) {
    const v = new T.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
    return v.lengthSq() < 1e-4 ? v.set(0, 1, 0).multiplyScalar(m) : v.normalize().multiplyScalar(m);
  }

  /* =================================================================
     5. PANTALLA ↔ MESA
     ================================================================= */

  const rayo = new T.Raycaster();
  const ndc = new T.Vector2();

  function aMesa(x, y, altura = 0, salida = new T.Vector3()) {
    ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
    rayo.setFromCamera(ndc, camara);
    const o = rayo.ray.origin, dir = rayo.ray.direction;
    const t = (altura - o.y) / dir.y;
    return salida.copy(o).addScaledVector(dir, t);
  }

  let necesitaDibujo = true;

  function ajustarTamano() {
    render.setSize(innerWidth, innerHeight);
    camara.aspect = innerWidth / innerHeight;
    // en pantallas angostas (celular) la cámara se aleja para que los dados no queden enormes
    const lejos = Math.pow(Math.max(1, 1.25 / camara.aspect), 0.45);
    camara.position.set(0, 32 * lejos, 10 * lejos);
    camara.lookAt(0, 0, 0);
    camara.fov = 30;
    camara.updateProjectionMatrix();
    camara.updateMatrixWorld();   // sin esto, los rayos salen desde una cámara sin ubicar
    const arribaIzq = aMesa(0, 0), abajoIzq = aMesa(0, innerHeight);
    const margen = 1.1;
    limites = {
      x0: arribaIzq.x + margen, x1: -arribaIzq.x - margen,
      z0: arribaIzq.z + margen * 1.4, z1: abajoIzq.z - margen,
    };
    paredes = [
      { n: new T.Vector3(0, 1, 0), d: 0 },
      { n: new T.Vector3(1, 0, 0), d: limites.x0 },
      { n: new T.Vector3(-1, 0, 0), d: -limites.x1 },
      { n: new T.Vector3(0, 0, 1), d: limites.z0 },
      { n: new T.Vector3(0, 0, -1), d: -limites.z1 },
    ];
    actualizarObstaculo();
    dados.forEach(despertar);
    necesitaDibujo = true;
  }

  // El diario cerrado ocupa lugar en la mesa: los dados rebotan contra él
  function actualizarObstaculo() {
    if (escena.classList.contains("leyendo")) return;
    const huella = document.querySelector("#libro .huella");
    if (!huella) { obstaculo = null; return; }
    const r = huella.getBoundingClientRect();
    if (!r.width) { obstaculo = null; return; }
    const ach = 0.12;   // el rectángulo de un libro girado es más grande que el libro
    const xa = r.left + r.width * ach, xb = r.right - r.width * ach;
    const ya = r.top + r.height * ach, yb = r.bottom - r.height * ach;
    const a = aMesa(xa, ya), b = aMesa(xb, yb);
    const nuevo = { x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), z0: Math.min(a.z, b.z), z1: Math.max(a.z, b.z), alto: 40 };   // "alto": ningún dado queda encima del libro
    const viejo = obstaculo;
    obstaculo = nuevo;
    if (!viejo || Math.abs(viejo.x0 - nuevo.x0) + Math.abs(viejo.z0 - nuevo.z0) + Math.abs(viejo.x1 - nuevo.x1) > 0.2) dados.forEach(despertar);
  }

  /* =================================================================
     6. AGARRAR, AGITAR Y TIRAR
     ================================================================= */

  let sost = null;   // { dado, objetivo, muestras: [{t, p}], agitacion, eje }
  let tragarClic = false;

  const puedeUsar = () =>
    document.body.classList.contains("con-sesion") &&
    !escena.classList.contains("leyendo") &&
    !document.getElementById("editor")?.classList.contains("visible") &&
    !document.getElementById("token")?.classList.contains("visible");

  function dadoBajo(x, y) {
    ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
    rayo.setFromCamera(ndc, camara);
    const hit = rayo.intersectObjects(dados.map((d) => d.malla), false)[0];
    return hit ? dados.find((d) => d.malla === hit.object) : null;
  }

  addEventListener("pointerdown", (e) => {
    if (sost || !puedeUsar() || (e.pointerType === "mouse" && e.button !== 0)) return;
    const d = dadoBajo(e.clientX, e.clientY);
    if (!d) return;
    e.preventDefault(); e.stopPropagation();
    tragarClic = true;
    d.sostenido = true;
    despertar(d);
    const objetivo = limitar(aMesa(e.clientX, e.clientY, ALTURA_MANO));
    sost = { dado: d, objetivo, muestras: [{ t: e.timeStamp, p: objetivo.clone() }], agitacion: 0, eje: azar(1), id: e.pointerId };
    escena.classList.add("agarrando");
  }, true);

  addEventListener("pointermove", (e) => {
    if (sost && e.pointerId === sost.id) {
      // el navegador puede agrupar varios movimientos en un evento: los usamos todos
      const eventos = (e.getCoalescedEvents && e.getCoalescedEvents().length) ? e.getCoalescedEvents() : [e];
      for (const ev of eventos) {
        const p = limitar(aMesa(ev.clientX, ev.clientY, ALTURA_MANO));
        const ult = sost.muestras[sost.muestras.length - 1];
        // agitar = cuánto lo movés mientras lo tenés en la mano
        sost.agitacion += p.distanceTo(ult.p) * 0.35;
        sost.muestras.push({ t: ev.timeStamp, p });
        if (Math.random() < 0.08) sost.eje = azar(1);
      }
      sost.objetivo.copy(sost.muestras[sost.muestras.length - 1].p);
      const ahora = sost.muestras[sost.muestras.length - 1].t;
      while (sost.muestras.length > 2 && ahora - sost.muestras[0].t > 100) sost.muestras.shift();
      return;
    }
    if (!puedeUsar()) { escena.classList.remove("sobre-dado"); return; }
    if (e.pointerType === "mouse") escena.classList.toggle("sobre-dado", !!dadoBajo(e.clientX, e.clientY));
  }, true);

  function soltar(e) {
    if (!sost || (e && e.pointerId !== sost.id)) return;
    const { dado: d, muestras, agitacion } = sost;
    const fin = e ? e.timeStamp : performance.now();
    const b = muestras[muestras.length - 1];
    // velocidad de la mano en los últimos ~100 ms (si se quedó quieta antes de soltar, es 0)
    const recientes = muestras.filter((m) => b.t - m.t <= 100);
    const a = recientes[0];
    const dt = Math.max(0.016, (b.t - a.t) / 1000);
    const vel = fin - b.t > 100 ? new T.Vector3() : b.p.clone().sub(a.p).divideScalar(dt);
    vel.y = 0;
    const rapidez = vel.length();
    d.sostenido = false;
    despertar(d);
    if (rapidez > 4 || agitacion > 2.5) {
      // tirada: velocidad de la mano + mucho giro al azar
      d.v.copy(vel.multiplyScalar(0.85).clampLength(0, 34)).add(new T.Vector3(0, -3, 0));
      if (rapidez < 4) d.v.add(azar(5 + Math.random() * 5).setY(0));
      d.w.copy(azar(14 + Math.random() * 18 + Math.min(agitacion, 10)));
    } else {
      // soltarlo sin tirar: cae y se acomoda
      d.v.copy(vel.multiplyScalar(0.5)).add(new T.Vector3(0, -1, 0));
      d.w.copy(azar(3 + Math.random() * 4));
    }
    sost = null;
    escena.classList.remove("agarrando");
  }
  addEventListener("pointerup", soltar, true);
  addEventListener("pointercancel", soltar, true);
  addEventListener("blur", () => soltar());

  // que el clic de un dado no abra el diario ni pase la página
  addEventListener("click", (e) => {
    if (tragarClic) { e.stopPropagation(); e.preventDefault(); tragarClic = false; }
  }, true);

  function limitar(p) {
    p.x = Math.max(limites.x0, Math.min(limites.x1, p.x));
    p.z = Math.max(limites.z0, Math.min(limites.z1, p.z));
    return p;
  }

  function moverSostenido(dt) {
    const d = sost.dado;
    // decae la agitación con el tiempo
    sost.agitacion *= Math.exp(-dt * 2.5);
    // sigue a la mano con un resorte
    const vObj = tmp.subVectors(sost.objetivo, d.p).multiplyScalar(16);
    d.v.lerp(vObj, Math.min(1, dt * 20));
    d.p.addScaledVector(d.v, dt);
    // gira en la mano: suave si está quieto, rápido si lo agitás
    const giro = 1.6 + Math.min(sost.agitacion * 8, 30);
    d.w.lerp(tmp2.copy(sost.eje).multiplyScalar(giro), Math.min(1, dt * 8));
    integrarGiro(d, dt);
  }

  /* =================================================================
     7. ARMAR LA MESA Y ANIMAR
     ================================================================= */

  function ubicarIniciales() {
    const lugares = [];
    const libre = (x, z) => {
      if (lugares.some(([a, b]) => Math.hypot(a - x, b - z) < 2.4)) return false;
      const o = obstaculo;
      if (o && x > o.x0 - 1.4 && x < o.x1 + 1.4 && z > o.z0 - 1.4 && z < o.z1 + 1.4) return false;
      return true;
    };
    dados.forEach((d) => {
      let x = 0, z = 0;
      for (let i = 0; i < 300; i++) {
        x = limites.x0 + Math.random() * (limites.x1 - limites.x0);
        z = limites.z0 + Math.random() * (limites.z1 - limites.z0);
        if (libre(x, z)) break;
      }
      lugares.push([x, z]);
      d.p.set(x, 1.5 + Math.random() * 2, z);
      d.q.setFromEuler(new T.Euler(Math.random() * 6.3, Math.random() * 6.3, Math.random() * 6.3));
      d.v.set(0, -2, 0);
      d.w.copy(azar(4));
      despertar(d);
    });
  }

  let anterior = performance.now();
  function bucle(t) {
    requestAnimationFrame(bucle);
    const dt = Math.min(0.033, (t - anterior) / 1000);
    anterior = t;
    if (document.hidden) return;

    if (sost) moverSostenido(dt);
    const activos = sost || dados.some((d) => !d.dormido);
    if (activos) {
      const h = dt / SUBPASOS;
      for (let i = 0; i < SUBPASOS; i++) paso(h);
    }
    if (activos || necesitaDibujo) {
      dados.forEach((d) => { d.malla.position.copy(d.p); d.malla.quaternion.copy(d.q); });
      render.render(mundo, camara);
      necesitaDibujo = false;
    }
  }

  async function iniciar() {
    if (document.fonts) {
      await Promise.race([document.fonts.load(`800 64px "Nunito"`), new Promise((r) => setTimeout(r, 2500))]).catch(() => {});
    }
    ORDEN.forEach((tipo) => { const d = crearDado(tipo); dados.push(d); mundo.add(d.malla); });
    ajustarTamano();
    ubicarIniciales();
    addEventListener("resize", ajustarTamano);
    // el diario cambia de lugar al entrar/salir/cerrar: revisamos su huella de vez en cuando
    setInterval(actualizarObstaculo, 600);
    requestAnimationFrame(bucle);
    contenedor.classList.add("listo");
  }

  iniciar();

  return {
    resultados: () => dados.map((d) => ({ tipo: d.tipo, valor: d.dormido ? resultado(d) : null })),
    // para pruebas
    _interno: { dados, aMesa, camara, render,
      // avanza la física sin dibujar (para pruebas): devuelve los segundos simulados hasta que todo se detiene
      simular(max = 15) { const h = 1 / 60 / SUBPASOS; let t = 0; while (t < max && dados.some((d) => !d.dormido)) { for (let i = 0; i < SUBPASOS; i++) paso(h); t += 1 / 60; } necesitaDibujo = true; return t; }, get obstaculo() { return obstaculo; }, get limites() { return limites; } },
  };
})();
