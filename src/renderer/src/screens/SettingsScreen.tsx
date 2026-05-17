import React, { useEffect, useState } from 'react'
import type { AppConfig, SensitiveConfig } from '../../../shared/types'

interface SettingsScreenProps {
  config: AppConfig
  onSaved: (config: AppConfig) => void
  onBack: () => void
}

type DeviceFlowState =
  | { step: 'idle' }
  | { step: 'pending'; userCode: string; verificationUri: string; deviceCode: string; interval: number }
  | { step: 'polling' }
  | { step: 'done' }
  | { step: 'error'; message: string }

export default function SettingsScreen({ config, onSaved, onBack }: SettingsScreenProps): React.ReactElement {
  const [form, setForm] = useState<AppConfig>(structuredClone(config))
  const [secrets, setSecrets] = useState<Partial<SensitiveConfig>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveOk, setSaveOk] = useState(false)
  const [deviceFlow, setDeviceFlow] = useState<DeviceFlowState>({ step: 'idle' })

  // Reset form when config prop changes
  useEffect(() => {
    setForm(structuredClone(config))
  }, [config])

  function setGitHub<K extends keyof AppConfig['github']>(key: K, value: AppConfig['github'][K]): void {
    setForm((prev) => ({ ...prev, github: { ...prev.github, [key]: value } }))
  }
  function setAzure<K extends keyof AppConfig['azure']>(key: K, value: AppConfig['azure'][K]): void {
    setForm((prev) => ({ ...prev, azure: { ...prev.azure, [key]: value } }))
  }

  async function startDeviceFlow(): Promise<void> {
    const clientId = form.github.clientId.trim()
    if (!clientId) {
      setDeviceFlow({ step: 'error', message: 'Enter your GitHub OAuth App Client ID first.' })
      return
    }
    setDeviceFlow({ step: 'idle' })
    const result = await window.api.github.startDeviceFlow(clientId)
    if (!result.ok) {
      setDeviceFlow({ step: 'error', message: result.error })
      return
    }
    const { device_code, user_code, verification_uri, interval } = result.data
    setDeviceFlow({ step: 'pending', userCode: user_code, verificationUri: verification_uri, deviceCode: device_code, interval })
    await window.api.github.openDeviceUrl(verification_uri)
    // Begin polling
    pollForToken(clientId, device_code, interval)
  }

  function pollForToken(clientId: string, deviceCode: string, intervalSec: number): void {
    setDeviceFlow((prev) => ({ ...prev, step: 'polling' } as DeviceFlowState))
    const deadline = Date.now() + 5 * 60 * 1000 // 5-minute timeout
    let currentIntervalMs = (intervalSec || 5) * 1000

    function next(): void {
      setTimeout(async () => {
        if (Date.now() > deadline) {
          setDeviceFlow({ step: 'error', message: 'Login timed out. Please try again.' })
          return
        }
        try {
          const result = await window.api.github.pollDeviceToken(clientId, deviceCode)
          if (!result.ok) {
            setDeviceFlow({ step: 'error', message: result.error })
            return
          }
          const { access_token, error, interval } = result.data
          if (access_token) {
            setSecrets((prev) => ({ ...prev, githubToken: access_token }))
            setDeviceFlow({ step: 'done' })
          } else if (error === 'slow_down') {
            // GitHub requires a longer interval; honour it
            currentIntervalMs = (interval ?? currentIntervalMs / 1000 + 5) * 1000
            next()
          } else if (error === 'access_denied' || error === 'expired_token') {
            setDeviceFlow({ step: 'error', message: `GitHub: ${error}` })
          } else {
            // authorization_pending → keep polling at current interval
            next()
          }
        } catch (e) {
          console.error('[pollDeviceToken] error:', e)
          setDeviceFlow({ step: 'error', message: e instanceof Error ? e.message : 'Polling error' })
        }
      }, currentIntervalMs)
    }

    next()
  }

  async function handleSave(): Promise<void> {
    setIsSaving(true)
    setSaveError('')
    setSaveOk(false)
    try {
      const result = await window.api.config.set(form, secrets)
      if (result.ok) {
        setSaveOk(true)
        setTimeout(() => setSaveOk(false), 2500)
        onSaved(form)
      } else {
        setSaveError(result.error)
      }
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="settings-screen">
      <div className="settings-header">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
          ← Back
        </button>
        <h1 className="settings-title">Settings</h1>
      </div>

      <div className="settings-body">

        {/* ── General ───────────────────────────────── */}
        <section className="settings-section">
          <h2>General</h2>
          <div className="field">
            <label>Default author name</label>
            <input
              type="text"
              value={form.author}
              onChange={(e) => setForm((p) => ({ ...p, author: e.target.value }))}
              placeholder="Your name"
            />
          </div>
        </section>

        <hr />

        {/* ── GitHub ────────────────────────────────── */}
        <section className="settings-section">
          <h2>GitHub</h2>
          <div className="settings-grid-2">
            <div className="field">
              <label>Repository</label>
              <input
                type="text"
                value={form.github.repo}
                onChange={(e) => setGitHub('repo', e.target.value)}
                placeholder="owner/repo"
              />
            </div>
            <div className="field">
              <label>Branch</label>
              <input
                type="text"
                value={form.github.branch}
                onChange={(e) => setGitHub('branch', e.target.value)}
                placeholder="main"
              />
            </div>
          </div>
          <div className="field" style={{ marginTop: 12 }}>
            <label>GitHub OAuth App — Client ID</label>
            <input
              type="text"
              value={form.github.clientId}
              onChange={(e) => setGitHub('clientId', e.target.value)}
              placeholder="Ov23li…"
            />
            <span className="field-hint">
              Create a GitHub OAuth App at{' '}
              <em>github.com → Settings → Developer settings → OAuth Apps</em>.
              Set the callback URL to <code>http://localhost</code> (Device Flow doesn't use it).
            </span>
          </div>

          {/* Device flow */}
          <div className="device-flow-box">
            {deviceFlow.step === 'idle' && (
              <button type="button" className="btn" onClick={startDeviceFlow}>
                Connect GitHub Account
              </button>
            )}
            {deviceFlow.step === 'pending' && (
              <div className="banner banner-info">
                <p>
                  <strong>1.</strong> Your browser should have opened{' '}
                  <strong>{deviceFlow.verificationUri}</strong>.
                </p>
                <p>
                  <strong>2.</strong> Enter this code:{' '}
                  <code className="device-code">{deviceFlow.userCode}</code>
                </p>
                <p>Waiting for you to authorize…</p>
              </div>
            )}
            {deviceFlow.step === 'polling' && (
              <div className="banner banner-info" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="spinner" />
                Waiting for GitHub authorization…
              </div>
            )}
            {deviceFlow.step === 'done' && (
              <div className="banner banner-success">
                ✓ GitHub connected! Remember to save settings below.
              </div>
            )}
            {deviceFlow.step === 'error' && (
              <div className="banner banner-error">
                {deviceFlow.message}
                <button
                  type="button"
                  style={{ marginLeft: 12 }}
                  className="btn btn-sm"
                  onClick={() => setDeviceFlow({ step: 'idle' })}
                >
                  Retry
                </button>
              </div>
            )}
          </div>
        </section>

        <hr />

        {/* ── Azure Storage ─────────────────────────── */}
        <section className="settings-section">
          <h2>Azure Blob Storage</h2>
          <div className="field">
            <label>Connection string</label>
            <input
              type="password"
              value={secrets.azureConnectionString ?? ''}
              onChange={(e) => setSecrets((p) => ({ ...p, azureConnectionString: e.target.value }))}
              placeholder="DefaultEndpointsProtocol=https;AccountName=…"
              autoComplete="off"
            />
            <span className="field-hint">Stored encrypted on disk. Leave blank to keep existing value.</span>
          </div>
          <div className="field" style={{ marginTop: 12 }}>
            <label>Container name</label>
            <input
              type="text"
              value={form.azure.container}
              onChange={(e) => setAzure('container', e.target.value)}
              placeholder="blog-images"
            />
            <span className="field-hint">
              The container must have <strong>Blob</strong> public read access so image URLs are embeddable.
            </span>
          </div>
        </section>

        <hr />

        {/* ── OpenAI ────────────────────────────────── */}
        <section className="settings-section">
          <h2>OpenAI (tag suggestions)</h2>
          <div className="field">
            <label>API key</label>
            <input
              type="password"
              value={secrets.openaiApiKey ?? ''}
              onChange={(e) => setSecrets((p) => ({ ...p, openaiApiKey: e.target.value }))}
              placeholder="sk-…"
              autoComplete="off"
            />
            <span className="field-hint">Stored encrypted on disk. Leave blank to keep existing value.</span>
          </div>
        </section>

        <hr />

        {/* Save bar */}
        <div className="settings-save-bar">
          {saveError && <span className="save-error-msg">{saveError}</span>}
          {saveOk && <span className="save-success-msg">✓ Settings saved</span>}
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? <><span className="spinner" /> Saving…</> : 'Save Settings'}
          </button>
        </div>

      </div>
    </div>
  )
}
