"use client";
import { useEffect, useRef, useState } from "react";
import { prepareInvitation } from "@/app/join/actions";

export function InvitationLanding() {
  const started = useRef(false);
  const [message, setMessage] = useState("Opening invitation…");
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const token = window.location.hash.slice(1);
    // Remove the secret from browser history before doing any network work.
    window.history.replaceState(null, "", "/join");
    void prepareInvitation(token).then((result) => {
      if (result.error) setMessage(result.error);
      // Deliberate full-document navigation: router.push/replace would retain
      // the landing's restrictive CSP. Only leave AFTER the cookie is set.
      else window.location.replace("/join/accept");
    }).catch(() => setMessage("Could not open this invitation. Reopen the original link to try again."));
  }, []);
  return <p role="status" className="text-sm text-muted-foreground">{message}</p>;
}
