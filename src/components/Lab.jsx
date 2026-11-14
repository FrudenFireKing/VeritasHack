import React, { useEffect, useRef, useState } from 'react'
import { SAMPLES } from '../lib/samples.js'
import { checkMode, runAudit } from '../lib/api.js'
import { assistantAnswer, pushArchive } from '../lib/demoEngine.js'
import Report from './Report.jsx'

const STEPS = [
  'Unrolling the manuscript',
  'Extracting the claims',
  'Cross-checking the web evidence',
  'Rendering the verdicts',
  'Binding the report',
]

const MAX_LEN = 6000

function StepIcon({ state, num }) {
  // state: 'done' | 'active' | 'pending'
  if (state === 'done')
    return (
      <span className="w-6 h-6 rounded-full border border-sage text-sage flex items-center justify-center text-[11px]">
        ✓
      </span>
    )
  return (
    <span
      className={`w-6 h-6 rounded-full border flex items-center justify-center text-[11px] ${
        state === 'active'
          ? 'border-gold text-gold animate-pulse-soft'
          : 'border-border text-muted-foreground'
      }`}
    >
      {state === 'active' ? num : ''}
    </span>
  )
}

export default function Lab({ onArchived }) {
  const [mode, setMode] = useState('demo')
  const [tab, setTab] = useState('paste')
  const [question, setQuestion] = useState('')
  const [text, setText] = useState('')
  const [auditing, setAuditing] = useState(false)
  const [step, setStep] = useState(-1)
  const [report, setReport] = useState(null)
  const reportRef = useRef(null)

  useEffect(() => {
    checkMode().then(setMode)
  }, [])

  async function startAudit(sourceText) {
    setAuditing(true)
    setStep(0)
    setReport(null)
    const r = await runAudit(sourceText, (s) => {
      if (s <= 5) setStep(s)
    })
    setReport(r)
    setAuditing(false)
    onArchived?.(pushArchive(r, sourceText))
    requestAnimationFrame(() => reportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  async function handleAudit() {
    if (auditing) return
    // Assistant: there is a question but no answer yet — first "generate" the answer,
    // then send it (or the manuscript from the field) to the audit.
    if (tab === 'assistant' && question.trim() && !text.trim()) {
      const answer = assistantAnswer(question)
      setText(answer)
      await startAudit(answer)
      return
    }
    if (!text.trim()) return
    await startAudit(text)
  }

  const busy = auditing
  const canSubmit = !busy && (tab === 'paste' ? text.trim().length > 0 : Boolean(question.trim() || text.trim()))

  return (
    <section id="lab" className="max-w-6xl mx-auto px-4 md:px-6 py-12 scroll-mt-20">
      <div className="panel p-6 md:p-10">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="eyebrow">Laboratory No. 1</p>
            <h2 className="font-display text-4xl md:text-5xl text-cream mt-3">The Freshness Audit</h2>
            <p className="mt-4 max-w-xl text-cream-dim leading-relaxed">
              Paste an AI answer or ask our assistant a question — VERITAS will break the text into
              facts, gather evidence from the web, and return a verdict on every claim.
            </p>
          </div>
          <span
            className={`shrink-0 border px-3 py-2 text-[11px] tracking-[0.18em] uppercase ${
              mode === 'live' ? 'border-sage text-sage' : 'border-gold text-gold'
            }`}
          >
            Mode: {mode === 'live' ? 'Live Web' : 'Demo Archive'}
          </span>
        </div>

        <div className="rule my-8" />

        {/* Input mode tabs */}
        <div className="flex gap-3" role="tablist" aria-label="Input mode">
          <button
            role="tab"
            aria-selected={tab === 'paste'}
            onClick={() => setTab('paste')}
            className={`px-5 py-2.5 text-sm border transition-colors ${
              tab === 'paste'
                ? 'border-cream-dim text-cream bg-secondary'
                : 'border-border text-muted-foreground hover:text-cream'
            }`}
          >
            Paste an AI answer
          </button>
          <button
            role="tab"
            aria-selected={tab === 'assistant'}
            onClick={() => setTab('assistant')}
            className={`px-5 py-2.5 text-sm border transition-colors ${
              tab === 'assistant'
                ? 'border-cream-dim text-cream bg-secondary'
                : 'border-border text-muted-foreground hover:text-cream'
            }`}
          >
            Ask the assistant
          </button>
        </div>

        {tab === 'assistant' && (
          <div className="mt-6">
            <label htmlFor="question" className="eyebrow block mb-2.5">
              Your question to the assistant
            </label>
            <input
              id="question"
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. Which social network is the largest right now?"
              maxLength={300}
              className="w-full bg-olive-surface-2 border border-input px-4 py-3.5 text-sm text-cream outline-none focus:border-sage transition-colors"
            />
          </div>
        )}

        <div className="mt-6">
          <label htmlFor="manuscript" className="eyebrow block mb-2.5">
            {tab === 'assistant'
              ? 'Manuscript under audit (the assistant\u2019s answer — feel free to edit)'
              : 'Manuscript under audit'}
          </label>
          <textarea
            id="manuscript"
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_LEN))}
            placeholder="Paste any language model's answer here — with numbers, dates and rankings. The more specific the facts, the sharper the verdict."
            rows={7}
            className="w-full bg-olive-surface-2 border border-input px-4 py-3.5 text-sm leading-relaxed text-cream outline-none focus:border-sage transition-colors resize-y"
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="eyebrow">Samples:</span>
            {SAMPLES.map((s) => (
              <button
                key={s.label}
                onClick={() => setText(s.text)}
                className="px-3.5 py-2 text-xs border border-border text-cream-dim hover:text-cream hover:border-olive-line-strong transition-colors"
              >
                {s.label}
              </button>
            ))}
            <span className="ml-auto text-xs text-muted-foreground tabular-nums">
              {text.length} / {MAX_LEN}
            </span>
          </div>
        </div>

        <button
          onClick={handleAudit}
          disabled={!canSubmit}
          className={`mt-6 px-8 py-3.5 text-sm font-semibold tracking-wider uppercase transition-opacity ${
            canSubmit
              ? 'bg-primary text-primary-foreground hover:opacity-90'
              : 'bg-secondary text-muted-foreground cursor-not-allowed'
          }`}
        >
          {busy ? 'Auditing…' : tab === 'assistant' ? 'Ask & Audit' : 'Audit Freshness'}
        </button>

        {/* The audit ritual: five steps */}
        {auditing && (
          <div className="mt-8 panel bg-olive-surface-2 p-5" aria-live="polite">
            <ol className="space-y-3">
              {STEPS.map((label, i) => {
                const state = i < step ? 'done' : i === step ? 'active' : 'pending'
                return (
                  <li key={label} className="flex items-center gap-3 text-sm">
                    <StepIcon state={state} num={i + 1} />
                    <span className={state === 'done' ? 'text-cream-dim' : state === 'active' ? 'text-cream' : 'text-muted-foreground'}>
                      {label}
                    </span>
                  </li>
                )
              })}
            </ol>
          </div>
        )}
      </div>

      {/* Batch report */}
      {report && (
        <div ref={reportRef} className="mt-10 scroll-mt-20" aria-label="Freshness audit report">
          <Report report={report} />
        </div>
      )}
    </section>
  )
}
