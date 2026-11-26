import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../src/", import.meta.url);

test("avatar is a first-class mobile navigation section", async () => {
  const [store, navigation, route] = await Promise.all([
    readFile(new URL("organism/store.ts", root), "utf8"),
    readFile(new URL("components/AppNavigation.tsx", root), "utf8"),
    readFile(new URL("routes/index.tsx", root), "utf8"),
  ]);

  assert.match(store, /export type AppSection =[^;]*\b"avatar"\b/,
    "the shared navigation state must include the avatar section");
  assert.match(navigation, /\{\s*id:\s*"avatar",\s*label:\s*"Avatar"/,
    "the bottom navigation must expose the avatar destination");
  assert.match(navigation, /aria-current=\{active === id \? "page" : undefined\}/,
    "the selected tab must remain accessible");
  assert.equal((navigation.match(/id: "(?:home|avatar|memory|motivation|settings|more)"/g) ?? []).length, 5,
    "the mobile navigation must remain a five-item bar");

  const avatarSection = route.match(/\{section === "avatar" \? \([\s\S]*?\) : null\}/);
  assert.ok(avatarSection, "the route must render a dedicated avatar section");
  assert.match(avatarSection[0], /<AvatarStage snap=\{snap\} thinking=\{busy\} \/>/,
    "the avatar tab must host the existing canonical AvatarStage");
  assert.match(avatarSection[0], /aria-label="Avatar"/,
    "the avatar destination must have a named landmark");

  const homeSection = route.match(/\{section === "home" \? \(([\s\S]*?)\) : null\}/);
  assert.ok(homeSection, "the home section must remain available");
  assert.doesNotMatch(homeSection[1], /<AvatarStage/,
    "the heavyweight avatar renderer must not mount on Home as well");
});
