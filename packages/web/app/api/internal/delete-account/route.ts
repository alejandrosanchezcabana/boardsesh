import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { getDb } from "@/app/lib/db/db";
import * as schema from "@/app/lib/db/schema";
import { eq } from "drizzle-orm";
import { authOptions } from "@/app/lib/auth/auth-options";

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getDb();

    // Delete the user row. Auth-related tables (accounts, sessions,
    // userCredentials, userProfiles) have onDelete: cascade and will
    // be cleaned up automatically by the database.
    await db
      .delete(schema.users)
      .where(eq(schema.users.id, session.user.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete account:", error);
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 },
    );
  }
}
