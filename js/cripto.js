/* =====================================================================
   CRIPTO
   El diario se guarda cifrado (AES-GCM de 256 bits).
   - Hay UNA clave maestra que cifra el contenido.
   - Esa clave maestra se guarda "envuelta" una vez por cada usuario,
     cifrada con una clave derivada de su contraseña (PBKDF2, 600.000 vueltas).
   Así cada cuenta tiene su propia contraseña, y cambiar una no afecta a las otras.
   Las contraseñas nunca se guardan en ningún lado.
   ===================================================================== */

const Cripto = (() => {
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const VUELTAS = 600000;

  const b64 = (buf) => {
    const b = new Uint8Array(buf); let s = "";
    for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    return btoa(s);
  };
  const desdeB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

  // "Huevañez", "huevanez" y "HUEVAÑEZ " son lo mismo (y "Rhazustión" = "rhazustion")
  const normalizar = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

  async function claveDeContrasena(contrasena, sal) {
    const base = await crypto.subtle.importKey("raw", enc.encode(normalizar(contrasena)), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: sal, iterations: VUELTAS, hash: "SHA-256" },
      base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }

  async function cifrar(clave, bytes) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const datos = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, clave, bytes);
    return { iv: b64(iv), datos: b64(datos) };
  }

  async function descifrar(clave, { iv, datos }) {
    return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: desdeB64(iv) }, clave, desdeB64(datos)));
  }

  const importarMaestra = (raw) => crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);

  function buscarUsuario(archivo, nombre) {
    return archivo.usuarios.find((u) => normalizar(u.nombre) === normalizar(nombre));
  }

  // Abre el diario con usuario y contraseña. Errores: "usuario" o "clave".
  async function entrar(archivo, nombre, contrasena) {
    const u = buscarUsuario(archivo, nombre);
    if (!u) throw new Error("usuario");
    let raw;
    try {
      const kek = await claveDeContrasena(contrasena, desdeB64(u.sal));
      raw = await descifrar(kek, u.llave);
    } catch { throw new Error("clave"); }
    const diario = await abrirConMaestra(archivo, raw);
    return { raw, usuario: u, diario };
  }

  async function abrirConMaestra(archivo, raw) {
    const k = await importarMaestra(raw);
    return JSON.parse(dec.decode(await descifrar(k, archivo.contenido)));
  }

  // Envuelve la clave maestra con la contraseña de un usuario
  async function envolver(raw, contrasena) {
    const sal = crypto.getRandomValues(new Uint8Array(16));
    const kek = await claveDeContrasena(contrasena, sal);
    return { sal: b64(sal), llave: await cifrar(kek, raw) };
  }

  /* Arma el archivo cifrado completo.
     usuarios: [{ nombre, rol, contrasena? , sal?, llave? }]
     - con "contrasena": se envuelve de nuevo (usuario nuevo o clave cambiada)
     - sin ella: se conserva su llave anterior */
  async function armarArchivo(raw, diario, usuarios) {
    const lista = [];
    for (const u of usuarios) {
      const base = { nombre: u.nombre.trim(), rol: u.rol };
      if (u.contrasena) Object.assign(base, await envolver(raw, u.contrasena));
      else Object.assign(base, { sal: u.sal, llave: u.llave });
      lista.push(base);
    }
    const k = await importarMaestra(raw);
    return {
      version: 1,
      usuarios: lista,
      contenido: await cifrar(k, enc.encode(JSON.stringify(diario))),
    };
  }

  function serializar(archivo) {
    return "/* Diario de Rhazustión: contenido CIFRADO.\n" +
           "   No se edita a mano: se modifica desde la página, con la cuenta de editor. */\n" +
           "window.DIARIO_CIFRADO = " + JSON.stringify(archivo, null, 1) + ";\n";
  }

  // Lee el archivo cifrado a partir de su texto (para traer la última versión de GitHub)
  function leerTexto(texto) {
    return JSON.parse(texto.slice(texto.indexOf("{"), texto.lastIndexOf("}") + 1));
  }

  const nuevaMaestra = () => crypto.getRandomValues(new Uint8Array(32));

  return { entrar, abrirConMaestra, armarArchivo, serializar, leerTexto, nuevaMaestra, normalizar, b64, desdeB64 };
})();

if (typeof module !== "undefined") module.exports = Cripto;
