"use client";

import type {
  ConversationIntent,
  MessageAttachmentPurpose,
} from "@paon/domain";
import { usePathname } from "next/navigation";
import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
} from "react";

import {
  submitTableServiceInquiry,
  sendSignedInTableServiceMessage,
  type TableServiceFormState,
} from "./table-service-actions";
import { requestTableServiceGuidance } from "./table-service-guidance-actions";

/**
 * Exact port of pag1.html's `#gilda-chat-widget` ("TableService") — CSS,
 * markup and the quick-intent picker/attach-panel interactions are
 * byte-for-byte from the source (class names, image URLs, colors,
 * the WhatsApp-style `#dcf8c6` bubble). PHASE 3.4 adds narrow grounded
 * guidance hooks after intent selection without redesigning the chrome.
 */

const INTENT_PICS: {
  value: ConversationIntent;
  img: string;
  caption: string;
}[] = [
  {
    value: "wedding",
    img: "https://www.nebelspiegel.com/images/chats222.png",
    caption: "I'm getting married",
  },
  {
    value: "wedding",
    img: "https://www.nebelspiegel.com/images/chatpic02.png",
    caption: "I'm a wedding guest",
  },
  {
    value: "shirts",
    img: "https://www.nebelspiegel.com/images/chatpic03.png",
    caption: "I need new shirts",
  },
  {
    value: "style_help",
    img: "https://www.nebelspiegel.com/images/chatpic04.png",
    caption: "How to find my style?",
  },
];

const ATTACH_ITEMS = [
  {
    img: "https://www.nebelspiegel.com/images/knopphoto.png",
    label: "Upload Photo",
    purpose: "photo" as const,
  },
  {
    img: "https://www.nebelspiegel.com/images/knopfile.png",
    label: "Attach Pdf",
    purpose: "document" as const,
  },
  {
    img: "https://www.nebelspiegel.com/images/knoppint.png",
    label: "Paste Pinterest Link",
    purpose: "pinterest_link" as const,
  },
  {
    img: "https://www.nebelspiegel.com/images/knopdress.png",
    label: "Upload Wedding Dress fabric",
    purpose: "wedding_fabric" as const,
  },
];

const initial: TableServiceFormState = { values: {}, fieldErrors: {} };

type Step = "name" | "email" | "message" | "invite_token" | "done";
type AttachmentDraft =
  | {
      readonly kind: "upload";
      readonly purpose: Exclude<MessageAttachmentPurpose, "pinterest_link">;
      readonly file: File;
      readonly previewUrl?: string;
    }
  | {
      readonly kind: "link";
      readonly purpose: "pinterest_link";
      readonly url: string;
    };

const PLACEHOLDER_BY_STEP: Record<Step, string> = {
  name: "Your name...",
  email: "Your email...",
  message: "Type a message...",
  invite_token: "Paste invite token or full join URL...",
  done: "",
};

function shouldRequestGuidance(
  intent: ConversationIntent,
  caption: string,
): boolean {
  if (caption === "I'm getting married") return false;
  return (
    intent === "wedding" ||
    intent === "shirts" ||
    intent === "style_help" ||
    caption.toLowerCase().includes("wedding")
  );
}

export function TableServiceWidget({
  retailerId,
  retailerName,
  slug,
  signedInMessagesHref,
  isSignedIn = false,
  weddingParties = [],
  garments = [],
}: {
  retailerId: string;
  retailerName: string;
  slug: string;
  /** Advisor-first handoff — shown as CTA; signed-in users still open the widget. */
  signedInMessagesHref?: string;
  isSignedIn?: boolean;
  /** PAON-added, no source equivalent (same precedent as FT-02's "Select"
   * button): lets a signed-in customer optionally tag a wedding_fabric
   * attachment to one of their own wedding parties. */
  weddingParties?: { id: string; label: string }[];
  /** PAON-added, same precedent as `weddingParties`: lets a signed-in
   * customer optionally tag a photo attachment to one of their own
   * wardrobe items. */
  garments?: { id: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [intent, setIntent] = useState<ConversationIntent>("freeform");
  const [picsVisible, setPicsVisible] = useState(true);
  const [step, setStep] = useState<Step>(isSignedIn ? "message" : "name");
  const [history, setHistory] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [attachOpen, setAttachOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [guidancePending, startGuidance] = useTransition();
  const [sendPending, startSend] = useTransition();
  const [attachmentDraft, setAttachmentDraft] =
    useState<AttachmentDraft | null>(null);
  const [attachmentPurpose, setAttachmentPurpose] = useState<Exclude<
    MessageAttachmentPurpose,
    "pinterest_link"
  > | null>(null);
  const [attachmentRightsConfirmed, setAttachmentRightsConfirmed] =
    useState(false);
  const [weddingPartyId, setWeddingPartyId] = useState("");
  const [wardrobeItemId, setWardrobeItemId] = useState("");
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [linkComposerOpen, setLinkComposerOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");

  const boundAction = submitTableServiceInquiry.bind(null, retailerId);
  const [state, formAction, isPending] = useActionState(boundAction, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pathname = usePathname();
  const isLandingPage = /^\/r\/[^/]+\/?$/.test(pathname ?? "");
  const isCartPage = /^\/r\/[^/]+\/cart\/?$/.test(pathname ?? "");
  const clearBottomChrome = isLandingPage || isCartPage;

  useEffect(() => {
    if (state.submitted) {
      setHistory((h) => [
        ...h,
        "Thank you — we'll be in touch shortly. An advisor can continue this conversation anytime.",
      ]);
      setStep("done");
    }
  }, [state.submitted]);

  useEffect(
    () => () => {
      if (attachmentDraft?.kind === "upload" && attachmentDraft.previewUrl) {
        URL.revokeObjectURL(attachmentDraft.previewUrl);
      }
    },
    [attachmentDraft],
  );

  function clearAttachment() {
    if (attachmentDraft?.kind === "upload" && attachmentDraft.previewUrl) {
      URL.revokeObjectURL(attachmentDraft.previewUrl);
    }
    setAttachmentDraft(null);
    setAttachmentRightsConfirmed(false);
    setAttachmentError(null);
    setWeddingPartyId("");
    setWardrobeItemId("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function requestAttachment(purpose: MessageAttachmentPurpose) {
    setAttachmentError(null);
    if (!isSignedIn) {
      setHistory((rows) => [
        ...rows,
        "Sign in to attach private consultation material securely. Your draft message stays here.",
      ]);
      setAttachOpen(false);
      return;
    }
    if (purpose === "pinterest_link") {
      setLinkComposerOpen(true);
      setAttachOpen(false);
      return;
    }
    setAttachmentPurpose(purpose);
    setAttachOpen(false);
    window.setTimeout(() => fileInputRef.current?.click(), 0);
  }

  function onFileSelected(file: File | undefined) {
    if (!file || !attachmentPurpose) return;
    clearAttachment();
    setAttachmentDraft({
      kind: "upload",
      purpose: attachmentPurpose,
      file,
      ...(file.type.startsWith("image/")
        ? { previewUrl: URL.createObjectURL(file) }
        : {}),
    });
  }

  function usePinterestLink() {
    const url = linkValue.trim();
    if (!url) return;
    clearAttachment();
    setAttachmentDraft({ kind: "link", purpose: "pinterest_link", url });
    setLinkComposerOpen(false);
    setLinkValue("");
  }

  function appendGuidance(intentValue: ConversationIntent, caption: string) {
    if (!shouldRequestGuidance(intentValue, caption)) return;
    startGuidance(async () => {
      const result = await requestTableServiceGuidance({
        retailerId,
        slug,
        intent: intentValue,
        caption,
        freeText: intentValue === "wedding" ? "summer wedding" : caption,
        question: caption,
      });
      setHistory((h) => [...h, ...result.chatLines]);
    });
  }

  function pickIntent(value: ConversationIntent, caption: string) {
    setIntent(value);
    setPicsVisible(false);
    if (caption === "I'm getting married") {
      setHistory((h) => [
        ...h,
        caption,
        "Sign in to open your wedding party planner — we'll bring you back here. You can also message an advisor below.",
      ]);
      window.setTimeout(() => {
        const next = encodeURIComponent("/wedding-parties/new");
        window.location.href = `/login?redirectTo=${next}`;
      }, 700);
      return;
    }
    if (caption === "I'm a wedding guest") {
      setHistory((h) => [
        ...h,
        caption,
        "Paste the invite token from your link (the long code after /join/), or ask the groom to send the full link. Meanwhile, here is grounded summer-wedding guidance:",
      ]);
      setStep(isSignedIn ? "message" : "invite_token");
      appendGuidance(value, caption);
      return;
    }
    setHistory((h) => [...h, caption]);
    appendGuidance(value, caption);
  }

  function handleSend() {
    const text = inputValue.trim();
    if (!text) return;
    if (
      step === "message" &&
      isSignedIn &&
      attachmentDraft &&
      !attachmentRightsConfirmed
    ) {
      setAttachmentError(
        "Confirm you may share this material for the consultation.",
      );
      return;
    }
    if (!(step === "message" && isSignedIn)) {
      setHistory((h) => [...h, text]);
    }
    setInputValue("");

    if (step === "invite_token") {
      const slugMatch = pathname?.match(/^\/r\/([^/]+)/);
      const pathSlug = slugMatch?.[1];
      const tokenMatch =
        text.match(/wedding-parties\/join\/([A-Za-z0-9_-]+)/)?.[1] ??
        text.match(/^[A-Za-z0-9_-]{12,}$/)?.[0];
      if (pathSlug && tokenMatch) {
        window.location.href = `/r/${pathSlug}/wedding-parties/join/${tokenMatch}`;
        return;
      }
      setHistory((h) => [
        ...h,
        "That didn't look like an invite token. Paste the full join link, or the long code after /join/. You can also leave a message for an advisor.",
      ]);
      setStep(isSignedIn ? "message" : "name");
      return;
    }

    if (step === "name") {
      setName(text);
      setStep("email");
      return;
    }
    if (step === "email") {
      setEmail(text);
      setStep("message");
      return;
    }
    if (step === "message") {
      if (
        text.toLowerCase().includes("summer") &&
        text.toLowerCase().includes("wedding")
      ) {
        startGuidance(async () => {
          const result = await requestTableServiceGuidance({
            retailerId,
            slug,
            intent,
            freeText: text,
            question: text,
          });
          setHistory((h) => [...h, ...result.chatLines]);
        });
      }
      if (isSignedIn) {
        startSend(async () => {
          const formData = new FormData();
          formData.set("body", text);
          if (attachmentDraft?.kind === "upload") {
            formData.set("attachmentPurpose", attachmentDraft.purpose);
            formData.set("attachment", attachmentDraft.file);
            if (
              attachmentDraft.purpose === "wedding_fabric" &&
              weddingPartyId
            ) {
              formData.set("weddingPartyId", weddingPartyId);
            }
            if (attachmentDraft.purpose === "photo" && wardrobeItemId) {
              formData.set("wardrobeItemId", wardrobeItemId);
            }
          } else if (attachmentDraft?.kind === "link") {
            formData.set("attachmentPurpose", "pinterest_link");
            formData.set("sourceUrl", attachmentDraft.url);
          }
          const result = await sendSignedInTableServiceMessage(
            retailerId,
            formData,
          );
          if (!result.ok) {
            setAttachmentError(result.error ?? "Message could not be sent.");
            setInputValue(text);
            return;
          }
          setHistory((rows) => [
            ...rows,
            text,
            result.attachmentPurpose
              ? "Shared securely with your advisor. Basic file checks passed; the original remains private."
              : "Sent securely to your advisor.",
          ]);
          clearAttachment();
        });
        return;
      }
      if (messageInputRef.current) messageInputRef.current.value = text;
      formRef.current?.requestSubmit();
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSend();
    }
  }

  return (
    <div
      className={`fixed right-5 z-50 flex flex-col items-end gap-3 ${
        clearBottomChrome ? "bottom-24" : "bottom-5"
      }`}
    >
      {open ? (
        <div
          id="gilda-chat-widget"
          role="dialog"
          aria-label={`Message ${retailerName}`}
          className="w-[min(23.5rem,calc(100vw-2.5rem))] overflow-hidden rounded-[10px] bg-white shadow-[var(--shadow-elevated)]"
        >
          <style>{`
            @font-face {
                font-family: 'lvreg';
                src: url('/fonts/optimaklein.woff2') format('woff2');
            }
            #gilda-chat-widget { font-family: 'lvreg', sans-serif; box-sizing: border-box; }
            #gilda-chat-widget * { box-sizing: border-box; }
            #gilda-chat-widget .gcw-chat-wrapper { width: 100%; height: 500px; display: flex; flex-direction: column; overflow: hidden; background: transparent; position: relative; }
            #gilda-chat-widget .gcw-chat-history { flex: 1; overflow-y: auto; display: flex; flex-direction: column-reverse; gap: 5px; padding-top: 10px; padding-bottom: 10px; }
            #gilda-chat-widget .gcw-chat-pics { display: flex; gap: 10px; margin-bottom: 10px; flex-wrap: nowrap; overflow-x: auto; padding-left: 20px; padding-right: 20px; clip-path: inset(0 -20px 0 -20px); scrollbar-width: none; -ms-overflow-style: none; transition: opacity 0.5s ease; }
            #gilda-chat-widget .gcw-chat-pics::-webkit-scrollbar { display: none; }
            #gilda-chat-widget .gcw-chat-pics .gcw-panel-wrapper { flex: 0 0 auto; width: 140px; height: 110px; border-radius: 10px; overflow: hidden; position: relative; cursor: pointer; }
            #gilda-chat-widget .gcw-chat-pics .gcw-panel-wrapper img { width:100%; height:100%; object-fit:cover; border-radius:10px; }
            #gilda-chat-widget .gcw-panel-overlay { position: absolute; bottom: 0; left: 0; width: 100%; height: 60%; color: #fff; font-size: 13px; font-family: 'lvreg'; text-align: left; background: linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,0.8)); display: flex; align-items: flex-end; padding-left: 10px; padding-bottom: 8px; border-bottom-left-radius: 10px; border-bottom-right-radius: 10px; }
            #gilda-chat-widget .gcw-message-wrapper { display: flex; justify-content: flex-end; padding-left: 20px; padding-right: 25px; }
            #gilda-chat-widget .gcw-message { display: inline-block; max-width: 100%; padding: 5px 10px; border-radius: 7px; word-wrap: break-word; white-space: pre-wrap; font-family: 'lvreg'; font-size: 16px; background-color: #dcf8c6; }
            #gilda-chat-widget .gcw-input-container { width: 100%; padding: 10px 20px; background: transparent; }
            #gilda-chat-widget .gcw-field-wrapper { position: relative; width: 100%; display: flex; align-items: center; }
            #gilda-chat-widget .gcw-field { width: 100%; height: 40px; border-radius: 7px; border: 1px solid #ccc; padding-left: 40px; padding-right: 75px; font-family: 'lvreg'; font-size: 16px; color: #808080; background-color: silver; }
            #gilda-chat-widget .gcw-paperclip { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); width: 20px; height: 20px; background-image: url('https://www.nebelspiegel.com/images/clip.svg'); background-size: contain; background-repeat: no-repeat; cursor: pointer; }
            #gilda-chat-widget .gcw-send-button { position: absolute; right: 5px; top: 50%; transform: translateY(-50%); width: 60px; height: 30px; border-radius: 7px; background: linear-gradient(to bottom, #696969, #000); color: #BFBFBF; font-family: 'lvreg'; font-size: 13px; text-align: center; line-height: 28px; cursor: pointer; border: none; }
            #gilda-chat-widget .gcw-attach-panel { position: absolute; bottom: 0; left: 0; width: 100%; height: auto; background: linear-gradient(to left, #fff, #ccc); display: flex; flex-direction: column; padding: 20px; z-index: 100; transition: transform 0.5s ease; transform: translateY(100%); }
            #gilda-chat-widget .gcw-attach-panel.active { transform: translateY(0); }
            #gilda-chat-widget .gcw-attach-item { display: flex; align-items: center; cursor: pointer; background: none; border: none; text-align: left; padding: 0; }
            #gilda-chat-widget .gcw-attach-item:not(:last-child) { margin-bottom: 10px; }
            #gilda-chat-widget .gcw-attach-btn { width: 50px; height: 50px; border-radius: 7px; background: linear-gradient(to right, #808080, #000); display: flex; justify-content: center; align-items: center; flex-shrink: 0; }
            #gilda-chat-widget .gcw-attach-btn img { width: 22px; height: 22px; }
            #gilda-chat-widget .gcw-attach-label { font-family: 'lvreg'; font-size: 16px; color: #333; text-align: left; text-transform: capitalize; margin-left: 15px; }
            #gilda-chat-widget .gcw-handoff { display: flex; flex-wrap: wrap; gap: 8px; padding: 0 20px 10px; }
            #gilda-chat-widget .gcw-handoff a { font-family: 'lvreg'; font-size: 13px; color: #000; text-decoration: underline; }
          `}</style>

          <div className="gcw-chat-wrapper">
            <div className="gcw-chat-history">
              {[...history].reverse().map((text, index) => (
                <div className="gcw-message-wrapper" key={index}>
                  <div className="gcw-message">{text}</div>
                </div>
              ))}
              {picsVisible ? (
                <div
                  className="gcw-chat-pics"
                  style={{ opacity: picsVisible ? 1 : 0 }}
                >
                  {INTENT_PICS.map((pic) => (
                    <button
                      type="button"
                      className="gcw-panel-wrapper"
                      key={pic.caption}
                      onClick={() => pickIntent(pic.value, pic.caption)}
                      style={{ border: "none", padding: 0, font: "inherit" }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- byte-for-byte source markup, not a Next-optimized image */}
                      <img src={pic.img} alt="" />
                      <div className="gcw-panel-overlay">{pic.caption}</div>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {!picsVisible ? (
              <div className="gcw-handoff" aria-label="Advisor handoff">
                {signedInMessagesHref ? (
                  <a href={signedInMessagesHref}>Message advisor</a>
                ) : null}
                <a href={`/r/${slug}/appointments`}>Book appointment</a>
                <a href={`/r/${slug}/swipe?occasion=summer+wedding`}>
                  Swipe options
                </a>
              </div>
            ) : null}

            <div className="gcw-input-container">
              <div className="gcw-field-wrapper">
                <input
                  type="text"
                  className="gcw-field"
                  placeholder={PLACEHOLDER_BY_STEP[step]}
                  value={inputValue}
                  disabled={
                    step === "done" ||
                    isPending ||
                    guidancePending ||
                    sendPending
                  }
                  onChange={(event) => setInputValue(event.target.value)}
                  onKeyDown={handleKeyDown}
                  aria-busy={guidancePending || isPending || sendPending}
                />
                <button
                  type="button"
                  aria-label="Attach"
                  className="gcw-paperclip"
                  style={{ border: "none", padding: 0 }}
                  onClick={(event) => {
                    event.stopPropagation();
                    setAttachOpen((value) => !value);
                  }}
                />
                <button
                  type="button"
                  className="gcw-send-button"
                  disabled={
                    step === "done" ||
                    isPending ||
                    guidancePending ||
                    sendPending
                  }
                  onClick={handleSend}
                >
                  {isPending || guidancePending || sendPending ? "…" : "Send"}
                </button>
              </div>
            </div>

            <div className={`gcw-attach-panel${attachOpen ? "active" : ""}`}>
              {ATTACH_ITEMS.map((item) => (
                <button
                  type="button"
                  className="gcw-attach-item"
                  key={item.label}
                  onClick={() => requestAttachment(item.purpose)}
                >
                  <div className="gcw-attach-btn">
                    {/* eslint-disable-next-line @next/next/no-img-element -- byte-for-byte source markup */}
                    <img src={item.img} alt="" />
                  </div>
                  <div className="gcw-attach-label">{item.label}</div>
                </button>
              ))}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              className="sr-only"
              aria-label="Choose consultation attachment"
              accept={
                attachmentPurpose === "document"
                  ? "application/pdf"
                  : attachmentPurpose === "wedding_fabric"
                    ? "image/jpeg,image/png,image/webp,application/pdf"
                    : "image/jpeg,image/png,image/webp"
              }
              onChange={(event) => onFileSelected(event.target.files?.[0])}
            />

            {linkComposerOpen ? (
              <div className="mx-5 mb-2 flex gap-2" aria-label="Pinterest link">
                <input
                  type="url"
                  value={linkValue}
                  onChange={(event) => setLinkValue(event.target.value)}
                  placeholder="https://www.pinterest.com/pin/..."
                  className="min-w-0 flex-1 rounded-[7px] border border-black/20 px-2 text-xs"
                />
                <button
                  type="button"
                  className="text-xs underline"
                  onClick={usePinterestLink}
                >
                  Use link
                </button>
                <button
                  type="button"
                  className="text-xs underline"
                  onClick={() => setLinkComposerOpen(false)}
                >
                  Cancel
                </button>
              </div>
            ) : null}

            {attachmentDraft ? (
              <div className="mx-5 mb-2 rounded-[7px] border border-black/15 bg-white p-2 text-xs">
                <div className="flex items-center gap-2">
                  {attachmentDraft.kind === "upload" &&
                  attachmentDraft.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
                    <img
                      src={attachmentDraft.previewUrl}
                      alt="Attachment preview"
                      className="h-10 w-10 rounded object-cover"
                    />
                  ) : null}
                  <span className="min-w-0 flex-1 truncate">
                    {attachmentDraft.kind === "upload"
                      ? attachmentDraft.file.name
                      : attachmentDraft.url}
                  </span>
                  <button
                    type="button"
                    className="underline"
                    onClick={clearAttachment}
                  >
                    Remove
                  </button>
                </div>
                <label className="mt-2 flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={attachmentRightsConfirmed}
                    onChange={(event) =>
                      setAttachmentRightsConfirmed(event.target.checked)
                    }
                  />
                  <span>
                    I may share this material for this private consultation.
                  </span>
                </label>
                {attachmentDraft.kind === "upload" &&
                attachmentDraft.purpose === "wedding_fabric" &&
                weddingParties.length > 0 ? (
                  <label className="mt-2 flex items-center gap-2">
                    <span>Link to wedding party (optional)</span>
                    <select
                      aria-label="Link to wedding party"
                      value={weddingPartyId}
                      onChange={(event) =>
                        setWeddingPartyId(event.target.value)
                      }
                      className="min-w-0 flex-1 rounded-[7px] border border-black/20 px-2 py-1 text-xs"
                    >
                      <option value="">Not linked</option>
                      {weddingParties.map((party) => (
                        <option key={party.id} value={party.id}>
                          {party.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {attachmentDraft.kind === "upload" &&
                attachmentDraft.purpose === "photo" &&
                garments.length > 0 ? (
                  <label className="mt-2 flex items-center gap-2">
                    <span>Link to a garment (optional)</span>
                    <select
                      aria-label="Link to a garment"
                      value={wardrobeItemId}
                      onChange={(event) =>
                        setWardrobeItemId(event.target.value)
                      }
                      className="min-w-0 flex-1 rounded-[7px] border border-black/20 px-2 py-1 text-xs"
                    >
                      <option value="">Not linked</option>
                      {garments.map((garment) => (
                        <option key={garment.id} value={garment.id}>
                          {garment.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>
            ) : null}

            {attachmentError ? (
              <p role="alert" className="mx-5 mb-2 text-xs text-red-700">
                {attachmentError}
              </p>
            ) : null}
          </div>

          <form ref={formRef} action={formAction} className="hidden">
            <input type="hidden" name="intent" value={intent} />
            <input type="hidden" name="name" value={name} />
            <input type="hidden" name="email" value={email} />
            <input type="hidden" name="message" ref={messageInputRef} />
          </form>

          {state.formError ? (
            <p role="alert" className="p-3 text-xs text-red-600">
              {state.formError}
            </p>
          ) : null}

          <button
            type="button"
            className="w-full border-t border-black/10 py-2 text-center text-xs text-[var(--color-stone-500)]"
            onClick={() => setOpen(false)}
          >
            Close
          </button>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label="Contact us"
        className="rounded-[var(--radius-md)] bg-[var(--color-stone-900)] px-5 py-3 text-sm font-medium text-white shadow-lg"
      >
        {open ? "Close" : "Ask us anything"}
      </button>
    </div>
  );
}
