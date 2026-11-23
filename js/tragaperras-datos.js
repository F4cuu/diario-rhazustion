/* =====================================================================
   TRAGAPERRAS DEL FUERTE — datos
   Acá se cambian los personajes, las recompensas y las probabilidades.
   · archivo / dorado: nombre de la imagen dentro de img/tragaperras/
   · efectos: qué se suma al inventario de la libreta (clave: cantidad)
   · mecanica: comportamientos especiales que maneja js/tragaperras.js
   ===================================================================== */

window.TRAGAPERRAS = {
  carpeta: "img/tragaperras/",

  // Por FILA (cada tirada tiene 2 filas). Tienen que sumar 100.
  probabilidades: { nada: 80, normal: 14, dorado: 5, especial: 1 },

  // Nombre que aparece en la libreta para cada clave de "efectos"
  inventario: {
    herreria:      "🔨 Herrería (nivel)",
    carpinteria:   "🪓 Carpintería (nivel)",
    caballos:      "🐴 Caballos (nivel)",
    oro:           "🪙 Oro",
    plata:         "🥈 Plata",
    barriles:      "🍺 Barriles de cerveza",
    potros:        "🐴 Potros",
    vidaRhaz:      "❤️ Vida temporal de Rhazustión",
    insp:          "🎵 Inspiración bárdica (d8), a un miembro al azar",
    inspGrupo:     "🎵 Inspiración bárdica (d8) para todos",
    vidaGrupo:     "💚 Vida temporal del grupo (próx. batalla)",
    perg12:        "📜 Pergamino de hechizo N1–2",
    perg3:         "📜 Pergamino de hechizo N3",
    inspHeroica:   "🌟 Inspiración heroica (Rhazustión)",
    vidaBalatro:   "🃏 Vida temporal de Balatro",
    recArcana:     "🔮 Recuperación arcana extra",
    kalamethGolpe: "🍺 Kalameth acierta su 1er ataque",
    tiradasExtra:  "🎰 Tiradas extra",
    armaMagica:    "⚡ Arma mágica de Eidan (la define el DM)",
    perdonFinn:    "🥀 Finn le pide perdón a Rhazustión",
  },

  personajes: [
    { nombre: "Eidan", archivo: "Eidan.png", dorado: "GOLDEN Eidan.png",
      normal: { texto: "+0,5 HERRERÍA.", efectos: { herreria: 0.5 } },
      golden: { texto: "+1 HERRERÍA y +20 oro (encargo urgente cumplido).", efectos: { herreria: 1, oro: 20 } } },

    { nombre: "Rhazustión II", archivo: "Rhazustión II.png", dorado: "GOLDEN Rhazustión II.png",
      normal: { texto: "+0,5 HERRERÍA.", efectos: { herreria: 0.5 } },
      golden: { texto: "+1 HERRERÍA y +10 vida temporal para Rhazustión (próxima sesión, hasta el fin del día).", efectos: { herreria: 1, vidaRhaz: 10 } } },

    { nombre: "Cachito", archivo: "Cachito.png", dorado: "GOLDEN Cachito.png",
      normal: { texto: "+0,5 CARPINTERÍA.", efectos: { carpinteria: 0.5 } },
      golden: { texto: "+1 CARPINTERÍA y +20 oro (vendió una carreta).", efectos: { carpinteria: 1, oro: 20 } } },

    { nombre: "Lukas", archivo: "Lukas.png", dorado: "GOLDEN Lukas.png", mecanica: "lukas",
      normal: { texto: "+0,5 CABALLOS y +10% de triple en la próxima tirada.", efectos: { caballos: 0.5 } },
      golden: { texto: "+1 CABALLOS y empareja 2 caballos. El próximo GOLDEN Lukas además da un potro.", efectos: { caballos: 1 } } },

    { nombre: "Fen Yeng", archivo: "Fen Yeng.png", dorado: "GOLDEN Fen Yeng.png",
      normal: { texto: "+50 plata.", efectos: { plata: 50 } },
      golden: { texto: "+50 plata y +20 oro (las aldeas donaron al fuerte).", efectos: { plata: 50, oro: 20 } } },

    { nombre: "Sebastián Tantan", archivo: "Seba.png", dorado: "GOLDEN Seba.png", mecanica: "seba",
      normal: { texto: "+50% de triple en la próxima tirada. Si se repite con el buff, +25% de chance DORADO (acumulable).", efectos: {} },
      golden: { texto: "+50% de triple GOLDEN en la próxima tirada. Si se repite con el buff, +100 oro.", efectos: {} } },

    { nombre: "Baldur", archivo: "Baldur.png", dorado: "GOLDEN Baldur.png",
      normal: { texto: "+25 plata.", efectos: { plata: 25 } },
      golden: { texto: "+50 plata y +10 oro.", efectos: { plata: 50, oro: 10 } } },

    { nombre: "Kalameth", archivo: "Kalameth.png", dorado: "GOLDEN Kalameth.png",
      normal: { texto: "¡Un barril aparece en la bodega! +1 barril.", efectos: { barriles: 1 } },
      golden: { texto: "¡Dos barriles en la bodega! +2 barriles.", efectos: { barriles: 2 } } },

    { nombre: "Balatro Balatrez", archivo: "Balatro.png", dorado: "GOLDEN Balatro.png",
      normal: { texto: "Las compras generales cuestan menos. +25 plata.", efectos: { plata: 25 } },
      golden: { texto: "Consigue ofertas. +20 oro.", efectos: { oro: 20 } } },

    { nombre: "Samira", archivo: "Samira.png", dorado: "GOLDEN Samira.png",
      normal: { texto: "Su cocina rinde más. +1 inspiración bárdica (d8) a un miembro al azar (próxima sesión).", efectos: { insp: 1 } },
      golden: { texto: "Manjar digno de pocos. TODOS +1 inspiración bárdica (d8) y +5 vida temporal en la próxima batalla.", efectos: { inspGrupo: 1, vidaGrupo: 5 } } },

    { nombre: "Kiara", archivo: "Kiara.png", dorado: "GOLDEN Kiara.png",
      normal: { texto: "Volvió de la demolición con pago extra. +1 oro.", efectos: { oro: 1 } },
      golden: { texto: "Día en familia, sube la moral: Rhazustión +1 inspiración heroica, Balatro +10 vida temporal, Kalameth +2 barriles y acierta su 1er ataque, Sebastián y Sylvar +1 recuperación arcana.",
                efectos: { inspHeroica: 1, vidaBalatro: 10, barriles: 2, kalamethGolpe: 1, recArcana: 1 } } },

    // Personajes nuevos: tienen ficha pero todavía no tienen recompensa.
    // Cuando se definan, completá "texto" y "efectos" (o borralos de la lista para sacarlos de la máquina).
    { nombre: "Sharpi",  archivo: "Sharpi.png",  dorado: "GOLDEN Sharpi.png" },
    { nombre: "Blingo",  archivo: "Blingo.png",  dorado: "GOLDEN Blingo.png" },
    { nombre: "Caelan",  archivo: "Caelan.png",  dorado: "GOLDEN Caelan.png" },
    { nombre: "Deli",    archivo: "Deli.png",    dorado: "GOLDEN Deli.png" },
    { nombre: "Elyna",   archivo: "Elyna.png",   dorado: "GOLDEN Elyna.png" },
    { nombre: "Futaba",  archivo: "Futaba.png",  dorado: "GOLDEN Futaba.png" },
    { nombre: "Lia",     archivo: "Lia.png",     dorado: "GOLDEN Lia.png" },
    { nombre: "Nara",    archivo: "Nara.png",    dorado: "GOLDEN Nara.png" },
    { nombre: "Nott",    archivo: "Nott.png",    dorado: "GOLDEN Nott.png" },
    { nombre: "Rachel",  archivo: "Rachel.png",  dorado: "GOLDEN Rachel.png" },
    { nombre: "Rafa",    archivo: "Rafa.png",    dorado: "GOLDEN Rafa.png" },
  ],

  // Se reparten la porción "especial" de la tabla (parte = fracción de ese 1%)
  especiales: [
    { nombre: "SUPER Eidan", archivo: "SUPER Eidan.png", parte: 0.60,
      texto: "Eidan elabora un ARMA MÁGICA. El DM define cuál.", efectos: { armaMagica: 1 } },
    { nombre: "SUPER Sharpi", archivo: "SUPER Sharpi.png", parte: 0.39,
      texto: "Asiste a todas las áreas: +0,5 HERRERÍA, +0,5 CARPINTERÍA, +0,5 CABALLOS y +3 tiradas a la tragaperras.",
      efectos: { herreria: 0.5, carpinteria: 0.5, caballos: 0.5, tiradasExtra: 3 } },
    { nombre: "WITHERED Finn", archivo: "WITHERED Finn.png", parte: 0.01,
      texto: "Ella vuelve a pedirle perdón a Rhazustión II.", efectos: { perdonFinn: 1 } },
  ],
};
