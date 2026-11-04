import { SignupForm } from "@/components/commerce/SignupForm";
import { SIGNUP } from "@/brands/gym/copy/home";
import { HANDS_BOX } from "@/brands/gym/copy/images";
import { photoProps } from "./photo";

/**
 * The restock list: the photograph of the box in chalked hands beside the
 * kit's signup form, in the profile's own consent words (they are stored as
 * the record of what was agreed, so they are shown exactly). Rendered only
 * when the brand runs a list.
 */
export function RestockBand({ consentText }: { consentText: string }) {
  return (
    <section aria-labelledby="list-heading" className="gym-restock">
      <div className="gym-restock-media">
        {/* next/image's props with the made-ahead copies (./photo.ts). */}
        <img {...photoProps(HANDS_BOX, { sizes: "(min-width: 1024px) 50vw, 100vw", className: "gym-restock-img" })} />
      </div>
      <div className="gym-restock-body">
        <h2 id="list-heading" className="gym-h2">
          {SIGNUP.heading}
        </h2>
        <p className="gym-lead">{SIGNUP.lead}</p>
        <SignupForm
          config={{
            consentText,
            placeholder: SIGNUP.placeholder,
            submitLabel: SIGNUP.submit,
            pendingLabel: SIGNUP.pending,
            doneMessage: SIGNUP.done,
          }}
          source="inline"
          classNames={{
            form: "gym-signup",
            row: "gym-signup-row",
            input: "gym-input",
            button: "gym-btn gym-btn-hazard shrink-0",
            error: "gym-alert",
            consent: "gym-signup-consent",
            link: "gym-link",
            done: "gym-signup-done",
          }}
        />
      </div>
    </section>
  );
}
