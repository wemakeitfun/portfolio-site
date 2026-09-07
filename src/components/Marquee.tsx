export default function Marquee({
  items,
  className = "",
}: {
  items: string[];
  className?: string;
}) {
  const loop = [...items, ...items];

  return (
    <div className={`relative overflow-hidden border-y border-border py-5 ${className}`}>
      <div className="flex w-max animate-[marquee_28s_linear_infinite] gap-10">
        {loop.map((item, i) => (
          <span
            key={i}
            className="font-display text-3xl md:text-5xl tracking-wide text-fg-muted whitespace-nowrap flex items-center gap-10"
          >
            {item}
            <span className="text-accent text-xl">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}
