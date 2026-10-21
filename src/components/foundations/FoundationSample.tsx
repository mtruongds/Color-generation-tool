import { Bell, Check, ChevronDown, Search } from 'lucide-react';
import { fontKind } from '../../lib/fonts';
import { type Accent, type ResolvedFoundations, type TypeStyle, fontStack, nestedRadius } from '../../lib/foundations';

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

/**
 * A small product screen drawn only from the generated tokens, so every foundation page
 * shows how type, spacing, radius and shadow work together.
 */
export function FoundationSample({ tokens, accent }: { tokens: ResolvedFoundations; accent: Accent }) {
  const { type: t, space, radius, shadow, mono } = tokens;
  const muted = { color: 'var(--muted-foreground)' };
  /** The menu's items sit one step in from its edge, so their corners follow its curve. */
  const menuInset = space(1);

  return (
    <div
      className="overflow-hidden border bg-background"
      style={{ borderRadius: radius.xl, padding: space(6) }}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]" style={{ gap: space(6) }}>
        {/* Card with form */}
        <div className="border bg-card" style={{ borderRadius: radius.lg, padding: space(6), boxShadow: shadow.sm }}>
          <div className="flex items-start justify-between" style={{ gap: space(3) }}>
            <div>
              <div style={typeCss(t.h4)}>Invite your team</div>
              <p style={{ ...typeCss(t['body-sm']), ...muted, marginTop: space(1) }}>
                Teammates get access to every project in this workspace.
              </p>
            </div>
            <span
              className="shrink-0"
              style={{
                ...typeCss(t.caption),
                fontWeight: 500,
                background: accent.subtle,
                color: accent.text,
                borderRadius: radius.full,
                padding: `${space(0.5)}px ${space(2)}px`,
              }}
            >
              Pro
            </span>
          </div>

          <label className="block" style={{ marginTop: space(5) }}>
            <span style={{ ...typeCss(t['body-sm']), fontWeight: 500 }}>Email</span>
            <div
              className="flex items-center border bg-background"
              style={{ marginTop: space(1.5), borderRadius: radius.md, padding: `${space(2)}px ${space(3)}px`, gap: space(2), boxShadow: shadow.xs }}
            >
              <Search className="size-4 shrink-0" style={muted} />
              <span style={{ ...typeCss(t['body-sm']), ...muted }}>name@company.com</span>
            </div>
          </label>

          <div className="flex flex-wrap" style={{ gap: space(2), marginTop: space(5) }}>
            <button
              type="button"
              tabIndex={-1}
              style={{
                ...typeCss(t['body-sm']),
                fontWeight: 500,
                background: accent.solid,
                color: accent.contrast,
                borderRadius: radius.md,
                padding: `${space(2)}px ${space(4)}px`,
                boxShadow: shadow.xs,
              }}
            >
              Send invites
            </button>
            <button
              type="button"
              tabIndex={-1}
              className="border bg-card"
              style={{ ...typeCss(t['body-sm']), fontWeight: 500, borderRadius: radius.md, padding: `${space(2)}px ${space(4)}px` }}
            >
              Copy link
            </button>
          </div>
        </div>

        {/* Article + floating menu */}
        <div className="relative flex flex-col" style={{ gap: space(4) }}>
          <div>
            <div style={{ ...typeCss(t.caption), color: accent.text, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
              Release notes
            </div>
            <div style={{ ...typeCss(t.h3), marginTop: space(2) }}>Faster sync, quieter alerts</div>
            <p style={{ ...typeCss(t.body), ...muted, marginTop: space(2) }}>
              Changes now reach every device in under a second, and alerts batch together so you see one summary
              instead of ten pings.
            </p>
          </div>

          <div className="border bg-popover" style={{ borderRadius: radius.lg, padding: menuInset, boxShadow: shadow.lg, maxWidth: 260 }}>
            {[
              { label: 'All activity', on: true },
              { label: 'Mentions only', on: false },
              { label: 'Muted', on: false },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between"
                style={{
                  ...typeCss(t['body-sm']),
                  borderRadius: nestedRadius(radius.lg, menuInset),
                  padding: `${space(1.5)}px ${space(2)}px`,
                  background: item.on ? 'var(--accent)' : undefined,
                }}
              >
                <span className="flex items-center" style={{ gap: space(2) }}>
                  <Bell className="size-3.5" style={muted} />
                  {item.label}
                </span>
                {item.on && <Check className="size-3.5" />}
              </div>
            ))}
          </div>

          <div className="flex items-center" style={{ gap: space(2) }}>
            <span
              className="inline-flex items-center border bg-card"
              style={{ ...typeCss(t.caption), borderRadius: radius.full, padding: `${space(1)}px ${space(3)}px`, gap: space(1) }}
            >
              Sort: Newest <ChevronDown className="size-3" />
            </span>
            <code
              className="bg-muted"
              style={{ ...typeCss(t.caption), fontFamily: mono, borderRadius: radius.xs, padding: `${space(0.5)}px ${space(1.5)}px` }}
            >
              v2.4.0
            </code>
          </div>
        </div>
      </div>
    </div>
  );
}
