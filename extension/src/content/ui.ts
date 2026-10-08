/**
 * The FormPilot control shown on websites: a small floating button, and a panel that lists every
 * detected field with its suggested value, source and confidence. It lives in a closed shadow root so
 * the site's styles can't reach it, and it never submits the site's form.
 */

import { attachFile, dateChoices, fill, formatDateFor, highlight, type FillRequest } from '../core/autofill-engine'
import type { DetectedField } from '../core/field-detector'
import type { SuggestResponse, Suggestion } from '../core/types'
import { fillableAsIs, selectedByDefault, suggestRequest, TIER_LABEL } from '../field-mapper'
import { send, STORAGE, type Status } from '../shared/messages'
import { STYLES } from './styles'

type Child = Node | string | null | undefined | false
type Props = Record<string, unknown>

function h(tag: string, props: Props | null = null, ...children: (Child | Child[])[]): HTMLElement {
  const el = document.createElement(tag)
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === undefined || value === null || value === false) continue
    if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value as EventListener)
    else if (key === 'className') el.className = String(value)
    else if (key === 'checked' || key === 'value' || key === 'disabled' || key === 'selected') (el as unknown as Record<string, unknown>)[key] = value
    else el.setAttribute(key, value === true ? '' : String(value))
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue
    el.append(child)
  }
  return el
}

const LOGO = `<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7" fill="#0e0e62"/><path d="M9 11h14M9 16h10M9 21h6" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/><circle cx="21.5" cy="21" r="2.6" fill="#ffc72c"/></svg>`

function logo(): HTMLElement {
  const span = h('span', { className: 'logo' })
  span.innerHTML = LOGO
  return span
}

const pct = (n: number) => `${Math.round(n * 100)}%`

/** "12 May 2002" -> "2002-05-12", for alternatives the person picks for a date field. */
function isoFromDisplay(value: string): string | null {
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
  const m = value.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/)
  const month = m ? months.indexOf(m[2].slice(0, 3).toLowerCase()) + 1 : 0
  return m && month ? `${m[3]}-${String(month).padStart(2, '0')}-${m[1].padStart(2, '0')}` : null
}

export class Overlay {
  private host: HTMLElement
  private root: ShadowRoot
  private fields: DetectedField[] = []
  private byId = new Map<string, DetectedField>()
  private status: Status
  private open = false
  private dismissed = false
  private phase: 'idle' | 'loading' | 'ready' | 'error' | 'connect' = 'idle'
  private error = ''
  private response: SuggestResponse | null = null
  private selected = new Set<string>()
  private filled = new Set<string>()
  private skipped = new Set<string>()
  private problems = new Map<string, string>()
  private drafts = new Map<string, string>()
  private saveDraft = new Set<string>()
  private choosing = new Set<string>()
  private stale = false
  private lastRun: { filled: number; review: number } | null = null

  constructor(status: Status) {
    this.status = status
    this.host = document.createElement('formpilot-overlay')
    this.host.style.all = 'initial'
    this.root = this.host.attachShadow({ mode: 'closed' })
    const style = document.createElement('style')
    style.textContent = STYLES
    this.root.append(style, h('div', { className: 'wrap' }))
    document.documentElement.append(this.host)
    this.render()
  }

  get visible(): boolean {
    return this.status.showButton && !this.status.hiddenSites.includes(location.hostname)
  }

  /** New detection results. When the form changed after suggestions were made, offer to rescan. */
  setFields(fields: DetectedField[]): void {
    const before = new Set(this.fields.map((f) => f.id))
    this.fields = fields
    this.byId = new Map(fields.map((f) => [f.id, f]))
    if (this.response && fields.some((f) => !before.has(f.id))) this.stale = true
    this.render()
  }

  async openPanel(): Promise<void> {
    this.open = true
    this.dismissed = false
    if (!this.response || this.stale) await this.scan()
    else this.render()
  }

  private async scan(): Promise<void> {
    this.phase = 'loading'
    this.stale = false
    this.render()
    const status = await send({ type: 'status' })
    if (!status.ok || !status.data.connected) {
      this.phase = 'connect'
      return this.render()
    }
    if (!this.fields.length) {
      this.phase = 'error'
      this.error = 'No form fields found on this page.'
      return this.render()
    }
    const reply = await send(suggestRequest(this.fields))
    if (!reply.ok) {
      this.phase = reply.status === 401 ? 'connect' : 'error'
      this.error = reply.error
      return this.render()
    }
    this.response = reply.data
    this.selected = new Set(reply.data.fields.filter((s) => !this.filled.has(s.id) && selectedByDefault(s, this.byId.get(s.id))).map((s) => s.id))
    this.problems.clear()
    this.phase = 'ready'
    this.render()
  }

  // --- Filling ---------------------------------------------------------------------------------

  private fillOne(s: Suggestion, request: FillRequest): boolean {
    const field = this.byId.get(s.id)
    if (!field) {
      this.problems.set(s.id, 'This field is no longer on the page.')
      return false
    }
    const result = fill(field, request)
    if (!result.ok) {
      this.problems.set(s.id, result.reason ?? 'Couldn’t fill this field.')
      return false
    }
    this.problems.delete(s.id)
    this.filled.add(s.id)
    this.selected.delete(s.id)
    highlight(field.element)
    return true
  }

  private autofill(): void {
    const items = this.response?.fields.filter((s) => this.selected.has(s.id)) ?? []
    let filled = 0
    for (const s of items) if (this.fillOne(s, { value: s.value ?? '', option: s.option, iso: s.value_iso })) filled++
    const review = (this.response?.fields ?? []).filter((s) => !this.filled.has(s.id) && !this.skipped.has(s.id) && s.status !== 'ready').length
    this.lastRun = { filled, review: review + this.problems.size }
    this.render()
  }

  private useValue(s: Suggestion, value: string): void {
    const field = this.byId.get(s.id)
    const dateLike = field && (field.type === 'date' || s.key === 'date_of_birth')
    const iso = value === s.value ? s.value_iso : dateLike ? isoFromDisplay(value) : null
    this.fillOne(s, { value, option: value === s.value ? s.option : value, iso })
    this.render()
  }

  private async attach(s: Suggestion, documentId: string): Promise<void> {
    const field = this.byId.get(s.id)
    if (!field || !(field.element instanceof HTMLInputElement)) return
    const reply = await send({ type: 'download', documentId })
    if (!reply.ok) {
      this.problems.set(s.id, reply.error)
      return this.render()
    }
    const bytes = Uint8Array.from(atob(reply.data.base64), (c) => c.charCodeAt(0))
    attachFile(field.element, new File([bytes], reply.data.name, { type: reply.data.mime }))
    this.filled.add(s.id)
    this.problems.delete(s.id)
    highlight(field.element)
    this.render()
  }

  private async saveManual(s: Suggestion, value: string): Promise<void> {
    if (s.key) {
      const saved = await send({ type: 'save-profile', key: s.key, value })
      if (saved.ok) return
    }
    await send({ type: 'save-answer', question: s.label, answer: value })
  }

  private async hideOnSite(): Promise<void> {
    const hidden = [...new Set([...this.status.hiddenSites, location.hostname])]
    await chrome.storage.local.set({ [STORAGE.hiddenSites]: hidden })
    this.status = { ...this.status, hiddenSites: hidden }
    this.open = false
    this.render()
  }

  // --- Rendering -------------------------------------------------------------------------------

  private render(): void {
    const wrap = this.root.querySelector('.wrap')!
    wrap.replaceChildren()
    if (this.open) wrap.append(this.panel())
    else if (this.visible && !this.dismissed && this.fields.length >= 2) wrap.append(this.pill())
  }

  private pill(): HTMLElement {
    return h(
      'div',
      { className: 'pill' },
      h(
        'button',
        { className: 'pill-main', onclick: () => void this.openPanel(), 'aria-label': `FormPilot: ${this.fields.length} fields detected. Open.` },
        logo(),
        h('span', null, h('strong', null, 'FormPilot'), ` · ${this.fields.length} fields`),
      ),
      h('button', { className: 'pill-x', onclick: () => ((this.dismissed = true), this.render()), 'aria-label': 'Hide FormPilot on this page', title: 'Hide on this page' }, '×'),
    )
  }

  private panel(): HTMLElement {
    const body = h('div', { className: 'body' })
    if (this.phase === 'loading') body.append(h('p', { className: 'muted' }, 'Understanding the form and matching it with your profile…'))
    else if (this.phase === 'connect') body.append(this.connectView())
    else if (this.phase === 'error') body.append(h('p', { className: 'error', role: 'alert' }, this.error), h('button', { className: 'btn ghost', onclick: () => void this.scan() }, 'Try again'))
    else if (this.response) body.append(...this.resultsView(this.response))

    return h(
      'section',
      { className: 'panel', role: 'dialog', 'aria-label': 'FormPilot' },
      h(
        'header',
        null,
        logo(),
        h('div', { className: 'title' }, h('strong', null, 'FormPilot'), h('span', { className: 'muted small' }, location.hostname)),
        h('button', { className: 'icon', onclick: () => ((this.open = false), this.render()), 'aria-label': 'Close FormPilot' }, '×'),
      ),
      body,
      h(
        'footer',
        null,
        h('span', null, 'FormPilot never submits forms. Review, then submit yourself.'),
        h('button', { className: 'link', onclick: () => void this.hideOnSite() }, 'Hide on this site'),
      ),
    )
  }

  private connectView(): HTMLElement {
    return h(
      'div',
      { className: 'stack' },
      h('p', null, h('strong', null, 'Connect FormPilot to your profile')),
      h('p', { className: 'muted' }, this.error || 'Sign in to the FormPilot app and connect this browser. Your profile stays in your account.'),
      h('button', { className: 'btn primary', onclick: () => void send({ type: 'open-connect' }) }, 'Connect FormPilot'),
    )
  }

  private resultsView(r: SuggestResponse): HTMLElement[] {
    const out: HTMLElement[] = []
    const s = r.summary
    out.push(
      h(
        'div',
        { className: 'summary' },
        h('p', { className: 'big' }, `${s.detected} fields detected`),
        h('div', { className: 'chips' }, h('span', { className: 'chip ok' }, `${s.ready} ready`), h('span', { className: 'chip warn' }, `${s.needs_review} need review`), h('span', { className: 'chip' }, `${s.missing} not in profile`)),
      ),
    )
    if (this.stale) out.push(h('div', { className: 'notice' }, 'This form changed. ', h('button', { className: 'link', onclick: () => void this.scan() }, 'Scan the new fields')))
    if (this.lastRun)
      out.push(
        h(
          'div',
          { className: 'result', role: 'status' },
          h('p', null, `✓ ${this.lastRun.filled} field${this.lastRun.filled === 1 ? '' : 's'} filled`),
          this.lastRun.review ? h('p', { className: 'warn-text' }, `⚠ ${this.lastRun.review} need${this.lastRun.review === 1 ? 's' : ''} your review`) : null,
        ),
      )

    const template = r.template
    const templateFields = r.fields.filter((f) => f.method === 'template' && !this.filled.has(f.id))
    if (template && templateFields.length)
      out.push(
        h(
          'div',
          { className: 'notice' },
          `Reuse your “${template.name}” template? `,
          h('button', { className: 'link', onclick: () => (templateFields.forEach((f) => this.fillOne(f, { value: f.value ?? '' })), this.render()) }, 'Use template'),
        ),
      )

    // Left to you: declarations, checkboxes, uploads with nothing to suggest.
    const left = r.fields.filter((f) => f.kind === 'consent' || this.byId.get(f.id)?.type === 'checkbox' || (f.kind === 'document' && f.status === 'missing'))
    const leftIds = new Set(left.map((f) => f.id))
    // Ready: confident values that can be written as they are.
    const ready = r.fields.filter((f) => !leftIds.has(f.id) && fillableAsIs(f, this.byId.get(f.id)))
    const readyIds = new Set(ready.map((f) => f.id))
    // Not in the profile: nothing to suggest and no alternatives.
    const missing = r.fields.filter((f) => !leftIds.has(f.id) && !readyIds.has(f.id) && f.status === 'missing' && !f.alternatives.length)
    const missingIds = new Set(missing.map((f) => f.id))
    // Everything else needs the person: uncertain matches, conflicts, answers, documents, ambiguous dates.
    const review = r.fields.filter((f) => !leftIds.has(f.id) && !readyIds.has(f.id) && !missingIds.has(f.id))

    if (ready.length) out.push(this.section('Ready to fill', ready.map((f) => this.readyRow(f))))
    const count = [...this.selected].filter((id) => readyIds.has(id)).length
    out.push(
      h(
        'div',
        { className: 'actions' },
        h('button', { className: 'btn primary', disabled: count === 0, onclick: () => this.autofill() }, count ? `Autofill ${count} field${count === 1 ? '' : 's'}` : 'Autofill'),
        h('p', { className: 'muted small' }, 'Review before filling. Sensitive fields are filled only if you tick them.'),
      ),
    )
    if (review.length) out.push(this.section('Needs your review', review.map((f) => this.reviewCard(f, r))))
    if (missing.length) out.push(this.section('Not in your profile', missing.map((f) => this.missingCard(f))))
    if (left.length) out.push(this.section('Left to you', left.map((f) => this.leftRow(f))))
    return out
  }

  private section(title: string, rows: HTMLElement[]): HTMLElement {
    return h('div', { className: 'section' }, h('h3', null, title), h('ul', null, rows))
  }

  private status_(f: Suggestion): HTMLElement | null {
    if (this.filled.has(f.id)) return h('span', { className: 'tag ok' }, '✓ Filled')
    if (this.skipped.has(f.id)) return h('span', { className: 'tag' }, 'Skipped')
    return null
  }

  private readyRow(f: Suggestion): HTMLElement {
    const id = `fp-sel-${f.id}`
    return h(
      'li',
      { className: 'row' },
      h('input', {
        type: 'checkbox',
        id,
        checked: this.selected.has(f.id),
        disabled: this.filled.has(f.id),
        onchange: (e: Event) => {
          if ((e.target as HTMLInputElement).checked) this.selected.add(f.id)
          else this.selected.delete(f.id)
          this.render()
        },
      }),
      h(
        'label',
        { for: id, className: 'grow' },
        h('span', { className: 'label' }, f.label),
        h('span', { className: 'value' }, f.value ?? ''),
        h('span', { className: 'meta' }, `${TIER_LABEL[f.tier]} · ${pct(f.confidence)}${f.source ? ` · ${f.source}` : ''}`),
        f.sensitive && !this.filled.has(f.id) ? h('span', { className: 'meta warn-text' }, 'Sensitive: tick to include') : null,
        this.problems.has(f.id) ? h('span', { className: 'meta error' }, this.problems.get(f.id)!) : null,
      ),
      this.status_(f),
    )
  }

  private reviewCard(f: Suggestion, r: SuggestResponse): HTMLElement {
    const done = this.status_(f)
    const card = h('li', { className: 'card' }, h('div', { className: 'card-head' }, h('span', { className: 'label' }, f.label), done ?? h('span', { className: 'tag warn' }, '⚠ Needs review')))
    if (done) return card
    const field = this.byId.get(f.id)

    if (f.kind === 'answer' && f.value) {
      const area = h('textarea', { rows: 5, 'aria-label': `Suggested answer for ${f.label}` }) as HTMLTextAreaElement
      area.value = this.drafts.get(f.id) ?? f.value
      area.addEventListener('input', () => this.drafts.set(f.id, area.value))
      card.append(
        h('p', { className: 'meta' }, 'Suggested answer. Edit it so it sounds like you.'),
        area,
        f.sources.length ? h('p', { className: 'meta' }, `Sources: ${f.sources.map((x) => x.label).join(', ')}`) : '',
        h(
          'div',
          { className: 'row-actions' },
          h('button', { className: 'btn small primary', onclick: () => this.useValue(f, area.value.trim()) }, 'Use'),
          h(
            'button',
            {
              className: 'btn small ghost',
              onclick: async () => {
                const reply = await send({ type: 'answer', question: f.label, organization: undefined })
                if (reply.ok && reply.data.answer) {
                  this.drafts.set(f.id, reply.data.answer)
                  f.sources = reply.data.sources
                }
                this.render()
              },
            },
            'Regenerate',
          ),
          h('button', { className: 'btn small ghost', onclick: () => (this.skipped.add(f.id), this.render()) }, 'Skip'),
        ),
      )
      return card
    }

    if (f.kind === 'document') {
      const select = h('select', { 'aria-label': `Document for ${f.label}` }, r.documents.map((d) => h('option', { value: d.id, selected: d.id === f.document_id }, d.filename))) as HTMLSelectElement
      card.append(
        h('p', { className: 'meta' }, 'Select document from your vault. It is attached only when you click Attach.'),
        select,
        h(
          'div',
          { className: 'row-actions' },
          h('button', { className: 'btn small primary', disabled: !r.documents.length, onclick: () => void this.attach(f, select.value) }, 'Attach'),
          h('button', { className: 'btn small ghost', onclick: () => (this.skipped.add(f.id), this.render()) }, 'Skip'),
        ),
      )
      return card
    }

    if (f.value_iso && f.value && field && formatDateFor(field.element, f.value_iso) === null) {
      // A date field with no format hint: day and month could be swapped, so the person chooses.
      card.append(
        h('p', { className: 'meta' }, `Which format does this field use? Your date: ${f.value}`),
        h('div', { className: 'row-actions' }, dateChoices(f.value_iso).map((c) => h('button', { className: 'btn small ghost', onclick: () => (this.fillOne(f, { value: c.value }), this.render()) }, c.label))),
      )
      return card
    }

    if (f.value) {
      card.append(
        h('p', { className: 'value' }, h('span', { className: 'muted' }, 'Suggested: '), f.value),
        h('p', { className: 'meta' }, `${TIER_LABEL[f.tier]} · ${pct(f.confidence)}${f.source ? ` · ${f.source}` : ''}`),
      )
    }
    card.append(h('p', { className: 'meta' }, f.reasoning))
    if (this.problems.has(f.id)) card.append(h('p', { className: 'meta error' }, this.problems.get(f.id)!))
    if (f.alternatives.length)
      card.append(h('div', { className: 'row-actions' }, f.alternatives.map((a) => h('button', { className: 'btn small ghost', onclick: () => this.useValue(f, a.value) }, `Use ${a.value}`))))

    const actions = h('div', { className: 'row-actions' })
    if (f.value) actions.append(h('button', { className: 'btn small primary', onclick: () => this.useValue(f, f.value!) }, 'Use'))
    actions.append(h('button', { className: 'btn small ghost', onclick: () => (this.choosing.add(f.id), this.render()) }, 'Choose another'))
    actions.append(h('button', { className: 'btn small ghost', onclick: () => (this.skipped.add(f.id), this.render()) }, 'Skip'))
    card.append(actions)
    if (this.choosing.has(f.id)) card.append(this.chooser(f, r))
    return card
  }

  /** Pick any value from the profile, or the field's own options. */
  private chooser(f: Suggestion, r: SuggestResponse): HTMLElement {
    const field = this.byId.get(f.id)
    const choices = field && field.options.length ? field.options.map((o) => ({ label: o, value: o })) : r.profile.map((p) => ({ label: `${p.label}: ${p.value}`, value: p.value }))
    const select = h('select', { 'aria-label': `Choose a value for ${f.label}` }, choices.map((c) => h('option', { value: c.value }, c.label.slice(0, 80)))) as HTMLSelectElement
    return h('div', { className: 'row-actions' }, select, h('button', { className: 'btn small primary', onclick: () => this.useValue(f, select.value) }, 'Fill'))
  }

  private missingCard(f: Suggestion): HTMLElement {
    const done = this.status_(f)
    const card = h('li', { className: 'card' }, h('div', { className: 'card-head' }, h('span', { className: 'label' }, f.label), done ?? h('span', { className: 'tag' }, '⚠ Information not available')))
    if (done) return card
    const id = `fp-manual-${f.id}`
    const input = h('input', { id, type: 'text', placeholder: 'Enter manually', 'aria-label': `Enter ${f.label}` }) as HTMLInputElement
    input.value = this.drafts.get(f.id) ?? ''
    input.addEventListener('input', () => this.drafts.set(f.id, input.value))
    const save = h('input', {
      type: 'checkbox',
      id: `${id}-save`,
      checked: this.saveDraft.has(f.id),
      onchange: (e: Event) => ((e.target as HTMLInputElement).checked ? this.saveDraft.add(f.id) : this.saveDraft.delete(f.id)),
    })
    card.append(
      h('p', { className: 'meta' }, 'FormPilot doesn’t guess information you haven’t given it.'),
      input,
      h('label', { for: `${id}-save`, className: 'meta check' }, save, f.sensitive ? 'Save to my FormPilot profile (sensitive: only if you’re sure)' : 'Save to my FormPilot profile for next time'),
      h(
        'div',
        { className: 'row-actions' },
        h(
          'button',
          {
            className: 'btn small primary',
            onclick: async () => {
              const value = input.value.trim()
              if (!value) return
              this.fillOne(f, { value })
              if (this.saveDraft.has(f.id)) await this.saveManual(f, value)
              this.render()
            },
          },
          'Fill',
        ),
        h('button', { className: 'btn small ghost', onclick: () => (this.skipped.add(f.id), this.render()) }, 'Skip'),
      ),
    )
    return card
  }

  private leftRow(f: Suggestion): HTMLElement {
    return h('li', { className: 'row' }, h('div', { className: 'grow' }, h('span', { className: 'label' }, f.label), h('span', { className: 'meta' }, f.reasoning)))
  }
}
