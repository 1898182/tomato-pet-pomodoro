import { ChevronDown, Coffee, Mail } from "lucide-react";
import { useState } from "react";
import { DONATION_URL, SUPPORT_EMAIL } from "../../shared/support";

export const FAQ_ITEMS = [
  { question: "How do I interact with the tomato pet?", answer: "Click the pet to poke it. During a break, the first poke also gives a small petting bonus. Double-click the pet to show or hide the timer bubble, and drag the pet or a non-interactive part of a bubble to move the window. Fully transparent areas pass clicks through to whatever is underneath." },
  { question: "What do the timer bubbles do?", answer: "The main bubble keeps the countdown, active task, and XP multiplier visible. Click it to toggle a separate action bubble. Short-break wellness prompts appear in their own bubble above the timer." },
  { question: "How do focus cycles work?", answer: "Each rhythm lists focus, short-break, and long-break minutes. The final number controls how many completed focus sessions occur before a long break. You can keep up to four rhythms and create named custom rhythms." },
  { question: "What does Start next session automatically change?", answer: "When enabled, the next focus or break starts immediately after the current session completes. When disabled, Tomato Pet waits for you to start the suggested next session." },
  { question: "What does Hide pet during focus do?", answer: "Stealth mode replaces the full pet with a compact timer near the taskbar during focus. The full pet returns for breaks and whenever the next break is waiting to start." },
  { question: "How do notifications and sounds work?", answer: "Desktop notifications announce completed sessions. Completion sound controls the system chime, while pet interaction sounds control the small poke sound." },
  { question: "What is Ambient focus sound?", answer: "Ambient focus sound plays your selected brown-noise or gentle-rain soundscape as a quiet background during active focus. It stops for pauses, completed sessions, and breaks, and its volume control does not affect other application sounds." },
  { question: "What does Launch at startup do?", answer: "It starts Tomato Pet when you sign in to your computer. This setting is optional and can be changed at any time." },
  { question: "How do XP, Seeds, levels, and streaks work?", answer: "Focused minutes earn permanent Lifetime XP and spendable Seeds. Levels are based on Lifetime XP and never decrease. Completing focus sessions on consecutive local calendar days grows your streak and can improve rewards." },
  { question: "Can I move my settings to another device?", answer: "Yes. Export a preference file and import it on the other device. It includes settings, focus rhythms, and avatar position, but intentionally excludes XP, Seeds, sessions, inventory, and progression." },
  { question: "Will there be more avatars?", answer: "Yes. The tomato is the first pet, and more avatars and customization options are planned for future releases." }
] as const;

export function FAQTab() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  return <section className="faq-view">
    <div className="faq-heading"><p className="eyebrow">Help and details</p><h2>Frequently asked questions</h2><small>Everything you need to settle in with your tomato.</small></div>
    <div className="faq-list">{FAQ_ITEMS.map((item, index) => {
      const open = openIndex === index;
      const panelId = `faq-panel-${index}`;
      return <article key={item.question} className={`faq-item${open ? " is-open" : ""}`}>
        <button type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpenIndex(open ? null : index)}><span>{item.question}</span><ChevronDown aria-hidden="true" /></button>
        <div id={panelId} className="faq-answer" hidden={!open}><p>{item.answer}</p></div>
      </article>;
    })}</div>
    <div className="faq-support-band">
      <div><p className="eyebrow">Need a hand?</p><h2>Support Tomato Pet</h2><p>Questions and bug reports are welcome. If Tomato Pet has helped you focus, you can also leave a small tip toward its future.</p></div>
      <div className="faq-support-actions"><button type="button" className="secondary-button" onClick={() => window.tomatoPet.app.openExternal(`mailto:${SUPPORT_EMAIL}`)}><Mail aria-hidden="true" />Email support</button><button type="button" onClick={() => window.tomatoPet.app.openExternal(DONATION_URL)}><Coffee aria-hidden="true" />Buy me a coffee</button></div>
    </div>
  </section>;
}
