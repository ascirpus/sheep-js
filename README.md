# Sheep.js

Javascript implementation of sheep.exe ((c) Tatsutoshi Nomura)

## Usage

Drop the built bundle into any page — it's fully self-contained (sprite sheet included):

```html
<script src="build/sheep.min.js"></script>
<script>
    new Sheep({ floors: "window, .floor" });
</script>
```

### Options

- `floors` — CSS selector for elements the sheep can walk on (default: `"window"`)
- `imagePath` — custom sprite sheet URL (default: inlined PNG)

## Building

```sh
npm install
npm run build
```

Produces `build/sheep.min.js` (~67 KB, sprite sheet inlined as base64).

## Development

Load `demo.html` directly in a browser to run from the unminified source files.
