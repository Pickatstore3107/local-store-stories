import Image from "next/image";

/**
 * A small hand-drawn person, for pages with nothing to show yet:
 * "lost" reads a map, "saved" carries a bag, "share" takes a photo.
 */
export function Illustration({ name, className = "" }: { name: "lost" | "saved" | "share"; className?: string }) {
  return (
    <Image
      src={`/art/${name}.svg`}
      alt=""
      width={240}
      height={250}
      className={`mx-auto h-auto w-[9.5rem] ${className}`}
    />
  );
}
