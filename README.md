# Canarias Planner 2026

Planner interactivo para viaje a Islas Canarias.

## Qué incluye

- Mapa interactivo.
- Puntos recomendados y puntos custom.
- Panel de detalle.
- Links web, imágenes, horarios, precios/entradas.
- Itinerario editable.
- Notas por punto.
- Exportación JSON/CSV.
- Guardado local en el navegador mediante `localStorage`.

## Publicar en GitHub Pages

1. Crea un repositorio en GitHub llamado, por ejemplo:

   `canarias-planner`

2. Sube estos archivos al repositorio:

   - `index.html`
   - `README.md`

3. En GitHub entra a:

   `Settings → Pages`

4. En **Build and deployment**, selecciona:

   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/root`

5. Guarda.

6. GitHub publicará una URL similar a:

   `https://TU-USUARIO.github.io/canarias-planner/`

## Importante sobre colaboración

Esta versión guarda cambios en el navegador de cada persona usando `localStorage`.

Eso significa:

- Si Basti agrega puntos, se guardan en el navegador de Basti.
- Si Javi abre el mismo link, verá la base del planner, pero no necesariamente los cambios locales de Basti.
- Para colaboración real entre ambos, la siguiente fase debe conectar el planner a una base compartida como Firebase Firestore o Supabase.

## Siguiente fase recomendada

Convertir el guardado desde:

```js
localStorage.setItem(...)
localStorage.getItem(...)
```

a una base compartida:

```js
Firestore document:
trips/canarias-2026-basti-javi
```

Estructura sugerida:

```json
{
  "itineraryPlan": [],
  "customPoints": [],
  "plannerNotes": {},
  "selectedPlan": [],
  "updatedAt": "",
  "updatedBy": ""
}
```

