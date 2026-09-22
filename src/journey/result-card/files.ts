const resultCardWidth = 1080;
const resultCardHeight = 1440;

export async function renderResultCardPng(svg: string): Promise<Blob> {
  if (!svg.startsWith('<svg') || !svg.includes('viewBox="0 0 1080 1440"')) {
    throw new Error('이미지를 만들지 못했습니다.');
  }
  let sourceUrl: string | null = null;
  try {
    const source = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    sourceUrl = URL.createObjectURL(source);
    const image = await loadImage(sourceUrl);
    const canvas = document.createElement('canvas');
    canvas.width = resultCardWidth;
    canvas.height = resultCardHeight;
    const context = canvas.getContext('2d');
    if (context === null) throw new Error('canvas');
    context.drawImage(image, 0, 0, resultCardWidth, resultCardHeight);
    const png = await canvasToPng(canvas);
    if (png.type !== 'image/png' || png.size === 0) throw new Error('png');
    return png;
  } catch {
    throw new Error('이미지를 만들지 못했습니다.');
  } finally {
    if (sourceUrl !== null) {
      try { URL.revokeObjectURL(sourceUrl); } catch { /* Browser URL cleanup is best effort. */ }
    }
  }
}

export function downloadResultCard(blob: Blob, filename: string): boolean {
  let url: string | null = null;
  let anchor: HTMLAnchorElement | null = null;
  try {
    if (blob.type !== 'image/png' || blob.size === 0) return false;
    url = URL.createObjectURL(blob);
    anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    return true;
  } catch {
    return false;
  } finally {
    anchor?.remove();
    if (url !== null) {
      const resultUrl = url;
      window.setTimeout(() => {
        try { URL.revokeObjectURL(resultUrl); } catch { /* Download has already been requested. */ }
      }, 0);
    }
  }
}

function loadImage(sourceUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('decode'));
    image.src = sourceUrl;
  });
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob === null) reject(new Error('encode'));
      else resolve(blob);
    }, 'image/png');
  });
}
