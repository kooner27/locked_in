# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

# locked_in

## Importing Flashcards

Locked In supports CSV decks and JSON decks.

CSV rows should be:

```csv
term,definition
"cell membrane","Controls what enters and leaves the cell"
```

JSON decks should use a top-level `cards` array. Each card needs `front` and
`back`. A side can be a plain string, an image object, or an array of mixed
blocks:

```json
{
  "cards": [
    {
      "front": "What is the powerhouse of the cell?",
      "back": "Mitochondria"
    },
    {
      "front": [
        { "type": "text", "text": "Name this structure:" },
        {
          "type": "image",
          "src": "images/cell-diagram.png",
          "alt": "Cell diagram",
          "width": "70%"
        }
      ],
      "back": "Mitochondrion"
    }
  ]
}
```

For local images, select the JSON file together with the image files, or select a
folder containing both. Relative paths are resolved from the JSON file location.
Remote image URLs and `data:image/...` sources also work.

Image `width` is optional. If omitted, the app uses the default fit-to-card
sizing. Width can be a CSS value like `"70%"` or `"320px"`, or a number like
`320`.

`state.json` is reserved for exporting and importing study progress, not deck
content.
