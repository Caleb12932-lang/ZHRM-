import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, Users, CalendarDays, Briefcase, Banknote, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ZHRM — People, leave, hiring & payroll in one place" },
      {
        name: "description",
        content:
          "ZHRM brings your employee directory, leave, attendance, recruitment, payroll and performance reviews into one calm workspace.",
      },
      { property: "og:title", content: "ZHRM — Modern HR workspace" },
      {
        property: "og:description",
        content:
          "Directory, leave, attendance, hiring, payroll and performance — one workspace for your whole team.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: Users, title: "People directory", text: "Profiles, teams, contact details and org structure kept current." },
  { icon: CalendarDays, title: "Leave & attendance", text: "Self-service requests, approvals and daily clock in/out." },
  { icon: Briefcase, title: "Recruitment", text: "Post roles, track candidates through stages and onboard new hires." },
  { icon: Banknote, title: "Payroll & reviews", text: "Payslips, pay periods, goals and structured review cycles." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="flex items-center gap-2 font-semibold text-primary">
          <Building2 className="size-5" /> ZHRM
        </span>
        <Button asChild size="sm">
          <Link to="/auth">Sign in</Link>
        </Button>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-6 pb-16 pt-10 sm:pt-20">
          <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
            Human resources, simplified
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            One calm workspace for your people, from hire to payroll.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
            Directory, time off, attendance, hiring, payroll and performance — all connected, with
            role-based access so everyone sees exactly what they should.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/auth">
                Get started <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/dashboard">Open dashboard</Link>
            </Button>
          </div>
        </section>

        <section className="border-t bg-muted/40">
          <div className="mx-auto grid max-w-6xl gap-6 px-6 py-16 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <div key={f.title} className="rounded-xl border bg-card p-6">
                <f.icon className="size-6 text-primary" />
                <h2 className="mt-4 font-semibold">{f.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-6xl px-6 py-10 text-sm text-muted-foreground">
        © {new Date().getFullYear()} ZHRM
      </footer>
    </div>
  );
}
