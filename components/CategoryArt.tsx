// Branded abstract artwork shown for a category until it has its own photo.

const T9 = '#0c2624';
const T8 = '#123835';
const T7 = '#184a46';
const T6 = '#22605b';
const T5 = '#2f7a73';
const T3 = '#8fb5af';
const PAPER = '#f5f2ec';
const BRASS = '#b9955d';

function Art({ slug }: { slug: string }) {
  switch (slug) {
    case 'plexi-art':
      return (
        <>
          <rect width="400" height="400" fill={T8} />
          <rect x="60" y="70" width="170" height="230" rx="10" fill={T5} opacity="0.75" />
          <rect x="140" y="120" width="190" height="220" rx="10" fill={BRASS} opacity="0.55" />
          <rect x="100" y="40" width="120" height="150" rx="10" fill={T3} opacity="0.45" />
          <circle cx="270" cy="120" r="46" fill={PAPER} opacity="0.35" />
        </>
      );
    case 'metal-art':
      return (
        <>
          <defs>
            <linearGradient id="ca-metal" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#3b4c4a" />
              <stop offset="0.5" stopColor="#8a9895" />
              <stop offset="1" stopColor="#223230" />
            </linearGradient>
          </defs>
          <rect width="400" height="400" fill={T9} />
          <circle cx="200" cy="200" r="150" fill="url(#ca-metal)" />
          {[130, 110, 90, 70, 50, 30].map((r) => (
            <circle key={r} cx="200" cy="200" r={r} fill="none" stroke={T9} strokeOpacity="0.35" strokeWidth="2" />
          ))}
          <rect x="190" y="40" width="20" height="320" fill={T9} opacity="0.5" />
        </>
      );
    case 'wood-art':
      return (
        <>
          <rect width="400" height="400" fill="#6b4a2e" />
          {Array.from({ length: 14 }, (_, i) => (
            <path
              key={i}
              d={`M-20 ${30 + i * 28} C 90 ${10 + i * 28}, 150 ${60 + i * 28}, 230 ${30 + i * 28} S 360 ${8 + i * 28}, 420 ${36 + i * 28}`}
              fill="none"
              stroke={i % 3 === 0 ? '#c9a27a' : '#8a6340'}
              strokeWidth={i % 3 === 0 ? 3 : 1.5}
              opacity="0.8"
            />
          ))}
          <ellipse cx="250" cy="180" rx="26" ry="14" fill="none" stroke="#c9a27a" strokeWidth="2" />
        </>
      );
    case 'parametric':
      return (
        <>
          <rect width="400" height="400" fill={T7} />
          {Array.from({ length: 22 }, (_, i) => {
            const x = 20 + i * 17;
            const bulge = 40 * Math.sin((i / 21) * Math.PI);
            return (
              <path
                key={i}
                d={`M${x} 0 C ${x + bulge} 120, ${x - bulge} 260, ${x + bulge / 2} 400`}
                fill="none"
                stroke={i % 2 ? T3 : PAPER}
                strokeOpacity={i % 2 ? 0.55 : 0.3}
                strokeWidth="5"
              />
            );
          })}
        </>
      );
    case 'mirrors-art':
      return (
        <>
          <defs>
            <linearGradient id="ca-mirror" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#e8f0ee" />
              <stop offset="0.45" stopColor={T3} />
              <stop offset="0.55" stopColor="#dfe9e6" />
              <stop offset="1" stopColor={T5} />
            </linearGradient>
          </defs>
          <rect width="400" height="400" fill={T8} />
          <path d="M110 360V170a90 90 0 0 1 180 0v190Z" fill="url(#ca-mirror)" />
          <path d="M110 360V170a90 90 0 0 1 180 0v190Z" fill="none" stroke={BRASS} strokeWidth="6" />
          <path d="M150 130 250 300M175 115 270 275" stroke="#fff" strokeOpacity="0.5" strokeWidth="6" />
        </>
      );
    case '3d-arts':
      return (
        <>
          <rect width="400" height="400" fill={T9} />
          {[
            [40, 40, 60, 150, T5],
            [110, 40, 60, 90, BRASS],
            [110, 140, 60, 150, T3],
            [180, 40, 60, 200, T6],
            [250, 40, 60, 60, PAPER],
            [250, 110, 60, 180, T5],
            [320, 40, 50, 120, T3],
            [40, 200, 60, 100, BRASS],
            [180, 250, 60, 110, T3],
            [320, 170, 50, 190, T6],
            [40, 310, 60, 50, T6],
            [110, 300, 60, 60, PAPER],
            [250, 300, 60, 60, BRASS],
          ].map(([x, y, w, h, c], i) => (
            <rect key={i} x={x} y={y} width={w} height={h} rx={Math.min(Number(w), Number(h)) / 2} fill={String(c)} opacity="0.9" />
          ))}
        </>
      );
    case 'sculpture':
      return (
        <>
          <rect width="400" height="400" fill={PAPER} />
          <rect x="140" y="300" width="120" height="100" fill={T7} />
          <circle cx="200" cy="200" r="62" fill={T5} />
          <path d="M150 300c0-40 20-58 50-58s50 18 50 58Z" fill={T8} />
          <circle cx="232" cy="178" r="16" fill={PAPER} opacity="0.5" />
          <ellipse cx="200" cy="112" rx="34" ry="22" fill={BRASS} />
        </>
      );
    default:
      return (
        <>
          <rect width="400" height="400" fill={T7} />
          <path d="M200 60 340 200 200 340 60 200Z" fill="none" stroke={T3} strokeWidth="3" />
          <path d="M200 120 280 200 200 280 120 200Z" fill={T3} opacity="0.4" />
        </>
      );
  }
}

export function CategoryArt({ slug, className = 'placeholder-art' }: { slug: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <Art slug={slug} />
    </svg>
  );
}
