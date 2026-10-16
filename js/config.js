/* Tailwind CDN theme. Imported first by main.js so the design tokens are
   registered before the first render pass. */
export const tailwindConfig = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        paper: 'var(--paper)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        line: 'var(--line)',
        'line-strong': 'var(--line-strong)',
        ink: 'var(--ink)',
        'ink-2': 'var(--ink-2)',
        'ink-3': 'var(--ink-3)',
        signal: 'var(--signal)',
        'signal-ink': 'var(--signal-ink)',
        'signal-wash': 'var(--signal-wash)',
        ok: 'var(--ok)',
        warn: 'var(--warn)',
        danger: 'var(--danger)',
        water: 'var(--water)',
        'm-metro': 'var(--m-metro)',
        'm-bus': 'var(--m-bus)',
        'm-walk': 'var(--m-walk)',
      },
      fontFamily: {
        display: ['"Schibsted Grotesk"', '"Anek Bangla"', 'sans-serif'],
        body: ['"Hanken Grotesk"', '"Hind Siliguri"', 'sans-serif'],
        mono: ['"Geist Mono"', 'monospace'],
      }
    }
  }
};

tailwind.config = tailwindConfig;
