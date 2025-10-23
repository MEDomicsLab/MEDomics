const axios = require('axios')
axios.get('http://localhost:3000/check-requirements').then(res => {
  console.log('check-requirements response:', res.data)
}).catch(err => {
  console.error('error calling check-requirements:', err.message)
})
