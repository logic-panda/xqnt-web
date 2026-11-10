import assert from 'node:assert/strict'
import test from 'node:test'

import { isAlertNotice } from '../../src/utils/noticeFormat.js'

test('signals, price alerts and the profile test trigger the in-app alert', () => {
  assert.equal(isAlertNotice({ signal_type: 'open_long', payload: { event: 'qd.signal' } }), true)
  assert.equal(isAlertNotice({ signal_type: 'indicator_signal', payload: {} }), true)
  assert.equal(isAlertNotice({ signal_type: 'price_alert', payload: {} }), true)
  assert.equal(isAlertNotice({ signal_type: 'profile_test', payload: {} }), true)
  assert.equal(isAlertNotice({ payload: { display: { template: 'signal.trade', params: {} } } }), true)
})

test('reports and login notices stay silent', () => {
  assert.equal(isAlertNotice({ signal_type: 'security_login', payload: { event: 'security.login' } }), false)
  assert.equal(isAlertNotice({ signal_type: 'ai_monitor', payload: {} }), false)
  assert.equal(isAlertNotice(null), false)
})

test('alert sound repeats for the requested seconds and stops on demand', async () => {
  const beeps = []
  let stopped = 0
  let unlock = null
  const param = record => ({
    value: 0,
    setValueAtTime: (value, at) => record && beeps.push([value, at]),
    linearRampToValueAtTime: () => {}
  })
  class FakeAudioContext {
    constructor () {
      this.state = 'suspended'
      this.currentTime = 10
      this.destination = {}
    }

    resume () {
      this.state = 'running'
      return Promise.resolve()
    }

    createGain () {
      return { gain: param(false), connect () {}, disconnect () {} }
    }

    createOscillator () {
      return { frequency: param(true), connect () {}, start () {}, stop: () => { stopped += 1 } }
    }
  }
  globalThis.window = {
    AudioContext: FakeAudioContext,
    addEventListener: (type, handler) => { unlock = handler }
  }
  const { armAlertSound, playAlertSound, stopAlertSound } = await import('../../src/utils/alertSound.js')

  armAlertSound()
  assert.equal(playAlertSound(), false, 'blocked until the user interacts with the page')
  unlock()

  assert.equal(playAlertSound(3), true)
  const times = beeps.map(([, at]) => at)
  assert.equal(beeps.length, 12, 'two tones every half second for three seconds')
  assert.ok(Math.min(...times) >= 10 && Math.max(...times) < 13.05)

  stopAlertSound()
  // One scheduled stop at the end of the pattern plus the early stop.
  assert.equal(stopped, 2)
  stopAlertSound()
  assert.equal(stopped, 2)
})
