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

  if (!changes || typeof changes !== "object" || Array.isArray(changes)) {
    return [];
  }

  return Object.entries(changes as Record<string, unknown>).flatMap(([field, value]) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return [];
    }

    const before = (value as Record<string, unknown>).before;
    const after = (value as Record<string, unknown>).after;

    if (before === after) return [];

    return [
      {
        field,
        before: stringifyValue(before),
        after: stringifyValue(after),
      },
    ];
  });
};

const resolveTargetLabel = (targetType: string, targetId?: string, details?: ActivityDetails) => {
  if (typeof details?.customer_name === "string" && details.customer_name.trim()) {
    return details.customer_name.trim();
  }

  if (typeof details?.target_name === "string" && details.target_name.trim()) {
    return details.target_name.trim();
  }

  if (typeof details?.job_id === "string" && details.job_id.trim()) {
    return details.job_id.trim();
  }

  if (typeof details?.email === "string" && details.email.trim()) {
    return details.email.trim();
  }

  return `this ${prettify(targetType).toLowerCase()}`;
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
  const actor = userName || "Unknown user";
  const normalizedAction = action.toLowerCase();
  const normalizedTargetType = targetType.toLowerCase();
  const targetLabel = resolveTargetLabel(targetType, targetId, details);

  const statusFrom = details?.status_from !== undefined ? stringifyValue(details.status_from) : null;
  const statusTo = details?.status_to !== undefined ? stringifyValue(details.status_to) : null;

  if (normalizedTargetType === "lead") {
    if (normalizedAction === "created" || normalizedAction === "create") {
      return `${actor} created lead "${targetLabel}".`;
    }

    if (normalizedAction === "status_changed" || normalizedAction === "status_change") {
      if (statusFrom && statusTo) {
        return `${actor} changed the status of "${targetLabel}" from "${statusFrom}" to "${statusTo}".`;
      }
      return `${actor} changed the status of "${targetLabel}".`;
    }

    if (normalizedAction === "payment_recorded") {
      const amount = details?.amount !== undefined && details?.amount !== null ? stringifyValue(details.amount) : null;

      return amount
        ? `${actor} recorded a payment of $${amount} for "${targetLabel}".`
        : `${actor} recorded a payment for "${targetLabel}".`;
    }

    if (normalizedAction === "note_added") {
      const noteType =
        typeof details?.note_type === "string" && details.note_type.trim() ? details.note_type.trim() : "general";

      return `${actor} added a ${noteType} note to "${targetLabel}".`;
    }

    if (normalizedAction === "photos_uploaded") {
      const count = Number(details?.count || 0);

      return count > 0
        ? `${actor} uploaded ${count} photo${count === 1 ? "" : "s"} to "${targetLabel}".`
        : `${actor} uploaded photos to "${targetLabel}".`;
    }

    if (normalizedAction === "shared") {
      const sharedWith = details?.shared_with !== undefined ? stringifyValue(details.shared_with) : "another user";

      return `${actor} shared "${targetLabel}" with ${sharedWith}.`;
    }

    if (normalizedAction === "updated" || normalizedAction === "update") {
      const changeList = buildChangeList(details);

      if (changeList.length === 0) {
        return `${actor} updated "${targetLabel}".`;
      }

      if (changeList.length === 1) {
        const change = changeList[0];
        return `${actor} changed ${prettify(change.field)} on "${targetLabel}" from "${change.before}" to "${change.after}".`;
      }

      return `${actor} updated "${targetLabel}" and changed ${changeList.length} fields.`;
    }

    if (normalizedAction === "deleted" || normalizedAction === "delete") {
      return `${actor} deleted lead "${targetLabel}".`;
    }
  }

  if (normalizedTargetType === "user") {
    if (normalizedAction === "created" || normalizedAction === "create") {
      return `${actor} created user "${targetLabel}".`;
    }

    if (normalizedAction === "password_changed") {
      return `${actor} changed the password for "${targetLabel}".`;
    }

    if (normalizedAction === "updated" || normalizedAction === "update") {
      const changeList = buildChangeList(details);

      if (changeList.length === 0) {
        return `${actor} updated user "${targetLabel}".`;
      }

      if (changeList.length === 1) {
        const change = changeList[0];
        return `${actor} changed ${prettify(change.field)} for user "${targetLabel}" from "${change.before}" to "${change.after}".`;
      }

      return `${actor} updated user "${targetLabel}" and changed ${changeList.length} fields.`;
    }
  }

  return `${actor} ${prettify(action).toLowerCase()} "${targetLabel}".`;
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
    const { data: profile } = await supabase.from("profiles_public" as never).select("full_name").eq("id", userId).single() as { data: { full_name?: string } | null };

    resolvedName = profile?.full_name || "Unknown user";
  }

  const message = buildActivityMessage({
    userName: resolvedName,
    action,
    targetType,
    targetId,
    details,
  });

  const payload = {
    user_id: userId,
    user_name: resolvedName,
    action,
    target_type: targetType,
    target_id: targetId ?? null,
    details: JSON.stringify({
      ...(details ?? {}),
      message,
    }),
  };

  const { error } = await supabase.from("activity_logs").insert(payload);

  if (error) {
    console.error("Failed to log activity:", error);
  }
}
