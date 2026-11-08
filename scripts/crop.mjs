import fs from 'fs'; import { PNG } from 'pngjs';
const [f, out, x, y, w, h] = process.argv.slice(2); const src = PNG.sync.read(fs.readFileSync(f));
const dst = new PNG({ width: +w, height: +h });
PNG.bitblt(src, dst, +x, +y, +w, +h, 0, 0); fs.writeFileSync(out, PNG.sync.write(dst));
