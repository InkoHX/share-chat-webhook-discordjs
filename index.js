const Discord = require('discord.js')
const DeepProxy = require('proxy-deep')
const fs = require('fs/promises')
const mkdirp = require('mkdirp')
const { dirname } = require('path')
const client = new Discord.Client()

/**
 * data store
 * @param {string} path
 * @param {object} _default
 *
 * @see {@link https://scrapbox.io/discordjs-japan/更新したら自動で保存されるオブジェクトのサンプル|Scrapbox}
 */
const dataStore = async (path, _default = {}) => {
  const data = await fs
    .readFile(path)
    .then(file => JSON.parse(file))
    .catch(async () => {
      await mkdirp(dirname(path))
      await fs.writeFile(path, JSON.stringify(_default, null, 2))
      return _default
    })

  return new DeepProxy(data, {
    get (target, key, receiver) {
      const val = Reflect.get(target, key, receiver)
      if (typeof val === 'object' && val !== null) {
        return this.nest(val)
      } else {
        return val
      }
    },
    set (target, key, value, receiver) {
      Reflect.set(target, key, value, receiver)
      fs.writeFile(path, JSON.stringify(this.rootTarget, null, 2))
      return true
    }
  })
}

/**
 * @type {Promise<{ webhooks: { channelId: string, webhookId: string }[]}>}
 */
const storeAsync = dataStore('./data.json', { webhooks: [] })

client.once('ready', () => console.log('Ready!'))

client.on('message', message => {
  if (message.author.bot || message.system) return
  if (message.guild && !message.guild.available) return

  if (message.content.startsWith('!addShareChannel')) return addShareChannel(message).catch(console.error)
  if (message.content.startsWith('!removeShareChannel')) return removeShareChannel(message).catch(console.error)

  return handleMessage(message)
    .catch(console.error)
})

const requireBotPermissions = ['MANAGE_WEBHOOKS', 'MANAGE_MESSAGES']
const missingBotPermissionsMessage = `ボットがこのコマンドの処理を行うためには、**${requireBotPermissions.join(', ')}**権限が必要です。`

const requireMemberPermissions = ['MANAGE_GUILD', 'MANAGE_WEBHOOKS']
const missingMemberPermissionsMessage = `あなたがこのコマンドを使用するには、**${requireMemberPermissions.join(', ')}**権限を持っている必要があります。`

const noChannelMentionMessage = 'チャンネルをメンションしてメッセージを送信してね。'

/**
 * @param {Discord.Message} message
 */
async function addShareChannel (message) {
  const member = message.member
  const channels = message.mentions.channels

  if (!member.hasPermission(requireMemberPermissions)) return message.reply(missingMemberPermissionsMessage)
  if (!message.guild.me.hasPermission(requireBotPermissions)) return message.reply(missingBotPermissionsMessage)
  if (!channels.size) return message.reply(noChannelMentionMessage)

  const store = await storeAsync.then(value => value.webhooks)

  return Promise.all(channels.map(channel => channel.fetchWebhooks()))
    .then(webhooks => webhooks.map(webhooks => webhooks.map(webhook => webhook.channelID)))
    .then(channelIds => channelIds.reduce((previousValue, currentValue) => previousValue.concat(currentValue), []))
    .then(channelIds => channelIds.filter(channelId => store.some(value => value.channelId !== channelId)))
    .then(channelIds => channels.filter(channel => !channelIds.includes(channel.id)))
    .then(channels => Promise.all(channels.map(channel => channel.createWebhook('Share Chat'))))
    .then(webhooks => webhooks.map(webhook => store.push({ webhookId: webhook.id, channelId: webhook.channelID })))
    .then(indexNumbers => message.reply(`${indexNumbers.length}個のチャンネルを共有化しました。`))
}

/**
 * @param {Discord.Message} message
 */
async function removeShareChannel (message) {
  const member = message.member
  const channels = message.mentions.channels

  if (!member.hasPermission(requireMemberPermissions)) return message.reply(missingMemberPermissionsMessage)
  if (!message.guild.me.hasPermission(requireBotPermissions)) return message.reply(missingBotPermissionsMessage)
  if (!channels.size) return message.reply(noChannelMentionMessage)

  const store = await storeAsync
  const deleteWebhookIds = []

  const deleteWebhook = webhook => {
    deleteWebhookIds.push(webhook.id)

    return webhook.delete()
  }

  return Promise.all(channels.map(channel => channel.fetchWebhooks()))
    .then(webhooks => webhooks.map(webhooks => webhooks.map(webhook => webhook)))
    .then(webhooks => webhooks.reduce((previousValue, currentValue) => previousValue.concat(currentValue), []))
    .then(webhooks => webhooks.filter(webhook => store.webhooks.some(value => value.webhookId === webhook.id)))
    .then(webhooks => webhooks.filter(webhook => channels.has(webhook.channelID)))
    .then(webhooks => Promise.all(webhooks.map(webhook => deleteWebhook(webhook))))
    .then(() => { store.webhooks = store.webhooks.filter(value => !deleteWebhookIds.includes(value.webhookId)) })
    .then(() => message.reply(`${deleteWebhookIds.length}個のチャンネルの共有化を解除しました。`))
}

/**
 * @param {Discord.Message} message
 */
async function handleMessage (message) {
  const store = await storeAsync.then(value => value.webhooks)

  if (!store.find(value => value.channelId === message.channel.id)) return

  const messageOptions = {
    username: message.author.username,
    avatarURL: message.author.displayAvatarURL({ format: 'png', size: 512 }),
    files: message.attachments.map(attachment => attachment.url)
  }

  return Promise.all(store.map(value => client.channels.fetch(value.channelId)))
    .then(channels => channels.filter(channel => channel.type === 'text' && !channel.deleted))
    .then(channels => Promise.all(channels.map(channel => channel.fetchWebhooks())))
    .then(webhooks => webhooks.map(webhooks => webhooks.map(webhook => webhook)))
    .then(webhooks => webhooks.reduce((previousValue, currentValue) => previousValue.concat(currentValue), []))
    .then(webhooks => webhooks.filter(webhook => store.some(value => value.webhookId === webhook.id)))
    .then(webhooks => Promise.all(webhooks.map(webhook => webhook.send(message.cleanContent, messageOptions))))
    .then(() => message.delete())
}

client.login().catch(console.error)
