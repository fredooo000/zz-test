"use client";

import * as React from "react";

interface ImageFallbackProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackSrc?: string;
}

export function ImageFallback({
  src,
  alt,
  fallbackSrc = "/placeholder.svg",
  className,
  ...props
}: ImageFallbackProps) {
  const [imgSrc, setImgSrc] = React.useState(src || "");
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    setImgSrc(src || "");
    setFailed(false);
  }, [src]);

  const handleError = () => {
    if (!failed && imgSrc !== fallbackSrc) {
      setImgSrc(fallbackSrc);
    } else {
      setFailed(true);
    }
  };

  if (failed) {
    return (
      <div className={`flex items-center justify-center bg-surface/50 ${className || ""}`}>
        <span className="text-[10px] text-slate-500">{alt || "No image"}</span>
      </div>
    );
  }

  return (
    <img src={imgSrc} alt={alt || ""} className={className} onError={handleError} {...props} />
  );
}
