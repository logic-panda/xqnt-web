<template>
  <div class="telegram-connect">
    <a-button :type="value ? 'default' : 'primary'" icon="send" :loading="waiting" @click="connect">
      {{ value ? $t('telegramConnect.reconnect') : $t('telegramConnect.connect') }}
    </a-button>
    <span v-if="waiting" class="telegram-connect__status">
      {{ $t('telegramConnect.waiting') }}
      <a :href="url" target="_blank" rel="noopener noreferrer">{{ $t('telegramConnect.open') }}</a>
    </span>
    <span v-else-if="value" class="telegram-connect__status telegram-connect__status--ok">
      <a-icon type="check-circle" /> {{ $t('telegramConnect.connected') }}
    </span>
    <span v-else class="telegram-connect__status">{{ $t('telegramConnect.hint') }}</span>
  </div>
</template>

<script>
import { startTelegramLink, getTelegramLinkStatus } from '@/api/user'

const POLL_MS = 2500

// Binds the user's Telegram chat to the platform bot: opens t.me/<bot>?start=<code>, then polls
// until the backend sees that /start and returns the chat id. Works with v-model and v-decorator.
export default {
  name: 'TelegramConnect',
  model: { prop: 'value', event: 'change' },
  props: { value: { type: String, default: '' } },
  data () {
    return { waiting: false, url: '', timer: null }
  },
  beforeDestroy () {
    clearTimeout(this.timer)
  },
  methods: {
    async connect () {
      // Open the tab inside the click so popup blockers allow it; it is pointed at the bot below.
      const tab = window.open('', '_blank')
      try {
        const res = await startTelegramLink()
        if (res.code !== 1) throw new Error(res.msg)
        this.url = res.data.url
        if (tab) tab.location.href = this.url
        this.waiting = true
        this.poll(res.data.code, Date.now() + res.data.expires_in * 1000)
      } catch (e) {
        if (tab) tab.close()
        this.fail(e)
      }
    },
    poll (code, deadline) {
      this.timer = setTimeout(async () => {
        if (Date.now() > deadline) return this.fail(new Error(this.$t('telegramConnect.expired')))
        try {
          const res = await getTelegramLinkStatus(code)
          if (res.code !== 1) throw new Error(res.msg)
          if (!res.data.linked) return this.poll(code, deadline)
          this.waiting = false
          this.$emit('change', res.data.chat_id)
          this.$message.success(this.$t('telegramConnect.success'))
        } catch (e) {
          this.fail(e)
        }
      }, POLL_MS)
    },
    fail (e) {
      this.waiting = false
      const msg = (e && e.response && e.response.data && e.response.data.msg) || (e && e.message)
      this.$message.error(msg || this.$t('telegramConnect.failed'))
    }
  }
}
</script>

<style lang="less" scoped>
.telegram-connect {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;

  &__status {
    color: rgba(0, 0, 0, 0.45);
    font-size: 12px;
  }

  &__status--ok {
    color: #52c41a;
  }
}
</style>
