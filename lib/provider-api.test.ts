import test from "node:test";
import assert from "node:assert/strict";
import { checkOpenAiConnection, checkProviderConnection } from "./provider-api.ts";

function withKey<T>(key: string | undefined, fn: () => T): T {
  const saved = process.env.OPENAI_API_KEY;
  if (key === undefined) {
    delete process.env.OPENAI_API_KEY;
  } else {
    process.env.OPENAI_API_KEY = key;
  }
  try {
    return fn();
  } finally {
    if (saved === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = saved;
  }
}

test("checkOpenAiConnection : clé absente => missing_api_key", async () => {
  await withKey(undefined, async () => {
    const result = await checkOpenAiConnection();
    assert.equal(result.ok, false);
    assert.equal(result.status, "missing_api_key");
    assert.equal(result.provider, "OpenAI");
    assert.ok(result.message.length > 0);
  });
});

test("checkOpenAiConnection : clé + fetch 200 => ok true avec no-store et abort signal", async () => {
  await withKey("sk-test-fake-key", async () => {
    let options: RequestInit | undefined;
    const mockFetch = async (_url: string, opts?: RequestInit) => {
      options = opts;
      return ({ ok: true, status: 200 }) as Response;
    };
    const result = await checkOpenAiConnection(mockFetch);
    assert.equal(result.ok, true);
    assert.equal(result.status, "connected");
    assert.equal(result.provider, "OpenAI");
    assert.equal(options?.cache, "no-store");
    assert.ok(options?.signal, "Un AbortSignal doit être transmis au fetch");
  });
});

test("checkOpenAiConnection : clé + fetch 401 => ok false sans fuite de clé", async () => {
  const fakeKey = "sk-secret-must-not-appear-in-result";
  await withKey(fakeKey, async () => {
    const mockFetch = async (_url: string, _opts?: RequestInit) =>
      ({ ok: false, status: 401 }) as Response;
    const result = await checkOpenAiConnection(mockFetch);
    assert.equal(result.ok, false);
    assert.equal(result.status, "auth_error");
    assert.ok(!result.message.includes(fakeKey), "Le message ne doit pas contenir la clé API");
    assert.ok(!JSON.stringify(result).includes(fakeKey), "La réponse sérialisée ne doit pas contenir la clé API");
  });
});

test("checkOpenAiConnection : erreur réseau => ok false propre", async () => {
  await withKey("sk-test-fake-key", async () => {
    const mockFetch = async (_url: string, _opts?: RequestInit): Promise<Response> => {
      throw new Error("ECONNREFUSED");
    };
    const result = await checkOpenAiConnection(mockFetch);
    assert.equal(result.ok, false);
    assert.equal(result.status, "network_error");
    assert.equal(result.provider, "OpenAI");
    assert.ok(result.message.length > 0);
  });
});

test("aucun message ne contient la valeur de la clé mockée (tous scénarios)", async () => {
  const fakeKey = "sk-ultra-secret-never-leak-9876543210";
  await withKey(fakeKey, async () => {
    const scenarios: Array<() => Promise<Response>> = [
      async () => ({ ok: false, status: 401 }) as Response,
      async () => ({ ok: false, status: 500 }) as Response,
      async () => { throw new Error("network fail"); },
    ];
    for (const mockFetch of scenarios) {
      const result = await checkOpenAiConnection(mockFetch);
      const serialized = JSON.stringify(result);
      assert.ok(!serialized.includes(fakeKey), `Fuite détectée dans : ${serialized}`);
    }
  });
});

test("checkProviderConnection : OpenAI délègue à checkOpenAiConnection", async () => {
  await withKey(undefined, async () => {
    const result = await checkProviderConnection("OpenAI");
    assert.equal(result.provider, "OpenAI");
    assert.equal(result.status, "missing_api_key");
  });
});

test("checkProviderConnection : fournisseur non supporté => error", async () => {
  const result = await checkProviderConnection("Anthropic");
  assert.equal(result.ok, false);
  assert.equal(result.status, "error");
  assert.equal(result.provider, "Anthropic");
});
