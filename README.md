# vuex-electron-sync-state

Vuex plugin for synchronizing the vuex state in each electron process.

## Usage
```javascript
// src/renderer/store/index.js
import Vuex from 'vuex'
import syncStatePlugin from 'vuex-electron-sync-state'

const store = Vuex.Store({})

export default new Vuex.Store({
  state: {},
  mutations: {},
  actions: {},
  plugins: [
    syncStatePlugin
  ]
})
```

And you should import the store entry in main process.
```javascript
// src/main/main.js
import store from '../renderer/store/index'

...
```

## Notice

The actions logic will be executed in the dispatched process. The mutations logic will be executed in all process.

So you need to pay attention to which process the code logic will be executed in.

