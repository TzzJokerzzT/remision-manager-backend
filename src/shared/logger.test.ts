import { describe, expect, test } from "bun:test";
import { logger } from "./logger.js";

describe("logger", () => {
	test("exports a valid pino instance with level from env", () => {
		expect(logger).toBeDefined();
		expect(typeof logger.info).toBe("function");
		expect(typeof logger.error).toBe("function");
		expect(typeof logger.debug).toBe("function");
		expect(logger.level).toBe("info");
	});

	test("default log level is info when LOG_LEVEL is not overridden", () => {
		expect(logger.level).toBe("info");
	});
});
