/** Asset list colors — consistent with the Tallyo palette */

export const NW_ASSET_ACCENT_OPTIONS: { key: string; label: string }[] = [
  { key: 'cyan', label: 'Cyjan' },
  { key: 'green', label: 'Zieleń' },
  { key: 'magenta', label: 'Magenta' },
  { key: 'amber', label: 'Bursztyn' },
  { key: 'rose', label: 'Róż' },
  { key: 'violet', label: 'Fiolet' },
]

const ACCENT: Record<
  string,
  { icon: string; amount: string; swatch: string; editHover: string; rowAccent: string }
> = {
  cyan: {
    icon: 'text-(--accent)',
    amount: 'text-(--accent)',
    swatch: 'bg-(--accent)',
    editHover: 'hover:border-(--accent)/40 hover:text-(--accent)',
    rowAccent: 'border-l-[3px] border-l-(--accent)/60 bg-(--accent)/5',
  },
  green: {
    icon: 'text-(--positive)',
    amount: 'text-(--positive)',
    swatch: 'bg-(--positive)',
    editHover: 'hover:border-(--positive)/40 hover:text-(--positive)',
    rowAccent: 'border-l-[3px] border-l-(--positive)/60 bg-(--positive)/5',
  },
  magenta: {
    icon: 'text-(--accent-2)',
    amount: 'text-(--accent-2)',
    swatch: 'bg-(--accent-2)',
    editHover: 'hover:border-(--accent-2)/40 hover:text-(--accent-2)',
    rowAccent: 'border-l-[3px] border-l-(--accent-2)/55 bg-(--accent-2)/5',
  },
  amber: {
    icon: 'text-(--warning)',
    amount: 'text-(--warning)',
    swatch: 'bg-(--warning)',
    editHover: 'hover:border-(--warning)/45 hover:text-(--warning)',
    rowAccent: 'border-l-[3px] border-l-(--warning)/60 bg-(--warning)/5',
  },
  rose: {
    icon: 'text-[#ff6b9d]',
    amount: 'text-[#ff6b9d]',
    swatch: 'bg-[#ff6b9d]',
    editHover: 'hover:border-[#ff6b9d]/45 hover:text-[#ff6b9d]',
    rowAccent: 'border-l-[3px] border-l-[#ff6b9d]/55 bg-[#ff6b9d]/5',
  },
  violet: {
    icon: 'text-violet-400',
    amount: 'text-violet-400',
    swatch: 'bg-violet-500',
    editHover: 'hover:border-violet-400/45 hover:text-violet-400',
    rowAccent: 'border-l-[3px] border-l-violet-400/55 bg-violet-400/5',
  },
}

export const DEFAULT_NW_ASSET_ACCENT_KEY = 'cyan'

export function normalizeNwAssetAccentKey(key: string | null | undefined): string {
  return key && ACCENT[key] ? key : DEFAULT_NW_ASSET_ACCENT_KEY
}

export function getNwAssetAccentClasses(accentKey: string | null | undefined): {
  icon: string
  amount: string
  swatch: string
  editHover: string
  rowAccent: string
} {
  const k = normalizeNwAssetAccentKey(accentKey)
  return ACCENT[k]!
}
