// GET /api/sharing/granted — list accounts the current user has been granted
// read-only access to (i.e. they are the grantee, not the owner). FR-33.

import { connectMongo } from "@/lib/mongodb";
import { getUserId } from "@/lib/auth";
import { SharedAccessModel } from "@/models/SharedAccess";
import { UserModel } from "@/models/User";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    await connectMongo();
    const userId = await getUserId();

    const grants = await SharedAccessModel.find({
      granteeId: userId,
      status: "active",
    })
      .sort({ createdAt: -1 })
      .lean();

    if (grants.length === 0) {
      return Response.json({ items: [] }, { status: 200 });
    }

    // Resolve owner names/emails for display.
    const ownerIds = grants.map((g) => g.ownerId);
    const owners = await UserModel.find({ _id: { $in: ownerIds } })
      .select("email name")
      .lean<{ _id: unknown; email: string; name?: string }[]>();

    const ownerMap = new Map(
      owners.map((u) => [String(u._id), { email: u.email, name: u.name }]),
    );

    const items = grants.map((g) => ({
      accessId: String(g._id),
      ownerId: g.ownerId,
      ownerEmail: ownerMap.get(g.ownerId)?.email ?? g.ownerId,
      ownerName: ownerMap.get(g.ownerId)?.name,
      grantedAt: g.createdAt,
    }));

    return Response.json({ items }, { status: 200 });
  } catch (err) {
    logger.error("GET /api/sharing/granted failed", { err });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
