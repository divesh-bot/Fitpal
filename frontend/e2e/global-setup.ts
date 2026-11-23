import { createTestUser } from "./testUser";

export default async function globalSetup() {
  const user = await createTestUser();
  console.log(`E2E: test user ${user.id.slice(0, 8)}… created`);
}
