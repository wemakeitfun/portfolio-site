"use client";

import Image from "next/image";
import { mediaUrl, type MediaRow } from "@/lib/media";
import VideoPlayer from "./VideoPlayer";

/**
 * Fills its parent (which must be `relative` and have a size or aspect ratio).
 * Videos get a custom control bar (play/pause, volume) and wait for a click,
 * unless the video is set to autoplay (muted, looping, while on screen).
 */
export default function ProjectMedia({
  media,
  sizes,
  priority = false,
  className = "",
  fit = "cover",
}: {
  media: MediaRow;
  sizes: string;
  priority?: boolean;
  className?: string;
  /** "contain" letterboxes instead of cropping — for a gallery item capped by max-height. */
  fit?: "cover" | "contain";
}) {
  const src = mediaUrl(media.path);
  const fitClass = fit === "contain" ? "object-contain" : "object-cover";

  if (media.kind === "video") {
    return <VideoPlayer src={src} className={className} fit={fit} autoplay={media.autoplay} />;
  }
  return (
    <Image
      src={src}
      alt={media.alt ?? ""}
      fill
      sizes={sizes}
      priority={priority}
      className={`absolute inset-0 h-full w-full ${fitClass} ${className}`}
    />
  );
}
