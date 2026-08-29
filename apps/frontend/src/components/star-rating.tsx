import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingInputProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

export function StarRatingInput({ value, onChange, disabled }: StarRatingInputProps) {
  const [hovered, setHovered] = useState(0);
  const display = hovered || value;

  return (
    <div className="flex gap-1" onMouseLeave={() => setHovered(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onMouseEnter={() => setHovered(n)}
          onClick={() => onChange(n)}
          aria-label={`${n} estrella${n > 1 ? "s" : ""}`}
          className="disabled:cursor-not-allowed"
        >
          <Star className={cn("size-6 transition-colors", n <= display ? "fill-gold text-gold" : "text-hairline")} />
        </button>
      ))}
    </div>
  );
}

export function StarRatingDisplay({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${value} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn("size-3.5", n <= value ? "fill-gold text-gold" : "text-hairline")} />
      ))}
    </div>
  );
}
