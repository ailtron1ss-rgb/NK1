/**
 * Sprite sheet helper for 2 rows × 4 columns layout:
 *   1 3 5 7
 *   2 4 6 8
 * User uploads full sheet → we slice into 8 frames.
 */

export interface SpriteFrame {
  index: number; // 1..8
  label: string;
  dataUrl: string;
}

export async function sliceSpriteSheet(
  file: File | Blob,
  labels: string[] = [
    'neutral', 'happy', 'sad', 'angry',
    'embarrassed', 'thinking', 'surprised', 'smug'
  ]
): Promise<SpriteFrame[]> {
  const img = await createImageBitmap(file);
  const cols = 4;
  const rows = 2;
  const fw = Math.floor(img.width / cols);
  const fh = Math.floor(img.height / rows);

  // Mapping according to user layout:
  // 1=(0,0) 3=(1,0) 5=(2,0) 7=(3,0)
  // 2=(0,1) 4=(1,1) 6=(2,1) 8=(3,1)
  const order = [
    { col: 0, row: 0, idx: 1 },
    { col: 0, row: 1, idx: 2 },
    { col: 1, row: 0, idx: 3 },
    { col: 1, row: 1, idx: 4 },
    { col: 2, row: 0, idx: 5 },
    { col: 2, row: 1, idx: 6 },
    { col: 3, row: 0, idx: 7 },
    { col: 3, row: 1, idx: 8 }
  ];

  const canvas = document.createElement('canvas');
  canvas.width = fw;
  canvas.height = fh;
  const ctx = canvas.getContext('2d')!;

  const frames: SpriteFrame[] = [];
  for (let i = 0; i < 8; i++) {
    const { col, row, idx } = order[i];
    ctx.clearRect(0, 0, fw, fh);
    ctx.drawImage(img, col * fw, row * fh, fw, fh, 0, 0, fw, fh);
    const dataUrl = canvas.toDataURL('image/png');
    frames.push({
      index: idx,
      label: labels[i] || `frame_${idx}`,
      dataUrl
    });
  }
  return frames;
}

export function saveFramesToLocalStorage(frames: SpriteFrame[]) {
  localStorage.setItem('kurisu_sprite_frames', JSON.stringify(frames));
}

export function loadFramesFromLocalStorage(): SpriteFrame[] | null {
  try {
    const raw = localStorage.getItem('kurisu_sprite_frames');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
