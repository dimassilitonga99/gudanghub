import assert from 'node:assert/strict';
import fs from 'node:fs';

const component = fs.readFileSync('src/components/ui/vignette-bloom.tsx', 'utf8');
const shell = fs.readFileSync('src/components/layout/AppShell.tsx', 'utf8');
const styles = fs.readFileSync('src/index.css', 'utf8');

assert.match(component, /assets\.21st\.dev\/ascii-recipes\/videos\/user_2nElBLvklOKlAURm6W1PTu6yYFh\/ce2c1d6e-d203-4519-8bd5-8fabf950352b\.mp4/);
assert.match(component, /assets\.21st\.dev\/ascii-recipes\/thumbnails\/user_2nElBLvklOKlAURm6W1PTu6yYFh\/0920f00b-2ec1-4cb9-87ec-5ba0d33c1d32\.webp/);
assert.match(component, /autoPlay/);
assert.match(component, /loop/);
assert.match(component, /muted/);
assert.match(component, /playsInline/);
assert.match(component, /Vignette Bloom — animated ASCII art/);
assert.match(shell, /pointer-events-none/);
assert.match(shell, /relative z-10/);
assert.match(shell, /Dashboard/);
assert.match(shell, /Keluar/);
assert.match(styles, /prefers-reduced-motion: reduce/);
assert.match(styles, /vignette-bloom__video/);
assert.match(styles, /vignette-bloom__poster/);

console.log('ASCII sidebar source checks passed');
