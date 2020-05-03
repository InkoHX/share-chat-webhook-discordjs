const asserts = require('assert')
const dataStore = require('../store')

describe('store.js', () => {
  describe('直列', () => {
    const storeAsync = dataStore('./testStore/series.json', { apple: 0, banana: 0 })

    it('書き込み', async () => {
      const store = await storeAsync

      store.apple = 3
      store.banana = 2
    })

    it('読み込み', async () => {
      const store = await storeAsync

      asserts.strictEqual(store.apple, 3)
      asserts.strictEqual(store.banana, 2)
    })
  })

  describe('並列', async () => {
    const storeAsync = dataStore('./testStore/parallel.json', { apples: [], bananas: [] })

    const apples = [
      {
        name: '青森のおいしいりんご',
        quality: 10
      },
      {
        name: '山形のおいしいりんご',
        quality: 10
      },
      {
        name: 'りんごろう',
        quality: 0
      }
    ]

    const bananas = [
      {
        name: 'フィリピンのおいしいバナナ',
        quality: 10
      },
      {
        name: '道に落ちてたバナナ',
        quality: 5
      },
      {
        name: 'あたまの悪い人のバナナ',
        quality: 0
      }
    ]

    it('書き込み', async () => {
      const store = await storeAsync

      return Promise.all(apples.map(value => store.apples.push(value)))
        .then(() => Promise.all(bananas.map(value => store.bananas.push(value))))
    })

    it('読み込み', async () => {
      const store = await storeAsync

      asserts.deepStrictEqual(store.apples, apples)
      asserts.deepStrictEqual(store.bananas, bananas)
    })
  })
})