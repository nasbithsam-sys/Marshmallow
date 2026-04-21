import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useState } from "react";

interface ImageLightboxProps {
  images: string[];
  initialIndex?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ImageLightbox({ images, initialIndex = 0, open, onOpenChange }: ImageLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgErrored, setImgErrored] = useState(false);

  useEffect(() => {
    if (open) setCurrentIndex(initialIndex);
  }, [initialIndex, open]);

  // Reset load/error state when the source for the current slide changes.
  const currentSrc = images[currentIndex];
  useEffect(() => {
    setImgLoaded(false);
    setImgErrored(false);
  }, [currentSrc]);

  const handlePrev = () => setCurrentIndex((i) => (i > 0 ? i - 1 : images.length - 1));
  const handleNext = () => setCurrentIndex((i) => (i < images.length - 1 ? i + 1 : 0));

  if (!images.length) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 bg-black/95 border-none overflow-hidden">
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-3 right-3 z-50 text-white/70 hover:text-white hover:bg-white/10"
          onClick={() => onOpenChange(false)}
        >
          <X className="h-5 w-5" />
        </Button>

        <div className="flex items-center justify-center min-h-[60vh] relative">
          {images.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-2 z-40 text-white/70 hover:text-white hover:bg-white/10"
              onClick={handlePrev}
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
          )}

          {/* Loading spinner overlays until the image is fully loaded */}
          {!imgLoaded && !imgErrored && currentSrc && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/70">
              <div className="w-8 h-8 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              <p className="text-xs">Loading image…</p>
            </div>
          )}

          {currentSrc && !imgErrored && (
            <img
              key={currentSrc}
              src={currentSrc}
              alt={`Image ${currentIndex + 1}`}
              className="max-w-full max-h-[85vh] object-contain"
              style={{ opacity: imgLoaded ? 1 : 0, transition: "opacity 200ms ease" }}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgErrored(true)}
            />
          )}

          {imgErrored && (
            <div className="text-white/60 text-sm px-6 text-center">
              Couldn't load this image. Try closing and reopening.
            </div>
          )}

          {images.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 z-40 text-white/70 hover:text-white hover:bg-white/10"
              onClick={handleNext}
            >
              <ChevronRight className="h-6 w-6" />
            </Button>
          )}
        </div>

        {images.length > 1 && (
          <div className="text-center text-white/50 text-xs pb-3">
            {currentIndex + 1} / {images.length}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
