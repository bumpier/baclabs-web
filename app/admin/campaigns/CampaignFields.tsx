import type { Campaign } from "@prisma/client";
import { EMPTY_AUDIENCE, parseAudience } from "@/lib/campaigns";

/**
 * The composer's inputs, rendered inside an ActionForm by both the new and
 * the edit page. Plain inputs, no client state: the server action reads them.
 */
export function CampaignFields({ campaign }: { campaign?: Campaign }) {
  const a = campaign ? parseAudience(campaign.audience) : { ...EMPTY_AUDIENCE, subscribers: true };
  return (
    <>
      {campaign && <input type="hidden" name="id" value={campaign.id} />}
      <div>
        <label htmlFor="subject" className="label">
          Subject
        </label>
        <input id="subject" name="subject" required maxLength={200} defaultValue={campaign?.subject} className="field" />
      </div>
      <div>
        <label htmlFor="preheader" className="label">
          Preview text <span className="font-normal text-ink-soft">(shown after the subject in the inbox)</span>
        </label>
        <input id="preheader" name="preheader" maxLength={200} defaultValue={campaign?.preheader} className="field" />
      </div>
      <div>
        <label htmlFor="bodyMarkdown" className="label">
          Email
        </label>
        <textarea
          id="bodyMarkdown"
          name="bodyMarkdown"
          rows={16}
          defaultValue={
            campaign?.bodyMarkdown ??
            "Hi {{first_name}},\n\nWrite your message here.\n\n[button: Choose your pack](https://baclab.co.uk/#buy)"
          }
          className="field font-mono text-sm"
        />
        <p className="mt-2 text-xs text-ink-soft">
          Blank line between paragraphs. <code># Heading</code>, <code>**bold**</code>, <code>*italic*</code>,{" "}
          <code>- list item</code>, <code>[link text](https://…)</code>, and a button:{" "}
          <code>[button: Label](https://…)</code>. Merge fields: <code>{"{{first_name}}"}</code>,{" "}
          <code>{"{{code}}"}</code>, <code>{"{{offer}}"}</code>, <code>{"{{expires}}"}</code>. An offer code, if
          you add one, is also shown in a box under the email. The unsubscribe line is added for you.
        </p>
      </div>

      <fieldset className="rounded-control border border-line p-4">
        <legend className="px-1 text-sm font-medium text-ink">Send to</legend>
        <div className="space-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="subscribers" defaultChecked={a.subscribers} /> All mailing-list subscribers
          </label>
          <label className="flex items-center gap-2 pl-6 text-ink-soft">
            <input type="checkbox" name="subscribersNotOrdered" defaultChecked={a.subscribersNotOrdered} /> or only
            subscribers who have not ordered yet
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="customers" defaultChecked={a.customers} /> All past customers
          </label>
          <label className="flex flex-wrap items-center gap-2 pl-6 text-ink-soft">
            <input type="checkbox" name="lapsedCustomers" defaultChecked={a.lapsedCustomers} /> or only customers
            with no order in the last
            <input
              type="number"
              name="lapsedDays"
              min={1}
              max={3650}
              defaultValue={a.lapsedDays}
              aria-label="Days since last order"
              className="w-20 rounded-control border border-line px-2 py-1"
            />
            days
          </label>
        </div>
        <p className="mt-3 text-xs text-ink-soft">
          Combined, with duplicates removed. Anyone who has unsubscribed is always left out. Past customers
          are emailed under the soft opt-in, so keep it to BacLab products they would expect to hear about.
        </p>
      </fieldset>
    </>
  );
}
