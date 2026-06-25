import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

export default function PhotoCarousel({ photos }) {
  const [current, setCurrent] = useState(0);

  if (!photos || photos.length === 0) {
    return (
      <div className="aspect-video bg-muted rounded-xl flex items-center justify-center text-muted-foreground">
        No photos
      </div>
    );
  }

  const prev = () => setCurrent(c => (c === 0 ? photos.length - 1 : c - 1));
  const next = () => setCurrent(c => (c === photos.length - 1 ? 0 : c + 1));

  return (
    <div className="relative rounded-xl overflow-hidden bg-black">
      <div className="aspect-video relative">
        <AnimatePresence mode="wait">
          <motion.img
            key={current}
            src={photos[current]}
            alt=""
            className="w-full h-full object-contain"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
        </AnimatePresence>
      </div>

      {photos.length > 1 && (
        <>
          <Button
            variant="ghost"
            size="icon"
            onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full h-8 w-8"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full h-8 w-8"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {photos.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === current ? 'bg-white' : 'bg-white/40'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}