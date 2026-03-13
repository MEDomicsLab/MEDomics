const { fork } = require('child_process')
const path = require('path')
const axios = require('axios')

const backend = path.join(__dirname, '..', 'backend', 'expressServer.mjs')
console.log('Forking backend:', backend)
const child = fork(backend, { silent: true })
child.on('message', async (msg) => {
  console.log('Parent received message from backend:', msg)
  if (msg && msg.type === 'EXPRESS_PORT') {
    const port = msg.expressPort
    try {
      const res = await axios.get(`http://localhost:${port}/check-requirements`)
      console.log('check-requirements response:', res.data)
    } catch (err) {
      console.error('error calling check-requirements:', err.message)
    } finally {
      child.kill()
    }
  }
})

child.on('exit', (code) => console.log('Child exited', code))
child.on('error', (err) => console.error('Child error', err))
