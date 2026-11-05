import { fontKind } from '../../lib/fonts';
import { type TypeStyle, fontStack } from '../../lib/foundations';

/** Inline style for a generated text style. */
export function typeCss(s: TypeStyle, mobile = false): React.CSSProperties {
  return {
    fontFamily: fontStack(s.family, fontKind(s.family)),
    fontSize: mobile ? s.mobileSize : s.size,
    lineHeight: `${mobile ? s.mobileLineHeight : s.lineHeight}px`,
    fontWeight: s.weight,
    letterSpacing: s.tracking ? `${s.tracking}em` : undefined,
  };
}
