import { useState } from 'react';
import {
  AlertCircle,
  Bold,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Copy,
  CreditCard,
  Info,
  Italic,
  LogOut,
  Mail,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  Underline,
  User,
  X,
} from 'lucide-react';
import { cn } from '../ui/utils';
import { nestedRadius } from '../../lib/foundations';
import type { PreviewKit } from './FoundationPreview';

/** Core shadcn/ui components, redrawn from the generated tokens and the picked scales. */
const COMPONENTS = [
  'Button',
  'Badge',
  'Input',
  'Textarea',
  'Checkbox',
  'Radio group',
  'Switch',
  'Select',
  'Tabs',
  'Toggle group',
  'Card',
  'Alert',
  'Avatar',
  'Progress',
  'Slider',
  'Dropdown menu',
  'Tooltip',
  'Dialog',
  'Table',
  'Accordion',
  'Breadcrumb',
  'Pagination',
  'Skeleton',
  'Toast',
] as const;

const FAQ = [
  { q: 'Is it accessible?', a: 'Yes. It follows the WAI-ARIA design pattern and works with a keyboard.' },
  { q: 'Is it styled?', a: 'Every color, size and curve here comes from your foundation tokens.' },
  { q: 'Is it animated?', a: 'Content opens and closes with a short transition you can turn off.' },
];

const INVOICES = [
  { id: 'INV001', status: 'Paid', method: 'Credit card', amount: '$250.00' },
  { id: 'INV002', status: 'Pending', method: 'PayPal', amount: '$150.00' },
  { id: 'INV003', status: 'Unpaid', method: 'Bank transfer', amount: '$350.00' },
];

/**
 * A page of shadcn/ui's core components, each drawn only from the foundation tokens so a
 * change to type, spacing, radius, shadow or color shows up on every component at once.
 */
export function ComponentGallery({ kit }: { kit: PreviewKit }) {
  const { tokens, mobile, columns, gutter, container, Text, btn, badge, steps, mark, pad, mergeStyle, MUTED, HAIRLINE } = kit;
  const { type: t, space, radius, shadow, mono } = tokens;
  const typeOf = kit.typeCss;

  const [agree, setAgree] = useState(true);
  const [plan, setPlan] = useState('pro');
  const [airplane, setAirplane] = useState(false);
  const [notify, setNotify] = useState(true);
  const [tab, setTab] = useState('account');
  const [marks, setMarks] = useState<string[]>(['bold']);
  const [volume, setVolume] = useState(60);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [pageNo, setPageNo] = useState(2);
  const [alertShown, setAlertShown] = useState(true);

  /** A field's shell: border g7 → g8, a8 with an a5 ring on focus. */
  const field = cn(
    'border border-(--g7) bg-(--bg) transition-[border-color,box-shadow] hover:border-(--g8)',
    'focus-within:border-(--a8) focus-within:shadow-[0_0_0_3px_var(--a5)]',
  );
  const fieldSteps = steps('field: background · border: g7 → g8 · focus: a8 + ring a5');
  const fieldPad = `${space(2)}px ${space(3)}px`;
  const label = { ...typeOf(t['body-sm']), fontWeight: 500 } as React.CSSProperties;
  const floating: React.CSSProperties = {
    background: 'var(--g-surface)',
    border: HAIRLINE,
    borderRadius: radius.md,
    boxShadow: shadow.md,
    padding: space(1),
  };
  /** Rows inside a floating menu sit one step in, so their corners follow its curve. */
  const itemRadius = nestedRadius(radius.md, space(1));

  const Check16 = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) => (
    <span
      role="checkbox"
      aria-checked={on}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === ' ' && (e.preventDefault(), onClick())}
      className="flex cursor-pointer items-start outline-none"
      style={{ gap: space(2.5) }}
      {...steps(on ? 'checkbox: a9 · check: contrast' : 'checkbox: border g7')}
    >
      <span
        className={cn('mt-0.5 flex shrink-0 items-center justify-center transition-colors', on ? 'bg-(--a9) text-(--a-contrast)' : 'shadow-[inset_0_0_0_1px_var(--g7)]')}
        style={{ width: 16, height: 16, borderRadius: Math.min(radius.xs, 4) }}
      >
        {on && <Check className="size-3" strokeWidth={3} />}
      </span>
      {children}
    </span>
  );

  const Toggle = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) => (
    <span
      role="switch"
      aria-checked={on}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === ' ' && (e.preventDefault(), onClick())}
      className="flex cursor-pointer items-center justify-between outline-none"
      style={{ gap: space(3) }}
      {...steps(on ? 'switch: on a9 · thumb: white' : 'switch: off g6')}
    >
      {children}
      <span className={cn('relative shrink-0 transition-colors', on ? 'bg-(--a9)' : 'bg-(--g6)')} style={{ width: 32, height: 18, borderRadius: radius.full }}>
        <span className="absolute bg-white transition-[left]" style={{ top: 2, left: on ? 16 : 2, width: 14, height: 14, borderRadius: radius.full, boxShadow: shadow.xs }} />
      </span>
    </span>
  );

  /** One component's tile: its name, then the component working. */
  const Showcase = ({ name, first = false, children }: { name: (typeof COMPONENTS)[number]; first?: boolean; children: React.ReactNode }) => (
    <section
      id={`component-${name.toLowerCase().replace(/\s+/g, '-')}`}
      className="inline-block w-full"
      style={{ breakInside: 'avoid', marginBottom: gutter, background: 'var(--bg)', border: HAIRLINE, borderRadius: radius.lg }}
      {...steps('tile: background · border: g6')}
      {...(first ? mark('radius', 'radius-lg') : {})}
    >
      <div className="flex items-center justify-between" style={{ padding: `${space(2.5)}px ${space(4)}px`, borderBottom: HAIRLINE }}>
        <Text s="body-sm" as="h2" tagged={first} style={{ fontWeight: 600 }}>
          {name}
        </Text>
        <Text s="caption" tagged={false} style={{ color: MUTED, fontFamily: mono }}>
          {`<${name.replace(/\s+/g, '')} />`}
        </Text>
      </div>
      <div {...mergeStyle(first ? pad(4) : {}, { padding: space(4) })}>{children}</div>
    </section>
  );

  return (
    <main style={{ ...container, paddingBlock: space(mobile ? 8 : 12) }}>
      <Text s="caption" style={{ color: 'var(--a11)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Component library
      </Text>
      <Text s="h1" as="h1" style={{ marginTop: space(2) }}>
        Components
      </Text>
      <Text s="body-lg" as="p" style={{ marginTop: space(2), color: MUTED, maxWidth: 640 }}>
        {COMPONENTS.length} core components after shadcn/ui, styled only with your tokens. Change a foundation and every
        one of them follows.
      </Text>

      <div style={{ marginTop: space(mobile ? 6 : 10), columnCount: columns, columnGap: gutter }}>
        <Showcase name="Button" first>
          <div className="flex flex-wrap items-center" style={{ gap: space(2) }}>
            <span {...btn('solid')} {...mark('radius', 'radius-md')}>
              Default
            </span>
            <span {...btn('gray')}>Secondary</span>
            <span {...btn('neutral')}>Outline</span>
            <span {...btn('ghost')}>Ghost</span>
            <span {...btn('soft')}>Soft</span>
            <span {...btn('disabled')}>Disabled</span>
          </div>
          <div className="flex flex-wrap items-center" style={{ gap: space(2), marginTop: space(3) }}>
            <span {...btn('solid', 'sm')}>Small</span>
            <span {...btn('solid', 'lg')}>
              <Mail className="size-4" /> Large with icon
            </span>
            <span {...btn('neutral', 'icon')} aria-label="Add">
              <Plus className="size-4" />
            </span>
            <Text s="body-sm" tagged={false} className="cursor-pointer underline-offset-4 hover:underline" style={{ color: 'var(--a11)', fontWeight: 500 }} {...steps('link: a11')}>
              Link
            </Text>
          </div>
        </Showcase>

        <Showcase name="Badge">
          <div className="flex flex-wrap items-center" style={{ gap: space(2) }}>
            <span {...badge('solid')} {...mark('radius', 'radius-full')}>
              Default
            </span>
            <span {...badge('soft')}>Soft</span>
            <span {...badge('surface')}>Surface</span>
            <span {...badge('outline')}>Outline</span>
            <span {...badge('gray')}>Secondary</span>
            <span {...badge('soft')}>
              <Check className="size-3" style={{ marginRight: space(1) }} /> Verified
            </span>
          </div>
        </Showcase>

        <Showcase name="Input">
          <label className="block">
            <span style={label}>Email</span>
            <div className={cn('flex items-center', field)} style={{ marginTop: space(1.5), padding: fieldPad, gap: space(2), borderRadius: radius.md }} {...fieldSteps} {...mark('radius', 'radius-md')}>
              <Mail className="size-4 shrink-0" style={{ color: 'var(--g10)' }} />
              <input placeholder="name@company.com" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-(--g10)" style={typeOf(t['body-sm'])} />
            </div>
            <Text s="caption" as="p" tagged={false} style={{ marginTop: space(1.5), color: MUTED }}>
              We'll never share your email.
            </Text>
          </label>
          <div className="flex" style={{ gap: space(2), marginTop: space(4) }}>
            <div className={cn('flex min-w-0 flex-1 items-center', field)} style={{ padding: fieldPad, gap: space(2), borderRadius: radius.md }} {...fieldSteps}>
              <Search className="size-4 shrink-0" style={{ color: 'var(--g10)' }} />
              <input placeholder="Search" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-(--g10)" style={typeOf(t['body-sm'])} />
            </div>
            <span {...btn('solid')}>Subscribe</span>
          </div>
          <div
            className="border border-(--g6) bg-(--g3)"
            style={{ ...typeOf(t['body-sm']), color: 'var(--g9)', marginTop: space(3), padding: fieldPad, borderRadius: radius.md, cursor: 'not-allowed' }}
            {...steps('disabled: g3 · border: g6 · text: g9')}
          >
            Disabled
          </div>
        </Showcase>

        <Showcase name="Textarea">
          <label className="block">
            <span style={label}>Your message</span>
            <div className={field} style={{ marginTop: space(1.5), borderRadius: radius.md }} {...fieldSteps}>
              <textarea
                rows={3}
                placeholder="Type your message here."
                className="block w-full resize-none bg-transparent outline-none placeholder:text-(--g10)"
                style={{ ...typeOf(t['body-sm']), padding: fieldPad }}
              />
            </div>
          </label>
          <div className="flex justify-end" style={{ marginTop: space(3) }}>
            <span {...btn('solid', 'sm')}>Send message</span>
          </div>
        </Showcase>

        <Showcase name="Checkbox">
          <div className="flex flex-col" style={{ gap: space(3) }}>
            <Check16 on={agree} onClick={() => setAgree((v) => !v)}>
              <span>
                <Text s="body-sm" tagged={false} style={{ fontWeight: 500 }}>
                  Accept terms and conditions
                </Text>
                <Text s="caption" tagged={false} style={{ color: MUTED, marginTop: space(0.5) }}>
                  You agree to our Terms of Service and Privacy Policy.
                </Text>
              </span>
            </Check16>
            <span className="flex items-center opacity-50" style={{ gap: space(2.5), cursor: 'not-allowed' }} {...steps('disabled: border g7 at 50%')}>
              <span className="shrink-0 shadow-[inset_0_0_0_1px_var(--g7)]" style={{ width: 16, height: 16, borderRadius: Math.min(radius.xs, 4) }} />
              <Text s="body-sm" tagged={false}>
                Disabled option
              </Text>
            </span>
          </div>
        </Showcase>

        <Showcase name="Radio group">
          <div role="radiogroup" className="flex flex-col" style={{ gap: space(2) }}>
            {[
              { v: 'free', l: 'Free', d: 'Up to 3 projects' },
              { v: 'pro', l: 'Pro', d: 'Unlimited projects, $12/mo' },
              { v: 'team', l: 'Team', d: 'Shared workspaces, $40/mo' },
            ].map((o) => {
              const on = plan === o.v;
              return (
                <span
                  key={o.v}
                  role="radio"
                  aria-checked={on}
                  onClick={() => setPlan(o.v)}
                  className={cn('flex cursor-pointer items-center transition-[box-shadow,background-color]', on ? 'bg-(--a2) shadow-[inset_0_0_0_1px_var(--a8)]' : 'shadow-[inset_0_0_0_1px_var(--g6)] hover:bg-(--g2)')}
                  style={{ gap: space(3), padding: `${space(2.5)}px ${space(3)}px`, borderRadius: radius.md }}
                  {...steps(on ? 'selected: a2 · border a8 · dot a9' : 'option: border g6 · hover g2')}
                >
                  <span
                    className={cn('grid shrink-0 place-items-center', on ? 'shadow-[inset_0_0_0_1px_var(--a9)]' : 'shadow-[inset_0_0_0_1px_var(--g7)]')}
                    style={{ width: 16, height: 16, borderRadius: radius.full }}
                  >
                    {on && <span className="bg-(--a9)" style={{ width: 8, height: 8, borderRadius: radius.full }} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <Text s="body-sm" tagged={false} style={{ fontWeight: 500 }}>
                      {o.l}
                    </Text>
                    <Text s="caption" tagged={false} style={{ color: MUTED }}>
                      {o.d}
                    </Text>
                  </span>
                </span>
              );
            })}
          </div>
        </Showcase>

        <Showcase name="Switch">
          <div className="flex flex-col" style={{ gap: space(3) }}>
            <Toggle on={airplane} onClick={() => setAirplane((v) => !v)}>
              <Text s="body-sm" tagged={false} style={{ fontWeight: 500 }}>
                Airplane mode
              </Text>
            </Toggle>
            <div style={{ height: 1, background: 'var(--g6)' }} />
            <Toggle on={notify} onClick={() => setNotify((v) => !v)}>
              <span>
                <Text s="body-sm" tagged={false} style={{ fontWeight: 500 }}>
                  Marketing emails
                </Text>
                <Text s="caption" tagged={false} style={{ color: MUTED }}>
                  Product news and offers.
                </Text>
              </span>
            </Toggle>
          </div>
        </Showcase>

        <Showcase name="Select">
          <span style={label}>Timezone</span>
          <div
            className="flex cursor-pointer items-center justify-between border border-(--a8) bg-(--bg) shadow-[0_0_0_3px_var(--a5)]"
            style={{ ...typeOf(t['body-sm']), marginTop: space(1.5), padding: fieldPad, borderRadius: radius.md }}
            {...steps('open trigger: border a8 + ring a5')}
          >
            Asia/Ho Chi Minh <ChevronsUpDown className="size-4" style={{ color: MUTED }} />
          </div>
          <div style={{ ...floating, marginTop: space(1) }} {...steps('popover: gray surface · border g6 · shadow-md')} {...mark('shadow', 'shadow-md')}>
            <Text s="caption" tagged={false} style={{ color: MUTED, fontWeight: 500, padding: `${space(1.5)}px ${space(2)}px` }}>
              Asia
            </Text>
            {['Asia/Bangkok', 'Asia/Ho Chi Minh', 'Asia/Singapore'].map((z) => {
              const on = z === 'Asia/Ho Chi Minh';
              return (
                <div
                  key={z}
                  className={cn('flex cursor-pointer items-center justify-between transition-colors hover:bg-(--a4) hover:text-(--a12)', on && 'bg-(--a3)')}
                  style={{ ...typeOf(t['body-sm']), padding: `${space(1.5)}px ${space(2)}px`, borderRadius: itemRadius }}
                  {...steps(on ? 'selected: a3 · hover a4' : 'item: hover a4 · text a12')}
                >
                  {z}
                  {on && <Check className="size-4" style={{ color: 'var(--a11)' }} />}
                </div>
              );
            })}
          </div>
        </Showcase>

        <Showcase name="Tabs">
          <div
            role="tablist"
            className="inline-flex bg-(--g3)"
            style={{ padding: 3, borderRadius: radius.md, gap: 2 }}
            {...steps('list: g3 · active: background · text g12 / g11')}
          >
            {['account', 'password'].map((k) => (
              <span
                key={k}
                role="tab"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={cn('cursor-pointer capitalize transition-[background-color,box-shadow,color]', tab === k ? 'bg-(--bg) text-(--g12)' : 'text-(--g11) hover:text-(--g12)')}
                style={{
                  ...typeOf(t['body-sm']),
                  fontWeight: 500,
                  padding: `${space(1)}px ${space(3)}px`,
                  borderRadius: nestedRadius(radius.md, 3),
                  boxShadow: tab === k ? shadow.xs : undefined,
                }}
              >
                {k}
              </span>
            ))}
          </div>
          <div style={{ marginTop: space(3) }}>
            <Text s="body-sm" as="p" tagged={false} style={{ color: MUTED }}>
              {tab === 'account' ? 'Make changes to your account here. Click save when you are done.' : 'Change your password here. After saving, you will be logged out.'}
            </Text>
            <div className={cn('flex items-center', field)} style={{ marginTop: space(3), padding: fieldPad, borderRadius: radius.md }} {...fieldSteps}>
              <input
                key={tab}
                type={tab === 'password' ? 'password' : 'text'}
                defaultValue={tab === 'account' ? 'Pedro Duarte' : 'hunter22'}
                className="min-w-0 flex-1 bg-transparent outline-none"
                style={typeOf(t['body-sm'])}
              />
            </div>
          </div>
        </Showcase>

        <Showcase name="Toggle group">
          <div className="inline-flex" style={{ gap: space(1) }} role="group" aria-label="Text formatting">
            {[
              { k: 'bold', icon: Bold },
              { k: 'italic', icon: Italic },
              { k: 'underline', icon: Underline },
            ].map(({ k, icon: Icon }) => {
              const on = marks.includes(k);
              return (
                <span
                  key={k}
                  role="button"
                  aria-pressed={on}
                  aria-label={k}
                  onClick={() => setMarks((m) => (on ? m.filter((x) => x !== k) : [...m, k]))}
                  className={cn('grid cursor-pointer place-items-center transition-colors', on ? 'bg-(--a4) text-(--a12)' : 'text-(--g11) hover:bg-(--g4) hover:text-(--g12)')}
                  style={{ width: space(9), height: space(9), borderRadius: radius.md }}
                  {...steps(on ? 'pressed: a4 · text a12' : 'off: text g11 · hover g4')}
                >
                  <Icon className="size-4" />
                </span>
              );
            })}
          </div>
        </Showcase>

        <Showcase name="Card">
          <div style={{ border: HAIRLINE, borderRadius: radius.lg, background: 'var(--g-surface)', boxShadow: shadow.sm }} {...steps('card: gray surface · border g6 · shadow-sm')} {...mark('shadow', 'shadow-sm')}>
            <div style={{ padding: space(5) }}>
              <Text s="h4" as="h3" tagged={false}>
                Create project
              </Text>
              <Text s="body-sm" as="p" tagged={false} style={{ color: MUTED, marginTop: space(1) }}>
                Deploy your new project in one click.
              </Text>
              <span style={{ ...label, display: 'block', marginTop: space(4) }}>Name</span>
              <div className={field} style={{ marginTop: space(1.5), padding: fieldPad, borderRadius: radius.md }} {...fieldSteps}>
                <input placeholder="Name of your project" className="w-full bg-transparent outline-none placeholder:text-(--g10)" style={typeOf(t['body-sm'])} />
              </div>
            </div>
            <div className="flex justify-between" style={{ padding: `0 ${space(5)}px ${space(5)}px` }}>
              <span {...btn('neutral')}>Cancel</span>
              <span {...btn('solid')}>Deploy</span>
            </div>
          </div>
        </Showcase>

        <Showcase name="Alert">
          <div className="flex flex-col" style={{ gap: space(3) }}>
            <div
              className="flex bg-(--a2) shadow-[inset_0_0_0_1px_var(--a6)]"
              style={{ gap: space(3), padding: space(3.5), borderRadius: radius.md }}
              {...steps('alert: a2 · border a6 · icon a11')}
            >
              <Info className="mt-0.5 size-4 shrink-0" style={{ color: 'var(--a11)' }} />
              <span>
                <Text s="body-sm" tagged={false} style={{ fontWeight: 600, color: 'var(--a12)' }}>
                  Heads up!
                </Text>
                <Text s="body-sm" tagged={false} style={{ color: 'var(--a11)' }}>
                  You can add components to your app using the CLI.
                </Text>
              </span>
            </div>
            {alertShown && (
              <div className="flex" style={{ gap: space(3), padding: space(3.5), borderRadius: radius.md, border: HAIRLINE }} {...steps('alert: background · border g6')}>
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span className="min-w-0 flex-1">
                  <Text s="body-sm" tagged={false} style={{ fontWeight: 600 }}>
                    Your session expires soon
                  </Text>
                  <Text s="body-sm" tagged={false} style={{ color: MUTED }}>
                    Save your work to keep it.
                  </Text>
                </span>
                <X className="size-4 shrink-0 cursor-pointer" style={{ color: MUTED }} onClick={() => setAlertShown(false)} aria-label="Dismiss" />
              </div>
            )}
          </div>
        </Showcase>

        <Showcase name="Avatar">
          <div className="flex flex-wrap items-center" style={{ gap: space(5) }}>
            <span className="flex" {...steps('avatar: a3–a5 · text a11 · ring background')}>
              {['LN', 'KH', 'MA', 'HA'].map((n, i) => (
                <span
                  key={n}
                  className="grid place-items-center"
                  style={{
                    ...typeOf(t.caption),
                    fontWeight: 600,
                    width: space(9),
                    height: space(9),
                    marginLeft: i ? -space(2) : 0,
                    borderRadius: radius.full,
                    background: `var(--a${3 + (i % 3)})`,
                    color: 'var(--a11)',
                    boxShadow: '0 0 0 2px var(--bg)',
                  }}
                >
                  {n}
                </span>
              ))}
            </span>
            <span className="flex items-center" style={{ gap: space(2.5) }}>
              <span className="grid place-items-center bg-(--g4)" style={{ width: space(10), height: space(10), borderRadius: radius.full }} {...steps('fallback: g4 · icon g11')}>
                <User className="size-5" style={{ color: MUTED }} />
              </span>
              <span>
                <Text s="body-sm" tagged={false} style={{ fontWeight: 500 }}>
                  Linh Nguyen
                </Text>
                <Text s="caption" tagged={false} style={{ color: MUTED }}>
                  linh@northwind.co
                </Text>
              </span>
            </span>
          </div>
        </Showcase>

        <Showcase name="Progress">
          {[
            { l: 'Uploading assets', v: 66 },
            { l: 'Storage used', v: 24 },
          ].map(({ l, v }, i) => (
            <div key={l} style={{ marginTop: i ? space(4) : 0 }}>
              <div className="flex justify-between">
                <Text s="body-sm" tagged={false} style={{ fontWeight: 500 }}>
                  {l}
                </Text>
                <Text s="body-sm" tagged={false} className="tabular-nums" style={{ color: MUTED }}>
                  {v}%
                </Text>
              </div>
              <div className="overflow-hidden bg-(--a4)" style={{ height: space(2), borderRadius: radius.full, marginTop: space(2) }} {...steps('track: a4 · fill: a9')}>
                <div className="h-full bg-(--a9)" style={{ width: `${v}%`, borderRadius: radius.full }} />
              </div>
            </div>
          ))}
        </Showcase>

        <Showcase name="Slider">
          <div className="flex justify-between">
            <Text s="body-sm" tagged={false} style={{ fontWeight: 500 }}>
              Volume
            </Text>
            <Text s="body-sm" tagged={false} className="tabular-nums" style={{ color: MUTED }}>
              {volume}
            </Text>
          </div>
          <div className="relative flex items-center" style={{ height: 20, marginTop: space(2) }} {...steps('track: g5 · range: a9 · thumb: background + border a9')}>
            <div className="absolute inset-x-0 bg-(--g5)" style={{ height: 6, borderRadius: radius.full }} />
            <div className="absolute left-0 bg-(--a9)" style={{ height: 6, width: `${volume}%`, borderRadius: radius.full }} />
            <div
              className="pointer-events-none absolute bg-(--bg) shadow-[inset_0_0_0_2px_var(--a9)]"
              style={{ left: `calc(${volume}% - 9px)`, width: 18, height: 18, borderRadius: radius.full, boxShadow: `inset 0 0 0 2px var(--a9), ${shadow.sm}` }}
            />
            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              aria-label="Volume"
              className="absolute inset-0 w-full cursor-pointer opacity-0"
            />
          </div>
        </Showcase>

        <Showcase name="Dropdown menu">
          <span {...btn('neutral')}>
            My account <ChevronDown className="size-4" />
          </span>
          <div style={{ ...floating, marginTop: space(1), maxWidth: 240 }} {...steps('menu: gray surface · border g6 · shadow-md')}>
            <Text s="caption" tagged={false} style={{ fontWeight: 600, padding: `${space(1.5)}px ${space(2)}px` }}>
              My account
            </Text>
            <div style={{ height: 1, background: 'var(--g6)', margin: `${space(1)}px -${space(1)}px` }} />
            {[
              { l: 'Profile', icon: User, k: '⇧⌘P' },
              { l: 'Billing', icon: CreditCard, k: '⌘B' },
              { l: 'Settings', icon: Settings, k: '⌘S' },
            ].map(({ l, icon: Icon, k }) => (
              <div
                key={l}
                className="flex cursor-pointer items-center transition-colors hover:bg-(--a4) hover:text-(--a12)"
                style={{ ...typeOf(t['body-sm']), gap: space(2), padding: `${space(1.5)}px ${space(2)}px`, borderRadius: itemRadius }}
                {...steps('item: hover a4 · text a12 · shortcut g11')}
              >
                <Icon className="size-4" style={{ color: MUTED }} />
                <span className="flex-1">{l}</span>
                <span style={{ ...typeOf(t.caption), color: MUTED, letterSpacing: '0.1em' }}>{k}</span>
              </div>
            ))}
            <div style={{ height: 1, background: 'var(--g6)', margin: `${space(1)}px -${space(1)}px` }} />
            <div
              className="flex cursor-pointer items-center transition-colors hover:bg-(--g4)"
              style={{ ...typeOf(t['body-sm']), gap: space(2), padding: `${space(1.5)}px ${space(2)}px`, borderRadius: itemRadius }}
            >
              <LogOut className="size-4" style={{ color: MUTED }} /> Log out
            </div>
          </div>
        </Showcase>

        <Showcase name="Tooltip">
          <div className="flex flex-col items-center" style={{ gap: space(2), paddingTop: space(2) }}>
            <span
              className="bg-(--g12) text-(--g1)"
              style={{ ...typeOf(t.caption), padding: `${space(1.5)}px ${space(3)}px`, borderRadius: radius.sm, boxShadow: shadow.md }}
              {...steps('tooltip: g12 · text g1')}
            >
              Add to library
            </span>
            <span {...btn('neutral', 'icon')} aria-label="Add to library">
              <Plus className="size-4" />
            </span>
          </div>
        </Showcase>

        <Showcase name="Dialog">
          <div className="relative overflow-hidden" style={{ borderRadius: radius.md, background: 'color-mix(in oklab, var(--g12) 40%, transparent)', padding: space(mobile ? 3 : 5) }} {...steps('overlay: g12 at 40%')}>
            <div style={{ background: 'var(--bg)', borderRadius: radius.lg, boxShadow: shadow.xl, padding: space(5) }} {...steps('dialog: background · shadow-xl')} {...mark('shadow', 'shadow-xl')}>
              <div className="flex items-start justify-between" style={{ gap: space(3) }}>
                <Text s="h5" as="h3" tagged={false}>
                  Share link
                </Text>
                <X className="size-4 shrink-0" style={{ color: MUTED }} />
              </div>
              <Text s="body-sm" as="p" tagged={false} style={{ color: MUTED, marginTop: space(1) }}>
                Anyone who has this link will be able to view this.
              </Text>
              <div className="flex" style={{ gap: space(2), marginTop: space(4) }}>
                <div className="min-w-0 flex-1 truncate bg-(--g3)" style={{ ...typeOf(t['body-sm']), fontFamily: mono, padding: fieldPad, borderRadius: radius.md }}>
                  northwind.co/s/9Fx2
                </div>
                <span {...btn('solid', 'icon')} aria-label="Copy">
                  <Copy className="size-4" />
                </span>
              </div>
              <div className="flex justify-end" style={{ marginTop: space(4) }}>
                <span {...btn('gray')}>Close</span>
              </div>
            </div>
          </div>
        </Showcase>

        <Showcase name="Table">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={typeOf(t['body-sm'])}>
              <thead>
                <tr style={{ borderBottom: HAIRLINE }}>
                  {['Invoice', 'Status', 'Amount'].map((h, i) => (
                    <th key={h} className={cn('text-left whitespace-nowrap', i === 2 && 'text-right')} style={{ padding: `${space(2)}px ${space(2)}px`, color: MUTED, fontWeight: 500 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {INVOICES.map((r) => (
                  <tr key={r.id} className="transition-colors hover:bg-(--g2)" style={{ borderBottom: HAIRLINE }} {...steps('row: rule g6 · hover g2')}>
                    <td style={{ padding: space(2), fontWeight: 500 }}>{r.id}</td>
                    <td style={{ padding: space(2) }}>
                      <span {...badge(r.status === 'Paid' ? 'soft' : r.status === 'Pending' ? 'outline' : 'gray')}>{r.status}</span>
                    </td>
                    <td className="text-right tabular-nums" style={{ padding: space(2) }}>
                      {r.amount}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-(--g2)">
                  <td colSpan={2} style={{ padding: space(2), fontWeight: 500 }}>
                    Total
                  </td>
                  <td className="text-right tabular-nums" style={{ padding: space(2), fontWeight: 500 }}>
                    $750.00
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Showcase>

        <Showcase name="Accordion">
          {FAQ.map(({ q, a }, i) => {
            const open = openFaq === i;
            return (
              <div key={q} style={{ borderBottom: i < FAQ.length - 1 ? HAIRLINE : undefined }}>
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenFaq(open ? null : i)}
                  className="flex w-full cursor-pointer items-center justify-between text-left underline-offset-4 hover:underline"
                  style={{ ...typeOf(t['body-sm']), fontWeight: 500, paddingBlock: space(3) }}
                >
                  {q}
                  <ChevronDown className={cn('size-4 shrink-0 transition-transform', open && 'rotate-180')} style={{ color: MUTED }} />
                </button>
                {open && (
                  <Text s="body-sm" as="p" tagged={false} style={{ color: MUTED, paddingBottom: space(3) }}>
                    {a}
                  </Text>
                )}
              </div>
            );
          })}
        </Showcase>

        <Showcase name="Breadcrumb">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center" style={{ ...typeOf(t['body-sm']), gap: space(1.5), color: MUTED }}>
            <span className="fx-link cursor-pointer">Home</span>
            <ChevronRight className="size-3.5" />
            <MoreHorizontal className="size-4" />
            <ChevronRight className="size-3.5" />
            <span className="fx-link cursor-pointer">Components</span>
            <ChevronRight className="size-3.5" />
            <span style={{ color: 'var(--g12)', fontWeight: 500 }}>Breadcrumb</span>
          </nav>
        </Showcase>

        <Showcase name="Pagination">
          <nav aria-label="Pagination" className="flex flex-wrap items-center" style={{ gap: space(1) }}>
            <span {...btn('ghost', 'sm')} onClick={() => setPageNo((p) => Math.max(1, p - 1))}>
              <ChevronLeft className="size-4" /> Previous
            </span>
            {[1, 2, 3].map((n) => {
              const b = btn(n === pageNo ? 'neutral' : 'ghost', 'sm');
              return (
                <span key={n} {...b} style={{ ...b.style, minWidth: space(8) }} onClick={() => setPageNo(n)} aria-current={n === pageNo ? 'page' : undefined}>
                  {n}
                </span>
              );
            })}
            <MoreHorizontal className="size-4" style={{ color: MUTED }} />
            <span {...btn('ghost', 'sm')} onClick={() => setPageNo((p) => Math.min(3, p + 1))}>
              Next <ChevronRight className="size-4" />
            </span>
          </nav>
        </Showcase>

        <Showcase name="Skeleton">
          <div className="flex items-center" style={{ gap: space(3) }} {...steps('skeleton: g4, pulsing')}>
            <span className="shrink-0 animate-pulse bg-(--g4)" style={{ width: space(12), height: space(12), borderRadius: radius.full }} />
            <span className="flex flex-1 flex-col" style={{ gap: space(2) }}>
              <span className="animate-pulse bg-(--g4)" style={{ height: space(4), width: '80%', borderRadius: radius.sm }} />
              <span className="animate-pulse bg-(--g4)" style={{ height: space(4), width: '55%', borderRadius: radius.sm }} />
            </span>
          </div>
        </Showcase>

        <Showcase name="Toast">
          <div
            className="flex items-start"
            style={{ gap: space(3), padding: space(4), background: 'var(--g-surface)', border: HAIRLINE, borderRadius: radius.lg, boxShadow: shadow.lg }}
            {...steps('toast: gray surface · border g6 · shadow-lg')}
            {...mark('shadow', 'shadow-lg')}
          >
            <Calendar className="mt-0.5 size-4 shrink-0" style={{ color: 'var(--a11)' }} />
            <span className="min-w-0 flex-1">
              <Text s="body-sm" tagged={false} style={{ fontWeight: 600 }}>
                Event has been created
              </Text>
              <Text s="caption" tagged={false} style={{ color: MUTED, marginTop: space(0.5) }}>
                Sunday, December 03 at 9:00 AM
              </Text>
            </span>
            <span {...btn('solid', 'sm')}>Undo</span>
          </div>
        </Showcase>
      </div>
    </main>
  );
}
