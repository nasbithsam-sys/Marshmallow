const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.78;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load image"));
    };

    image.src = objectUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

export async function optimizeImageForUpload(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  if (file.type === "image/gif") return file;

  try {
    const image = await loadImage(file);
    const longestSide = Math.max(image.width, image.height);
    const scale = longestSide > MAX_DIMENSION ? MAX_DIMENSION / longestSide : 1;

    const targetWidth = Math.max(1, Math.round(image.width * scale));
    const targetHeight = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const context = canvas.getContext("2d");
    if (!context) return file;

    context.drawImage(image, 0, 0, targetWidth, targetHeight);

    const outputType = file.type === "image/png" ? "image/jpeg" : file.type;
    const blob = await canvasToBlob(
      canvas,
      outputType,
      outputType === "image/jpeg" || outputType === "image/webp" ? JPEG_QUALITY : undefined,
    );

    if (!blob || blob.size >= file.size) return file;

    const nextName = outputType === "image/jpeg" ? file.name.replace(/\.[^.]+$/, ".jpg") : file.name;
    return new File([blob], nextName, {
      type: outputType,
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  }
}
