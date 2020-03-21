const { webContents, ipcMain, ipcRenderer, remote } = require('electron')

const syncStateNotify = 'vuex-electron-sync-state-notify'
const mainGlobalStore = 'MAIN_GLOBAL_STORE'
const syncCurrentMutation = 'SYNC_CURRENT_MUTATION'

class VuexElectronSyncState {
  constructor (store) {
    this.store = store

    if (process.type === 'browser') {
      global[mainGlobalStore] = this.store
    } else if (process.type === 'renderer') {
      // sync main process state while renderer process launching
      const mainState = remote.getGlobal(mainGlobalStore).state
      this.store.replaceState(JSON.parse(JSON.stringify(mainState)))
    }

    if (process.type === 'browser' || process.type === 'renderer') {
      this.rewriteCommit()
      this.onNotify()
      this.subscribeMutations()
    }
  }

  rewriteCommit () {
    if (!this.store.originalCommit) {
      this.store.originalCommit = this.store.commit

      this.store.commit = function (_type, _payload, _options) {
        const res = this.originalCommit(_type, _payload, _options)
        let type
        let payload
        if (typeof _type === 'object' && _type.type) {
          type = _type.type
          payload = _type
        } else if (typeof _type === 'string' && _type) {
          type = _type
          payload = _payload
        } else {
          throw Error(`expects string as the type, but found ${typeof _type}.`)
        }
        if (this._mutations[type] && type !== syncCurrentMutation) {
          this.originalCommit(syncCurrentMutation, {
            type,
            payload
          })
        }
        return res
      }.bind(this.store)
      this.store.hotUpdate({
        mutations: {
          [syncCurrentMutation]: () => [] // add a customize mutation
        }
      }) // reload mutations and actions, apply rewritten commit
    }
  }

  onNotify () {
    const ipcType = process.type === 'renderer' ? ipcRenderer : ipcMain
    ipcType.on(syncStateNotify, (event, { type, payload }) => {
      if (typeof this.store.originalCommit === 'function') {
        this.store.originalCommit(type, payload)
      }
    })
  }

  subscribeMutations () {
    this.store.subscribe((mutation) => {
      if (mutation.type === syncCurrentMutation) {
        // current process just ran rewritten commit, notify other process to run original commit
        if (process.type === 'renderer') {
          const currentWebcontents = remote.getCurrentWebContents()
          ipcRenderer.send(syncStateNotify, mutation.payload) // notify main process
          remote.webContents.getAllWebContents().forEach((item) => {
            if (item !== currentWebcontents) {
              item.send(syncStateNotify, mutation.payload) // notify other renderer process
            }
          })
        } else if (process.type === 'browser') {
          webContents.getAllWebContents().forEach((item) => {
            item.send(syncStateNotify, mutation.payload) // notify all renderer process
          })
        }
      }
    })
  }
}

module.exports = (store) => {
  // eslint-disable-next-line no-new
  new VuexElectronSyncState(store)
}
