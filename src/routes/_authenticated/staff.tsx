import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useCurrentUser, useIsAdmin } from "@/lib/use-role";
import { ShieldCheck, User as UserIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/staff")({
  head: () => ({ meta: [{ title: "Staff — Transport Admin" }] }),
  component: StaffPage,
});

function StaffPage() {
  const { user } = useCurrentUser();
  const isAdmin = useIsAdmin(user?.id);
  const [rows, setRows] = useState<any[]>([]);

  const load = useCallback(async () => {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name, email, created_at").order("created_at");
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");
    const rolesByUser = new Map<string, string[]>();
    (roles ?? []).forEach((r: any) => {
      const list = rolesByUser.get(r.user_id) ?? [];
      list.push(r.role);
      rolesByUser.set(r.user_id, list);
    });
    setRows((profiles ?? []).map((p: any) => ({ ...p, roles: rolesByUser.get(p.id) ?? [] })));
  }, []);
  useEffect(() => { load(); }, [load]);

  const promote = async (uid: string) => {
    const { error } = await supabase.from("user_roles").insert({ user_id: uid, role: "admin" });
    if (error) return toast.error(error.message);
    toast.success("Promoted to admin"); load();
  };
  const demote = async (uid: string) => {
    if (uid === user?.id) return toast.error("You cannot remove your own admin role");
    const { error } = await supabase.from("user_roles").delete().eq("user_id", uid).eq("role", "admin");
    if (error) return toast.error(error.message);
    toast.success("Admin removed"); load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Staff</h1>
        <p className="text-sm text-muted-foreground">
          Staff create accounts via the sign-up page. {isAdmin ? "You can promote staff to admin here." : "Only admins can change roles."}
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">All staff</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.length === 0 && <TableRow><TableCell colSpan={4} className="py-6 text-center text-muted-foreground">No staff yet.</TableCell></TableRow>}
              {rows.map((r) => {
                const admin = r.roles.includes("admin");
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {admin ? <ShieldCheck className="h-4 w-4 text-primary" /> : <UserIcon className="h-4 w-4 text-muted-foreground" />}
                        {r.full_name ?? "—"}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.email ?? "—"}</TableCell>
                    <TableCell><Badge variant={admin ? "default" : "secondary"}>{admin ? "Admin" : "Staff"}</Badge></TableCell>
                    <TableCell className="text-right">
                      {isAdmin && !admin && <Button size="sm" variant="outline" onClick={() => promote(r.id)}>Make admin</Button>}
                      {isAdmin && admin && r.id !== user?.id && <Button size="sm" variant="ghost" onClick={() => demote(r.id)}>Remove admin</Button>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
