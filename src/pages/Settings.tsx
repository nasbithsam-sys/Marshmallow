import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { ALL_LEAD_STATUSES, STATUS_LABELS, ALL_NAV_ITEMS } from "@/lib/constants";
import { adminApi } from "@/lib/admin-api";
import { logActivity } from "@/lib/activity";
import type { AppRole } from "@/types";
import MFAEnroll from "@/components/auth/MFAEnroll";
import { motion } from "framer-motion";
import { heroTitle, staggerContainer, staggerItem } from "@/lib/motion";

const generateCode = () => String(Math.floor(100000 + Math.random() * 900000));

const NAV_SECTION_LABELS: Record<string, string> = {
  leads: "All Leads",
  analytics: "Analytics",
  settings: "Settings",
  activity_logs: "Activity Logs",
  schedule: "Schedule",
  map: "Lead Map",
  areas: "Area Insights",
};

const roleColors: Record<string, string> = {
  admin: "bg-primary/8 text-primary border-primary/10",
  processor: "bg-[hsl(var(--success)/0.08)] text-[hsl(var(--success))] border-[hsl(var(--success)/0.1)]",
  customer_service: "bg-[hsl(var(--warning)/0.08)] text-[hsl(var(--warning))] border-[hsl(var(--warning)/0.1)]",
  no_role: "bg-muted text-muted-foreground border-border",
};

const VISIBILITY_ROLES: Array<{ key: "customer_service" | "processor"; label: string }> = [
  { key: "customer_service", label: "Customer Service" },
  { key: "processor", label: "Processor" },
];

const formatRoleLabel = (role?: string | null) => {
  if (!role) return "No Role";
  return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
};

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

  const { data: users = [] } = useQuery({
    queryKey: ["settings-users"],
    queryFn: async () => {
      const { data: profiles } = await supabase.from("profiles").select("*");
      const { data: roles } = await supabase.from("user_roles").select("*");

      return (profiles ?? []).map((p: any) => ({
        ...p,
        role: roles?.find((r: any) => r.user_id === p.id)?.role ?? "no_role",
      }));
    },
  });

  const { data: accessCodes = [] } = useQuery({
    queryKey: ["user-access-codes"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from("user_access_codes").select("*");
      return data ?? [];
    },
  });

  const { data: navPermissions = [] } = useQuery({
    queryKey: ["settings-nav-permissions"],
    queryFn: async () => {
      const { data } = await supabase.from("navigation_permissions").select("*");
      return data ?? [];
    },
  });

  const { data: statusVisibility = [] } = useQuery({
    queryKey: ["settings-status-visibility"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("lead_status_visibility").select("*");

      if (error) {
        throw error;
      }

      return data ?? [];
    },
  });

  const getUserById = (userId: string) => users.find((u: any) => u.id === userId);

  const getAccessCode = (userId: string) => {
    return (accessCodes as any[]).find((c: any) => c.user_id === userId)?.code ?? null;
  };

  const handleGenerateCode = async (userId: string) => {
    const code = generateCode();
    const existing = (accessCodes as any[]).find((c: any) => c.user_id === userId);
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
      const existing = navPermissions.find((p: any) => p.user_id === userId && p.nav_section === section);
      const targetUser = getUserById(userId);
      const beforeAllowed = (existing as any)?.allowed ?? false;

      if (existing) {
        await supabase
          .from("navigation_permissions")
          .update({ allowed })
          .eq("id", (existing as any).id);
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
      role,
      status,
      isVisible,
    }: {
      role: "customer_service" | "processor";
      status: string;
      isVisible: boolean;
    }) => {
      const existing = (statusVisibility as any[]).find((row: any) => row.role === role && row.status === status);
      const beforeVisible = existing?.is_visible ?? true;

      if (existing) {
        const { error } = await (supabase as any)
          .from("lead_status_visibility")
          .update({ is_visible: isVisible })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("lead_status_visibility").insert({
          role,
          status,
          is_visible: isVisible,
        });

        if (error) throw error;
      }

      if (user) {
        await logActivity(user.id, "updated", "user", `${role}_${status}`, {
          target_name: `${formatRoleLabel(role)} role`,
          changes: {
            [status]: {
              before: beforeVisible,
              after: isVisible,
            },
          },
          message: `Admin ${isVisible ? "showed" : "hid"} "${STATUS_LABELS[status] || status}" status for "${formatRoleLabel(role)}" role.`,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings-status-visibility"] });
      queryClient.invalidateQueries({ queryKey: ["lead-status-visibility"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Status visibility updated");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to update status visibility");
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
    } catch (err: any) {
      toast.error(err.message || "Failed to create user");
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
    } catch (err: any) {
      toast.error(err.message || "Failed to set password");
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
    } catch (err: any) {
      toast.error(err.message || "Failed to delete user");
    }
  };

  const getNavPermission = (userId: string, section: string) => {
    const perm = navPermissions.find((p: any) => p.user_id === userId && p.nav_section === section);
    return (perm as any)?.allowed ?? false;
  };

  const getStatusVisibility = (role: "customer_service" | "processor", status: string) => {
    const row = (statusVisibility as any[]).find((p: any) => p.role === role && p.status === status);
    return row?.is_visible ?? true;
  };

  const getInitials = (name: string) =>
    name
      ?.split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "U";

  const nonAdminUsers = users.filter((u: any) => u.role !== "admin");

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between">
        <motion.div variants={heroTitle} initial="initial" animate="animate">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage users, permissions, and security</p>
        </motion.div>

        {isAdmin && (
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Create User
          </Button>
        )}
      </div>

      <div className="flex gap-1 bg-muted/50 rounded-lg p-1 w-fit flex-wrap border border-border/30">
        {(
          [
            { key: "users", label: "Users", icon: null },
            { key: "nav_permissions", label: "Tab Permissions", icon: null },
            { key: "status_permissions", label: "Status Visibility", icon: null },
            { key: "security", label: "Security", icon: ShieldCheck },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "px-4 py-2 rounded-md text-[13px] font-medium transition-all duration-200 flex items-center gap-1.5",
              activeTab === tab.key
                ? "bg-card text-foreground shadow-premium-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.icon && <tab.icon className="h-3.5 w-3.5" />}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "users" && (
        <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid gap-3">
          {users.map((u: any) => (
            <motion.div key={u.id} variants={staggerItem}>
              <Card className="hover:shadow-premium-md">
                <CardContent className="p-4 flex items-center gap-4">
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarFallback className="bg-primary/8 text-primary text-[11px] font-bold">
                      {getInitials(u.full_name)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-foreground">{u.full_name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{u.email}</p>
                  </div>

                  <span
                    className={cn(
                      "px-2.5 py-1 rounded-full text-[10px] font-semibold capitalize border",
                      roleColors[u.role] || roleColors.no_role,
                    )}
                  >
                    {u.role.replace("_", " ")}
                  </span>

                  {isAdmin && (
                    <>
                      <Select
                        value={u.role}
                        onValueChange={(v) => updateRole.mutate({ userId: u.id, role: v as AppRole })}
                      >
                        <SelectTrigger className="w-[140px] h-9 text-[12px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="processor">Processor</SelectItem>
                          <SelectItem value="customer_service">Customer Service</SelectItem>
                        </SelectContent>
                      </Select>

                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-[11px]"
                        onClick={() => {
                          setPasswordUserId(u.id);
                          setPasswordUserName(u.full_name);
                          setNewPasswordValue("");
                          setPasswordDialogOpen(true);
                        }}
                      >
                        <Lock className="h-3 w-3" />
                        Password
                      </Button>

                      {u.role !== "admin" && (
                        <>
                          <div className="flex items-center gap-1.5 border-l border-border/30 pl-3 ml-1">
                            {getAccessCode(u.id) ? (
                              <>
                                <code className="font-mono text-[13px] font-bold text-foreground bg-muted/60 px-2.5 py-1 rounded-md border border-border/40 tracking-[0.15em]">
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
                                className="h-8 w-8 text-destructive/50 hover:text-destructive hover:bg-destructive/5 hover:border-destructive/20"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete user "{u.full_name}"?</AlertDialogTitle>
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
                        </>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      {activeTab === "nav_permissions" && (
        <Card>
          <CardContent className="p-0">
            <div className="px-5 py-3.5 border-b border-border/40 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-primary/6 border border-primary/8 flex items-center justify-center">
                <Shield className="h-3.5 w-3.5 text-primary/70" />
              </div>
              <span className="text-sm font-semibold text-foreground">Navigation Access per User</span>
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
                  {nonAdminUsers.map((u: any) => (
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
        <Card>
          <CardContent className="p-0">
            <div className="px-5 py-3.5 border-b border-border/40 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-primary/6 border border-primary/8 flex items-center justify-center">
                <Eye className="h-3.5 w-3.5 text-primary/70" />
              </div>
              <span className="text-sm font-semibold text-foreground">Status Visibility by Role</span>
              <span className="text-[10px] text-muted-foreground/40 ml-2">
                Hidden statuses disappear from All Leads, tabs, counters, and filters
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/30 bg-muted/20">
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground/60 sticky left-0 bg-muted/20 z-10 uppercase tracking-wider">
                      Role
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
                  {VISIBILITY_ROLES.map((roleRow) => (
                    <tr
                      key={roleRow.key}
                      className="border-b border-border/20 last:border-b-0 hover:bg-muted/10 transition-colors"
                    >
                      <td className="px-4 py-3 sticky left-0 bg-card z-10">
                        <div>
                          <p className="text-[12px] font-medium">{roleRow.label}</p>
                          <p className="text-[10px] text-muted-foreground/50">{roleRow.key}</p>
                        </div>
                      </td>

                      {ALL_LEAD_STATUSES.map((status) => (
                        <td key={status} className="px-2 py-3 text-center">
                          <Switch
                            checked={getStatusVisibility(roleRow.key, status)}
                            onCheckedChange={(checked) =>
                              toggleStatusVisibility.mutate({
                                role: roleRow.key,
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
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <MFAEnroll />
        </motion.div>
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
                placeholder="••••••••"
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
            <DialogTitle>Change Password — {passwordUserName}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground/60 font-medium">New Password</Label>
              <Input
                type="password"
                value={newPasswordValue}
                onChange={(e) => setNewPasswordValue(e.target.value)}
                placeholder="••••••••"
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
