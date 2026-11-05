import { randomUUID } from "node:crypto"
import { Schema } from "effect"
import { Ipc, Plugin, Slot, Style } from "@opencode/plugin/gui"
import { createSignal, onCleanup, onMount, For, Show } from "solid-js"
import { countdown, compactCountdown, windowLabel, windowsFromResponse, resetCreditsFromResponse } from "./limits.js"
import { codexRequest } from "./codex"
import { interpolateTranslation } from "./i18n.js"
import { RefreshIcon, ChevronIcon } from "./icons"
import css from "./usage.css?inline"

const Window = Schema.Struct({ used: Schema.Number, minutes: Schema.Number, resetsAt: Schema.Number })
const Usage = Ipc.define({
  id: "codex-usage-desktop.usage",
  methods: {
    read: {
      output: Schema.Struct({
        windows: Schema.Array(Window),
        error: Schema.String,
        credits: Schema.Number,
        expiresAt: Schema.Number,
      }),
    },
    reset: { output: Schema.String },
  },
})

async function readLimits() {
  try {
    const result = await codexRequest("account/rateLimits/read")
    const windows = windowsFromResponse(result)
    return {
      windows,
      error: windows.length ? "" : "error.noWindows",
      ...resetCreditsFromResponse(result),
      accountId: result.accountId ?? null,
    }
  } catch (error) {
    return {
      windows: [],
      credits: -1,
      expiresAt: 0,
      accountId: null,
      error: error instanceof Error ? error.message : "error.generic",
    }
  }
}

function UsageBar(props: {
  read: () => Promise<{
    windows: readonly { used: number; minutes: number; resetsAt: number }[]
    error: string
    credits: number
    expiresAt: number
  }>
  reset: () => Promise<string>
  t: (key: string, params?: Record<string, string | number | boolean>) => string
  locale: string
}) {
  const [windows, setWindows] = createSignal<readonly { used: number; minutes: number; resetsAt: number }[]>([])
  const [error, setError] = createSignal("")
  const [busy, setBusy] = createSignal(false)
  const [updated, setUpdated] = createSignal(0)
  const [now, setNow] = createSignal(Date.now())
  const [credits, setCredits] = createSignal(-1)
  const [expiresAt, setExpiresAt] = createSignal(0)
  const [confirm, setConfirm] = createSignal(false)
  const [resetting, setResetting] = createSignal(false)
  const [notice, setNotice] = createSignal("")
  let dialog!: HTMLDialogElement
  const color = (used: number) => (used >= 90 ? "#f87171" : used >= 75 ? "#f0b65e" : "#67c9aa")
  const resetTime = (timestamp: number) => countdown(timestamp, now(), props.locale, props.t)
  const updatedLabel = () =>
    updated()
      ? props.t("status.updated", {
          time: new Intl.DateTimeFormat(props.locale, { timeStyle: "short" }).format(updated()),
        })
      : props.t("status.loading")
  let alive = true
  async function refresh() {
    if (busy() || resetting()) return
    setBusy(true)
    try {
      const result = await props.read()
      if (!alive) return
      if (!result.error) {
        setWindows(result.windows)
        setUpdated(Date.now())
        setCredits(result.credits)
        setExpiresAt(result.expiresAt)
      }
      setError(result.error)
    } catch {
      if (alive) setError("error.generic")
    } finally {
      if (alive) setBusy(false)
    }
  }
  async function reset() {
    if (resetting() || busy() || error() || credits() <= 0) return
    setResetting(true)
    setConfirm(false)
    setNotice("")
    try {
      const outcome = await props.reset()
      if (alive) setNotice(`reset.${outcome}`)
    } catch {
      if (alive) setNotice("error.reset")
    } finally {
      if (alive) {
        setResetting(false)
        await refresh()
      }
    }
  }
  onMount(() => {
    void refresh()
    const poll = setInterval(() => void refresh(), 5 * 60 * 1000)
    const clock = setInterval(() => setNow(Date.now()), 30000)
    onCleanup(() => {
      alive = false
      clearInterval(poll)
      clearInterval(clock)
    })
  })
  return (
    <>
      <div class="cu cu-strip">
        <button
          type="button"
          class="cu-trigger"
          aria-label={props.t("panel.open")}
          aria-haspopup="dialog"
          onClick={() => {
            setConfirm(false)
            dialog.showModal()
          }}
        >
          <span class="cu-logo">◎ Codex</span>
          <For each={windows()}>
            {(window) => (
              <span class="cu-mini" title={`${windowLabel(window.minutes, props.t)} · ${resetTime(window.resetsAt)}`}>
                <span class="cu-mini-label">
                  {window.minutes === 300
                    ? "5h"
                    : window.minutes === 10080
                      ? "7d"
                      : windowLabel(window.minutes, props.t)}
                </span>
                <span class="cu-track" aria-hidden="true">
                  <span class="cu-fill" style={{ width: `${window.used}%`, background: color(window.used) }} />
                </span>
                <span style={{ color: color(window.used) }}>{window.used}%</span>
                <span class="cu-mini-reset">{compactCountdown(window.resetsAt, now(), props.locale)}</span>
              </span>
            )}
          </For>
          <Show when={error()}>
            <span class="cu-error" title={props.t(error())}>
              !
            </span>
          </Show>
          <Show when={!windows().length && !error()}>
            <span class="cu-muted">…</span>
          </Show>
          <span class="cu-chevron">
            <ChevronIcon />
          </span>
        </button>
      </div>
      <dialog
        ref={dialog}
        class="cu cu-dialog"
        aria-label={props.t("panel.title")}
        onClick={(event) => {
          if (event.target === dialog) {
            const rect = dialog.getBoundingClientRect()
            if (
              event.clientX < rect.left ||
              event.clientX > rect.right ||
              event.clientY < rect.top ||
              event.clientY > rect.bottom
            )
              dialog.close()
          }
        }}
      >
        <header class="cu-head">
          <div class="cu-title">
            <strong>{props.t("panel.title")}</strong>
            <span class="cu-muted">{updatedLabel()}</span>
          </div>
          <div class="cu-head-actions">
            <button
              type="button"
              class="cu-icon"
              disabled={busy() || resetting()}
              aria-busy={busy()}
              title={props.t("status.refresh")}
              aria-label={props.t("status.refresh")}
              onClick={() => void refresh()}
            >
              <RefreshIcon busy={busy()} />
            </button>
          </div>
        </header>
        <div class="cu-body">
          <For each={windows()}>
            {(window) => (
              <section class="cu-window">
                <div class="cu-row">
                  <strong>{windowLabel(window.minutes, props.t)}</strong>
                  <span class="cu-percent" style={{ color: color(window.used) }}>
                    {window.used}%
                  </span>
                </div>
                <div
                  class="cu-track"
                  role="progressbar"
                  aria-label={windowLabel(window.minutes, props.t)}
                  aria-valuenow={window.used}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <span class="cu-fill" style={{ width: `${window.used}%`, background: color(window.used) }} />
                </div>
                <div class="cu-row cu-muted">
                  <span>{props.t("panel.used")}</span>
                  <span>{resetTime(window.resetsAt)}</span>
                </div>
              </section>
            )}
          </For>
          <Show when={error()}>
            <p class="cu-notice cu-error" role="status">
              {props.t(error())} {updated() ? props.t("status.stale") : ""}
            </p>
          </Show>
          <section class="cu-reset">
            <div class="cu-row">
              <div class="cu-title">
                <strong>
                  {credits() < 0 ? props.t("reset.unavailable") : props.t("reset.credits", { count: credits() })}
                </strong>
                <Show when={expiresAt() > 0}>
                  <span class="cu-muted">
                    {props.t("reset.expires", {
                      date: new Intl.DateTimeFormat(props.locale, { dateStyle: "medium" }).format(expiresAt() * 1000),
                    })}
                  </span>
                </Show>
              </div>
              <button
                type="button"
                class="cu-action"
                disabled={credits() <= 0 || !!error() || busy() || resetting()}
                onClick={() => setConfirm(true)}
              >
                {props.t(resetting() ? "reset.working" : "reset.action")}
              </button>
            </div>
            <Show when={confirm()}>
              <div class="cu-confirm">
                <p>{props.t("reset.confirm")}</p>
                <div class="cu-row">
                  <button type="button" class="cu-action" onClick={() => setConfirm(false)}>
                    {props.t("reset.cancel")}
                  </button>
                  <button type="button" class="cu-action" disabled={resetting()} onClick={() => void reset()}>
                    {props.t("reset.action")}
                  </button>
                </div>
              </div>
            </Show>
            <Show when={notice()}>
              <p class="cu-notice" role="status">
                {props.t(notice())}
              </p>
            </Show>
          </section>
          <p class="cu-notice">{props.t("panel.account")}</p>
        </div>
      </dialog>
    </>
  )
}

export default Plugin.define({
  i18n: {
    en: {
      "panel.title": "Codex usage",
      "panel.open": "Open Codex usage details",
      "panel.used": "Used",
      "panel.account": "Account signed in to Codex CLI · Updated every 5 minutes",
      "reset.credits": "{count} resets available",
      "reset.expires": "Next expires {date}",
      "reset.unavailable": "Reset availability unknown",
      "reset.action": "Reset now",
      "reset.working": "Resetting…",
      "reset.confirm": "Use one earned reset credit to reset eligible Codex usage limits? This cannot be undone.",
      "reset.cancel": "Cancel",
      "reset.reset": "Usage limits reset successfully.",
      "reset.alreadyRedeemed": "This reset was already applied. Usage refreshed.",
      "reset.nothingToReset": "No current limit is eligible for a reset.",
      "reset.noCredit": "No reset credits available.",
      "reset.accountChanged": "Account changed or unavailable. Refresh before trying again.",
      "reset.failed": "Reset not confirmed. Refresh usage; retrying this attempt will not spend an extra credit.",
      "error.reset": "Reset could not be confirmed. Refresh usage before retrying.",
      "window.fiveHours": "5-hour",
      "window.weekly": "Weekly",
      "window.limit": "Limit",
      "window.minutes": "{minutes} min",
      "reset.in": "Resets",
      "reset.unknown": "Reset time unknown",
      "reset.imminent": "Reset imminent",
      "status.stale": "showing previous data",
      "status.loading": "Loading usage…",
      "status.refresh": "Refresh usage",
      "status.updated": "Updated {time}",
      "error.timeout": "Codex did not respond. Try again.",
      "error.cliMissing": "Codex CLI not found. Install it and sign in.",
      "error.closed": "Codex closed before returning usage data.",
      "error.communication": "Could not communicate with Codex.",
      "error.responseTooLarge": "Codex response was too large.",
      "error.serverStart": "Could not start the Codex server.",
      "error.auth": "Could not read limits. Check that Codex is signed in to ChatGPT.",
      "error.noWindows": "The account returned no usage windows.",
      "error.generic": "Could not read Codex usage.",
    },
    ca: {
      "panel.title": "Consum de Codex",
      "panel.open": "Obre els detalls del consum de Codex",
      "panel.used": "Utilitzat",
      "panel.account": "Compte iniciat a Codex CLI · Actualització cada 5 minuts",
      "reset.credits": "{count} reinicis disponibles",
      "reset.expires": "El següent venç el {date}",
      "reset.unavailable": "Disponibilitat de reinicis desconeguda",
      "reset.action": "Reinicia ara",
      "reset.working": "Reiniciant…",
      "reset.confirm":
        "Vols gastar un crèdit de reinici per restablir els límits de Codex elegibles? Aquesta acció no es pot desfer.",
      "reset.cancel": "Cancel·la",
      "reset.reset": "Els límits s'han reiniciat correctament.",
      "reset.alreadyRedeemed": "Aquest reinici ja s'havia aplicat. Consum actualitzat.",
      "reset.nothingToReset": "Cap límit actual es pot reiniciar.",
      "reset.noCredit": "No hi ha reinicis disponibles.",
      "reset.accountChanged": "El compte ha canviat o no està disponible. Actualitza abans de tornar-ho a provar.",
      "reset.failed":
        "No s'ha confirmat el reinici. Actualitza el consum; reintentar aquesta operació no gastarà un crèdit addicional.",
      "error.reset": "No s'ha pogut confirmar el reinici. Actualitza el consum abans de reintentar-ho.",
      "window.fiveHours": "5 hores",
      "window.weekly": "Setmanal",
      "window.limit": "Límit",
      "window.minutes": "{minutes} min",
      "reset.in": "Es reinicia",
      "reset.unknown": "Reinici desconegut",
      "reset.imminent": "Reinici imminent",
      "status.stale": "es mostren dades anteriors",
      "status.loading": "Consultant el consum…",
      "status.refresh": "Actualitza el consum",
      "status.updated": "Actualitzat {time}",
      "error.timeout": "Codex no respon. Torna-ho a provar.",
      "error.cliMissing": "No s'ha trobat Codex CLI. Instal·la'l i inicia sessió.",
      "error.closed": "Codex s'ha tancat abans de retornar les dades.",
      "error.communication": "No s'ha pogut comunicar amb Codex.",
      "error.responseTooLarge": "La resposta de Codex és massa gran.",
      "error.serverStart": "No s'ha pogut iniciar el servei de Codex.",
      "error.auth": "No es poden consultar els límits. Comprova que Codex té una sessió ChatGPT iniciada.",
      "error.noWindows": "El compte no ha retornat finestres de consum.",
      "error.generic": "No s'ha pogut consultar el consum de Codex.",
    },
    es: {
      "panel.title": "Uso de Codex",
      "panel.open": "Abrir detalles de uso de Codex",
      "panel.used": "Usado",
      "panel.account": "Cuenta conectada en Codex CLI · Actualización cada 5 minutos",
      "reset.credits": "{count} reinicios disponibles",
      "reset.expires": "El siguiente vence el {date}",
      "reset.unavailable": "Disponibilidad de reinicios desconocida",
      "reset.action": "Reiniciar ahora",
      "reset.working": "Reiniciando…",
      "reset.confirm":
        "¿Gastar un crédito de reinicio para restablecer los límites elegibles de Codex? Esta acción no se puede deshacer.",
      "reset.cancel": "Cancelar",
      "reset.reset": "Límites reiniciados correctamente.",
      "reset.alreadyRedeemed": "Este reinicio ya se había aplicado. Uso actualizado.",
      "reset.nothingToReset": "Ningún límite actual permite un reinicio.",
      "reset.noCredit": "No hay reinicios disponibles.",
      "reset.accountChanged": "La cuenta ha cambiado o no está disponible. Actualiza antes de reintentar.",
      "reset.failed":
        "Reinicio no confirmado. Actualiza el uso; reintentar esta operación no gastará un crédito adicional.",
      "error.reset": "No se pudo confirmar el reinicio. Actualiza el uso antes de reintentar.",
      "window.fiveHours": "5 horas",
      "window.weekly": "Semanal",
      "window.limit": "Límite",
      "window.minutes": "{minutes} min",
      "reset.in": "Se reinicia",
      "reset.unknown": "Reinicio desconocido",
      "reset.imminent": "Reinicio inminente",
      "status.stale": "se muestran datos anteriores",
      "status.loading": "Consultando el uso…",
      "status.refresh": "Actualizar el uso",
      "status.updated": "Actualizado {time}",
      "error.timeout": "Codex no responde. Inténtalo de nuevo.",
      "error.cliMissing": "No se encontró Codex CLI. Instálalo e inicia sesión.",
      "error.closed": "Codex se cerró antes de devolver los datos.",
      "error.communication": "No se pudo comunicar con Codex.",
      "error.responseTooLarge": "La respuesta de Codex es demasiado grande.",
      "error.serverStart": "No se pudo iniciar el servidor de Codex.",
      "error.auth": "No se pueden consultar los límites. Comprueba que has iniciado sesión en ChatGPT desde Codex.",
      "error.noWindows": "La cuenta no devolvió ventanas de uso.",
      "error.generic": "No se pudo consultar el uso de Codex.",
    },
    fr: {
      "panel.title": "Utilisation Codex",
      "panel.open": "Ouvrir les détails Codex",
      "panel.used": "Utilisé",
      "panel.account": "Compte connecté à Codex CLI · Actualisation toutes les 5 minutes",
      "reset.credits": "{count} réinitialisations disponibles",
      "reset.expires": "Prochaine expiration : {date}",
      "reset.unavailable": "Disponibilité inconnue",
      "reset.action": "Réinitialiser",
      "reset.working": "Réinitialisation…",
      "reset.confirm":
        "Utiliser un crédit pour réinitialiser les limites Codex éligibles ? Cette action est irréversible.",
      "reset.cancel": "Annuler",
      "reset.reset": "Limites réinitialisées.",
      "reset.alreadyRedeemed": "Cette réinitialisation a déjà été appliquée.",
      "reset.nothingToReset": "Aucune limite éligible à une réinitialisation.",
      "reset.noCredit": "Aucun crédit disponible.",
      "reset.accountChanged": "Compte modifié ou indisponible. Actualisez avant de réessayer.",
      "reset.failed":
        "Réinitialisation non confirmée. Actualisez ; réessayer cette opération ne consommera pas de crédit supplémentaire.",
      "error.reset": "Réinitialisation non confirmée. Actualisez avant de réessayer.",
      "window.fiveHours": "5 heures",
      "window.weekly": "Hebdomadaire",
      "window.limit": "Limite",
      "window.minutes": "{minutes} min",
      "reset.in": "Réinitialisation",
      "reset.unknown": "Réinitialisation inconnue",
      "reset.imminent": "Réinitialisation imminente",
      "status.stale": "anciennes données affichées",
      "status.loading": "Récupération de l’utilisation…",
      "status.refresh": "Actualiser l’utilisation",
      "status.updated": "Mis à jour à {time}",
      "error.timeout": "Codex ne répond pas. Réessayez.",
      "error.cliMissing": "Codex CLI est introuvable. Installez-le et connectez-vous.",
      "error.closed": "Codex s’est fermé avant de renvoyer les données.",
      "error.communication": "Impossible de communiquer avec Codex.",
      "error.responseTooLarge": "La réponse de Codex est trop volumineuse.",
      "error.serverStart": "Impossible de démarrer le serveur Codex.",
      "error.auth": "Impossible de lire les limites. Vérifiez que Codex est connecté à ChatGPT.",
      "error.noWindows": "Aucune période d’utilisation renvoyée par le compte.",
      "error.generic": "Impossible de récupérer l’utilisation Codex.",
    },
    de: {
      "panel.title": "Codex-Nutzung",
      "panel.open": "Codex-Nutzungsdetails öffnen",
      "panel.used": "Verbraucht",
      "panel.account": "In Codex CLI angemeldetes Konto · Aktualisierung alle 5 Minuten",
      "reset.credits": "{count} Rücksetzungen verfügbar",
      "reset.expires": "Nächster Ablauf: {date}",
      "reset.unavailable": "Verfügbarkeit unbekannt",
      "reset.action": "Jetzt zurücksetzen",
      "reset.working": "Wird zurückgesetzt…",
      "reset.confirm":
        "Ein Guthaben verwenden, um berechtigte Codex-Limits zurückzusetzen? Dies kann nicht rückgängig gemacht werden.",
      "reset.cancel": "Abbrechen",
      "reset.reset": "Limits erfolgreich zurückgesetzt.",
      "reset.alreadyRedeemed": "Diese Rücksetzung wurde bereits angewendet.",
      "reset.nothingToReset": "Kein aktuelles Limit kann zurückgesetzt werden.",
      "reset.noCredit": "Kein Rücksetzungsguthaben verfügbar.",
      "reset.accountChanged": "Konto geändert oder nicht verfügbar. Bitte aktualisieren.",
      "reset.failed":
        "Rücksetzung nicht bestätigt. Bitte aktualisieren; ein erneuter Versuch verbraucht kein zusätzliches Guthaben.",
      "error.reset": "Rücksetzung nicht bestätigt. Vor dem erneuten Versuch aktualisieren.",
      "window.fiveHours": "5 Stunden",
      "window.weekly": "Wöchentlich",
      "window.limit": "Limit",
      "window.minutes": "{minutes} Min.",
      "reset.in": "Zurückgesetzt",
      "reset.unknown": "Rücksetzzeit unbekannt",
      "reset.imminent": "Wird gleich zurückgesetzt",
      "status.stale": "ältere Daten werden angezeigt",
      "status.loading": "Nutzung wird geladen…",
      "status.refresh": "Nutzung aktualisieren",
      "status.updated": "Aktualisiert {time}",
      "error.timeout": "Codex antwortet nicht. Bitte erneut versuchen.",
      "error.cliMissing": "Codex CLI nicht gefunden. Installieren und anmelden.",
      "error.closed": "Codex wurde vor der Rückgabe der Nutzungsdaten beendet.",
      "error.communication": "Kommunikation mit Codex fehlgeschlagen.",
      "error.responseTooLarge": "Die Codex-Antwort ist zu groß.",
      "error.serverStart": "Codex-Server konnte nicht gestartet werden.",
      "error.auth": "Limits konnten nicht gelesen werden. Prüfe die ChatGPT-Anmeldung in Codex.",
      "error.noWindows": "Das Konto hat keine Nutzungszeiträume zurückgegeben.",
      "error.generic": "Codex-Nutzung konnte nicht abgerufen werden.",
    },
  },
  main(ctx) {
    let pending: ReturnType<typeof readLimits> | undefined
    let resetPending: Promise<string> | undefined
    let attemptKey: string | undefined
    let accountId: string | null = null
    ctx.provide(Usage, {
      read: () => {
        if (!pending)
          pending = readLimits()
            .then((result) => {
              if (!result.error) accountId = result.accountId
              return result
            })
            .finally(() => {
              pending = undefined
            })
        return pending
      },
      reset: () => {
        if (resetPending) return resetPending
        resetPending = (async () => {
          const expectedAccount = accountId
          if (pending) await pending
          const current = await readLimits()
          if (current.error || current.accountId !== expectedAccount) return "accountChanged"
          if (current.credits <= 0) return "noCredit"
          // Preserve the key on ambiguous failures: retrying cannot spend two credits.
          attemptKey ??= randomUUID()
          try {
            const result = await codexRequest("account/rateLimitResetCredit/consume", { idempotencyKey: attemptKey })
            if (!["reset", "nothingToReset", "noCredit", "alreadyRedeemed"].includes(result?.outcome)) return "failed"
            attemptKey = undefined
            return result.outcome as string
          } catch {
            return "failed"
          }
        })().finally(() => {
          resetPending = undefined
        })
        return resetPending
      },
    })
  },
  setup(ctx) {
    const usage = ctx.main(Usage)
    ctx.add(Style, css)
    ctx.add(Slot, {
      at: "window.bottom",
      render: () => (
        <UsageBar
          read={() => usage.read({ signal: ctx.signal })}
          reset={() => usage.reset({ signal: ctx.signal })}
          t={(key, params) => interpolateTranslation(ctx.t(key), params)}
          locale={ctx.locale.locale()}
        />
      ),
    })
  },
})
