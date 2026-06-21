"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";

export default function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();

  const switchTo = (newLocale: string) => {
    document.cookie = `NEXT_LOCALE=${newLocale};path=/;max-age=${365 * 24 * 60 * 60};SameSite=Lax`;
    router.push(newLocale === "fr" ? "/" : "/en");
    router.refresh();
  };

  return (
    <div className="langSwitcher">
      <button
        className={`langBtn${locale === "fr" ? " langActive" : ""}`}
        onClick={() => switchTo("fr")}
        aria-label="Français"
      >
        FR
      </button>
      <button
        className={`langBtn${locale === "en" ? " langActive" : ""}`}
        onClick={() => switchTo("en")}
        aria-label="English"
      >
        EN
      </button>
    </div>
  );
}
