import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { AccessibilityInfo, View } from "react-native";

// The prototype's `Walker`, as the website's src/components/pas/walker.tsx:
// a sprite sheet of hand-drawn frames shown one at a time. With reduced
// motion it shows one still frame.

export type SpriteSpec = {
  src: number;
  cols: number;
  n: number;
  fw: number;
  fh: number;
  fps: number;
  loop: boolean;
  still: number;
  hold?: number;
  label: string;
};

export const WALK: SpriteSpec = { src: require("../../assets/walker-sprite.webp"), cols: 8, n: 48, fw: 390, fh: 613, fps: 17, loop: true, still: 6, label: "A woman walking with a shopping bag" };
export const SAVE: SpriteSpec = { src: require("../../assets/saved-sprite.webp"), cols: 12, n: 84, fw: 300, fh: 474, fps: 11.3, loop: false, still: 83, hold: 2200, label: "A woman tucking a note into her bag" };

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced).catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => sub.remove();
  }, []);
  return reduced;
}

/** The sprite, `width` wide, centred on the middle of its box. */
export function Walker({ width, spec = WALK }: { width: number; spec?: SpriteSpec }) {
  const still = useReducedMotion();
  const [frame, setFrame] = useState(spec.still);
  const height = Math.round((width * spec.fh) / spec.fw);
  const rows = Math.ceil(spec.n / spec.cols);

  useEffect(() => {
    if (still) {
      setFrame(spec.still);
      return;
    }
    const start = Date.now();
    const cycle = (spec.n / spec.fps) * 1000 + (spec.hold ?? 0);
    const timer = setInterval(() => {
      const t = spec.loop ? Date.now() - start : (Date.now() - start) % cycle;
      const f = spec.loop
        ? Math.floor((t / 1000) * spec.fps) % spec.n
        : Math.min(spec.n - 1, Math.floor((t / 1000) * spec.fps));
      setFrame(f);
    }, 1000 / spec.fps);
    return () => clearInterval(timer);
  }, [spec, still]);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={spec.label}
      pointerEvents="none"
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width,
        height,
        marginLeft: -width / 2,
        marginTop: -height / 2,
        overflow: "hidden",
      }}
    >
      <Image
        source={spec.src}
        contentFit="fill"
        style={{
          position: "absolute",
          width: width * spec.cols,
          height: height * rows,
          left: -(frame % spec.cols) * width,
          top: -Math.floor(frame / spec.cols) * height,
        }}
      />
    </View>
  );
}
