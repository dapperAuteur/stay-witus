import type { supportMessages } from "@/db/schema";
import type { Dictionary } from "@/lib/dictionaries";

type MessageRow = typeof supportMessages.$inferSelect;

/** Message list shared by the staff and platform thread views. */
export function SupportThreadMessages({
  messages,
  dict,
  viewerIsAdmin,
}: {
  messages: MessageRow[];
  dict: Dictionary;
  viewerIsAdmin: boolean;
}) {
  const s = dict.admin.support;
  return (
    <ol className="mt-6 flex flex-col gap-4">
      {messages.map((message) => {
        const mine = viewerIsAdmin
          ? message.authorRole === "admin"
          : message.authorRole === "user";
        return (
          <li
            key={message.id}
            className={`max-w-xl rounded-xl border p-4 text-sm ${
              mine
                ? "self-end border-slate-300 dark:border-slate-600"
                : "self-start border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
            }`}
          >
            <p className="text-xs font-semibold text-slate-500">
              {message.authorRole === "admin" ? s.admin : s.you} ·{" "}
              <time dateTime={message.createdAt.toISOString()}>
                {message.createdAt.toISOString().slice(0, 16).replace("T", " ")}
              </time>
            </p>
            <p className="mt-1 whitespace-pre-line">{message.body}</p>
            {message.attachments?.map((attachment, index) =>
              attachment.kind === "recording_link" && attachment.url ? (
                <a
                  key={index}
                  href={attachment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex min-h-11 items-center text-xs font-medium underline underline-offset-4"
                >
                  {s.recording}
                  <span className="sr-only"> (opens in new tab)</span>
                </a>
              ) : null,
            )}
          </li>
        );
      })}
    </ol>
  );
}
