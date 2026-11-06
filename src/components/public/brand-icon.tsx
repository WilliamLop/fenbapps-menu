import {
  Flame,
  Leaf,
  Waves,
  Wine,
  UtensilsCrossed,
} from "lucide-react";
import type { TenantBrandIcon } from "@/modules/tenant/queries";

interface BrandIconProps {
  icon: TenantBrandIcon;
  className?: string;
}

export function BrandIcon({ icon, className = "size-4" }: BrandIconProps) {
  switch (icon) {
    case "leaf":
      return <Leaf className={className} />;
    case "waves":
      return <Waves className={className} />;
    case "wine":
      return <Wine className={className} />;
    case "utensils":
      return <UtensilsCrossed className={className} />;
    case "flame":
    default:
      return <Flame className={className} />;
  }
}
