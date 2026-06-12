import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { WALK_IN_PAYMENT_REQUIRED_MESSAGE } from "@/lib/invoice-rules";

export function apiError(error: unknown, message = "Unable to process this request right now.", status = 500) {
  console.error("[API_ERROR]", error);
  if (error instanceof ZodError) {
    return NextResponse.json({ error: "Please check the highlighted fields.", issues: error.flatten() }, { status: 400 });
  }
  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P1001") return NextResponse.json({ error: "Database is temporarily unavailable. Please try again shortly." }, { status: 503 });
    if (error.code === "P2002") return NextResponse.json({ error: "A record with this unique value already exists." }, { status: 409 });
    if (error.code === "P2003") return NextResponse.json({ error: "This record is connected to other data and cannot be changed that way." }, { status: 409 });
    if (error.code === "P2004" && String(error.meta?.database_error || error.message).includes("invoice_walk_in_paid_on_spot")) {
      return NextResponse.json({ error: WALK_IN_PAYMENT_REQUIRED_MESSAGE }, { status: 400 });
    }
    if (error.code === "P2025") return NextResponse.json({ error: "Record not found." }, { status: 404 });
  }
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return NextResponse.json({ error: "Database is temporarily unavailable. Please try again shortly." }, { status: 503 });
  }
  return NextResponse.json({ error: message }, { status });
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
}

export function forbidden(message = "Forbidden.") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function badRequest(message = "Invalid request.") {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function notFound(message = "Record not found.") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function conflict(message = "This operation conflicts with existing data.") {
  return NextResponse.json({ error: message }, { status: 409 });
}
