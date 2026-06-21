"use client";

import { useTranslations } from "next-intl";
import { googleSignInAction } from "../app/actions";
import LanguageSwitcher from "./LanguageSwitcher";

export default function LandingPage() {
  const t = useTranslations("landing");

  const features = [t("feature1"), t("feature2"), t("feature3")];

  return (
    <div className="landingPage">
      <header className="landingHeader">
        <div className="landingBrand">
          <span className="landingBrandMark">TP</span>
          <span className="landingBrandName">TorquePilot AI Conso</span>
        </div>
        <div className="landingHeaderRight">
          <LanguageSwitcher />
          <span className="landingBetaBadge">{t("beta")}</span>
        </div>
      </header>

      <main className="landingBody">
        <div className="landingCard">
          <p className="eyebrow" style={{ textAlign: "center" }}>
            {t("eyebrow")}
          </p>

          <h1 className="landingTitle">
            {t.rich("title", {
              accent: (chunks) => (
                <span className="landingTitleAccent">{chunks}</span>
              ),
            })}
          </h1>

          <p className="landingSubtitle">{t("subtitle")}</p>

          <div className="landingFeatures">
            {features.map((f) => (
              <div key={f} className="landingFeature">
                <span className="landingFeatureCheck">&#10003;</span>
                <span>{f}</span>
              </div>
            ))}
          </div>

          <form action={googleSignInAction} className="landingSignIn">
            <button type="submit">&#128274; {t("signIn")}</button>
          </form>

          <p className="landingPrivacy">&#128274; {t("privacy")}</p>

          <hr className="landingDivider" />
          <p className="landingVersion">{t("version")}</p>
        </div>
      </main>

      <footer className="landingFooter">{t("copyright")}</footer>
    </div>
  );
}
