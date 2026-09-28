import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Briefcase, Users, UserCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { hr, HIRING_STAGES, prettyDate, titleCase } from "@/lib/hr";
import { useMe } from "@/hooks/useMe";
import { PageHeader } from "@/components/hr/Shell";
import { StatCard, StatusBadge, EmptyState } from "@/components/hr/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/recruitment")({
  component: Recruitment,
});

function Recruitment() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const [jobOpen, setJobOpen] = useState(false);
  const [applicantOpen, setApplicantOpen] = useState(false);

  const jobs = useQuery({ queryKey: ["jobs"], queryFn: hr.jobs });
  const applicants = useQuery({ queryKey: ["applicants"], queryFn: hr.applicants });
  const onboarding = useQuery({ queryKey: ["onboarding"], queryFn: hr.onboarding });
  const departments = useQuery({ queryKey: ["departments"], queryFn: hr.departments });

  const createJob = useMutation({
    mutationFn: async (fd: FormData) => {
      const get = (k: string) => String(fd.get(k) ?? "").trim();
      const payload: Record<string, unknown> = {
        title: get("title"),
        description: get("description") || null,
        location: get("location") || null,
        employment_type: get("employment_type") || "full_time",
        status: "open",
      };
      const dept = get("department_id");
      if (dept && dept !== "none") payload["department_id"] = dept;
      const { error } = await supabase.from("job_postings").insert(payload as never);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Job posted");
      setJobOpen(false);
      qc.invalidateQueries({ queryKey: ["jobs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addApplicant = useMutation({
    mutationFn: async (fd: FormData) => {
      const get = (k: string) => String(fd.get(k) ?? "").trim();
      const { error } = await supabase.from("applicants").insert({
        job_id: get("job_id"),
        full_name: get("full_name"),
        email: get("email"),
        phone: get("phone") || null,
        notes: get("notes") || null,
        stage: "applied",
      } as never);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Applicant added");
      setApplicantOpen(false);
      qc.invalidateQueries({ queryKey: ["applicants"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const moveStage = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      const { error } = await supabase.from("applicants").update({ stage } as never).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["applicants"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleTask = useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await supabase
        .from("onboarding_tasks")
        .update({ status: done ? "completed" : "pending" } as never)
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["onboarding"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const jobList = jobs.data ?? [];
  const applicantList = applicants.data ?? [];
  const isHr = Boolean(me?.isHr);

  return (
    <div>
      <PageHeader
        title="Recruitment & onboarding"
        description="Publish roles, move candidates through your pipeline and onboard new hires."
        action={
          isHr ? (
            <div className="flex gap-2">
              <Dialog open={applicantOpen} onOpenChange={setApplicantOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">Add applicant</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add applicant</DialogTitle>
                  </DialogHeader>
                  <form
                    className="grid gap-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      addApplicant.mutate(new FormData(e.currentTarget));
                    }}
                  >
                    <div className="space-y-2">
                      <Label>Role</Label>
                      <Select name="job_id" required>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                        <SelectContent>
                          {jobList.map((j) => (
                            <SelectItem key={j.id} value={j.id}>
                              {j.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="full_name">Candidate name</Label>
                      <Input id="full_name" name="full_name" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" name="email" type="email" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input id="phone" name="phone" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea id="notes" name="notes" rows={3} />
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={addApplicant.isPending}>
                        Save applicant
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>

              <Dialog open={jobOpen} onOpenChange={setJobOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="size-4" /> Post a role
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Post a role</DialogTitle>
                  </DialogHeader>
                  <form
                    className="grid gap-4 sm:grid-cols-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      createJob.mutate(new FormData(e.currentTarget));
                    }}
                  >
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="title">Job title</Label>
                      <Input id="title" name="title" required />
                    </div>
                    <div className="space-y-2">
                      <Label>Department</Label>
                      <Select name="department_id" defaultValue="none">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Unassigned</SelectItem>
                          {(departments.data ?? []).map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="location">Location</Label>
                      <Input id="location" name="location" />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Employment type</Label>
                      <Select name="employment_type" defaultValue="full_time">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["full_time", "part_time", "contract", "intern"].map((t) => (
                            <SelectItem key={t} value={t}>
                              {titleCase(t)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea id="description" name="description" rows={4} />
                    </div>
                    <DialogFooter className="sm:col-span-2">
                      <Button type="submit" disabled={createJob.isPending}>
                        Publish role
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Open roles" value={jobList.filter((j) => j.status === "open").length} icon={<Briefcase className="size-5" />} />
        <StatCard label="Candidates" value={applicantList.length} icon={<Users className="size-5" />} />
        <StatCard label="Hired" value={applicantList.filter((a) => a.stage === "hired").length} icon={<UserCheck className="size-5" />} />
      </div>

      <Tabs defaultValue="pipeline" className="mt-6">
        <TabsList>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="mt-4">
          {applicantList.length === 0 ? (
            <EmptyState title="No candidates yet" hint="Add applicants to start your pipeline." />
          ) : (
            <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
              {HIRING_STAGES.map((stage) => (
                <div key={stage} className="rounded-lg border bg-card p-3">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {titleCase(stage)} · {applicantList.filter((a) => a.stage === stage).length}
                  </p>
                  <div className="space-y-2">
                    {applicantList
                      .filter((a) => a.stage === stage)
                      .map((a) => (
                        <div key={a.id} className="rounded-md bg-muted/50 p-3">
                          <p className="text-sm font-medium">{a.full_name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {a.job?.title ?? "Role removed"}
                          </p>
                          {isHr && (
                            <Select
                              value={stage}
                              onValueChange={(v) => moveStage.mutate({ id: a.id, stage: v })}
                            >
                              <SelectTrigger className="mt-2 h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {HIRING_STAGES.map((s) => (
                                  <SelectItem key={s} value={s}>
                                    {titleCase(s)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="roles" className="mt-4">
          {jobList.length === 0 ? (
            <EmptyState title="No roles published" />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {jobList.map((j) => (
                <Card key={j.id}>
                  <CardHeader className="flex-row items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">{j.title}</CardTitle>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {j.department?.name ?? "Unassigned"} · {j.location ?? "Remote"}
                      </p>
                    </div>
                    <StatusBadge status={j.status} />
                  </CardHeader>
                  <CardContent>
                    <p className="line-clamp-3 text-sm text-muted-foreground">
                      {j.description ?? "No description provided."}
                    </p>
                    <p className="mt-3 text-xs text-muted-foreground">
                      {applicantList.filter((a) => a.job_id === j.id).length} applicants ·{" "}
                      {titleCase(j.employment_type)}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="onboarding" className="mt-4">
          {(onboarding.data ?? []).length === 0 ? (
            <EmptyState title="No onboarding tasks" hint="Tasks assigned to new hires show up here." />
          ) : (
            <div className="space-y-2">
              {(onboarding.data ?? []).map((t) => (
                <Card key={t.id}>
                  <CardContent className="flex items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{t.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.employee?.full_name ?? "Unassigned"} · due {prettyDate(t.due_date)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={t.status} />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          toggleTask.mutate({ id: t.id, done: t.status !== "completed" })
                        }
                      >
                        {t.status === "completed" ? "Reopen" : "Complete"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
