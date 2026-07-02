import { cn } from "@/lib/utils";

interface AvatarProps {
  initials: string;
  color?: string;
  className?: string;
  title?: string;
}

export function Avatar({ initials, color, className, title }: AvatarProps) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white",
        className
      )}
      style={{ backgroundColor: color ?? "var(--primary)" }}
    >
      {initials}
    </span>
  );
}
