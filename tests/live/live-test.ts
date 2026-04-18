import { describe } from "vitest";

const describeLive = process.env.RUN_LIVE_TESTS === "1" ? describe : describe.skip;
const LIVE_TEST_TIMEOUT = 30_000;

export { LIVE_TEST_TIMEOUT, describeLive };
