# Diario de Rhazustión

Una página web con un escritorio y el diario en el centro. Para leerlo hay que entrar
con una cuenta. Después hacés doble clic en el diario, se acerca y se lee página por página.
Sobre la mesa hay un dado de cada tipo, monedas para revolear y una vela que se puede mover.

**Link:** https://f4cuu.github.io/diario-rhazustion/

## Cuentas
| Cuenta | Permiso |
|---|---|
| Huevañez | Leer y editar |
| Catta, Pingas, Balatro | Solo leer |

Al escribir el nombre y la clave no importan las mayúsculas ni las tildes.
Las claves se cambian desde la página: **✎ Editar → Cuentas** (solo una cuenta editora puede hacerlo).

## Cómo está protegido
El diario se guarda **cifrado** en `data/diario.enc.js` (AES-256). Aunque el repositorio
sea público, sin una clave válida el contenido no se puede leer. Las claves no están
guardadas en ningún lado.

La protección depende de que las claves no sean fáciles de adivinar: una clave corta
o conocida (como el nombre del personaje) se puede descubrir probando.

## Cómo escribir (cuenta Huevañez)
1. Entrá a la página con tu cuenta y tocá **✎ Editar** (arriba a la derecha).
2. Elegí una entrada o tocá **+ Nueva entrada**. En el texto, una línea en blanco empieza un párrafo nuevo;
   `*cursiva*` y `**negrita**`.
3. **Ver en el diario** te muestra cómo queda sin publicar.
4. **Guardar y publicar** (o `Ctrl+S`). La primera vez en cada navegador te pide un token de GitHub
   (la página explica cómo crearlo). La página pública se actualiza en 1–2 minutos.

El texto del diario **ya no se edita en VS Code**: el archivo está cifrado.
Si cambiás el código (estilos, diseño), primero hacé **Sync / Pull** en VS Code para
bajar lo que se guardó desde la web y no pisarlo.

## Controles del diario
| Acción | Teclado | Mouse / celular |
|---|---|---|
| Abrir el diario | — | doble clic / doble toque sobre el diario |
| Mover el diario sobre la mesa | — | mantener apretado y arrastrar |
| Página siguiente | → · Espacio · AvPág | clic en la mitad derecha / deslizar a la izquierda |
| Página anterior | ← · RePág | clic en la mitad izquierda / deslizar a la derecha |
| Ir al principio / final | Inicio / Fin | — |
| Ir a una entrada | — | clic en el índice |
| Cerrar el diario | Esc | botón «Cerrar» |

## Dados
Sobre el escritorio hay un d4, d6, d8, d10, d% (decenas), d12, d20 y un d2 (moneda),
en blanco nacarado con números grafito.

- **Mantené apretado** un dado para levantarlo.
- **Agitalo** (movelo de un lado a otro): gira en la mano.
- **Soltalo** mientras lo agitás o lanzándolo con un movimiento: el dado rueda y queda con un número arriba.
- Si lo movés despacio y lo soltás quieto, solo se apoya.

Funciona con mouse y con el dedo en el celular. Los dados rebotan contra los bordes y contra el diario.

## Vela y monedas
- **La vela** se arrastra por la mesa (mantener apretado): la luz y las sombras de todo cambian con
  ella, la llama se dobla con el movimiento y la vela se balancea al soltarla. Los dados y las monedas
  chocan contra ella. **Un clic la apaga** (sale un hilo de humo y la mesa queda a oscuras); otro clic la enciende.
- **El diario** es un libro 3D sobre la mesa: lo ilumina la vela, proyecta sombra y se pueden apoyar
  dados encima (viajan con él si lo movés). Mantener apretado lo levanta y lo arrastra, y empuja lo que
  encuentra. Con doble clic se abre: el libro de páginas sale desde ese mismo lugar y vuelve ahí al cerrarlo.
- **Las monedas** se agarran y se revolean igual que los dados. Si caen de canto, giran sobre sí mismas
  como un trompo; si no, rebotan y terminan girando y tambaleándose sobre la mesa hasta quedar planas.

## Archivos
- `index.html`: la estructura de la página.
- `css/estilos.css`: el escritorio y el libro. `css/cuentas.css`: login y editor.
- `js/cripto.js`: cifrado y descifrado.
- `js/paginador.js`: reparte el texto en páginas.
- `js/libro.js`: el libro 3D, animaciones y controles.
- `js/editor.js`: el editor y el guardado en GitHub.
- `js/app.js`: login y sesión.
- `js/config.js`: usuario y repositorio de GitHub.
- `js/dados.js`: la mesa en 3D (dados, monedas y vela) y su física.
- `vendor/three.min.js`: three.js r149 (licencia MIT, en `vendor/three-LICENSE.txt`).
- `data/diario.enc.js`: **el diario cifrado** (no se toca a mano).
