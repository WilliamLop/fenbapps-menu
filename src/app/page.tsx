import { redirect } from "next/navigation";

export default function HomePage() {
  const defaultDemoSlug =
    process.env.NEXT_PUBLIC_DEFAULT_DEMO_SLUG ?? "casa-brasa";
  redirect(`/${defaultDemoSlug}`);
}
