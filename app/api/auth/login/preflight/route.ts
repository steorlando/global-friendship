import { NextResponse } from "next/server";
import { checkLoginAccess } from "@/lib/auth/login-access";

type PreflightBody = {
  email?: unknown;
  role?: unknown;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PreflightBody;
    const result = await checkLoginAccess(body.email, body.role);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, code: result.code, message: result.message },
        { status: result.status }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        code: "BAD_REQUEST",
        message: error instanceof Error ? error.message : "Invalid request",
      },
      { status: 400 }
    );
  }
}
