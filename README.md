# Diario de Rhazustión

Una página web con un escritorio y el diario en el centro. Presionás cualquier tecla,
el diario se acerca y se lee página por página.

## Cómo abrirlo
- **Rápido:** doble clic en `index.html`.
- **Con VS Code (recomendado):** abrí la carpeta en VS Code, instalá la extensión
  **Live Server** (VS Code te la sugiere sola) y hacé clic en **Go Live** abajo a la derecha.
  Cada vez que guardás un archivo, la página se recarga sola.

## Cómo escribir
Todo el texto está en **`data/diario.js`**. Cada entrada es:

```js
{
  titulo: "Sesión 3",
  fecha: "14 de marzo",
  texto: `
Primer párrafo...

Segundo párrafo (línea en blanco = párrafo nuevo).
*cursiva*  **negrita**
`
},
```

No hace falta cortar el texto en páginas: el diario lo reparte solo
y arma el índice con los números de página.

## Controles
| Acción | Teclado | Mouse / celular |
|---|---|---|
| Abrir el diario | cualquier tecla | clic / tocar |
| Página siguiente | → · Espacio · AvPág | clic en la mitad derecha / deslizar a la izquierda |
| Página anterior | ← · RePág | clic en la mitad izquierda / deslizar a la derecha |
| Ir al principio / final | Inicio / Fin | — |
| Ir a una entrada | — | clic en el índice |
| Cerrar el diario | Esc | botón "Cerrar" |

## Archivos
- `index.html`: la estructura de la página (escritorio, vela, dado, mapa).
- `css/estilos.css`: el aspecto (colores arriba de todo, en `:root`).
- `js/paginador.js`: reparte el texto en páginas.
- `js/libro.js`: arma el libro 3D y maneja animaciones y controles.
- `data/diario.js`: **tu contenido**.
