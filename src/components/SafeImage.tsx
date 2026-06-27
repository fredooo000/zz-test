"use client";

import * as React from "react";

const RETRY_PROXY = "/api/proxy/image?url=";

interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  proxyFallback?: boolean;
}

export function SafeImage({ src, alt, className, proxyFallback = true, ...props }: SafeImageProps) {
  const [imgSrc, setImgSrc] = React.useState(src || "");
  const [failed, setFailed] = React.useState(false);
  const proxyAttempted = React.useRef(false);
  const prevSrc = React.useRef(src);

  if (src !== prevSrc.current) {
    prevSrc.current = src;
    setImgSrc(src || "");
    setFailed(false);
    proxyAttempted.current = false;
  }

  const handleError = () => {
    if (!proxyAttempted.current && proxyFallback && src && !imgSrc.startsWith(RETRY_PROXY)) {
      proxyAttempted.current = true;
      setImgSrc(`${RETRY_PROXY}${encodeURIComponent(src)}`);
      return;
    }
    setFailed(true);
  };

  if (failed) {
    return null;
  }

  return (
    <img src={imgSrc} alt={alt || ""} className={className} onError={handleError} {...props} />
  );
}
