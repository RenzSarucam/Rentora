import type { Metadata } from "next";
import { SignOutButton } from "@/components/app/sign-out-button";
import { getProfile } from "@/features/boarder/queries";
import { ChangePasswordButton, ProfileForm } from "@/features/boarder/profile-form";
import { Card, CardHeading, ScreenTitle } from "@/features/boarder/ui";
import { requireBoarder } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Me" };

export default async function ProfilePage() {
  const viewer = await requireBoarder();
  const profile = await getProfile(viewer);

  return (
    <div className="grid gap-4">
      <ScreenTitle sub={viewer.orgName}>{viewer.fullName}</ScreenTitle>

      <Card>
        <CardHeading>Personal details</CardHeading>
        <p className="mb-4 text-sm text-muted-foreground">
          Signed in as <span className="font-medium text-foreground">{viewer.email}</span>. To change your email, ask your landlord.
        </p>
        {profile && <ProfileForm profile={profile} />}
      </Card>

      <Card>
        <CardHeading>Account</CardHeading>
        <div className="grid gap-4">
          <ChangePasswordButton email={viewer.email} />
          <SignOutButton className="h-11 w-full justify-center rounded-xl border border-border text-foreground" label="Sign out" />
        </div>
      </Card>
    </div>
  );
}
