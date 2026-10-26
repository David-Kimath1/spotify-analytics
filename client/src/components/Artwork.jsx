import React, { useEffect, useState } from 'react';
import { Music2, Users2 } from 'lucide-react';

export default function Artwork({ src, className, alt = '', artist = false }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [src]);

  if (src && !failed) {
    return <img className={className} src={src} alt={alt} onError={() => setFailed(true)} />;
  }

  const Icon = artist ? Users2 : Music2;
  return <span className={`${className} data-art-empty${artist ? ' artist-image' : ''}`} aria-hidden="true"><Icon size={16} /></span>;
}
