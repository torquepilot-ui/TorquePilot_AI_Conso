import test from "node:test";
import assert from "node:assert/strict";
import { DASHBOARD_NAV_ITEMS, getDashboardNavItem } from "./dashboard-navigation.ts";

test("navigation dashboard : menu professionnel complet et ordonné", () => {
  assert.deepEqual(DASHBOARD_NAV_ITEMS.map((item) => item.label), [
    "HOME",
    "PROJETS",
    "AGENTS",
    "LOGS",
    "COLLECTE",
    "CONSOMMATION",
    "ALERTES",
    "PARAMÈTRES",
  ]);
  assert.equal(DASHBOARD_NAV_ITEMS[0].href, "/");
  assert.ok(DASHBOARD_NAV_ITEMS.every((item) => item.description.length > 12));
  assert.equal(new Set(DASHBOARD_NAV_ITEMS.map((item) => item.href)).size, DASHBOARD_NAV_ITEMS.length);
});

test("navigation dashboard : résolution page active par route", () => {
  assert.equal(getDashboardNavItem("/")?.label, "HOME");
  assert.equal(getDashboardNavItem("/consommation")?.label, "CONSOMMATION");
  assert.equal(getDashboardNavItem("/consommation?range=7d")?.label, "CONSOMMATION");
  assert.equal(getDashboardNavItem("/collecte")?.label, "COLLECTE");
  assert.equal(getDashboardNavItem("/collecte?project=1")?.label, "COLLECTE");
  assert.equal(getDashboardNavItem("/projets/123")?.label, "PROJETS");
  assert.equal(getDashboardNavItem("/inconnue"), undefined);
});
