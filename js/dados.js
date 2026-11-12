/* =====================================================================
   LA MESA EN 3D: DADOS, MONEDAS Y VELA
   Un dado de cada tipo (d4, d6, d8, d10, d%, d12, d20 y d2), tres monedas
   y una vela, dibujados con three.js y con una física propia.

   - Mantener apretado un dado o una moneda: lo levantás.
   - Agitarlo: gira en la mano.
   - Soltarlo en movimiento (o después de agitarlo): lo tirás.
     Las monedas, si caen de canto, giran como un trompo; si no, rebotan y
     terminan girando y tambaleándose sobre la mesa hasta quedar planas.
   - La vela se arrastra: la luz y las sombras se mueven con ella.
   El número de un dado es el que queda arriba cuando se detiene.
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
  render.toneMappingExposure = 1.1;
  render.shadowMap.enabled = true;
  render.shadowMap.type = T.PCFSoftShadowMap;
  contenedor.appendChild(render.domElement);

  const mundo = new T.Scene();
  const camara = new T.PerspectiveCamera(30, 1, 0.5, 300);
  camara.position.set(0, 32, 10);
  camara.lookAt(0, 0, 0);

  // Luz ambiente tenue: la que manda es la de la vela
  mundo.add(new T.HemisphereLight(0xffe9cc, 0x2a180c, 0.42));
  const relleno = new T.DirectionalLight(0xbfd0ff, 0.16);
  relleno.position.set(10, 14, 12);
  mundo.add(relleno);

  // Reflejos suaves (para el brillo nacarado de los dados y el metal)
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

  const piso = new T.Mesh(new T.PlaneGeometry(300, 300), new T.ShadowMaterial({ opacity: 0.5 }));
  piso.rotation.x = -Math.PI / 2;
  piso.receiveShadow = true;
  mundo.add(piso);

  const lienzoTextura = (w, h, dibujar) => {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    dibujar(c.getContext("2d"), w, h);
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 8;
    return t;
  };

  /* =================================================================
     4. LA VELA (candelabro de bronce, cera, mecha y llama)
     ================================================================= */

  const RADIO_VELA = 1.08;          // para los choques (el plato)
  const ALTO_LLAMA = 3.42;

  function crearVela() {
    const grupo = new T.Group();
    const bronce = new T.MeshStandardMaterial({ color: 0xb48a3c, metalness: 0.85, roughness: 0.32 });
    const perfilPlato = [[0, 0], [0.98, 0], [1.06, 0.05], [1.1, 0.15], [1.04, 0.21], [0.97, 0.13], [0.56, 0.12], [0.53, 0.3], [0.44, 0.32], [0, 0.32]]
      .map(([x, y]) => new T.Vector2(x, y));
    const plato = new T.Mesh(new T.LatheGeometry(perfilPlato, 56), bronce);
    const asa = new T.Mesh(new T.TorusGeometry(0.2, 0.045, 10, 28), bronce);
    asa.rotation.x = Math.PI / 2; asa.position.set(1.22, 0.12, 0);
    const cera = new T.MeshPhysicalMaterial({
      color: 0xf4e8cd, roughness: 0.55, sheen: 0.6, sheenColor: new T.Color(0xffe2b0),
      emissive: new T.Color(0xffa04a), emissiveIntensity: 0.06,
    });
    const perfilCera = [[0, 0.3], [0.46, 0.3], [0.47, 1.3], [0.455, 2.3], [0.47, 3.02], [0.44, 3.1], [0.36, 3.07], [0.12, 3.0], [0, 3.0]]
      .map(([x, y]) => new T.Vector2(x, y));
    const cuerpoCera = new T.Mesh(new T.LatheGeometry(perfilCera, 48), cera);
    // chorreaduras de cera
    [[0.3, 2.62, 0.5], [2.2, 2.75, 0.32], [4.1, 2.5, 0.62]].forEach(([ang, y, largo]) => {
      const g = new T.Mesh(new T.CapsuleGeometry(0.055, largo, 4, 8), cera);
      g.position.set(Math.cos(ang) * 0.47, y, Math.sin(ang) * 0.47);
      cuerpoCera.add(g);
    });
    const mecha = new T.Mesh(new T.CylinderGeometry(0.022, 0.028, 0.26, 8), new T.MeshStandardMaterial({ color: 0x1b1410, roughness: 1 }));
    mecha.position.set(0, 3.12, 0); mecha.rotation.z = 0.12;

    const texLlama = lienzoTextura(128, 256, (c, w, h) => {
      const g = c.createRadialGradient(w / 2, h * 0.68, 2, w / 2, h * 0.62, h * 0.5);
      g.addColorStop(0, "rgba(255,255,240,1)"); g.addColorStop(0.18, "rgba(255,236,170,.98)");
      g.addColorStop(0.42, "rgba(255,170,60,.85)"); g.addColorStop(0.7, "rgba(255,90,20,.35)"); g.addColorStop(1, "rgba(255,60,0,0)");
      c.fillStyle = g;
      c.beginPath(); c.moveTo(w / 2, 4);
      c.bezierCurveTo(w * 0.86, h * 0.45, w * 0.98, h * 0.82, w / 2, h - 4);
      c.bezierCurveTo(w * 0.02, h * 0.82, w * 0.14, h * 0.45, w / 2, 4); c.fill();
      // base azulada
      const b = c.createRadialGradient(w / 2, h * 0.9, 1, w / 2, h * 0.9, w * 0.3);
      b.addColorStop(0, "rgba(120,150,255,.55)"); b.addColorStop(1, "rgba(120,150,255,0)");
      c.fillStyle = b; c.fillRect(0, 0, w, h);
    });
    const llama = new T.Sprite(new T.SpriteMaterial({ map: texLlama, blending: T.AdditiveBlending, depthWrite: false, transparent: true }));
    llama.center.set(0.5, 0.06);
    llama.position.set(0, 3.2, 0);
    const texHalo = lienzoTextura(128, 128, (c, w, h) => {
      const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, "rgba(255,200,120,.9)"); g.addColorStop(0.35, "rgba(255,160,70,.25)"); g.addColorStop(1, "rgba(255,140,60,0)");
      c.fillStyle = g; c.fillRect(0, 0, w, h);
    });
    const halo = new T.Sprite(new T.SpriteMaterial({ map: texHalo, blending: T.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.45 }));
    halo.position.set(0, ALTO_LLAMA, 0);
    halo.scale.set(2.6, 2.6, 1);

    const luz = new T.PointLight(0xffb468, 1.7, 70, 1.15);
    luz.position.set(0, ALTO_LLAMA + 0.15, 0);
    luz.castShadow = true;
    luz.shadow.mapSize.set(1024, 1024);
    luz.shadow.camera.near = 0.2; luz.shadow.camera.far = 70;
    luz.shadow.bias = -0.003; luz.shadow.radius = 3;

    // la cera no proyecta sombra: con la llama tan cerca, oscurecería un disco enorme alrededor de la vela
    [plato, asa].forEach((m) => { m.castShadow = true; m.receiveShadow = false; });
    plato.receiveShadow = true;

    // el "cuerpo" que se inclina al arrastrarla (todo menos la luz, que va aparte)
    const inclinable = new T.Group();
    inclinable.add(plato, asa, cuerpoCera, mecha, llama, halo, luz);
    grupo.add(inclinable);
    mundo.add(grupo);

    return {
      grupo, inclinable, luz, llama, halo, cera,
      tocables: [plato, asa, cuerpoCera],
      p: new T.Vector3(), v: new T.Vector3(), alto: 0,
      inclin: new T.Vector3(), inclinVel: new T.Vector3(),
      sostenida: false, objetivo: new T.Vector3(), agarre: new T.Vector3(),
    };
  }

  /* =================================================================
     5. MONEDAS (oro con relieve)
     ================================================================= */

  const RADIO_MONEDA = 0.62, ESPESOR_MONEDA = 0.11;

  function dibujarCara(c, w, lado, relieve) {
    const cx = w / 2, R = w / 2;
    // fondo
    if (relieve) { c.fillStyle = "#808080"; c.fillRect(0, 0, w, w); }
    else {
      const g = c.createRadialGradient(cx * 0.8, cx * 0.7, 10, cx, cx, R);
      g.addColorStop(0, "#f6d77a"); g.addColorStop(0.6, "#d9a944"); g.addColorStop(1, "#a9782a");
      c.fillStyle = g; c.fillRect(0, 0, w, w);
    }
    const tinta = relieve ? "#e8e8e8" : "rgba(120,78,18,.55)";
    const brillo = relieve ? "#d0d0d0" : "rgba(255,240,190,.5)";
    // borde y puntos
    c.lineWidth = w * 0.025; c.strokeStyle = tinta;
    c.beginPath(); c.arc(cx, cx, R * 0.86, 0, Math.PI * 2); c.stroke();
    c.fillStyle = tinta;
    for (let k = 0; k < 36; k++) {
      const a = (k / 36) * Math.PI * 2;
      c.beginPath(); c.arc(cx + Math.cos(a) * R * 0.76, cx + Math.sin(a) * R * 0.76, w * 0.011, 0, Math.PI * 2); c.fill();
    }
    c.save(); c.translate(cx, cx);
    if (lado === 0) {
      // cara: una hoja (elfo de los bosques)
      c.rotate(-0.5);
      c.beginPath(); c.moveTo(0, -R * 0.5);
      c.bezierCurveTo(R * 0.36, -R * 0.22, R * 0.3, R * 0.3, 0, R * 0.5);
      c.bezierCurveTo(-R * 0.3, R * 0.3, -R * 0.36, -R * 0.22, 0, -R * 0.5); c.fill();
      c.strokeStyle = relieve ? "#a0a0a0" : brillo; c.lineWidth = w * 0.014;
      c.beginPath(); c.moveTo(0, -R * 0.42); c.lineTo(0, R * 0.62); c.stroke();
      for (let k = -2; k <= 2; k++) {
        c.beginPath(); c.moveTo(0, k * R * 0.12); c.lineTo(R * 0.17, k * R * 0.12 - R * 0.1); c.stroke();
        c.beginPath(); c.moveTo(0, k * R * 0.12); c.lineTo(-R * 0.17, k * R * 0.12 - R * 0.1); c.stroke();
      }
    } else {
      // cruz: una espada (caballero arcano) y un "VII"
      c.beginPath(); c.moveTo(0, -R * 0.55); c.lineTo(R * 0.06, -R * 0.42); c.lineTo(R * 0.06, R * 0.18); c.lineTo(-R * 0.06, R * 0.18); c.lineTo(-R * 0.06, -R * 0.42); c.closePath(); c.fill();
      c.fillRect(-R * 0.24, R * 0.18, R * 0.48, R * 0.07);
      c.fillRect(-R * 0.04, R * 0.25, R * 0.08, R * 0.2);
      c.beginPath(); c.arc(0, R * 0.5, R * 0.06, 0, Math.PI * 2); c.fill();
      c.font = `700 ${R * 0.22}px Cinzel, Georgia, serif`; c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText("VII", -R * 0.38, -R * 0.05); c.fillText("VII", R * 0.38, -R * 0.05);
    }
    c.restore();
  }

  function crearMoneda() {
    const caras = [0, 1].map((lado) => ({
      map: lienzoTextura(512, 512, (c, w) => dibujarCara(c, w, lado, false)),
      bump: lienzoTextura(512, 512, (c, w) => dibujarCara(c, w, lado, true)),
    }));
    caras.forEach((c) => { c.bump.encoding = T.LinearEncoding; });
    const canto = lienzoTextura(512, 16, (c, w, h) => {
      c.fillStyle = "#777"; c.fillRect(0, 0, w, h);
      c.fillStyle = "#ddd"; for (let x = 0; x < w; x += 6) c.fillRect(x, 0, 3, h);
    });
    canto.encoding = T.LinearEncoding;
    const oro = { color: 0xffffff, metalness: 1, roughness: 0.3, bumpScale: 0.02 };
    const mats = [
      new T.MeshStandardMaterial({ ...oro, color: 0xd9ab4a, bumpMap: canto }),
      new T.MeshStandardMaterial({ ...oro, map: caras[0].map, bumpMap: caras[0].bump }),
      new T.MeshStandardMaterial({ ...oro, map: caras[1].map, bumpMap: caras[1].bump }),
    ];
    const malla = new T.Mesh(new T.CylinderGeometry(RADIO_MONEDA, RADIO_MONEDA, ESPESOR_MONEDA, 48, 1), mats);
    malla.castShadow = true;
    const puntos = [];
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2;
      puntos.push(new T.Vector3(Math.cos(a) * RADIO_MONEDA, ESPESOR_MONEDA / 2, Math.sin(a) * RADIO_MONEDA),
                  new T.Vector3(Math.cos(a) * RADIO_MONEDA, -ESPESOR_MONEDA / 2, Math.sin(a) * RADIO_MONEDA));
    }
    return {
      tipo: "moneda", malla, puntos, mundo: puntos.map(() => new T.Vector3()),
      radio: RADIO_MONEDA, invI: 1 / (0.3 * RADIO_MONEDA * RADIO_MONEDA),
      p: new T.Vector3(), q: new T.Quaternion(), v: new T.Vector3(), w: new T.Vector3(),
      dormido: false, quieto: 0, sostenido: false,
      giro: null, lanzada: false, tocoPiso: false,
    };
  }

  /* =================================================================
     6. FÍSICA
     ================================================================= */

  const GRAVEDAD = 75, SUBPASOS = 6, REBOTE = 0.32, ROCE = 0.45;
  const ALTURA_MANO = 3.4;
  const ARRIBA = new T.Vector3(0, 1, 0);
  let paredes = [];                      // planos: { n, d }  (adentro: n·x >= d)
  let limites = { x0: -10, x1: 10, z0: -6, z1: 6 };
  let obstaculo = null;                  // el diario: { x0, x1, z0, z1, alto }
  const dados = [], monedas = [], cuerpos = [];
  let vela = null;

  const tmp = new T.Vector3(), tmp2 = new T.Vector3(), tmp3 = new T.Vector3();

  function aplicar(d, J, r) {
    d.v.add(J);
    d.w.addScaledVector(tmp3.crossVectors(r, J), d.invI);
  }

  function velPunto(d, r, salida) {
    return salida.crossVectors(d.w, r).add(d.v);
  }

  function despertar(d) { d.dormido = false; d.quieto = 0; }

  const activo = (c) => !c.dormido && !c.sostenido && !c.giro;

  function paso(h) {
    const contactos = [];
    for (const d of cuerpos) {
      if (!activo(d)) continue;
      d.v.y -= GRAVEDAD * h;
      d.enPiso = false;
      d.correccion = {};
      for (let i = 0; i < d.puntos.length; i++) {
        const P = d.mundo[i].copy(d.puntos[i]).applyQuaternion(d.q).add(d.p);
        // piso y paredes
        for (let k = 0; k < paredes.length; k++) {
          const pl = paredes[k], pen = pl.d - pl.n.dot(P);
          if (pen > -0.004) contactos.push(nuevoContacto(d, P, pl.n, pen, k, 0));
        }
        // el diario
        const o = obstaculo;
        if (o && P.x > o.x0 && P.x < o.x1 && P.z > o.z0 && P.z < o.z1 && P.y < o.alto) {
          const op = [[P.x - o.x0, -1, 0, 0], [o.x1 - P.x, 1, 0, 0], [P.z - o.z0, 0, 0, -1], [o.z1 - P.z, 0, 0, 1], [o.alto - P.y, 0, 1, 0]]
            .reduce((a, b) => (b[0] < a[0] ? b : a));
          contactos.push(nuevoContacto(d, P, new T.Vector3(op[1], op[2], op[3]), op[0], "o" + op.slice(1).join(), 0));
        }
        // la vela (un cilindro que además se puede estar moviendo)
        if (vela) {
          const dx = P.x - vela.p.x, dz = P.z - vela.p.z, d2 = dx * dx + dz * dz;
          if (d2 < RADIO_VELA * RADIO_VELA) {
            const dist = Math.sqrt(d2) || 1e-4;
            const n = new T.Vector3(dx / dist, 0, dz / dist);
            contactos.push(nuevoContacto(d, P, n, RADIO_VELA - dist, "vela", Math.max(0, vela.v.dot(n))));
          }
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

    chocarEntreSi();

    // integrar
    for (const d of cuerpos) {
      if (d.giro) { avanzarGiro(d, h); continue; }
      if (!activo(d)) continue;
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
      if (d.tipo === "moneda") revisarMoneda(d);
      if (d.giro) continue;
      // reposo
      if (d.enPiso && d.v.lengthSq() < 0.04 && d.w.lengthSq() < 0.09) {
        d.quieto += h;
        if (d.quieto > 0.35) { d.dormido = true; d.v.set(0, 0, 0); d.w.set(0, 0, 0); d.lanzada = false; }
      } else d.quieto = 0;
    }
  }

  // Choques entre objetos: dados como esferas; si hay una moneda, en el plano de la mesa
  function chocarEntreSi() {
    for (let a = 0; a < cuerpos.length; a++) for (let b = a + 1; b < cuerpos.length; b++) {
      const A = cuerpos[a], B = cuerpos[b];
      if ((A.dormido && B.dormido) || A.sostenido || B.sostenido) continue;
      const hayMoneda = A.tipo === "moneda" || B.tipo === "moneda";
      let rmin, dist;
      tmp.subVectors(A.p, B.p);
      if (hayMoneda) {
        if (Math.abs(tmp.y) > 1.1) continue;
        tmp.y = 0;
        const hr = (c) => (c.tipo === "moneda" ? c.radio * 0.95 : c.radio * 0.72);
        rmin = hr(A) + hr(B);
      } else rmin = (A.radio + B.radio) * 0.78;
      dist = tmp.length();
      if (dist >= rmin || dist < 1e-6) continue;
      const n = tmp.divideScalar(dist);
      const rel = tmp2.subVectors(A.v, B.v).dot(n);
      const fuerte = rel < -1.5;
      if (fuerte) {
        // una moneda que gira y recibe un golpe vuelve a la física normal
        [A, B].forEach((c) => { if (c.giro) soltarGiro(c); });
      }
      if (rel < 0) {
        const j = (-(1 + 0.35) * rel) / 2;
        A.v.addScaledVector(n, j); B.v.addScaledVector(n, -j);
        if (fuerte) { A.w.add(azar(Math.abs(rel) * 0.6)); B.w.add(azar(Math.abs(rel) * 0.6)); }
      }
      // separarlos (sin levantarlos ni hundirlos); solo se "despiertan" si el choque es de verdad
      const sep = (rmin - dist) / 2;
      tmp2.copy(n).setY(0);
      if (tmp2.lengthSq() > 1e-6) {
        tmp2.normalize();
        const mueveA = !A.dormido && !A.giro, mueveB = !B.dormido && !B.giro;
        if (mueveA) A.p.addScaledVector(tmp2, mueveB ? sep : sep * 2);
        if (mueveB) B.p.addScaledVector(tmp2, mueveA ? -sep : -sep * 2);
      }
      if (fuerte) { despertar(A); despertar(B); }
    }
  }

  function nuevoContacto(d, P, n, pen, clave, vObstaculo) {
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
      // rebote, o si el obstáculo viene hacia el objeto (la vela arrastrada), lo empuja
      sesgo: Math.max(vn0 < -2 ? -REBOTE * vn0 : 0, vObstaculo * 1.05),
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

  /* ---------- el giro de una moneda sobre la mesa ----------
     Si al revolearla cae de canto, gira sobre sí misma como un trompo y se va
     inclinando de a poco. Si cae de otra forma, rebota; y cuando se le acaba el
     impulso, gira tambaleándose cada vez más rápido hasta quedar plana
     (como cuando una moneda "zumba" sobre la mesa). */

  function ejeMoneda(m) { return tmp3.copy(ARRIBA).applyQuaternion(m.q); }

  function revisarMoneda(m) {
    if (!m.lanzada || m.giro || !m.enPiso) return;
    const eje = ejeMoneda(m);
    const beta = Math.acos(Math.min(1, Math.abs(eje.y)));      // 0 = plana, π/2 = de canto
    if (!m.tocoPiso) {
      m.tocoPiso = true;
      if (beta > 1.2) { iniciarGiro(m, beta, true); return; }   // cayó de canto
    }
    if (m.v.length() < 2.2 && m.w.length() < 12) {
      iniciarGiro(m, Math.max(beta, 0.22 + Math.random() * 0.2), false);
    }
  }

  function iniciarGiro(m, beta, largo) {
    const eje = ejeMoneda(m);
    const lado = eje.y >= 0 ? 1 : -1;
    const horiz = Math.hypot(eje.x, eje.z);
    const phi = horiz > 1e-4 ? Math.atan2(eje.z * lado, eje.x * lado) : Math.random() * Math.PI * 2;
    m.giro = {
      t: 0, dur: largo ? 4.5 + Math.random() * 3 : 1.5 + Math.random() * 1.1,
      b0: beta, beta, phi, psi: 0, lado,
      omega0: largo ? 7 + Math.min(m.w.length() * 0.12, 6) : 3.2 + Math.random() * 2,
      deriva: new T.Vector3(m.v.x, 0, m.v.z).multiplyScalar(largo ? 0.35 : 0.5),
    };
    m.v.set(0, 0, 0); m.w.set(0, 0, 0);
    m.dormido = false; m.lanzada = false;
  }

  const qAux = new T.Quaternion(), qGiro = new T.Quaternion(), vEje = new T.Vector3();
  function avanzarGiro(m, h) {
    const g = m.giro;
    g.t += h;
    const s = Math.min(1, g.t / g.dur);
    g.beta = g.b0 * (1 - Math.pow(s, 1.8));
    const omega = Math.min(45, g.omega0 / Math.sqrt(Math.sin(g.beta) + 0.06));
    g.phi += omega * h;
    g.psi -= omega * Math.cos(g.beta) * 0.9 * h;
    // se desliza un poco y frena
    g.deriva.multiplyScalar(1 - 2.2 * h);
    m.p.addScaledVector(g.deriva, h);
    empujarFuera(m.p, m.radio);
    // orientación: eje inclinado g.beta, girando alrededor de la vertical
    vEje.set(Math.sin(g.beta) * Math.cos(g.phi), Math.cos(g.beta), Math.sin(g.beta) * Math.sin(g.phi)).multiplyScalar(g.lado);
    qAux.setFromUnitVectors(ARRIBA, vEje);
    qGiro.setFromAxisAngle(ARRIBA, g.psi);
    m.q.copy(qAux).multiply(qGiro);
    m.p.y = m.radio * Math.sin(g.beta) + (ESPESOR_MONEDA / 2) * Math.cos(g.beta);
    if (s >= 1) {
      m.giro = null;
      m.p.y = ESPESOR_MONEDA / 2;
      m.v.set(0, 0, 0); m.w.set(0, 0, 0);
      m.dormido = true; m.quieto = 0;
    }
  }

  function soltarGiro(m) {
    const g = m.giro;
    const omega = Math.min(45, g.omega0 / Math.sqrt(Math.sin(g.beta) + 0.06));
    m.giro = null;
    m.v.copy(g.deriva);
    m.w.set(0, omega * 0.4, 0).add(azar(3));
    m.lanzada = true; m.tocoPiso = true;
    despertar(m);
  }

  // Mantiene un punto de la mesa fuera del diario, de la vela y dentro de los bordes
  function empujarFuera(p, r, esVela = false) {
    p.x = Math.max(limites.x0, Math.min(limites.x1, p.x));
    p.z = Math.max(limites.z0, Math.min(limites.z1, p.z));
    const o = obstaculo;
    if (o && p.x > o.x0 - r && p.x < o.x1 + r && p.z > o.z0 - r && p.z < o.z1 + r) {
      const op = [[p.x - (o.x0 - r), "x", o.x0 - r], [(o.x1 + r) - p.x, "x", o.x1 + r], [p.z - (o.z0 - r), "z", o.z0 - r], [(o.z1 + r) - p.z, "z", o.z1 + r]]
        .reduce((a, b) => (b[0] < a[0] ? b : a));
      p[op[1]] = op[2];
    }
    if (vela && !esVela) {
      const dx = p.x - vela.p.x, dz = p.z - vela.p.z, min = RADIO_VELA + r, d = Math.hypot(dx, dz);
      if (d < min) { const k = d > 1e-4 ? min / d : 0; p.x = vela.p.x + (d > 1e-4 ? dx * k : min); p.z = vela.p.z + dz * k; }
    }
    return p;
  }

  /* =================================================================
     7. PANTALLA ↔ MESA
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

  function aPantalla(v) {
    const p = v.clone().project(camara);
    return { x: ((p.x + 1) / 2) * innerWidth, y: ((1 - p.y) / 2) * innerHeight };
  }

  let necesitaDibujo = true;

  function ajustarTamano() {
    render.setSize(innerWidth, innerHeight);
    camara.aspect = innerWidth / innerHeight;
    // en pantallas angostas (celular) la cámara se aleja para que los objetos no queden enormes
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
    if (vela) empujarFuera(vela.p, RADIO_VELA - 0.2, true);
    cuerpos.forEach(despertar);
    necesitaDibujo = true;
  }

  // El diario cerrado ocupa lugar en la mesa: los objetos rebotan contra él
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
    const nuevo = { x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), z0: Math.min(a.z, b.z), z1: Math.max(a.z, b.z), alto: 40 };   // "alto": nada queda encima del libro
    const viejo = obstaculo;
    obstaculo = nuevo;
    if (!viejo || Math.abs(viejo.x0 - nuevo.x0) + Math.abs(viejo.z0 - nuevo.z0) + Math.abs(viejo.x1 - nuevo.x1) > 0.2) {
      cuerpos.forEach(despertar);
      if (vela && !vela.sostenida) empujarFuera(vela.p, RADIO_VELA - 0.2, true);
    }
  }

  /* =================================================================
     8. AGARRAR, AGITAR Y TIRAR  (dados y monedas)  ·  ARRASTRAR (la vela)
     ================================================================= */

  let sost = null;   // { dado, objetivo, muestras: [{t, p}], agitacion, eje }
  let tragarClic = false;

  const puedeUsar = () =>
    document.body.classList.contains("con-sesion") &&
    !escena.classList.contains("leyendo") &&
    !document.getElementById("editor")?.classList.contains("visible") &&
    !document.getElementById("token")?.classList.contains("visible");

  function objetoBajo(x, y) {
    ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
    rayo.setFromCamera(ndc, camara);
    const mallas = cuerpos.map((d) => d.malla).concat(vela ? vela.tocables : []);
    const hit = rayo.intersectObjects(mallas, true)[0];
    if (!hit) return null;
    const c = cuerpos.find((d) => d.malla === hit.object);
    return c || "vela";
  }

  addEventListener("pointerdown", (e) => {
    if (sost || !puedeUsar() || (e.pointerType === "mouse" && e.button !== 0)) return;
    const d = objetoBajo(e.clientX, e.clientY);
    if (!d) return;
    e.preventDefault(); e.stopPropagation();
    tragarClic = true;
    escena.classList.add("agarrando");
    if (d === "vela") {
      // la vela se arrastra por la mesa desde el punto donde la agarraste
      const punto = aMesa(e.clientX, e.clientY, 0);
      vela.agarre.copy(vela.p).sub(punto).setY(0);
      vela.objetivo.copy(vela.p);
      vela.sostenida = true;
      sost = { vela: true, id: e.pointerId };
      return;
    }
    if (d.giro) { d.giro = null; }
    d.sostenido = true;
    d.lanzada = false;
    despertar(d);
    const objetivo = limitar(aMesa(e.clientX, e.clientY, ALTURA_MANO));
    sost = { dado: d, objetivo, muestras: [{ t: e.timeStamp, p: objetivo.clone() }], agitacion: 0, eje: azar(1), id: e.pointerId };
  }, true);

  addEventListener("pointermove", (e) => {
    if (sost && e.pointerId === sost.id) {
      if (sost.vela) {
        aMesa(e.clientX, e.clientY, 0, vela.objetivo).add(vela.agarre);
        return;
      }
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
    if (e.pointerType === "mouse") escena.classList.toggle("sobre-dado", !!objetoBajo(e.clientX, e.clientY));
  }, true);

  function soltar(e) {
    if (!sost || (e && e.pointerId !== sost.id)) return;
    if (sost.vela) {
      vela.sostenida = false;
      sost = null;
      escena.classList.remove("agarrando");
      return;
    }
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
    const tirada = rapidez > 4 || agitacion > 2.5;
    if (d.tipo === "moneda") {
      if (tirada) {
        // revoleada: sale volando y girando "de cabeza" (como cuando la tirás con el pulgar)
        d.v.copy(vel.multiplyScalar(0.85).clampLength(0, 30)).add(new T.Vector3(0, 6 + Math.random() * 6, 0));
        if (rapidez < 4) d.v.add(azar(4 + Math.random() * 4).setY(0));
        const dir = rapidez > 0.5 ? vel.clone().normalize() : azar(1).setY(0).normalize();
        const ejeVuelta = new T.Vector3().crossVectors(ARRIBA, dir);
        d.w.copy(ejeVuelta.multiplyScalar(22 + Math.random() * 20)).add(new T.Vector3(0, (Math.random() - 0.5) * 10, 0));
        d.lanzada = true; d.tocoPiso = false;
      } else {
        d.v.copy(vel.multiplyScalar(0.5)).add(new T.Vector3(0, -1, 0));
        d.w.copy(azar(2));
        d.lanzada = false;
      }
    } else if (tirada) {
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

  // que el clic sobre un objeto no abra el diario ni pase la página
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

  /* ---------- la vela: se arrastra, se inclina y la llama reacciona ---------- */

  const anteriorVela = new T.Vector3();
  let tiempoLlama = 0;
  const luzDom = document.getElementById("luz-vela");

  function moverVela(dt) {
    anteriorVela.copy(vela.p);
    if (vela.sostenida) {
      const obj = empujarFuera(vela.objetivo.clone(), RADIO_VELA - 0.2, true);
      vela.p.lerp(obj, Math.min(1, dt * 16));
      empujarFuera(vela.p, RADIO_VELA - 0.2, true);
    }
    const vInst = tmp.subVectors(vela.p, anteriorVela).divideScalar(Math.max(dt, 1e-3));
    vela.v.lerp(vInst, 0.5);
    if (!vela.sostenida && vInst.lengthSq() < 1e-6) vela.v.multiplyScalar(0.5);
    // se levanta un poquito al agarrarla
    vela.alto += ((vela.sostenida ? 0.3 : 0) - vela.alto) * Math.min(1, dt * 10);
    // se inclina hacia atrás al arrastrarla y se balancea al soltarla (resorte)
    const objetivoInclin = tmp2.copy(vela.v).setY(0).multiplyScalar(-0.012).clampLength(0, 0.22);
    vela.inclinVel.addScaledVector(tmp3.subVectors(objetivoInclin, vela.inclin), 110 * dt);
    vela.inclinVel.multiplyScalar(Math.exp(-9 * dt));
    vela.inclin.addScaledVector(vela.inclinVel, dt);
    const ang = vela.inclin.length();
    if (ang > 1e-5) vela.inclinable.quaternion.setFromAxisAngle(tmp3.crossVectors(ARRIBA, vela.inclin).normalize(), ang);
    else vela.inclinable.quaternion.identity();
    vela.grupo.position.set(vela.p.x, vela.alto, vela.p.z);

    // despierta a lo que esté cerca si la vela se mueve
    if (vela.v.lengthSq() > 0.01) {
      cuerpos.forEach((c) => {
        if (Math.hypot(c.p.x - vela.p.x, c.p.z - vela.p.z) < RADIO_VELA + c.radio + 0.6) despertar(c);
      });
    }

    // llama: titila, se agacha y se achica con el movimiento (viento)
    tiempoLlama += dt;
    const t = tiempoLlama, rapidez = vela.v.length();
    const viento = Math.min(0.45, rapidez * 0.025);
    const f = 1 + 0.07 * Math.sin(t * 7.3) + 0.05 * Math.sin(t * 13.1 + 1.3) + 0.04 * Math.sin(t * 23.7 + 0.4) + (Math.random() - 0.5) * 0.06 - viento * 0.6;
    vela.luz.intensity = 1.7 * f;
    vela.luz.position.x = (Math.random() - 0.5) * 0.03 - vela.inclin.x * 2;
    vela.luz.position.z = (Math.random() - 0.5) * 0.03 - vela.inclin.z * 2;
    vela.llama.scale.set(0.3 * (1 + viento * 0.4), 0.8 * f * (1 - viento * 0.25), 1);
    // la llama se dobla para el lado contrario al movimiento (en pantalla)
    const lado = -vela.v.x * 0.03 + vela.inclin.x * 3;
    vela.llama.material.rotation += ((Math.max(-1, Math.min(1, lado)) + Math.sin(t * 5.1) * 0.04) - vela.llama.material.rotation) * Math.min(1, dt * 12);
    vela.halo.material.opacity = 0.42 * f;
    vela.cera.emissiveIntensity = 0.05 + 0.03 * f;

    // resplandor sobre la madera (el escritorio es una imagen 2D: lo iluminamos con CSS)
    if (luzDom) {
      const s = aPantalla(tmp.set(vela.p.x, 0.2, vela.p.z));
      luzDom.style.setProperty("--lx", s.x.toFixed(1) + "px");
      luzDom.style.setProperty("--ly", s.y.toFixed(1) + "px");
      luzDom.style.opacity = (0.82 + 0.18 * f).toFixed(3);
    }
  }

  /* =================================================================
     9. ARMAR LA MESA Y ANIMAR
     ================================================================= */

  function ubicarIniciales() {
    const lugares = [[vela.p.x, vela.p.z, 2.2]];
    const libre = (x, z, r) => {
      if (lugares.some(([a, b, ra]) => Math.hypot(a - x, b - z) < ra + r)) return false;
      const o = obstaculo;
      if (o && x > o.x0 - 1.4 && x < o.x1 + 1.4 && z > o.z0 - 1.4 && z < o.z1 + 1.4) return false;
      return true;
    };
    const buscar = (r, cerca) => {
      let x = 0, z = 0;
      for (let i = 0; i < 400; i++) {
        if (cerca && i < 200) { x = cerca.x + (Math.random() - 0.5) * 3; z = cerca.z + (Math.random() - 0.5) * 3; }
        else { x = limites.x0 + Math.random() * (limites.x1 - limites.x0); z = limites.z0 + Math.random() * (limites.z1 - limites.z0); }
        x = Math.max(limites.x0, Math.min(limites.x1, x)); z = Math.max(limites.z0, Math.min(limites.z1, z));
        if (libre(x, z, r)) break;
      }
      lugares.push([x, z, r]);
      return [x, z];
    };
    // monedas: juntas, arriba a la derecha
    const rincon = aMesa(innerWidth * 0.84, innerHeight * 0.2);
    monedas.forEach((m) => {
      const [x, z] = buscar(0.75, rincon);
      m.p.set(x, 0.4 + Math.random() * 0.4, z);
      m.q.setFromEuler(new T.Euler((Math.random() - 0.5) * 0.3, Math.random() * 6.3, Math.random() < 0.5 ? 0 : Math.PI));
      m.v.set(0, -1, 0); m.w.set(0, 0, 0);
      despertar(m);
    });
    dados.forEach((d) => {
      const [x, z] = buscar(1.2);
      d.p.set(x, 1.5 + Math.random() * 2, z);
      d.q.setFromEuler(new T.Euler(Math.random() * 6.3, Math.random() * 6.3, Math.random() * 6.3));
      d.v.set(0, -2, 0);
      d.w.copy(azar(4));
      despertar(d);
    });
  }

  let anterior = performance.now(), cuadro = 0;
  function bucle(t) {
    requestAnimationFrame(bucle);
    const dt = Math.min(0.033, (t - anterior) / 1000);
    anterior = t;
    if (document.hidden) return;
    // con el diario abierto, la mesa queda de fondo: alcanza con dibujar menos seguido
    cuadro++;
    if (escena.classList.contains("leyendo") && cuadro % 3) return;

    if (sost && !sost.vela) moverSostenido(dt);
    moverVela(dt);
    const activos = sost || cuerpos.some((d) => !d.dormido);
    if (activos) {
      const h = dt / SUBPASOS;
      for (let i = 0; i < SUBPASOS; i++) paso(h);
    }
    cuerpos.forEach((d) => { d.malla.position.copy(d.p); d.malla.quaternion.copy(d.q); });
    render.render(mundo, camara);   // siempre: la llama titila
    necesitaDibujo = false;
  }

  async function iniciar() {
    if (document.fonts) {
      await Promise.race([document.fonts.load(`800 64px "Nunito"`), new Promise((r) => setTimeout(r, 2500))]).catch(() => {});
    }
    ORDEN.forEach((tipo) => { const d = crearDado(tipo); dados.push(d); cuerpos.push(d); mundo.add(d.malla); });
    for (let i = 0; i < 3; i++) { const m = crearMoneda(); monedas.push(m); cuerpos.push(m); mundo.add(m.malla); }
    vela = crearVela();
    ajustarTamano();
    // la vela arranca arriba a la izquierda, como antes
    aMesa(innerWidth * 0.11, innerHeight * 0.24, 0, vela.p);
    empujarFuera(vela.p, RADIO_VELA - 0.2, true);
    ubicarIniciales();
    addEventListener("resize", ajustarTamano);
    // el diario cambia de lugar al entrar/salir/cerrar: revisamos su huella de vez en cuando
    setInterval(actualizarObstaculo, 600);
    requestAnimationFrame(bucle);
    contenedor.classList.add("listo");
    luzDom?.classList.add("listo");
  }

  iniciar();

  const ocupados = () => cuerpos.some((d) => !d.dormido);
  return {
    resultados: () => dados.map((d) => ({ tipo: d.tipo, valor: d.dormido ? resultado(d) : null })),
    // para pruebas
    _interno: { dados, monedas, cuerpos, get vela() { return vela; }, aMesa, aPantalla, camara, render, moverVela,
      // avanza la física sin dibujar (para pruebas): devuelve los segundos simulados hasta que todo se detiene
      simular(max = 15) { const h = 1 / 60 / SUBPASOS; let t = 0; while (t < max && ocupados()) { for (let i = 0; i < SUBPASOS; i++) paso(h); t += 1 / 60; } necesitaDibujo = true; return t; },
      get obstaculo() { return obstaculo; }, get limites() { return limites; } },
  };
})();
