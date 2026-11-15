import "server-only";
import type { DateTime } from "luxon";
import type { Repository } from "@/lib/repo/interfaces";
import type { Message } from "@/lib/repo/types";
import { resolveAudience } from "./audience";
import { audiencePeople, loadPeopleFacts, renderContextFor, type PeopleFacts } from "./context";
import { deliverEmail, deliverInApp } from "./deliver";
import { EMAIL_FONT } from "./email-layout";
import { richTextToHtml, richTextToPlain } from "./richtext";
import { appUrl } from "./senders";
import { fillMergeFields, mergeValues } from "./templates";

/**
 * Send a message to its audience now (spec 7.4 item 10). The audience is worked out at send
 * time, so a scheduled message reaches whoever matches when it goes out. Only active people
 * receive messages; emails respect each person's email setting.
 */
export async function deliverMessage(repo: Repository, message: Message, now: DateTime, facts?: PeopleFacts) {
  const pf = facts ?? (await loadPeopleFacts(repo, now));
  const ids = resolveAudience(message.audience, audiencePeople(pf));
  const at = now.toISO()!;
  let emails = 0;
  for (const userId of ids) {
    const f = pf.facts.get(userId);
    if (!f) continue;
    const values = mergeValues(renderContextFor(pf, userId));
    const subject = fillMergeFields(message.subject, values);
    const body = fillMergeFields(message.body, values);
    const plain = richTextToPlain(body);
    await repo.messageRecipients.create({
      id: `${message.id}:${userId}`,
      messageId: message.id,
      userId,
      deliveredAt: at,
      readAt: null,
    });
    const base = { key: `${userId}:${message.id}:MESSAGE`, userId, type: "MESSAGE", subject, messageId: message.id };
    if (message.channels.includes("IN_APP")) await deliverInApp(repo, { ...base, title: subject, body: plain }, now);
    if (message.channels.includes("EMAIL") && f.user.notifPrefs.email) {
      await deliverEmail(
        repo,
        {
          ...base,
          to: f.user.email,
          payload: {
            preheader: plain.slice(0, 90),
            heading: subject,
            paragraphs: plain.split(/\n{2,}/),
            bodyHtml: richTextToHtml(body, EMAIL_FONT),
            button: { label: "Open in the app", url: `${appUrl()}/member/messages` },
          },
        },
        now,
      );
      emails++;
    }
  }
  await repo.messages.update(message.id, { sentAt: at });
  return { recipients: ids.length, emails };
}
