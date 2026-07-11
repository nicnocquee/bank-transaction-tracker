/**
 * Collapsed-by-default help for IMAP field values (Gmail, Outlook, others).
 */
export function ImapSetupGuide() {
  return (
    <details className="group rounded-lg border border-line bg-panel text-sm open:shadow-sm">
      <summary className="cursor-pointer list-none px-4 py-3 font-medium tracking-tight marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="flex items-center justify-between gap-3">
          <span>Need help finding these values?</span>
          <span
            aria-hidden
            className="text-ink-muted transition-transform duration-150 ease-out group-open:rotate-180"
          >
            ▾
          </span>
        </span>
      </summary>

      <div className="space-y-5 border-t border-line px-4 py-4 text-ink-muted">
        <p>
          Connect the inbox that receives bank receipt emails. Currently we
          import Bank Sinarmas mail from{" "}
          <span className="font-mono text-xs text-foreground">
            qris-transaction@banksinarmas.com
          </span>
          .
        </p>

        <div>
          <h3 className="font-medium text-foreground">Gmail</h3>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5">
            <li>
              Enable{" "}
              <a
                className="text-accent underline underline-offset-2"
                href="https://myaccount.google.com/security"
                target="_blank"
                rel="noreferrer"
              >
                2-Step Verification
              </a>
              .
            </li>
            <li>
              Create an{" "}
              <a
                className="text-accent underline underline-offset-2"
                href="https://myaccount.google.com/apppasswords"
                target="_blank"
                rel="noreferrer"
              >
                App password
              </a>{" "}
              and paste it below (not your normal Google password).
            </li>
            <li>
              Use host{" "}
              <span className="font-mono text-xs text-foreground">
                imap.gmail.com
              </span>
              , port{" "}
              <span className="font-mono text-xs text-foreground">993</span>,
              TLS on, username = your Gmail address.
            </li>
          </ol>
        </div>

        <div>
          <h3 className="font-medium text-foreground">
            Outlook / Microsoft 365
          </h3>
          <p className="mt-1.5">
            Host{" "}
            <span className="font-mono text-xs text-foreground">
              outlook.office365.com
            </span>
            , port{" "}
            <span className="font-mono text-xs text-foreground">993</span>, TLS
            on. Use your full email as username; create an app password if basic
            auth is blocked.
          </p>
        </div>

        <div>
          <h3 className="font-medium text-foreground">Other providers</h3>
          <p className="mt-1.5">
            Search your provider’s help for “IMAP settings” — you need the IMAP
            hostname, SSL port (usually 993), and mailbox or app password.
          </p>
        </div>
      </div>
    </details>
  );
}
