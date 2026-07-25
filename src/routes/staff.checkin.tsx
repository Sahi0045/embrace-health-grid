/**
 * /staff/checkin — alias entry point for the Room Check-In page.
 * The sidebar links to /staff/rooms; the Doctor Locator links here.
 * Both render the same full-featured check-in experience.
 */
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/staff/checkin")({
  beforeLoad: () => {
    throw redirect({ to: "/staff/rooms" });
  },
  component: () => null,
});
