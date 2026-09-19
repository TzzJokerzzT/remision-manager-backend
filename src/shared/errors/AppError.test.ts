// Co-located unit tests for the AppError hierarchy.
// Conventions: relative imports with .js extension; pure instantiation and
// instanceof checks (no subclassing, no mocking); no mongoose, no process.env,
// no network/timers/filesystem.
import { describe, expect, test } from "bun:test";
import {
	AppError,
	ConflictError,
	ForbiddenError,
	NotFoundError,
	UnauthorizedError,
	ValidationError,
} from "./AppError.js";

describe("AppError hierarchy", () => {
	test("AppError is instanceof AppError with message and statusCode", () => {
		const err = new AppError("message", 500);

		expect(err).toBeInstanceOf(AppError);
		expect(err.message).toBe("message");
		expect(err.statusCode).toBe(500);
	});

	test("isOperational defaults to true", () => {
		const err = new AppError("oops");

		expect(err.isOperational).toBe(true);
	});

	test("subclasses carry correct status codes and are AppError instances", () => {
		const notFound = new NotFoundError();
		const unauthorized = new UnauthorizedError();
		const forbidden = new ForbiddenError();
		const conflict = new ConflictError();
		const validation = new ValidationError();

		expect(notFound.statusCode).toBe(404);
		expect(unauthorized.statusCode).toBe(401);
		expect(forbidden.statusCode).toBe(403);
		expect(conflict.statusCode).toBe(409);
		expect(validation.statusCode).toBe(422);

		expect(notFound).toBeInstanceOf(AppError);
		expect(unauthorized).toBeInstanceOf(AppError);
		expect(forbidden).toBeInstanceOf(AppError);
		expect(conflict).toBeInstanceOf(AppError);
		expect(validation).toBeInstanceOf(AppError);
	});

	test("ValidationError passes details through", () => {
		const details = { field: "email" };
		const err = new ValidationError("bad data", details);

		expect(err.details).toBe(details);
		expect(err.statusCode).toBe(422);
	});

	test("plain Error is not instanceof AppError", () => {
		expect(new Error("boom")).not.toBeInstanceOf(AppError);
	});
});
