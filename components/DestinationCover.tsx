import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  useDestinationPhoto,
  getCityAccentGradient,
  isImageUrlLoaded,
  markImageUrlLoaded,
} from '../hooks/useDestinationPhoto';

interface DestinationCoverProps {
  city?: string | null;
  className?: string;
  debounceMs?: number;
  crossfade?: boolean;
  children?: React.ReactNode;
  scrimClassName?: string;
}

export const DestinationCover: React.FC<DestinationCoverProps> = React.memo(({
  city,
  className = '',
  debounceMs = 280,
  crossfade = false,
  children,
  scrimClassName = 'bg-gradient-to-t from-black/78 via-black/32 to-black/15',
}) => {
  const { data } = useDestinationPhoto(city, debounceMs);
  const rawUrl = data?.imageUrl || null;

  const imgRef = useRef<HTMLImageElement | null>(null);
  const lastGoodUrlRef = useRef<string | null>(
    rawUrl && isImageUrlLoaded(rawUrl) ? rawUrl : null
  );

  const [loadedUrl, setLoadedUrl] = useState<string | null>(() =>
    rawUrl && isImageUrlLoaded(rawUrl) ? rawUrl : null
  );
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [prevUrl, setPrevUrl] = useState<string | null>(null);

  const imageUrl = rawUrl && rawUrl !== failedUrl ? rawUrl : null;
  const isAlreadyLoaded = Boolean(
    imageUrl && (isImageUrlLoaded(imageUrl) || loadedUrl === imageUrl)
  );

  useEffect(() => {
    setFailedUrl(null);
  }, [rawUrl, city]);

  useLayoutEffect(() => {
    if (!imageUrl) return;
    if (isImageUrlLoaded(imageUrl)) {
      if (crossfade && lastGoodUrlRef.current && lastGoodUrlRef.current !== imageUrl) {
        setPrevUrl(lastGoodUrlRef.current);
      } else {
        setPrevUrl(null);
      }
      lastGoodUrlRef.current = imageUrl;
      setLoadedUrl(imageUrl);
      return;
    }
    if (lastGoodUrlRef.current && lastGoodUrlRef.current !== imageUrl) {
      setPrevUrl(lastGoodUrlRef.current);
    }
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      markImageUrlLoaded(imageUrl);
      lastGoodUrlRef.current = imageUrl;
      setLoadedUrl(imageUrl);
      if (!crossfade) setPrevUrl(null);
    }
  }, [imageUrl, crossfade]);

  const handleLoad = (url: string) => {
    markImageUrlLoaded(url);
    lastGoodUrlRef.current = url;
    setLoadedUrl(url);
    if (!crossfade) {
      setPrevUrl(null);
    } else {
      window.setTimeout(() => {
        setPrevUrl((curr) => (curr === url ? curr : null));
      }, 760);
    }
  };

  const handleError = (url: string) => {
    setFailedUrl(url);
  };

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ background: getCityAccentGradient(city) }}
    >
      {crossfade ? (
        <>
          {prevUrl && prevUrl !== imageUrl && (
            <img
              src={prevUrl}
              alt=""
              aria-hidden="true"
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover opacity-100 pointer-events-none select-none"
            />
          )}
          <AnimatePresence mode="sync" initial={false}>
            {imageUrl && (
              <motion.img
                ref={imgRef}
                key={imageUrl}
                src={imageUrl}
                alt={city || 'Destination'}
                decoding="async"
                initial={{ opacity: 0, scale: 1.035 }}
                animate={{ opacity: isAlreadyLoaded ? 1 : 0, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
                onLoad={() => handleLoad(imageUrl)}
                onError={() => handleError(imageUrl)}
                className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
              />
            )}
          </AnimatePresence>
        </>
      ) : (
        <>
          {prevUrl && prevUrl !== imageUrl && (
            <img
              src={prevUrl}
              alt=""
              aria-hidden="true"
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover opacity-100 pointer-events-none select-none"
            />
          )}
          {imageUrl && (
            <img
              ref={imgRef}
              key={imageUrl}
              src={imageUrl}
              alt={city || 'Destination'}
              decoding="async"
              onLoad={() => handleLoad(imageUrl)}
              onError={() => handleError(imageUrl)}
              className={`absolute inset-0 w-full h-full object-cover pointer-events-none select-none ${
                isAlreadyLoaded
                  ? 'opacity-100'
                  : 'opacity-0 transition-opacity duration-300'
              }`}
            />
          )}
        </>
      )}
      <div className={`absolute inset-0 pointer-events-none ${scrimClassName}`} />
      <div className="relative z-10 h-full w-full">{children}</div>
    </div>
  );
});

DestinationCover.displayName = 'DestinationCover';
