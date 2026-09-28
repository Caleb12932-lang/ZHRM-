import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Target, Star, ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { hr, prettyDate, titleCase } from "@/lib/hr";
import { useMe } from "@/hooks/useMe";
import { PageHeader } from "@/components/hr/Shell";
import { StatCard, StatusBadge, EmptyState } from "@/components/hr/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
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

export const Route = createFileRoute("/_authenticated/performance")({
  component: Performance,
});

function Performance() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const [goalOpen, setGoalOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);

  const reviews = useQuery({ queryKey: ["reviews"], queryFn: hr.reviews });
  const goals = useQuery({ queryKey: ["goals"], queryFn: hr.goals });
  const employees = useQuery({ queryKey: ["employees"], queryFn: hr.employees });

  const canReview = Boolean(me?.isHr || me?.isManager);
  const reviewList = reviews.data ?? [];
  const goalList = goals.data ?? [];

  const createGoal = useMutation({
    mutationFn: async (fd: FormData) => {
      const get = (k: string) => String(fd.get(k) ?? "").trim();
      const employeeId = get("employee_id") || me?.employee?.id;
      if (!employeeId) throw new Error("No employee profile found.");
      const { error } = await supabase.from("goals").insert({
        employee_id: employeeId,
        title: get("title"),
        description: get("description") || null,
        due_date: get("due_date") || null,
        progress: 0,
        status: "in_progress",
      } as never);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Goal created");
      setGoalOpen(false);
      qc.invalidateQueries({ queryKey: ["goals"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateProgress = useMutation({
    mutationFn: async ({ id, progress }: { id: string; progress: number }) => {
      const { error } = await supabase
        .from("goals")
        .update({
          progress,
          status: progress >= 100 ? "completed" : "in_progress",
        } as never)
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goals"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const createReview = useMutation({
    mutationFn: async (fd: FormData) => {
      const get = (k: string) => String(fd.get(k) ?? "").trim();
      const { error } = await supabase.from("reviews").insert({
        employee_id: get("employee_id"),
        reviewer_id: me?.employee?.id ?? null,
        period: get("cycle"),
        rating: Number(get("rating")),
        strengths: get("summary") || null,
        status: "submitted",
      } as never);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Review submitted");
      setReviewOpen(false);
      qc.invalidateQueries({ queryKey: ["reviews"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const avgRating = reviewList.length
    ? Math.round(
      (reviewList.reduce((s, r) => s + Number(r.rating ?? 0), 0) / reviewList.length) * 10,
    ) / 10
    : 0;

  return (
    <div>
      <PageHeader
        title="Performance"
        description="Track goals, run review cycles and keep feedback flowing."
        action={
          <div className="flex gap-2">
            <Dialog open={goalOpen} onOpenChange={setGoalOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Plus className="size-4" /> New goal
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create goal</DialogTitle>
                </DialogHeader>
                <form
                  className="grid gap-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    createGoal.mutate(new FormData(e.currentTarget));
                  }}
                >
                  {canReview && (
                    <div className="space-y-2">
                      <Label>Employee</Label>
                      <Select name="employee_id" defaultValue={me?.employee?.id ?? ""}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select employee" />
                        </SelectTrigger>
                        <SelectContent>
                          {(employees.data ?? []).map((e) => (
                            <SelectItem key={e.id} value={e.id}>
                              {e.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="title">Goal</Label>
                    <Input id="title" name="title" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea id="description" name="description" rows={3} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="due_date">Target date</Label>
                    <Input id="due_date" name="due_date" type="date" />
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={createGoal.isPending}>
                      Create goal
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            {canReview && (
              <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="size-4" /> New review
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Write a review</DialogTitle>
                  </DialogHeader>
                  <form
                    className="grid gap-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      createReview.mutate(new FormData(e.currentTarget));
                    }}
                  >
                    <div className="space-y-2">
                      <Label>Employee</Label>
                      <Select name="employee_id" required>
                        <SelectTrigger>
                          <SelectValue placeholder="Select employee" />
                        </SelectTrigger>
                        <SelectContent>
                          {(employees.data ?? []).map((e) => (
                            <SelectItem key={e.id} value={e.id}>
                              {e.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cycle">Cycle</Label>
                      <Input id="cycle" name="cycle" placeholder="e.g. H1 2026" required />
                    </div>
                    <div className="space-y-2">
                      <Label>Rating</Label>
                      <Select name="rating" defaultValue="4">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5].map((n) => (
                            <SelectItem key={n} value={String(n)}>
                              {n} / 5
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="summary">Summary</Label>
                      <Textarea id="summary" name="summary" rows={4} />
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={createReview.isPending}>
                        Submit review
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Active goals" value={goalList.filter((g) => g.status === "in_progress").length} icon={<Target className="size-5" />} />
        <StatCard label="Completed goals" value={goalList.filter((g) => g.status === "completed").length} icon={<ClipboardList className="size-5" />} />
        <StatCard label="Average rating" value={avgRating || "—"} hint="Across all reviews" icon={<Star className="size-5" />} />
      </div>

      <Tabs defaultValue="goals" className="mt-6">
        <TabsList>
          <TabsTrigger value="goals">Goals</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
        </TabsList>

        <TabsContent value="goals" className="mt-4">
          {goalList.length === 0 ? (
            <EmptyState title="No goals yet" hint="Create a goal to start tracking progress." />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {goalList.map((g) => (
                <Card key={g.id}>
                  <CardHeader className="flex-row items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">{g.title}</CardTitle>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {g.employee?.full_name ?? "—"} · due {prettyDate(g.due_date)}
                      </p>
                    </div>
                    <StatusBadge status={g.status} />
                  </CardHeader>
                  <CardContent>
                    {g.description && (
                      <p className="mb-3 text-sm text-muted-foreground">{g.description}</p>
                    )}
                    <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                      <span>Progress</span>
                      <span>{g.progress}%</span>
                    </div>
                    <Progress value={g.progress} />
                    <div className="mt-3 flex flex-wrap gap-2">
                      {[25, 50, 75, 100].map((p) => (
                        <Button
                          key={p}
                          size="sm"
                          variant="outline"
                          onClick={() => updateProgress.mutate({ id: g.id, progress: p })}
                        >
                          {p}%
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="reviews" className="mt-4">
          {reviewList.length === 0 ? (
            <EmptyState title="No reviews yet" hint="Reviews written for you or your team appear here." />
          ) : (
            <div className="space-y-3">
              {reviewList.map((r) => (
                <Card key={r.id}>
                  <CardContent className="p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">{r.employee?.full_name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.period} · {r.employee?.job_title ?? "Role not set"}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold">{r.rating}/5</span>
                        <StatusBadge status={titleCase(r.status)} />
                      </div>
                    </div>
                    {r.strengths && (
                      <p className="mt-3 text-sm text-muted-foreground">{r.strengths}</p>
                    )}
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
