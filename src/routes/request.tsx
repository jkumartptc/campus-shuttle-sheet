import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { CheckCircle2, Bus } from "lucide-react";

export const Route = createFileRoute("/request")({
  head: () => ({
    meta: [
      { title: "Transport Request — College Transport" },
      { name: "description", content: "Request college transport facility. Submit your details to the transport office." },
      { property: "og:title", content: "Transport Request Form" },
      { property: "og:description", content: "Apply for college bus transport facility." },
    ],
  }),
  component: RequestPage,
});

const initial = {
  name: "", register_no: "", department: "", year: "",
  mobile: "", father_name: "", father_mobile: "", bus_stop_name: "",
};

function RequestPage() {
  const [form, setForm] = useState(initial);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const set = (k: keyof typeof initial) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    for (const [k, v] of Object.entries(form)) {
      if (!String(v).trim()) return toast.error(`Please fill ${k.replace(/_/g, " ")}`);
    }
    if (!/^\d{10}$/.test(form.mobile)) return toast.error("Mobile must be 10 digits");
    if (!/^\d{10}$/.test(form.father_mobile)) return toast.error("Father mobile must be 10 digits");
    setSubmitting(true);
    const { error } = await supabase.from("transport_requests").insert({
      name: form.name.trim(),
      register_no: form.register_no.trim(),
      department: form.department.trim(),
      year: form.year.trim(),
      mobile: form.mobile.trim(),
      father_name: form.father_name.trim(),
      father_mobile: form.father_mobile.trim(),
      bus_stop_name: form.bus_stop_name.trim(),
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    setDone(true);
    setForm(initial);
  };

  if (done) {
    return (
      <div className="min-h-screen bg-muted/40 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-10 pb-8 text-center space-y-4">
            <CheckCircle2 className="h-14 w-14 text-green-600 mx-auto" />
            <h1 className="text-2xl font-bold">Request Submitted</h1>
            <p className="text-muted-foreground">
              Thank you. Your transport request has been received. The transport office will contact you shortly.
            </p>
            <Button variant="outline" onClick={() => setDone(false)}>Submit another request</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/40 py-8 px-4">
      <Card className="max-w-2xl mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Bus className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Transport Facility Request</CardTitle>
          <p className="text-sm text-muted-foreground">Fill the form below to request college bus transport.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Student Name *"><Input value={form.name} onChange={set("name")} maxLength={100} /></Field>
            <Field label="Register Number *"><Input value={form.register_no} onChange={set("register_no")} maxLength={50} /></Field>
            <Field label="Department *"><Input value={form.department} onChange={set("department")} maxLength={100} /></Field>
            <Field label="Year of Study *"><Input value={form.year} onChange={set("year")} placeholder="I / II / III / IV" maxLength={20} /></Field>
            <Field label="Mobile Number *"><Input value={form.mobile} onChange={set("mobile")} inputMode="numeric" maxLength={10} placeholder="10-digit mobile" /></Field>
            <Field label="Father's Name *"><Input value={form.father_name} onChange={set("father_name")} maxLength={100} /></Field>
            <Field label="Father's Mobile *"><Input value={form.father_mobile} onChange={set("father_mobile")} inputMode="numeric" maxLength={10} placeholder="10-digit mobile" /></Field>
            <Field label="Bus Stop Name *"><Input value={form.bus_stop_name} onChange={set("bus_stop_name")} maxLength={100} placeholder="Nearest bus stop" /></Field>
            <div className="sm:col-span-2 pt-2">
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Submitting…" : "Submit Request"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      {children}
    </div>
  );
}
