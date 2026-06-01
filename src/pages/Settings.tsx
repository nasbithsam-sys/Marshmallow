import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Plus, Shield, Eye, Trash2, ShieldCheck, Copy, RefreshCw, KeyRound, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { ALL_LEAD_STATUSES, STATUS_LABELS, ALL_NAV_ITEMS, STATUS_CHANGE_ACCESS, type LeadStatus } from "@/lib/constants";
import { adminApi } from "@/lib/admin-api";
import { logActivity } from "@/lib/activity";
import { getDefaultNavAccess } from "@/lib/access";
import type { AppRole } from "@/types";
import MFAEnroll from "@/components/auth/MFAEnroll";
import { motion } from "framer-motion";
import { heroTitle } from "@/lib/motion";

const generateCode = () => {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return String(100000 + (arr[0] % 900000));
};

const NAV_SECTION_LABELS: Record<string, string> = {
  leads: "All Leads",
  analytics: "Analytics",
  settings: "Settings",
  activity_logs: "Activity Logs",
  schedule: "Schedule",
  areas: "Area Insights",
};

const roleColors: Record<string, string> = {
  admin: "bg-primary/8 text-primary border-primary/10",
  processor: "bg-[hsl(var(--success)/0.08)] text-[hsl(var(--success))] border-[hsl(var(--success)/0.1)]",
  customer_service: "bg-[hsl(var(--warning)/0.08)] text-[hsl(var(--warning))] border-[hsl(var(--warning)/0.1)]",
  opr: "bg-[hsl(var(--destructive)/0.08)] text-[hsl(var(--destructive))] border-[hsl(var(--destructive)/0.12)]",
  no_role: "bg-muted/70 text-muted-foreground border-border/60",
};

const formatRoleLabel = (role?: string | null) => {
  if (!role) return "No Role";
  return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
};

type ManagedRole = AppRole | "no_role";

interface SettingsUser {
  id: string;
  email: string | null;
  full_name: string | null;
  role: ManagedRole;
}

interface AccessCodeRow {
  user_id: string;
  code: string | null;
}

interface NavPermissionRow {
  id: string;
  user_id: string;
  nav_section: string;
  allowed: boolean;
}

interface StatusVisibilityRow {
  id: string;
  user_id: string | null;
  role: string | null;
  status: string;
  is_visible: boolean;
}

const MANAGED_ROLES: AppRole[] = ["customer_service", "processor", "opr"];

const Settings = () => {
  const { user, role: currentRole } = useAuth();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<AppRole>("customer_service");
  const [creating, setCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<"users" | "nav_permissions" | "status_permissions" | "security">("users");
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordUserId, setPasswordUserId] = useState("");
  const [passwordUserName, setPasswordUserName] = useState("");
  const [newPasswordValue, setNewPasswordValue] = useState("");
  const [settingPassword, setSettingPassword] = useState(false);

  const isAdmin = currentRole === "admin";

  const { data: users = [] } = useQuery<SettingsUser[]>({
    queryKey: ["settings-users"],
    queryFn: async () => {
      const { data: profiles } = await supabase.from("profiles").select("id, email, full_name");
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      const roleByUserId = new Map((roles ?? []).map((row) => [row.user_id, row.role as ManagedRole]));

      return (profiles ?? []).map((profile) => ({
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        role: roleByUserId.get(profile.id) ?? "no_role",
      }));
    },
  });

  const { data: accessCodes = [] } = useQuery<AccessCodeRow[]>({
    queryKey: ["user-access-codes"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from("user_access_codes").select("user_id, code");
      return data ?? [];
    },
  });

  const { data: navPermissions = [] } = useQuery<NavPermissionRow[]>({
    queryKey: ["settings-nav-permissions"],
    queryFn: async () => {
      const { data } = await supabase.from("navigation_permissions").select("id, user_id, nav_section, allowed");
      return data ?? [];
    },
  });

  const { data: statusVisibility = [] } = useQuery<StatusVisibilityRow[]>({
    queryKey: ["settings-status-visibility"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_status_visibility")
        .select("id, user_id, role, status, is_visible");

      if (error) {
        throw error;
      }

      return data ?? [];
    },
  });

  const userById = useMemo(() => new Map(users.map((targetUser) => [targetUser.id, targetUser])), [users]);
  const accessCodeByUserId = useMemo(() => new Map(accessCodes.map((row) => [row.user_id, row.code])), [accessCodes]);
  const navPermissionByUserAndSection = useMemo(
    () => new Map(navPermissions.map((row) => [`${row.user_id}:${row.nav_section}`, row.allowed])),
    [navPermissions],
  );
  const statusVisibilityByUserAndStatus = useMemo(
    () => new Map(statusVisibility.map((row) => [`${row.user_id}:${row.status}`, row.is_visible])),
    [statusVisibility],
  );
  const statusVisibilityByRoleAndStatus = useMemo(
    () =>
      new Map(
        statusVisibility
          .filter((row) => !row.user_id && row.role)
          .map((row) => [`${row.role}:${row.status}`, row.is_visible]),
      ),
    [statusVisibility],
  );

  const getUserById = (userId: string) => userById.get(userId);

  const getAccessCode = (userId: string) => accessCodeByUserId.get(userId) ?? null;

  const handleGenerateCode = async (userId: string) => {
    const code = generateCode();
    const existing = accessCodes.find((row) => row.user_id === userId);
    const targetUser = getUserById(userId);

    if (existing) {
      await supabase.from("user_access_codes").update({ code }).eq("user_id", userId);

      if (user) {
        await logActivity(user.id, "updated", "user", userId, {
          target_name: targetUser?.full_name || targetUser?.email || userId,
          email: targetUser?.email || null,
          changes: {
            access_code: {
              before: existing.code ?? null,
              after: code,
            },
          },
          message: `Admin regenerated access code for "${targetUser?.full_name || targetUser?.email || "user"}".`,
        });
      }
    } else {
      await supabase.from("user_access_codes").insert({ user_id: userId, code });

      if (user) {
        await logActivity(user.id, "updated", "user", userId, {
          target_name: targetUser?.full_name || targetUser?.email || userId,
          email: targetUser?.email || null,
          changes: {
            access_code: {
              before: null,
              after: code,
            },
          },
          message: `Admin generated access code for "${targetUser?.full_name || targetUser?.email || "user"}".`,
        });
      }
    }

    toast.success("Access code generated");
    queryClient.invalidateQueries({ queryKey: ["user-access-codes"] });
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Code copied to clipboard");
  };

  const updateRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const existingUser = getUserById(userId);
      const previousRole = existingUser?.role ?? "no_role";

      const { data: existing } = await supabase.from("user_roles").select("id").eq("user_id", userId).single();

      if (existing) {
        await supabase.from("user_roles").update({ role }).eq("user_id", userId);
      } else {
        await supabase.from("user_roles").insert({ user_id: userId, role });
      }

      if (user) {
        await logActivity(user.id, "updated", "user", userId, {
          target_name: existingUser?.full_name || existingUser?.email || userId,
          email: existingUser?.email || null,
          changes: {
            role: {
              before: previousRole,
              after: role,
            },
          },
          message: `Admin changed role for "${existingUser?.full_name || existingUser?.email || "user"}" from "${formatRoleLabel(previousRole)}" to "${formatRoleLabel(role)}".`,
        });
      }
    },
    onSuccess: () => {
      toast.success("Role updated");
      queryClient.invalidateQueries({ queryKey: ["settings-users"] });
    },
  });

  const toggleNavPermission = useMutation({
    mutationFn: async ({ userId, section, allowed }: { userId: string; section: string; allowed: boolean }) => {
      const existing = navPermissions.find((permission) => permission.user_id === userId && permission.nav_section === section);
      const targetUser = getUserById(userId);
      const beforeAllowed = existing?.allowed ?? false;

      if (existing) {
        await supabase
          .from("navigation_permissions")
          .update({ allowed })
          .eq("id", existing.id);
      } else {
        await supabase.from("navigation_permissions").insert({ user_id: userId, nav_section: section, allowed });
      }

      if (user) {
        await logActivity(user.id, "updated", "user", userId, {
          target_name: targetUser?.full_name || targetUser?.email || userId,
          email: targetUser?.email || null,
          changes: {
            [`nav_${section}`]: {
              before: beforeAllowed,
              after: allowed,
            },
          },
          message: `Admin ${allowed ? "enabled" : "disabled"} "${NAV_SECTION_LABELS[section] || section}" tab for "${targetUser?.full_name || targetUser?.email || "user"}".`,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings-nav-permissions"] });
      toast.success("Navigation permission updated");
    },
  });

  const toggleStatusVisibility = useMutation({
    mutationFn: async ({
      userId,
      role,
      status,
      isVisible,
    }: {
      userId?: string;
      role?: AppRole;
      status: string;
      isVisible: boolean;
    }) => {
      const targetUser = userId ? getUserById(userId) : undefined;
      const existing = statusVisibility.find((row) =>
        userId ? row.user_id === userId && row.status === status : !row.user_id && row.role === role && row.status === status,
      );
      const beforeVisible = existing?.is_visible ?? true;

      if (existing) {
        const { error } = await supabase
          .from("lead_status_visibility")
          .update({ is_visible: isVisible })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("lead_status_visibility").insert({
          user_id: userId ?? null,
          role: role ?? targetUser?.role ?? null,
          status,
          is_visible: isVisible,
        });

        if (error) throw error;
      }

      if (user) {
        await logActivity(user.id, "updated", userId ? "user" : "role", userId ?? role ?? status, {
          target_name: userId
            ? targetUser?.full_name || targetUser?.email || userId
            : `${formatRoleLabel(role)} role`,
          email: targetUser?.email || null,
          changes: {
            [status]: {
              before: beforeVisible,
              after: isVisible,
            },
          },
          message: userId
            ? `Admin ${isVisible ? "showed" : "hid"} "${STATUS_LABELS[status] || status}" status for "${targetUser?.full_name || targetUser?.email || "user"}".`
            : `Admin ${isVisible ? "showed" : "hid"} "${STATUS_LABELS[status] || status}" status for the "${formatRoleLabel(role)}" role.`,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings-status-visibility"] });
      queryClient.invalidateQueries({ queryKey: ["lead-status-visibility"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Status visibility updated");
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to update status visibility");
    },
  });

  const handleCreateUser = async () => {
    setCreating(true);

    try {
      const code = newRole !== "admin" ? generateCode() : undefined;
      const result = await adminApi.createUser(newEmail, newPassword, newName, newRole, code);

      if (user) {
        const createdUserId = result?.user?.id || result?.id || newEmail;

        await logActivity(user.id, "created", "user", createdUserId, {
          target_name: newName,
          email: newEmail,
          role: newRole,
          message: `Admin created user "${newName}" with role "${formatRoleLabel(newRole)}".`,
          changes: {
            full_name: {
              before: null,
              after: newName,
            },
            email: {
              before: null,
              after: newEmail,
            },
            role: {
              before: null,
              after: newRole,
            },
            access_code: {
              before: null,
              after: code ?? null,
            },
          },
        });
      }

      toast.success("User created");
      setCreateOpen(false);
      setNewEmail("");
      setNewPassword("");
      setNewName("");
      setNewRole("customer_service");

      queryClient.invalidateQueries({ queryKey: ["settings-users"] });
      queryClient.invalidateQueries({ queryKey: ["user-access-codes"] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create user");
    }

    setCreating(false);
  };

  const handleSetPassword = async () => {
    if (!newPasswordValue || newPasswordValue.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setSettingPassword(true);

    try {
      await adminApi.setPassword(passwordUserId, newPasswordValue);

      const targetUser = getUserById(passwordUserId);

      if (user) {
        await logActivity(user.id, "password_changed", "user", passwordUserId, {
          target_name: targetUser?.full_name || passwordUserName || targetUser?.email || passwordUserId,
          email: targetUser?.email || null,
          message: `Admin changed password for "${targetUser?.full_name || passwordUserName || targetUser?.email || "user"}".`,
        });
      }

      toast.success(`Password updated for ${passwordUserName}`);
      setPasswordDialogOpen(false);
      setNewPasswordValue("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to set password");
    }

    setSettingPassword(false);
  };

  const handleDeleteUser = async (userId: string) => {
    const targetUser = getUserById(userId);

    try {
      await adminApi.deleteUser(userId);

      if (user) {
        await logActivity(user.id, "deleted", "user", userId, {
          target_name: targetUser?.full_name || targetUser?.email || userId,
          email: targetUser?.email || null,
          message: `Admin deleted user "${targetUser?.full_name || targetUser?.email || "user"}".`,
        });
      }

      toast.success("User deleted");
      queryClient.invalidateQueries({ queryKey: ["settings-users"] });
      queryClient.invalidateQueries({ queryKey: ["user-access-codes"] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete user");
    }
  };

  const getNavPermission = (userId: string, section: string) => {
    const targetUser = getUserById(userId);
    const override = navPermissionByUserAndSection.get(`${userId}:${section}`);

    if (typeof override === "boolean") {
      return override;
    }

    if (!targetUser || targetUser.role === "no_role") {
      return false;
    }

    return getDefaultNavAccess(targetUser.role).has(section as (typeof ALL_NAV_ITEMS)[number]);
  };

  const getRoleStatusVisibility = (managedRole: AppRole, status: string) =>
    statusVisibilityByRoleAndStatus.get(`${managedRole}:${status}`) ?? true;
  const getStatusVisibility = (userId: string, status: string) => {
    const targetUser = getUserById(userId);
    const userOverride = statusVisibilityByUserAndStatus.get(`${userId}:${status}`);

    if (typeof userOverride === "boolean") {
      return userOverride;
    }

    if (!targetUser || targetUser.role === "admin" || targetUser.role === "no_role") {
      return true;
    }

    return getRoleStatusVisibility(targetUser.role, status);
  };

  const getInitials = (name?: string | null) =>
    name
      ?.split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "U";

  const nonAdminUsers = useMemo(() => users.filter((targetUser) => targetUser.role !== "admin"), [users]);
  const enabledNavPermissions = useMemo(
    () =>
      nonAdminUsers.reduce((count, targetUser) => {
        if (targetUser.role === "no_role") {
          return count;
        }

        const defaultAccess = getDefaultNavAccess(targetUser.role);
        return (
          count +
          ALL_NAV_ITEMS.filter((section) => {
            const override = navPermissionByUserAndSection.get(`${targetUser.id}:${section}`);
            return typeof override === "boolean" ? override : defaultAccess.has(section);
          }).length
        );
      }, 0),
    [nonAdminUsers, navPermissionByUserAndSection],
  );
  const hiddenStatusCount = useMemo(
    () =>
      nonAdminUsers.reduce((count, targetUser) => {
        const hiddenForUser = ALL_LEAD_STATUSES.filter((status) => !getStatusVisibility(targetUser.id, status)).length;
        return count + hiddenForUser;
      }, 0),
    [nonAdminUsers, statusVisibilityByRoleAndStatus, statusVisibilityByUserAndStatus, userById],
  );

  return (
    <div className="mx-auto max-w-[1440px] space-y-6">
      <motion.div
        variants={heroTitle}
        initial="initial"
        animate="animate"
        className="overflow-hidden rounded-[28px] border border-border/60 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.12),transparent_34%),linear-gradient(180deg,hsl(var(--card)),hsl(var(--card)/0.96))] shadow-[0_32px_80px_-44px_rgba(15,23,42,0.45)]"
      >
        <div className="flex flex-col gap-5 px-5 py-5 sm:px-6 sm:py-6 lg:flex-row lg:items-end lg:justify-between lg:px-7">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/[0.07] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
              <ShieldCheck className="h-3.5 w-3.5" />
              Workspace Controls
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-foreground sm:text-3xl">
              Structured control over people, access, and security
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              Keep user management clean, tab access predictable, and status visibility easy to audit across the
              whole CRM.
            </p>
          </div>

          {isAdmin && (
            <Button onClick={() => setCreateOpen(true)} className="gap-2 self-start lg:self-auto">
              <Plus className="h-4 w-4" />
              Create User
            </Button>
          )}
        </div>

        <div className="grid gap-3 border-t border-border/50 bg-background/45 px-5 py-4 sm:grid-cols-2 lg:grid-cols-4 lg:px-7">
          <div className="rounded-2xl border border-border/60 bg-card/80 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Users</p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-foreground">{users.length}</p>
            <p className="mt-1 text-[12px] text-muted-foreground">People currently configured in the workspace.</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card/80 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Non-admin seats
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-foreground">{nonAdminUsers.length}</p>
            <p className="mt-1 text-[12px] text-muted-foreground">Users governed by navigation and visibility rules.</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card/80 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Enabled tabs
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-foreground">{enabledNavPermissions}</p>
            <p className="mt-1 text-[12px] text-muted-foreground">Total visible navigation slots across non-admin users.</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card/80 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Hidden statuses
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-foreground">{hiddenStatusCount}</p>
            <p className="mt-1 text-[12px] text-muted-foreground">Status rules currently hiding workflow states.</p>
          </div>
        </div>
      </motion.div>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-border/50 bg-muted/35 p-2">
        {(
          [
            { key: "users", label: "Users", icon: Shield },
            { key: "nav_permissions", label: "Tab Permissions", icon: Shield },
            { key: "status_permissions", label: "Status Visibility", icon: Eye },
            { key: "security", label: "Security", icon: ShieldCheck },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold tracking-[-0.01em] transition-all duration-300",
              activeTab === tab.key
                ? "bg-card text-foreground shadow-premium-sm ring-1 ring-border/50"
                : "text-muted-foreground hover:bg-card/70 hover:text-foreground",
            )}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "users" && (
        <div className="grid gap-3">
          {users.map((u) => (
            <Card key={u.id} className="overflow-hidden border-border/60 bg-card/95 hover:shadow-premium-md">
              <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center">
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarFallback className="bg-primary/8 text-primary text-[11px] font-bold">
                    {getInitials(u.full_name)}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-foreground">{u.full_name || "Unnamed User"}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{u.email || "No email"}</p>
                </div>

                <span
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[10px] font-semibold capitalize",
                    roleColors[u.role] || roleColors.no_role,
                  )}
                >
                  {u.role.replace("_", " ")}
                </span>

                {isAdmin && (
                  <div className="flex w-full flex-col gap-3 lg:w-auto lg:flex-row lg:items-center">
                    <Select
                      value={u.role}
                      onValueChange={(v) => updateRole.mutate({ userId: u.id, role: v as AppRole })}
                    >
                      <SelectTrigger className="h-10 w-full text-[12px] lg:w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="processor">Processor</SelectItem>
                        <SelectItem value="customer_service">Customer Service</SelectItem>
                        <SelectItem value="opr">OPR (Operator)</SelectItem>
                      </SelectContent>
                    </Select>

                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-[11px]"
                      onClick={() => {
                        setPasswordUserId(u.id);
                        setPasswordUserName(u.full_name || u.email || "User");
                        setNewPasswordValue("");
                        setPasswordDialogOpen(true);
                      }}
                    >
                      <Lock className="h-3 w-3" />
                      Password
                    </Button>

                    {u.role !== "admin" && (
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                        <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-border/60 bg-background/70 px-3 py-2">
                          {getAccessCode(u.id) ? (
                            <>
                              <code className="rounded-md border border-border/40 bg-muted/60 px-2.5 py-1 font-mono text-[13px] font-bold tracking-[0.15em] text-foreground">
                                {getAccessCode(u.id)}
                              </code>

                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                onClick={() => handleCopyCode(getAccessCode(u.id)!)}
                                title="Copy code"
                              >
                                <Copy className="h-3 w-3" />
                              </Button>

                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                onClick={() => handleGenerateCode(u.id)}
                                title="Regenerate code"
                              >
                                <RefreshCw className="h-3 w-3" />
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 text-[11px]"
                              onClick={() => handleGenerateCode(u.id)}
                            >
                              <KeyRound className="h-3 w-3" />
                              Generate Code
                            </Button>
                          )}
                        </div>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 text-destructive/50 hover:border-destructive/20 hover:bg-destructive/5 hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete user "{u.full_name || u.email || "user"}"?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will remove the user's profile, roles, and permissions. The authentication
                                account will be deactivated.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteUser(u.id)}
                                className="bg-destructive text-destructive-foreground"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {activeTab === "nav_permissions" && (
        <Card className="overflow-hidden border-border/60 bg-card/95">
          <CardContent className="p-0">
            <div className="flex flex-col gap-2 border-b border-border/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-primary/8 bg-primary/6">
                  <Shield className="h-3.5 w-3.5 text-primary/70" />
                </div>
                <div>
                  <span className="text-sm font-semibold text-foreground">Navigation Access per User</span>
                  <p className="text-[12px] text-muted-foreground">Show only the tabs each teammate actually needs.</p>
                </div>
              </div>
              <span className="text-[11px] font-medium text-muted-foreground">{ALL_NAV_ITEMS.length} controllable tabs</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/30 bg-muted/20">
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
                      User
                    </th>
                    {ALL_NAV_ITEMS.map((section) => (
                      <th
                        key={section}
                        className="px-3 py-3 text-[10px] font-semibold text-muted-foreground/60 text-center uppercase tracking-wider"
                      >
                        {NAV_SECTION_LABELS[section] || section}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {nonAdminUsers.map((u) => (
                    <tr
                      key={u.id}
                      className="border-b border-border/20 last:border-b-0 hover:bg-muted/10 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar className="h-7 w-7">
                            <AvatarFallback className="bg-muted text-muted-foreground text-[9px] font-bold">
                              {getInitials(u.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-[12px] font-medium">{u.full_name}</p>
                            <p className="text-[10px] text-muted-foreground/50 capitalize">
                              {u.role.replace("_", " ")}
                            </p>
                          </div>
                        </div>
                      </td>

                      {ALL_NAV_ITEMS.map((section) => (
                        <td key={section} className="px-3 py-3 text-center">
                          <Switch
                            checked={getNavPermission(u.id, section)}
                            onCheckedChange={(checked) =>
                              toggleNavPermission.mutate({ userId: u.id, section, allowed: checked })
                            }
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "status_permissions" && (
        <Card className="overflow-hidden border-border/60 bg-card/95">
          <CardContent className="p-0">
            <div className="flex flex-col gap-2 border-b border-border/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-primary/8 bg-primary/6">
                  <Eye className="h-3.5 w-3.5 text-primary/70" />
                </div>
                <div>
                  <span className="text-sm font-semibold text-foreground">Status Visibility per User</span>
                  <p className="text-[12px] text-muted-foreground">
                    Hidden statuses disappear from All Leads, counters, and filters for that user.
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-medium text-muted-foreground">{ALL_LEAD_STATUSES.length} workflow states</span>
            </div>

            <div className="overflow-x-auto">
              <div className="border-b border-border/30 bg-muted/10 px-5 py-4">
                <div className="mb-3">
                  <span className="text-sm font-semibold text-foreground">Role Defaults</span>
                  <p className="text-[12px] text-muted-foreground">
                    Turn a status off for a role to hide leads in that workflow state for that whole role by default.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/30 bg-muted/20">
                        <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
                          Role
                        </th>
                        {ALL_LEAD_STATUSES.map((status) => (
                          <th
                            key={`role-${status}`}
                            className="px-2 py-3 text-[9px] font-semibold text-muted-foreground/60 text-center min-w-[80px] uppercase tracking-wider"
                          >
                            {STATUS_LABELS[status]}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {MANAGED_ROLES.map((managedRole) => (
                        <tr
                          key={managedRole}
                          className="border-b border-border/20 last:border-b-0 hover:bg-muted/10 transition-colors"
                        >
                          <td className="px-4 py-3">
                            <div>
                              <p className="text-[12px] font-medium">{formatRoleLabel(managedRole)}</p>
                              <p className="text-[10px] text-muted-foreground/50">Role-wide default visibility</p>
                            </div>
                          </td>

                          {ALL_LEAD_STATUSES.map((status) => (
                            <td key={`${managedRole}-${status}`} className="px-2 py-3 text-center">
                              <Switch
                                checked={getRoleStatusVisibility(managedRole, status)}
                                onCheckedChange={(checked) =>
                                  toggleStatusVisibility.mutate({
                                    role: managedRole,
                                    status,
                                    isVisible: checked,
                                  })
                                }
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/30 bg-muted/20">
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground/60 sticky left-0 bg-muted/20 z-10 uppercase tracking-wider">
                      User
                    </th>
                    {ALL_LEAD_STATUSES.map((status) => (
                      <th
                        key={status}
                        className="px-2 py-3 text-[9px] font-semibold text-muted-foreground/60 text-center min-w-[80px] uppercase tracking-wider"
                      >
                        {STATUS_LABELS[status]}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {nonAdminUsers.map((targetUser) => (
                    <tr
                      key={targetUser.id}
                      className="border-b border-border/20 last:border-b-0 hover:bg-muted/10 transition-colors"
                    >
                      <td className="px-4 py-3 sticky left-0 bg-card z-10">
                        <div className="flex items-center gap-2.5">
                          <Avatar className="h-7 w-7">
                            <AvatarFallback className="bg-muted text-muted-foreground text-[9px] font-bold">
                              {getInitials(targetUser.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-[12px] font-medium">{targetUser.full_name}</p>
                            <p className="text-[10px] text-muted-foreground/50 capitalize">
                              {targetUser.role.replace("_", " ")}
                            </p>
                          </div>
                        </div>
                      </td>

                      {ALL_LEAD_STATUSES.map((status) => (
                        <td key={status} className="px-2 py-3 text-center">
                          <Switch
                            checked={getStatusVisibility(targetUser.id, status)}
                            onCheckedChange={(checked) =>
                              toggleStatusVisibility.mutate({
                                userId: targetUser.id,
                                status,
                                isVisible: checked,
                              })
                            }
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "security" && (
        <div className="space-y-6">
          <MFAEnroll />
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground/60 font-medium">Full Name</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="John Doe" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground/60 font-medium">Email</Label>
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="john@company.com"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground/60 font-medium">Password</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="********"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground/60 font-medium">Role</Label>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as AppRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="processor">Processor</SelectItem>
                  <SelectItem value="customer_service">Customer Service</SelectItem>
                  <SelectItem value="opr">OPR (Operator)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateUser} disabled={creating || !newEmail || !newPassword || !newName}>
              {creating ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Change Password - {passwordUserName}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground/60 font-medium">New Password</Label>
              <Input
                type="password"
                value={newPasswordValue}
                onChange={(e) => setNewPasswordValue(e.target.value)}
                placeholder="********"
                onKeyDown={(e) => e.key === "Enter" && handleSetPassword()}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSetPassword} disabled={settingPassword || !newPasswordValue}>
              {settingPassword ? "Saving..." : "Set Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Settings;


