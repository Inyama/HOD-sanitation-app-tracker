import type { Metadata } from "next";
import { requirePage } from "@/lib/auth/session";
import { repo } from "@/lib/repo";
import { serverNow } from "@/lib/time/server-now";
import { formatShort, MEETING_ZONE } from "@/lib/time/zone";
import { loadMessagingScreen } from "@/lib/admin/ops-messages";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageComposer } from "@/components/admin/MessageComposer";
import { MessageHistory } from "@/components/admin/MessageHistory";
import { AnnouncementsPanel } from "@/components/admin/AnnouncementsPanel";

export const metadata: Metadata = { title: "Messaging" };

export default async function MessagesPage({ searchParams }: PageProps<"/admin/messages">) {
  await requirePage("/admin/messages");
  const now = await serverNow();
  const d = await loadMessagingScreen(repo(), now);
  const tab = (await searchParams).tab;
  const scheduled = d.history.filter((h) => h.status === "SCHEDULED").length;
  return (
    <>
      <PageHeader
        title="Messaging center"
        subtitle="Write to everyone or to exactly the right people, now or later, and see who read it."
      />
      <Tabs defaultValue={tab === "sent" || tab === "announcements" ? tab : "compose"}>
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="compose" className="min-h-10">
            Compose
          </TabsTrigger>
          <TabsTrigger value="sent" className="min-h-10 gap-1.5">
            Sent and scheduled{" "}
            {scheduled > 0 && (
              <span className="tabular rounded-full bg-muted px-1.5 text-xs">{scheduled} scheduled</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="announcements" className="min-h-10">
            Announcements
          </TabsTrigger>
        </TabsList>
        <TabsContent value="compose" className="mt-4">
          <MessageComposer
            people={d.people}
            teams={d.teams}
            nextMeeting={d.nextMeeting}
            minSchedule={now.setZone(MEETING_ZONE).plus({ minutes: 5 }).toFormat("yyyy-LL-dd'T'HH:mm")}
          />
        </TabsContent>
        <TabsContent value="sent" className="mt-4">
          <MessageHistory
            items={d.history.map((h) => ({
              ...h,
              whenLabel:
                h.status === "SCHEDULED"
                  ? `for ${formatShort(h.scheduledFor!)}`
                  : h.sentAt
                    ? formatShort(h.sentAt)
                    : h.scheduledFor
                      ? `was for ${formatShort(h.scheduledFor)}`
                      : "",
            }))}
          />
        </TabsContent>
        <TabsContent value="announcements" className="mt-4">
          <AnnouncementsPanel
            items={d.announcements.map((a) => ({
              id: a.id,
              title: a.title,
              body: a.body,
              pinned: a.pinned,
              author: a.author,
              createdLabel: formatShort(a.createdAt),
            }))}
          />
        </TabsContent>
      </Tabs>
    </>
  );
}
