declare module '@react-native/normalize-colors' {
  /** Parses any CSS/React Native color into a 0xRRGGBBAA integer, or `null` when invalid. */
  function normalizeColor(color: unknown): number | null;
  export default normalizeColor;
}

declare module 'jpeg-js' {
  export interface DecodedJpeg {
    width: number;
    height: number;
    data: Uint8Array;
  }
  export function decode(
    data: Uint8Array,
    options?: { useTArray?: boolean; formatAsRGBA?: boolean },
  ): DecodedJpeg;
  export function encode(
    image: { width: number; height: number; data: Uint8Array },
    quality?: number,
  ): { width: number; height: number; data: Uint8Array };
  const jpeg: { decode: typeof decode; encode: typeof encode };
  export default jpeg;
}
