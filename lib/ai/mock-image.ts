import { Buffer } from "node:buffer";
import { deflateSync } from "node:zlib";
import type { Scene } from "@/lib/schemas";

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const PALETTES = [
  {
    base: [247, 248, 244],
    ink: [24, 29, 36],
    accent: [226, 84, 74],
    secondary: [34, 150, 139]
  },
  {
    base: [239, 247, 247],
    ink: [28, 38, 44],
    accent: [246, 176, 67],
    secondary: [87, 113, 196]
  },
  {
    base: [244, 245, 250],
    ink: [22, 25, 35],
    accent: [43, 159, 115],
    secondary: [211, 91, 126]
  }
] as const;

function hashText(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function makeCrcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
}

const CRC_TABLE = makeCrcTable();

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (let index = 0; index < buffer.length; index += 1) {
    crc = CRC_TABLE[(crc ^ buffer[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer) {
  const typeBuffer = Buffer.from(type);
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32BE(data.length, 0);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([lengthBuffer, typeBuffer, data, crcBuffer]);
}

function mix(a: number, b: number, amount: number) {
  return Math.round(a + (b - a) * amount);
}

function inSoftBlock(x: number, y: number, width: number, height: number, seed: number) {
  const blockX = width * (0.16 + ((seed % 17) / 100));
  const blockY = height * (0.22 + (((seed >>> 5) % 19) / 100));
  const blockW = width * 0.66;
  const blockH = height * 0.42;
  return x >= blockX && x <= blockX + blockW && y >= blockY && y <= blockY + blockH;
}

export function createMockScenePng(scene: Scene, selectedTopic: string) {
  const width = 512;
  const height = 896;
  const seed = hashText(`${selectedTopic}-${scene.index}-${scene.imagePrompt}`);
  const palette = PALETTES[seed % PALETTES.length];
  const raw = Buffer.alloc((width * 4 + 1) * height);

  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;

    for (let x = 0; x < width; x += 1) {
      const offset = rowStart + 1 + x * 4;
      const diagonal = (x / width + y / height) / 2;
      const wave =
        (Math.sin((x + (seed % 89)) / 37) + Math.cos((y + (seed % 61)) / 49)) *
        0.08;
      const block = inSoftBlock(x, y, width, height, seed);
      const stripe =
        Math.abs((x - width * 0.5) * 0.28 + (y - height * 0.56)) <
        16 + (scene.index % 3) * 12;
      const dot =
        Math.hypot(
          x - width * (0.25 + ((seed >>> 9) % 18) / 100),
          y - height * (0.66 + ((seed >>> 13) % 12) / 100)
        ) <
        width * 0.18;

      const baseAmount = Math.max(0, Math.min(1, diagonal + wave));
      let red = mix(palette.base[0], palette.secondary[0], baseAmount * 0.48);
      let green = mix(palette.base[1], palette.secondary[1], baseAmount * 0.48);
      let blue = mix(palette.base[2], palette.secondary[2], baseAmount * 0.48);

      if (block) {
        red = mix(red, palette.ink[0], 0.18);
        green = mix(green, palette.ink[1], 0.18);
        blue = mix(blue, palette.ink[2], 0.18);
      }

      if (stripe || dot) {
        red = mix(red, palette.accent[0], stripe ? 0.72 : 0.42);
        green = mix(green, palette.accent[1], stripe ? 0.72 : 0.42);
        blue = mix(blue, palette.accent[2], stripe ? 0.72 : 0.42);
      }

      raw[offset] = red;
      raw[offset + 1] = green;
      raw[offset + 2] = blue;
      raw[offset + 3] = 255;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    PNG_SIGNATURE,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}
