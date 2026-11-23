import { deleteTestUser } from "./testUser";

/** Always runs after the tests, pass or fail: the test user and all its data are removed. */
export default async function globalTeardown() {
  await deleteTestUser();
}
