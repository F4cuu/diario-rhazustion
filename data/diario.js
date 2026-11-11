/* =====================================================================
   CONTENIDO DEL DIARIO
   ---------------------------------------------------------------------
   Este es el único archivo que tenés que tocar para escribir.

   - Cada entrada es un bloque { titulo, fecha, texto }.
   - El texto va entre comillas invertidas ` ` (así podés usar varias líneas).
   - Dejá una línea en blanco entre párrafos.
   - *texto* = cursiva      **texto** = negrita
   - No te preocupes por el largo: el diario reparte el texto en páginas solo.
   - Si el texto lleva una comilla invertida, escribila como \`
   ===================================================================== */

window.DIARIO = {
  titulo: "Diario de Rhazustión",

  personaje: {
    nombre: "Rhazustión Bonbon Kiary Valtheris Smith II",
    raza: "Elfo de los bosques",
    clase: "Guerrero · Caballero Arcano",
    nivel: 7,
    edad: "168 años",
    altura: "1,86 m",
    atributos: { FUE: 22, DES: 14, CON: 18, INT: 12, SAB: 13, CAR: 12 },
    nota: "Comencé este viaje con 167 inviernos. Cumplí uno más en el camino."
  },

  entradas: [
    {
      titulo: "Antes de todo",
      fecha: "Memorias previas a la campaña",
      texto: `
Si estás leyendo esto, o sos yo, o encontraste mi diario tirado en algún lugar en el que no debería estar. En el segundo caso, te pido que lo devuelvas. En el primero, hola, Rhazustión del futuro: espero que sigas teniendo las dos manos.

Acá voy a escribir lo que pasó antes de que todo esto empezara: de dónde vengo, quiénes me criaron y por qué un elfo de los bosques terminó cargando una espada y aprendiendo magia arcana al mismo tiempo.

*Pegá acá tus recuerdos de antes de la campaña.*
`
    },
    {
      titulo: "Sesión 1",
      fecha: "Fecha de la sesión",
      texto: `
Hoy conocí a quienes serían mis compañeros de viaje. No voy a mentir: mi primera impresión de algunos no fue la mejor. Pero un guerrero aprende a no juzgar una espada por la vaina.

*Pegá acá lo que escribiste de esta sesión.*
`
    },
    {
      titulo: "Sesión 2",
      fecha: "Fecha de la sesión",
      texto: `
El camino hacia el norte fue más largo de lo que nos habían prometido. El mapa que compramos en el último pueblo resultó ser, en el mejor de los casos, una sugerencia; en el peor, una broma de mal gusto de algún cartógrafo con resentimiento. Aun así, avanzamos.

Por la mañana el bosque estaba en silencio. Los que crecimos entre árboles sabemos que el silencio nunca es buena señal: un bosque que no canta es un bosque que está escuchando. Le dije a los demás que bajaran la voz, y por una vez me hicieron caso.

No pasó mucho hasta que encontramos las huellas. Eran grandes, demasiado grandes para un lobo y demasiado ordenadas para un oso. Me agaché a estudiarlas mientras el resto discutía si convenía seguirlas o rodearlas. Ganó la curiosidad, como casi siempre gana en este grupo.

Las huellas nos llevaron hasta un claro donde el pasto estaba aplastado en círculo, como si algo enorme hubiera dormido ahí. En el centro había restos de una fogata todavía tibia. Alguien, o algo, se había ido hacía muy poco.

Esa noche hice la primera guardia. Afilé la espada y repasé en voz baja las palabras de los conjuros que aprendí, porque la magia arcana es como un músculo: si no la ejercitás, se te olvida justo cuando más la necesitás. A lo lejos, entre los árboles, me pareció ver dos luces que me miraban. Cuando parpadeé, ya no estaban.

Al amanecer no le conté a nadie lo de las luces. Tal vez fue el cansancio. Tal vez no. Lo anoto acá para acordarme, por si vuelve a pasar.

*(Entrada de prueba larga: sirve para ver cómo el diario reparte el texto en varias páginas solo.)*
`
    }
  ]
};
