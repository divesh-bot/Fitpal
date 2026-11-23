import { sweepTestUsers } from "./testUser";

/** Safety net after every run: removes any test users left by an interrupted spec. */
export default async function globalTeardown() {
  const removed = await sweepTestUsers();
  console.log(removed ? `E2E: swept ${removed} leftover test user(s)` : "E2E: no leftover test users");
}
