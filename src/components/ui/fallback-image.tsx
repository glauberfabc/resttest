"use client";

import { useState, useEffect } from "react";
import Image, { ImageProps } from "next/image";

interface FallbackImageProps extends ImageProps {
  fallbackSrc?: string;
}

export function FallbackImage({
  src,
  fallbackSrc = "https://picsum.photos/seed/placeholder/64/64",
  alt,
  ...props
}: FallbackImageProps) {
  const [error, setError] = useState(false);
  const [imgSrc, setImgSrc] = useState(src);

  useEffect(() => {
    setImgSrc(src);
    setError(false);
  }, [src]);

  return (
    <Image
      {...props}
      src={error ? fallbackSrc : imgSrc}
      alt={alt}
      onError={() => {
        if (!error) {
          setError(true);
        }
      }}
    />
  );
}
