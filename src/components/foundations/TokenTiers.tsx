import { useMemo, useState } from 'react';
import { Check, ChevronRight, ChevronsUpDown, GripVertical, Pencil, Plus, RotateCcw, Search, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '../ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { cn } from '../ui/utils';
import { copyToClipboard } from '../../lib/clipboard';
import type { ColorFormat } from '../../lib/color-utils';
import type { GeneratedPalette } from '../../lib/export-utils';
import { type Foundations, type ShadowLayer, layerToCss } from '../../lib/foundations';
import {
  type CustomToken,
  TIERS,
  type Tier,
  type Token,
  type TokenGroup,
  aliasLock,
  aliasOptions,
  aliasTargets,
  buildTokens,
  isTokenName,
  resolveShadowLayers,
  resolveToken,
} from '../../lib/tokens';

const ALL_GROUPS: TokenGroup[] = ['color', 'typography', 'spacing', 'radius', 'shadow', 'grid'];

const TIER_META: Record<Tier, { label: string; blurb: string; tone: string }> = {
  primitive: { label: 'Primitive', blurb: 'Raw values · locked', tone: 'bg-muted text-muted-foreground' },
  base: { label: 'Base', blurb: 'Values mapped to a purpose · editable', tone: 'bg-sky-500/10 text-sky-700 dark:text-sky-300' },
  semantic: { label: 'Semantic', blurb: 'Values mapped to context and theme · editable', tone: 'bg-violet-500/10 text-violet-700 dark:text-violet-300' },
};

/** Example names for the add form, in each group's naming style. */
const NAME_HINTS: Record<TokenGroup, Record<'base' | 'semantic', string>> = {
  color: { base: 'brand-9', semantic: 'bg-card' },
  typography: { base: 'font-size-hero', semantic: 'text-hero-size' },
  spacing: { base: 'space-4xl', semantic: 'padding-section' },
  radius: { base: 'radius-3xl', semantic: 'radius-input' },
  shadow: { base: 'shadow-3xl', semantic: 'container-toast' },
  grid: { base: 'container-narrow', semantic: 'page-narrow' },
};

/** Long primitive lists (every color step, both modes) start folded. */
const FOLD_OVER = 60;

function formatValue(t: Token | undefined): string {
  if (!t || t.value === undefined) return '—';
  switch (t.type) {
    case 'dimension':
      return `${t.value}px`;
    case 'letterSpacing':
      return `${t.value}em`;
    case 'fontFamily':
      return String(t.value).split(',')[0].replace(/["']/g, '');
    case 'shadow': {
      const n = (t.value as ShadowLayer[]).length;
      return `${n} ${n === 1 ? 'layer' : 'layers'}`;
    }
    default:
      return String(t.value);
  }
}

function Preview({ t }: { t: Token | undefined }) {
  if (!t || t.value === undefined) return null;
  if (t.type === 'color') return <span className="size-4 shrink-0 rounded-[4px] border border-black/10" style={{ background: String(t.value) }} />;
  if (t.type === 'shadow') {
    return <span className="h-4 w-6 shrink-0 rounded-[3px] bg-card" style={{ boxShadow: (t.value as ShadowLayer[]).map(layerToCss).join(', ') }} />;
  }
  return null;
}

/** The token an alias lands on. A shadow level's colors come from its slots, so they follow the mode. */
function resolveShown(t: Token, byName: Map<string, Token>, isDark: boolean): Token | undefined {
  const landed = resolveToken(t, byName, isDark);
  return landed?.type === 'shadow' ? { ...landed, value: resolveShadowLayers(landed, byName, isDark) } : landed;
}

/** Every alias from a token down to its primitive, in light or dark mode. */
function aliasChain(t: Token, byName: Map<string, Token>, isDark: boolean): string[] {
  const chain = [t.name];
  let cur: Token | undefined = t;
  for (let i = 0; cur?.ref && i < 4; i++) {
    cur = byName.get(isDark && cur.darkRef ? cur.darkRef : cur.ref);
    if (cur) chain.push(cur.name);
  }
  return chain;
}

/**
 * Resolved value, with the widest breakpoint's value when the token switches by width. Semantic
 * tokens also name the primitive they land on, so the whole chain reads without opening anything.
 */
function Resolved({ t, byName, isDark }: { t: Token; byName: Map<string, Token>; isDark: boolean }) {
  const resolved = resolveShown(t, byName, isDark);
  const last = t.responsive?.at(-1);
  const wide = last && byName.get(last.ref);
  const chain = t.tier === 'primitive' ? [] : aliasChain(t, byName, isDark);
  const value = (
    <span className="flex items-center gap-2 font-mono text-xs whitespace-nowrap text-muted-foreground tabular">
      <Preview t={resolved} />
      {formatValue(resolved)}
      {last && wide && (
        <span className="text-muted-foreground/70">
          → {formatValue(resolveToken(wide, byName, isDark))} ≥{last.minWidth}
        </span>
      )}
      {chain.length > 2 && <span className="min-w-0 truncate text-muted-foreground/60">via {chain.at(-1)}</span>}
    </span>
  );
  if (chain.length < 2) return value;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="block min-w-0 cursor-default">{value}</span>
      </TooltipTrigger>
      <TooltipContent align="start" className="font-mono text-[0.6875rem]">
        {[...chain, formatValue(resolved)].join('  →  ')}
      </TooltipContent>
    </Tooltip>
  );
}

type RowFilter = 'all' | 'edited' | 'custom';

/**
 * Every token in one foundation, split into its three tiers. Primitives are read-only; base and
 * semantic tokens can be re-pointed to any token in the tier below, and new ones added.
 */
/**
 * Token column wide enough for the group's longest name (mono 12px ≈ 0.45rem a character),
 * plus room for the edited dot, custom badge and drag grip. Names past the cap still truncate.
 */
function tokenColumnWidth(tokens: Token[]) {
  const chars = Math.max(0, ...tokens.map((t) => t.name.length + (t.custom ? 11 : 0) + (t.defaultRef ? 2 : 0)));
  return `${Math.min(24, Math.max(12, chars * 0.45 + 2.5))}rem`;
}

export function TokenTiers({
  group,
  palettes,
  foundations,
  colorFormat,
  isDark,
  onAliasChange,
  onResetAliases,
  onAddToken,
  onUpdateToken,
  onRemoveToken,
  onMoveToken,
}: {
  group: TokenGroup;
  palettes: GeneratedPalette[];
  foundations: Foundations;
  colorFormat: ColorFormat;
  isDark: boolean;
  /** `null` restores the generator's alias. */
  onAliasChange: (name: string, ref: string | null) => void;
  onResetAliases: (names: string[]) => void;
  onAddToken: (token: CustomToken) => void;
  onUpdateToken: (name: string, patch: TokenPatch) => void;
  onRemoveToken: (name: string) => void;
  /** Moves a custom token to where `to` sits. */
  onMoveToken: (name: string, to: string) => void;
}) {
  const [query, setQuery] = useState('');
  /** The custom token whose row is open as a form. */
  const [editing, setEditing] = useState<string | null>(null);
  /** Custom token being dragged, and the one it would drop onto. */
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropOn, setDropOn] = useState<string | null>(null);
  const endDrag = () => {
    setDragging(null);
    setDropOn(null);
  };
  const [filter, setFilter] = useState<RowFilter>('all');
  const [folded, setFolded] = useState<Partial<Record<Tier, boolean>>>({});

  // Every group, so new names can't clash with a custom property elsewhere
  const allTokens = useMemo(
    () => buildTokens(palettes, foundations, { groups: ALL_GROUPS, modes: 'both', colorFormat }),
    [palettes, foundations, colorFormat],
  );
  const tokens = useMemo(() => allTokens.filter((t) => t.group === group), [allTokens, group]);
  const byName = useMemo(() => new Map(allTokens.map((t) => [t.name, t])), [allTokens]);
  const edited = tokens.filter((t) => t.defaultRef);
  const added = tokens.filter((t) => t.custom);

  /** Tokens that alias each token, so one in use can't be deleted. */
  const usedBy = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const t of tokens) {
      for (const ref of [t.ref, t.darkRef, ...(t.responsive?.map((r) => r.ref) ?? [])]) {
        if (ref) map.set(ref, [...(map.get(ref) ?? []), t.name]);
      }
    }
    return map;
  }, [tokens]);

  const q = query.trim().toLowerCase();
  const matches = (t: Token) =>
    (filter === 'all' || (filter === 'edited' ? !!t.defaultRef : !!t.custom)) &&
    (!q || t.name.includes(q) || t.ref?.includes(q) || t.description?.toLowerCase().includes(q));
  /** Searching or filtering opens every tier, so matches never hide in a folded one. */
  const narrowing = !!q || filter !== 'all';

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter tokens" className="h-8 pl-8 text-sm" aria-label="Filter tokens" />
        </div>
        <div role="radiogroup" aria-label="Show tokens" className="flex h-8 items-center rounded-lg bg-muted p-0.5">
          {(
            [
              ['all', 'All', tokens.length],
              ['edited', 'Edited', edited.length],
              ['custom', 'Added', added.length],
            ] as const
          ).map(([value, label, count]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={filter === value}
              disabled={value !== 'all' && count === 0}
              onClick={() => setFilter(value)}
              className={cn(
                'flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40',
                filter === value ? 'bg-card font-medium text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {value === 'edited' && <span className="size-1.5 rounded-full bg-amber-500" />}
              {value === 'custom' && <span className="size-1.5 rounded-full bg-emerald-500" />}
              {label}
              <span className="font-mono text-[0.625rem] tabular opacity-60">{count}</span>
            </button>
          ))}
        </div>
        {edited.length > 0 && (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onResetAliases(edited.map((t) => t.name))}>
            <RotateCcw className="size-3.5" /> Reset {edited.length} {edited.length === 1 ? 'edit' : 'edits'}
          </Button>
        )}
      </div>

      {TIERS.map((tier) => {
        const all = tokens.filter((t) => t.tier === tier);
        if (all.length === 0 && tier === 'primitive') return null;
        const rows = all.filter(matches);
        // A filter that leaves a tier empty hides it, rather than showing an empty table
        if (filter !== 'all' && rows.length === 0) return null;
        const isFolded = !narrowing && (folded[tier] ?? (tier === 'primitive' && all.length > FOLD_OVER));
        const meta = TIER_META[tier];
        const editedHere = all.filter((t) => t.defaultRef).length;
        const nameWidth = tokenColumnWidth(all);
        const customRows = all.filter((t) => t.custom);
        const customHere = customRows.length;
        // Usage only shows where some token has one; otherwise the column is just empty space
        const hasUsage = all.some((t) => t.description);
        const columns = 2 + (tier !== 'primitive' ? 1 : 0) + (hasUsage ? 1 : 0);

        return (
          <section key={tier} className="overflow-hidden rounded-xl border bg-card shadow-card">
            <button
              type="button"
              aria-expanded={!isFolded}
              onClick={() => setFolded((f) => ({ ...f, [tier]: !isFolded }))}
              className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            >
              <ChevronRight className={cn('size-4 shrink-0 text-muted-foreground transition-transform', !isFolded && 'rotate-90')} />
              <span className={cn('rounded-md px-1.5 py-0.5 text-xs font-medium', meta.tone)}>{meta.label}</span>
              <span className="truncate text-xs text-muted-foreground">{meta.blurb}</span>
              <span className="ml-auto shrink-0 font-mono text-[0.6875rem] text-muted-foreground tabular">
                {customHere > 0 && <span className="mr-2 text-emerald-600 dark:text-emerald-400">{customHere} added</span>}
                {editedHere > 0 && <span className="mr-2 text-amber-600 dark:text-amber-400">{editedHere} edited</span>}
                {narrowing ? `${rows.length}/${all.length}` : all.length}
              </span>
            </button>

            {!isFolded && (
              <div className="overflow-x-auto border-t">
                <table className="w-full min-w-[44rem] table-fixed text-left text-sm">
                  <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 font-medium" style={{ width: nameWidth }}>
                        Token
                      </th>
                      {tier !== 'primitive' && <th className="w-60 px-4 py-2 font-medium">Aliases</th>}
                      <th className="px-4 py-2 font-medium">{tier === 'primitive' ? 'Value' : 'Resolves to'}</th>
                      {hasUsage && <th className="px-4 py-2 font-medium">Usage</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.map((t) =>
                      t.custom && editing === t.name ? (
                        <TokenFormRow
                          key={t.name}
                          columns={columns}
                          tier={t.tier as 'base' | 'semantic'}
                          group={group}
                          targets={aliasOptions(t, tokens)}
                          taken={byName}
                          isDark={isDark}
                          initial={{ name: t.name, ref: t.ref ?? '', description: t.description }}
                          onSubmit={(patch) => {
                            onUpdateToken(t.name, patch);
                            setEditing(null);
                          }}
                          onCancel={() => setEditing(null)}
                        />
                      ) : (
                      <tr
                        key={t.name}
                        // Added tokens reorder by dragging, only among the added tokens in their own table
                        draggable={t.custom && customHere > 1}
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = 'move';
                          setDragging(t.name);
                        }}
                        onDragOver={(e) => {
                          const from = customRows.findIndex((c) => c.name === dragging);
                          if (!t.custom || from < 0) return;
                          e.preventDefault();
                          setDropOn(t.name);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (dragging && dragging !== t.name) onMoveToken(dragging, t.name);
                          endDrag();
                        }}
                        onDragEnd={endDrag}
                        className={cn(
                          'group/row h-[42px] transition-colors hover:bg-muted/30',
                          dragging === t.name && 'opacity-40',
                          dropOn === t.name &&
                            dragging !== t.name &&
                            (customRows.findIndex((c) => c.name === dragging) < customRows.indexOf(t)
                              ? 'shadow-[inset_0_-2px_0_var(--primary)]'
                              : 'shadow-[inset_0_2px_0_var(--primary)]'),
                        )}
                      >
                        <td className={cn('px-4 py-0', t.custom && customHere > 1 && 'cursor-grab active:cursor-grabbing')}>
                          <span className="flex items-center gap-1.5">
                            {t.defaultRef && <span className="size-1.5 shrink-0 rounded-full bg-amber-500" aria-label="Edited" />}
                            <button
                              type="button"
                              onClick={() => copyToClipboard(t.name, 'Token')}
                              title={t.name}
                              className="min-w-0 truncate rounded font-mono text-xs font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              {t.name}
                            </button>
                            {t.custom && (
                              <span className="shrink-0 rounded bg-emerald-500/10 px-1 text-[0.625rem] font-medium text-emerald-700 dark:text-emerald-300">
                                custom
                              </span>
                            )}
                            {t.custom && customHere > 1 && (
                              <GripVertical
                                className="ml-auto size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100"
                                aria-hidden
                              />
                            )}
                          </span>
                        </td>
                        {tier !== 'primitive' && (
                          <td className="px-4 py-0">
                            <AliasCell
                              token={t}
                              tokens={tokens}
                              byName={byName}
                              isDark={isDark}
                              usedBy={usedBy.get(t.name)}
                              onAliasChange={onAliasChange}
                              onUpdateToken={onUpdateToken}
                              onEditToken={setEditing}
                              onRemoveToken={onRemoveToken}
                            />
                          </td>
                        )}
                        <td className="px-4 py-0">
                          <Resolved t={t} byName={byName} isDark={isDark} />
                        </td>
                        {hasUsage && (
                          <td className="truncate px-4 py-0 text-xs text-muted-foreground" title={t.description}>
                            {t.description}
                          </td>
                        )}
                      </tr>
                      ),
                    )}
                    {rows.length === 0 && q && (
                      <tr>
                        <td colSpan={columns} className="px-4 py-6 text-center text-xs text-muted-foreground">
                          No {meta.label.toLowerCase()} tokens match “{query}”
                        </td>
                      </tr>
                    )}
                    {tier !== 'primitive' && filter === 'all' && (
                      <AddTokenRow key={`${group}-${tier}`} columns={columns} tier={tier} group={group} tokens={tokens} taken={byName} isDark={isDark} onAdd={onAddToken} />
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function AliasCell({
  token,
  tokens,
  byName,
  isDark,
  usedBy,
  onAliasChange,
  onUpdateToken,
  onEditToken,
  onRemoveToken,
}: {
  token: Token;
  tokens: Token[];
  byName: Map<string, Token>;
  isDark: boolean;
  usedBy?: string[];
  onAliasChange: (name: string, ref: string | null) => void;
  onUpdateToken: (name: string, patch: TokenPatch) => void;
  onEditToken: (name: string) => void;
  onRemoveToken: (name: string) => void;
}) {
  const options = aliasOptions(token, tokens);
  const defaultRef = token.defaultRef ?? token.ref;
  const change = (ref: string) => (token.custom ? onUpdateToken(token.name, { ref }) : onAliasChange(token.name, ref === token.defaultRef ? null : ref));
  // Shadow levels alias nothing, so a picker would only store an edit that never applies
  const lock = aliasLock(token);
  if (lock) return <span className="block truncate px-1 text-xs text-muted-foreground" title={lock}>{lock}</span>;

  return (
    <div className="flex items-center gap-1">
      <AliasPicker
        value={token.ref}
        options={options}
        byName={byName}
        isDark={isDark}
        defaultRef={token.custom ? undefined : defaultRef}
        label={`Alias for ${token.name}`}
        title={token.responsive ? 'Picking one token replaces the per-breakpoint values' : undefined}
        onChange={change}
      />
      {token.defaultRef && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0 text-muted-foreground"
              aria-label={`Reset ${token.name} to ${token.defaultRef}`}
              onClick={() => onAliasChange(token.name, null)}
            >
              <RotateCcw className="size-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Reset to {token.defaultRef}</TooltipContent>
        </Tooltip>
      )}
      {token.custom && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0 text-muted-foreground"
              aria-label={`Edit ${token.name}`}
              onClick={() => onEditToken(token.name)}
            >
              <Pencil className="size-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Edit name, alias and usage</TooltipContent>
        </Tooltip>
      )}
      {token.custom && (
        <Tooltip>
          <TooltipTrigger asChild>
            {/* Wrapped so the tooltip still shows while the button is disabled */}
            <span tabIndex={usedBy ? 0 : -1} className="shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-destructive"
                aria-label={`Delete ${token.name}`}
                disabled={!!usedBy}
                onClick={() => onRemoveToken(token.name)}
              >
                <Trash2 className="size-3" />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>{usedBy ? `Used by ${usedBy.join(', ')}` : `Delete ${token.name}`}</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

type TokenPatch = Partial<Pick<CustomToken, 'name' | 'ref' | 'description'>>;

function AddTokenRow({
  columns,
  tier,
  group,
  tokens,
  taken,
  isDark,
  onAdd,
}: {
  columns: number;
  tier: 'base' | 'semantic';
  group: TokenGroup;
  tokens: Token[];
  /** Every token name across groups. */
  taken: Map<string, Token>;
  isDark: boolean;
  onAdd: (token: CustomToken) => void;
}) {
  const [open, setOpen] = useState(false);
  // A new shadow token is a shadow, so its color slots and raw layer colors aren't targets
  const targets = aliasTargets(tier, group, tokens, group === 'shadow' ? 'shadow' : undefined);

  if (!open) {
    return (
      <tr>
        <td colSpan={columns} className="px-2 py-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs text-muted-foreground"
            disabled={targets.length === 0}
            onClick={() => setOpen(true)}
          >
            <Plus className="size-3.5" /> Add {TIER_META[tier].label.toLowerCase()} token
          </Button>
        </td>
      </tr>
    );
  }

  return (
    <TokenFormRow
      columns={columns}
      tier={tier}
      group={group}
      targets={targets}
      taken={taken}
      isDark={isDark}
      onSubmit={(t) => {
        onAdd({ tier, group, name: t.name!, ref: t.ref!, description: t.description });
        setOpen(false);
      }}
      onCancel={() => setOpen(false)}
    />
  );
}

/** Name, alias and usage for a custom token, as a table row. Adds a token, or edits `initial`. */
function TokenFormRow({
  columns,
  tier,
  group,
  targets,
  taken,
  isDark,
  initial,
  onSubmit,
  onCancel,
}: {
  columns: number;
  tier: 'base' | 'semantic';
  group: TokenGroup;
  targets: Token[];
  /** Every token name across groups. */
  taken: Map<string, Token>;
  isDark: boolean;
  initial?: { name: string; ref: string; description?: string };
  onSubmit: (token: TokenPatch) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [ref, setRef] = useState(initial?.ref ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');

  const slug = name.trim().toLowerCase().replace(/\s+/g, '-');
  const error = !slug
    ? null
    : !isTokenName(slug)
      ? 'Use lowercase letters, numbers and hyphens'
      : taken.has(slug) && slug !== initial?.name
        ? 'Name already in use'
        : null;
  const canSubmit = !!slug && !error && !!ref;

  const submit = () => {
    if (canSubmit) onSubmit({ name: slug, ref, description: description.trim() || undefined });
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') submit();
    if (e.key === 'Escape') onCancel();
  };

  return (
    <tr className="bg-muted/30 align-top">
      <td className="px-4 py-2">
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={NAME_HINTS[group][tier]}
          aria-label="Token name"
          aria-invalid={!!error}
          className="h-7 font-mono text-xs"
        />
        {error && <p className="mt-1 text-[0.6875rem] text-destructive">{error}</p>}
      </td>
      <td className="px-4 py-2">
        <AliasPicker
          value={ref || undefined}
          options={targets}
          byName={taken}
          isDark={isDark}
          label="Aliases"
          placeholder={group === 'shadow' ? 'Pick a shadow' : `Pick a ${TIER_META[tier === 'base' ? 'primitive' : 'base'].label.toLowerCase()} token`}
          onChange={setRef}
        />
      </td>
      <td colSpan={columns - 2} className="px-4 py-2">
        <div className="flex items-center gap-1.5">
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Usage (optional)"
            aria-label="Usage"
            className="h-7 min-w-0 flex-1 text-xs"
          />
          <Button size="sm" className="h-7 px-2.5 text-xs" disabled={!canSubmit} onClick={submit}>
            {initial ? 'Save' : 'Add'}
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </td>
    </tr>
  );
}

/** Searchable list of tokens to alias. Matches on name or resolved value, like "16px" or "#3e63dd". */
function AliasPicker({
  value,
  options,
  byName,
  isDark,
  defaultRef,
  label,
  placeholder = 'Pick a token',
  title,
  onChange,
}: {
  value?: string;
  options: Token[];
  byName: Map<string, Token>;
  isDark: boolean;
  defaultRef?: string;
  label: string;
  placeholder?: string;
  title?: string;
  onChange: (ref: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={label}
          title={title}
          className="h-7 min-w-0 flex-1 justify-between gap-1 px-2.5 font-mono text-xs font-normal"
        >
          <span className={cn('truncate', !value && 'text-muted-foreground')}>{value ?? placeholder}</span>
          <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-[26rem] p-0">
        <Command>
          <CommandInput placeholder="Search by name or value" className="h-9 text-xs" />
          <CommandList className="max-h-72 p-1">
            <CommandEmpty className="py-6 text-center text-xs text-muted-foreground">No matching token</CommandEmpty>
            {options.map((o) => {
              const resolved = resolveShown(o, byName, isDark);
              const shown = formatValue(resolved);
              return (
                <CommandItem
                  key={o.name}
                  value={o.name}
                  keywords={[shown, o.description ?? '']}
                  onSelect={() => {
                    onChange(o.name);
                    setOpen(false);
                  }}
                  className="gap-2 font-mono text-xs"
                >
                  <Check className={cn('size-3.5 shrink-0', o.name === value ? 'opacity-100' : 'opacity-0')} />
                  <Preview t={resolved} />
                  <span className="max-w-[65%] shrink-0 truncate" title={o.name}>{o.name}</span>
                  {o.name === defaultRef && <span className="shrink-0 text-muted-foreground">· default</span>}
                  <span className="ml-auto min-w-0 truncate pl-4 text-right text-muted-foreground tabular" title={shown}>
                    {shown}
                  </span>
                </CommandItem>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
