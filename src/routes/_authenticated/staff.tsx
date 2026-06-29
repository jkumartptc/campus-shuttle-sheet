import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useCurrentUser, useIsAdmin, type AppRole } from "@/lib/use-role";
import { deleteStaffUser } from "@/lib/staff-admin.functions";
import { ShieldCheck, Trash2, User as UserIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/staff")({
  head: () => ({ meta: [{ title: "Staff — Transport Admin" }] }),
  component: StaffPage,
});

const ROLE_OPTIONS: AppRole[] = ["admin", "staff", "driver", "accounts"];

function StaffPage() {
  const { user } = useCurrentUser();
  const isAdmin = useIsAdmin(user?.id);
  const [rows, setRows] = useState<any[]>([]);
  const [toDelete, setToDelete] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const deleteFn = useServerFn(deleteStaffUser);

  const load = useCallback(async () => {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name, email, created_at").order("created_at");
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");
    const rolesByUser = new Map<string, AppRole[]>();
    (roles ?? []).forEach((r: any) => {
      const list = rolesByUser.get(r.user_id) ?? [];
      list.push(r.role);
      rolesByUser.set(r.user_id, list);
    });
    setRows((profiles ?? []).map((p: any) => ({ ...p, roles: rolesByUser.get(p.id) ?? [] })));
  }, []);
  useEffect(() => { load(); }, [load]);

  const setRole = async (uid: string, current: AppRole[], next: AppRole) => {
    if (uid === user?.id && current.includes("admin") && next !== "admin") {
      return toast.error("You cannot remove your own admin role");
    }
    // Replace all roles with the chosen one (single primary role per user).
    const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", uid);
    if (delErr) return toast.error(delErr.message);
    const { error: insErr } = await supabase.from("user_roles").insert({ user_id: uid, role: next });
    if (insErr) return toast.error(insErr.message);
    toast.success(`Role set to ${next}`);
    load();
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteFn({ data: { userId: toDelete.id } });
      toast.success(`Deleted ${toDelete.name}`);
      setToDelete(null);
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete user");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Staff</h1>
        <p className="text-sm text-muted-foreground">
          Staff create accounts via the sign-up page. {isAdmin ? "You can change their role (admin, staff, driver, accounts) here." : "Only admins can change roles."}
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">All users</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead className="text-right">Change role</TableHead><TableHead className="text-right">Delete</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.length === 0 && <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground">No staff yet.</TableCell></TableRow>}
              {rows.map((r) => {
                const current: AppRole[] = r.roles;
                const primary: AppRole = current.includes("admin") ? "admin"
                  : current.includes("accounts") ? "accounts"
                  : current.includes("driver") ? "driver"
                  : "staff";
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {primary === "admin" ? <ShieldCheck className="h-4 w-4 text-primary" /> : <UserIcon className="h-4 w-4 text-muted-foreground" />}
                        {r.full_name ?? "—"}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.email ?? "—"}</TableCell>
                    <TableCell><Badge variant={primary === "admin" ? "default" : "secondary"}>{primary}</Badge></TableCell>
                    <TableCell className="text-right">
                      {isAdmin ? (
                        <Select value={primary} onValueChange={(v) => setRole(r.id, current, v as AppRole)}>
                          <SelectTrigger className="ml-auto w-36"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {ROLE_OPTIONS.map((role) => (
                              <SelectItem key={role} value={role}>{role}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
                    </TableCell>
                    <TableCell className="text-right">
                      {isAdmin && r.id !== user?.id ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setToDelete({ id: r.id, name: r.full_name ?? r.email ?? "this user" })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {toDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the user account, their roles, and their profile. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

