"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  listPartyMessages,
  postPartyMessage,
  type PartyMessage,
} from "../wedding-parties/actions";

/** How often an open chat looks for new messages. */
const POLL_MS = 8000;

/**
 * The party's chat: a small column beside the guest list. The organizer is
 * asked to open it with the first message; everyone holding the party's
 * link — guests who joined and invitees still filling in their details —
 * can read and write. Messages live with the party
 * (`wedding_party_messages`), reached only through the token-keyed
 * functions, and the column refreshes while it is on screen.
 */
export function TailoringPartyChat({
  token,
  authorName,
  isOrganizer,
  ensureToken,
  blocked,
}: {
  /** The party's link token; null until the party exists. */
  token: string | null;
  /** The name messages are sent under. */
  authorName: string;
  isOrganizer: boolean;
  /** Starts the party when there is none yet, returning its token. */
  ensureToken?: () => Promise<string | null>;
  /** Stops sending with a reason and an action, e.g. sign in or add a name. */
  blocked?: { message: string; onAct: () => void } | null;
}) {
  const [messages, setMessages] = useState<readonly PartyMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async (activeToken: string) => {
    const result = await listPartyMessages(activeToken);
    if (result.messages) setMessages(result.messages);
  }, []);

  useEffect(() => {
    if (!token) return;
    void refresh(token);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh(token);
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [token, refresh]);

  // Keep the newest message in view — scrolling the column, not the page.
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages.length]);

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    if (blocked) {
      blocked.onAct();
      setError(blocked.message);
      return;
    }
    setSending(true);
    setError(null);
    const activeToken = token ?? (await ensureToken?.()) ?? null;
    if (!activeToken) {
      setSending(false);
      setError("The chat opens once the party is set up.");
      return;
    }
    const result = await postPartyMessage({
      inviteToken: activeToken,
      authorName,
      body,
    });
    setSending(false);
    if (!result.ok) {
      setError(result.formError ?? "That message could not be sent.");
      return;
    }
    setDraft("");
    await refresh(activeToken);
  };

  const isMine = (message: PartyMessage) =>
    isOrganizer
      ? message.isOrganizer
      : !message.isOrganizer && message.authorName === authorName.trim();

  return (
    <div className="appointment-tailoring-party-card tp-chat">
      <p className="tp-chat-label">Party chat</p>
      <div className="tp-chat-log" ref={logRef} aria-live="polite">
        {messages.length === 0 ? (
          <p className="tp-chat-empty">
            {isOrganizer
              ? "Start the party: write the first message to your guests."
              : "No messages yet. Say hello to the party."}
          </p>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={[
                "tp-chat-message",
                isMine(message) ? "is-mine" : "",
              ].join(" ")}
            >
              <span className="tp-chat-author">
                {message.authorName}
                {message.isOrganizer ? " · Host" : ""}
              </span>
              <p>{message.body}</p>
              <time dateTime={message.createdAt}>
                {new Date(message.createdAt).toLocaleTimeString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
            </div>
          ))
        )}
      </div>
      {error ? (
        <p className="tp-chat-error" role="alert">
          {error}
        </p>
      ) : null}
      <form
        className="tp-chat-compose"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <textarea
          rows={1}
          value={draft}
          maxLength={1000}
          aria-label="Message the party"
          placeholder={
            isOrganizer && messages.length === 0
              ? "Write the first message…"
              : "Message the party…"
          }
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
        />
        <button type="submit" disabled={!draft.trim() || sending}>
          Send
        </button>
      </form>
    </div>
  );
}
