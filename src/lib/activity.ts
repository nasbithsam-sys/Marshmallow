import { supabase } from "@/integrations/supabase/client";

type ActivityDetails = Record<string, unknown>;

const prettify = (value: string) => value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const stringifyValue = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "empty";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(stringifyValue).join(", ");
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const buildChangeList = (details?: ActivityDetails) => {
  const changes = details?.changes;
  if (!changes || typeof changes !== "object" || Array.isArray(changes)) return [];

  return Object.entries(changes as Record<string, unknown>).flatMap(([field, value]) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];

    const before = (value as Record<string, unknown>).before;
    const after = (value as Record<string, unknown>).after;

    if (before === after) return [];

    return [`${prettify(field)} changed from "${stringifyValue(before)}" to "${stringifyValue(after)}"`];
  });
};

const buildActivityMessage = ({
  userName,
  action,
  targetType,
  targetId,
  details,
}: {
  userName: string;
  action: string;
  targetType: string;
  targetId?: string;
  details?: ActivityDetails;
}) => {
  const actor = userName || "Unknown";
  const targetLabel = details?.target_name
    ? String(details.target_name)
    : targetId
      ? String(targetId)
      : prettify(targetType);

  const statusFrom = details?.status_from ? stringifyValue(details.status_from) : null;
  const statusTo = details?.status_to ? stringifyValue(details.status_to) : null;

  if (targetType === "lead") {
    if (action === "created") {
      return `${actor} created lead ${targetLabel}`;
    }

    if (action === "status_changed") {
      if (statusFrom && statusTo) {
        return `${actor} changed lead ${targetLabel} status from ${statusFrom} to ${statusTo}`;
      }
      return `${actor} changed lead ${targetLabel} status`;
    }

    if (action === "payment_recorded") {
      const amount = details?.amount ? stringifyValue(details.amount) : null;
      return amount
        ? `${actor} recorded payment of ${amount} for lead ${targetLabel}`
        : `${actor} recorded payment for lead ${targetLabel}`;
    }

    if (action === "note_added") {
      const noteType = details?.note_type ? stringifyValue(details.note_type) : "note";
      return `${actor} added a ${noteType} note to lead ${targetLabel}`;
    }

    if (action === "photos_uploaded") {
      const count = Number(details?.count || 0);
      return `${actor} uploaded ${count || ""} photo${count === 1 ? "" : "s"} to lead ${targetLabel}`.replace(
        "uploaded  photos",
        "uploaded photos",
      );
    }

    if (action === "shared") {
      const sharedWith = details?.shared_with ? stringifyValue(details.shared_with) : "a user";
      return `${actor} shared lead ${targetLabel} with ${sharedWith}`;
    }

    if (action === "updated") {
      const changeList = buildChangeList(details);
      if (changeList.length > 0) {
        return `${actor} updated lead ${targetLabel}: ${changeList.slice(0, 3).join("; ")}`;
      }
      return `${actor} updated lead ${targetLabel}`;
    }
  }

  if (targetType === "user") {
    if (action === "created") {
      return `${actor} created user ${targetLabel}`;
    }

    if (action === "password_changed") {
      return `${actor} changed password for ${targetLabel}`;
    }

    if (action === "updated") {
      const changeList = buildChangeList(details);
      if (changeList.length > 0) {
        return `${actor} updated user ${targetLabel}: ${changeList.slice(0, 3).join("; ")}`;
      }
      return `${actor} updated user ${targetLabel}`;
    }
  }

  return `${actor} ${prettify(action).toLowerCase()} ${prettify(targetType).toLowerCase()} ${targetLabel}`;
};

export async function logActivity(
  userId: string,
  action: string,
  targetType: string,
  targetId?: string,
  details?: ActivityDetails,
  userName?: string,
) {
  let resolvedName = userName || "";

  if (!resolvedName) {
    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", userId).single();

    resolvedName = profile?.full_name || "Unknown";
  }

  const message = buildActivityMessage({
    userName: resolvedName,
    action,
    targetType,
    targetId,
    details,
  });

  await supabase.from("activity_logs").insert({
    user_id: userId,
    user_name: resolvedName,
    action,
    target_type: targetType,
    target_id: targetId,
    details: details ?? null,
    message,
  });
}
