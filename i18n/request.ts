import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";

export default getRequestConfig(async () => {
  const headerStore = await headers();
  const cookieStore = await cookies();

  const raw =
    headerStore.get("x-next-intl-locale") ||
    cookieStore.get("NEXT_LOCALE")?.value;
  const locale = raw === "en" ? "en" : "fr";

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
