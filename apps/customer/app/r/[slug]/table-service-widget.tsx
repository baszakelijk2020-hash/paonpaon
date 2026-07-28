"use client";

import type { ConversationIntent } from "@paon/domain";
import { usePathname } from "next/navigation";
import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import {
  submitTableServiceInquiry,
  type TableServiceFormState,
} from "./table-service-actions";

/**
 * Exact port of pag1.html's `#gilda-chat-widget` ("TableService") — CSS,
 * markup and the quick-intent picker/attach-panel interactions are
 * byte-for-byte from the source (class names, image URLs, colors,
 * the WhatsApp-style `#dcf8c6` bubble). The source widget has no
 * name/email fields (a static mockup never needed a real visitor
 * identity) but `submitTableServiceInquiry` — a real, already-shipped
 * anonymous-write Server Action — requires both, so the single
 * `.gcw-field` input is reused as a short guided sequence (name → email
 * → message) instead of adding three fields at once; every other visual
 * element is unchanged. The attach-panel's four options are decorative
 * in the source too (no upload call in the original JS either), so they
 * stay exactly as inert here — not wired to a fabricated upload feature.
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
  },
  {
    img: "https://www.nebelspiegel.com/images/knopfile.png",
    label: "Attach Pdf",
  },
  {
    img: "https://www.nebelspiegel.com/images/knoppint.png",
    label: "Paste Pinterest Link",
  },
  {
    img: "https://www.nebelspiegel.com/images/knopdress.png",
    label: "Upload Wedding Dress fabric",
  },
];

const initial: TableServiceFormState = { values: {}, fieldErrors: {} };

type Step = "name" | "email" | "message" | "invite_token" | "done";

const PLACEHOLDER_BY_STEP: Record<Step, string> = {
  name: "Your name...",
  email: "Your email...",
  message: "Type a message...",
  invite_token: "Paste invite token or full join URL...",
  done: "",
};

export function TableServiceWidget({
  retailerId,
  retailerName,
}: {
  retailerId: string;
  retailerName: string;
}) {
  const [open, setOpen] = useState(false);
  const [intent, setIntent] = useState<ConversationIntent>("freeform");
  const [picsVisible, setPicsVisible] = useState(true);
  const [step, setStep] = useState<Step>("name");
  const [history, setHistory] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [attachOpen, setAttachOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const boundAction = submitTableServiceInquiry.bind(null, retailerId);
  const [state, formAction, isPending] = useActionState(boundAction, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);

  const pathname = usePathname();
  const isLandingPage = /^\/r\/[^/]+\/?$/.test(pathname ?? "");
  // Cart's mobile sticky "Place order" bar occupies the bottom edge;
  // keep Ask us above it so the two do not fight for the same tap target.
  const isCartPage = /^\/r\/[^/]+\/cart\/?$/.test(pathname ?? "");
  const clearBottomChrome = isLandingPage || isCartPage;

  useEffect(() => {
    if (state.submitted) {
      setHistory((h) => [...h, "Thank you — we'll be in touch shortly."]);
      setStep("done");
    }
  }, [state.submitted]);

  function pickIntent(value: ConversationIntent, caption: string) {
    setIntent(value);
    setPicsVisible(false);
    if (caption === "I'm getting married") {
      setHistory((h) => [
        ...h,
        caption,
        "Sign in to open your wedding party planner — we'll bring you back here.",
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
        "Paste the invite token from your link (the long code after /join/), or ask the groom to send the full link. You can also leave us a message below.",
      ]);
      setStep("invite_token");
      return;
    }
    setHistory((h) => [...h, caption]);
  }

  function handleSend() {
    const text = inputValue.trim();
    if (!text) return;
    setHistory((h) => [...h, text]);
    setInputValue("");

    if (step === "invite_token") {
      const slugMatch = pathname?.match(/^\/r\/([^/]+)/);
      const slug = slugMatch?.[1];
      const tokenMatch =
        text.match(/wedding-parties\/join\/([A-Za-z0-9_-]+)/)?.[1] ??
        text.match(/^[A-Za-z0-9_-]{12,}$/)?.[0];
      if (slug && tokenMatch) {
        window.location.href = `/r/${slug}/wedding-parties/join/${tokenMatch}`;
        return;
      }
      setHistory((h) => [
        ...h,
        "That didn't look like an invite token. Paste the full join link, or the long code after /join/.",
      ]);
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

            <div className="gcw-input-container">
              <div className="gcw-field-wrapper">
                <input
                  type="text"
                  className="gcw-field"
                  placeholder={PLACEHOLDER_BY_STEP[step]}
                  value={inputValue}
                  disabled={step === "done" || isPending}
                  onChange={(event) => setInputValue(event.target.value)}
                  onKeyDown={handleKeyDown}
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
                  disabled={step === "done" || isPending}
                  onClick={handleSend}
                >
                  {isPending ? "…" : "Send"}
                </button>
              </div>
            </div>

            <div className={`gcw-attach-panel${attachOpen ? "active" : ""}`}>
              {ATTACH_ITEMS.map((item) => (
                <button
                  type="button"
                  className="gcw-attach-item"
                  key={item.label}
                  onClick={() => setAttachOpen(false)}
                >
                  <div className="gcw-attach-btn">
                    {/* eslint-disable-next-line @next/next/no-img-element -- byte-for-byte source markup */}
                    <img src={item.img} alt="" />
                  </div>
                  <div className="gcw-attach-label">{item.label}</div>
                </button>
              ))}
            </div>
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
        className="rounded-full bg-[var(--color-ink-600)] px-5 py-3 text-sm font-medium text-white shadow-lg"
      >
        {open ? "Close" : "Ask us anything"}
      </button>
    </div>
  );
}
