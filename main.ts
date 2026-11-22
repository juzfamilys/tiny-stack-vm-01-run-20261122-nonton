// Faithful tiny stack VM (ISA.md): 32-bit wrapping ints, 256-value stack,
// 64 return addresses, 256 words of memory, ten traps with their own exit
// codes, and the 1,000,000-step / 65,536-byte limits.
import * as fs from "node:fs";
import * as pt from "node:path";
const IN = process.env.MAKEFUN_INPUT_DIR ?? "/input";
const OU = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
function run(g: Uint8Array, q: Uint8Array): { b: Uint8Array; e: number } {
  const s = new Int32Array(256), c = new Int32Array(64), m = new Int32Array(256);
  const o = new Uint8Array(65536);
  let sp = 0, cp = 0, pc = 0, ip = 0, st = 0, n = 0;
  const end = (e: number) => ({ b: o.slice(0, n), e });
  for (;;) {
    if (st >= 1e6) return end(10);
    if (pc < 0 || pc >= g.length) return end(9);
    const op = g[pc];
    let im = 0, nd = 0, gv = 0;
    if (op === 0) { /* HALT */ }
    else if (op === 1) { im = 1; gv = 1; }
    else if (op === 2) { im = 4; gv = 1; }
    else if (op === 3) nd = 1;
    else if (op === 4) { nd = 1; gv = 2; }
    else if (op === 5) { nd = 2; gv = 2; }
    else if (op === 6) { nd = 2; gv = 3; }
    else if (op === 7) { nd = 3; gv = 3; }
    else if (op === 23 || op === 27) { nd = 1; gv = 1; }
    else if ((op >= 16 && op <= 22) || (op >= 24 && op <= 26) || (op >= 28 && op <= 30) || (op >= 32 && op <= 34)) { nd = 2; gv = 1; }
    else if (op === 48) im = 2;
    else if (op === 49 || op === 50) { im = 2; nd = 1; }
    else if (op === 51) im = 2;
    else if (op === 52) { /* RET */ }
    else if (op === 64) { nd = 1; gv = 1; }
    else if (op === 65) nd = 2;
    else if (op === 80 || op === 81 || op === 83) nd = 1;
    else if (op === 82) gv = 1;
    else return end(5);
    if (pc + im >= g.length) return end(9);
    st++;
    const nx = pc + 1 + im;
    if (sp < nd) return end(2);
    if (sp - nd + gv > 256) return end(3);
    pc = nx;
    if (op === 0) return end(0);
    if (op === 1) s[sp++] = (g[nx - 1] << 24) >> 24;
    else if (op === 2) s[sp++] = g[nx - 4] | (g[nx - 3] << 8) | (g[nx - 2] << 16) | (g[nx - 1] << 24);
    else if (op === 3) sp--;
    else if (op === 4) { s[sp] = s[sp - 1]; sp++; }
    else if (op === 5) { const t = s[sp - 1]; s[sp - 1] = s[sp - 2]; s[sp - 2] = t; }
    else if (op === 6) { s[sp] = s[sp - 2]; sp++; }
    else if (op === 7) { const t = s[sp - 3]; s[sp - 3] = s[sp - 2]; s[sp - 2] = s[sp - 1]; s[sp - 1] = t; }
    else if (op === 23) s[sp - 1] = -s[sp - 1] | 0;
    else if (op === 27) s[sp - 1] = ~s[sp - 1];
    else if (op >= 16 && op <= 34 && op !== 23 && op !== 27) {
      const b = s[sp - 1], a = s[sp - 2];
      let r = 0;
      if (op === 16) r = (a + b) | 0;
      else if (op === 17) r = (a - b) | 0;
      else if (op === 18) r = Math.imul(a, b);
      else if (op === 19) { if (!b) return end(4); r = a === -2147483648 && b === -1 ? a : (a / b) | 0; }
      else if (op === 20) { if (!b) return end(4); r = b === -1 ? 0 : (a % b) | 0; }
      else if (op === 21) { if (!b) return end(4); r = Math.floor((a >>> 0) / (b >>> 0)) | 0; }
      else if (op === 22) { if (!b) return end(4); r = ((a >>> 0) % (b >>> 0)) | 0; }
      else if (op === 24) r = a & b;
      else if (op === 25) r = a | b;
      else if (op === 26) r = a ^ b;
      else if (op === 28) r = a << (b & 31);
      else if (op === 29) r = a >> (b & 31);
      else if (op === 30) r = (a >>> (b & 31)) | 0;
      else if (op === 32) r = a === b ? 1 : 0;
      else if (op === 33) r = a < b ? 1 : 0;
      else r = (a >>> 0) < (b >>> 0) ? 1 : 0;
      sp -= 2;
      s[sp++] = r;
    }
    else if (op >= 48 && op <= 50) {
      const rel = ((g[nx - 2] | (g[nx - 1] << 8)) << 16) >> 16;
      if (op === 48 || (op === 49 ? s[--sp] === 0 : s[--sp] !== 0)) pc = nx + rel;
    }
    else if (op === 51) {
      if (cp === 64) return end(7);
      c[cp++] = nx;
      pc = g[nx - 2] | (g[nx - 1] << 8);
    }
    else if (op === 52) {
      if (!cp) return end(8);
      pc = c[--cp];
    }
    else if (op === 64) {
      const a = s[sp - 1];
      if (a < 0 || a >= 256) return end(6);
      s[sp - 1] = m[a];
    }
    else if (op === 65) {
      const a = s[sp - 1], v = s[sp - 2];
      if (a < 0 || a >= 256) return end(6);
      sp -= 2;
      m[a] = v;
    }
    else if (op === 80) {
      const t = String(s[sp - 1]);
      if (n + t.length > 65536) return end(11);
      for (let i = 0; i < t.length; i++) o[n++] = t.charCodeAt(i);
      sp--;
    }
    else if (op === 81) {
      if (n + 1 > 65536) return end(11);
      o[n++] = s[--sp] & 255;
    }
    else if (op === 82) s[sp++] = ip < q.length ? q[ip++] : -1;
    else return end(s[--sp] & 255);
  }
}
for (const id of fs.readdirSync(IN).sort()) {
  const r = run(new Uint8Array(fs.readFileSync(pt.join(IN, id, "program.bin"))), new Uint8Array(fs.readFileSync(pt.join(IN, id, "input.bin"))));
  fs.mkdirSync(pt.join(OU, id), { recursive: true });
  fs.writeFileSync(pt.join(OU, id, "stdout.bin"), r.b);
  fs.writeFileSync(pt.join(OU, id, "exit.txt"), r.e + "\n");
}
