import { Building2, Palette, Smartphone, Info, BookOpen } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
export const metadata = { title: "More" };
export default function MorePage() {
  return (
    <>
      <PageHeading
        title="Your workspace"
        description="Institute information and preferences, all in one place."
      />
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Card className="p-6">
          <Building2 className="mb-4 size-6 text-primary" />
          <h2 className="text-lg font-bold">Institute information</h2>
          <dl className="mt-5 space-y-5 text-sm">
            <div>
              <dt className="text-muted-foreground">Institute name</dt>
              <dd className="mt-1 font-semibold">Saraswati Vidya Institute</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Location</dt>
              <dd className="mt-1">Kota, Rajasthan</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Type</dt>
              <dd className="mt-1">School + Coaching</dd>
            </div>
          </dl>
          <p className="mt-5 rounded-xl bg-muted p-3 text-xs leading-6 text-muted-foreground">
            This is a sample institute. An organization switcher will be added
            to the header in the future.
          </p>
        </Card>
        <div className="space-y-5">
          <Card className="flex items-center justify-between gap-4 p-5">
            <div className="flex items-center gap-3">
              <Palette className="size-5 text-primary" />
              <div>
                <h2 className="font-semibold">Choose your theme</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Light / dark • Saved on this device
                </p>
              </div>
            </div>
            <ThemeToggle />
          </Card>
          <Card className="p-5">
            <Smartphone className="mb-3 size-5 text-primary" />
            <h2 className="font-semibold">Add to Home Screen</h2>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              On Android, open the Chrome menu (⋮) and select “Add to Home
              screen” or “Install app”, if available.
            </p>
            <p className="mt-3 text-xs leading-6 text-muted-foreground">
              Installation depends on your browser. This preview requires an
              internet connection; offline support is not included.
            </p>
          </Card>
          <Card className="p-5">
            <Info className="mb-3 size-5 text-primary" />
            <h2 className="font-semibold">About this preview</h2>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              Sample records only. Organization sign-in is available separately.
              Student, fee, attendance and subscription services are not
              connected yet.
            </p>
            <p className="mt-4 flex items-center gap-2 text-xs text-primary">
              <BookOpen className="size-4" />
              Vidya • Version 0.1
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
