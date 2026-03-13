// small helper to fork the backend and listen for EXPRESS_PORT message
const { fork } = require('child_process')
const path = require('path')

const backend = path.join(__dirname, '..', 'backend', 'expressServer.mjs')
console.log('Forking backend:', backend)
const child = fork(backend, { silent: false })
child.on('message', (msg) => {
  console.log('Parent received message from backend:', msg)
})
child.on('exit', (code) => console.log('Child exited', code))
child.on('error', (err) => console.error('Child error', err))
