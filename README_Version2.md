# Revista Yeison (flipbook en GitHub Pages)

Muestra un PDF como flipbook usando PDF.js (convierte páginas a imágenes en el navegador) y PageFlip (efecto de pasar página). Se aloja en **GitHub Pages**.

## Pasos

1. Sube estos archivos a la raíz del repo:
   - `index.html`
   - `styles.css`
   - `script.js`
   - Tu PDF como `magazine.pdf`
2. Activa GitHub Pages:
   - `Settings` → `Pages`
   - “Source”: `Deploy from a branch`
   - Rama: `main` y carpeta `/ (root)`
3. Abre la URL que te da Pages.

## Actualizar la revista
Reemplaza `magazine.pdf` por el nuevo. El visor usa `?v=timestamp` para evitar caché.

## Notas
- Si Safari antiguo da problemas, cambia `image/webp` por `"image/jpeg"` en `script.js`.
- Mantén el PDF razonable en tamaño para que cargue rápido (ideal < 50–80 MB).